import { useState } from 'react';
import { createMonitor, testWebhook } from '../api/client.js';
import ServerSetupGuide from './ServerSetupGuide.jsx';
import ApiConfigForm from './ApiConfigForm.jsx';

/** Convert a headers array [{key,value}] to a plain object, skipping empty keys. */
function headersArrayToObject(arr) {
  const obj = {};
  for (const { key, value } of arr) {
    if (key.trim()) obj[key.trim()] = value;
  }
  return Object.keys(obj).length ? obj : null;
}

export default function AddMonitorModal({ onClose, onCreated }) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [type, setType] = useState('web');
  const [interval, setInterval] = useState('60');
  const [description, setDescription] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [webhookStatus, setWebhookStatus] = useState('');
  // Step 2 for server type: show setup guide after creation
  const [createdMonitor, setCreatedMonitor] = useState(null);

  // API-type config fields
  const [apiMethod, setApiMethod] = useState('GET');
  const [apiHeaders, setApiHeaders] = useState([]);
  const [apiRequestBody, setApiRequestBody] = useState('');
  const [apiExpectedStatusCodes, setApiExpectedStatusCodes] = useState('');
  const [apiAssertJsonPath, setApiAssertJsonPath] = useState('');
  const [apiAssertJsonValue, setApiAssertJsonValue] = useState('');

  const isServer = type === 'server';
  const isApi = type === 'api';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload = {
        name,
        url: url || `server://${name.toLowerCase().replace(/\s+/g, '-')}`,
        type,
        interval_seconds: parseInt(interval, 10),
        webhook_url: webhookUrl || undefined,
        description: description || undefined,
      };
      if (isApi) {
        payload.method = apiMethod;
        payload.request_headers = headersArrayToObject(apiHeaders);
        payload.request_body = apiRequestBody || null;
        payload.expected_status_codes = apiExpectedStatusCodes || null;
        payload.assert_json_path = apiAssertJsonPath || null;
        payload.assert_json_value = apiAssertJsonValue || null;
      }
      const monitor = await createMonitor(payload);
      if (isServer) {
        // For server monitors, stay open to show the setup guide
        setCreatedMonitor(monitor);
      } else {
        onCreated();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTestWebhook = async () => {
    if (!webhookUrl) return;
    setWebhookStatus('Sending…');
    try {
      await testWebhook(webhookUrl);
      setWebhookStatus('✓ Test sent successfully');
    } catch (err) {
      setWebhookStatus(`✗ ${err.message}`);
    }
  };

  const webhookStatusColor = webhookStatus.startsWith('✓') ? '#22c55e'
    : webhookStatus.startsWith('✗') ? '#ef4444'
      : '#94a3b8';

  // ── Step 2: Setup guide (server monitors only) ────────────────────────────
  if (createdMonitor) {
    return (
      <div className="overlay" onClick={(e) => e.target === e.currentTarget && onCreated()}>
        <div className="modal">
          <h2 className="modal-title">Monitor created!</h2>
          <div className="info-box">
            <strong>{createdMonitor.name}</strong> has been added. Follow the steps below to install the
            agent on your server — it will start reporting heartbeats right away.
          </div>
          <ServerSetupGuide
            token={createdMonitor.secretToken || createdMonitor.secret_token}
            monitorId={createdMonitor.id}
            interval={createdMonitor.intervalSeconds || createdMonitor.interval_seconds || 60}
          />
          <div className="form-btn-row">
            <button className="btn btn-primary" onClick={() => onCreated()}>Done</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Step 1: Form ──────────────────────────────────────────────────────────
  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h2 className="modal-title">Add Monitor</h2>
        <form onSubmit={handleSubmit}>
          <label className="form-label">Name</label>
          <input
            className="form-input" type="text" value={name} required
            placeholder={isServer ? 'My Production Server' : 'My Website'}
            onChange={(e) => setName(e.target.value)}
          />

          <label className="form-label">Type</label>
          <select className="form-input" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="web">Web / HTTP</option>
            <option value="api">API</option>
            <option value="service" disabled>Service (WIP)</option>
            <option value="server">Server (agent-based)</option>
            <option value="other" disabled>Other (WIP)</option>
          </select>

          {isServer ? (
            <>
              <label className="form-label">
                Server address <span className="form-label-hint">(hostname or IP, shown as label only)</span>
              </label>
              <input
                className="form-input" type="text" value={url}
                placeholder="192.168.1.100 or my-server.example.com"
                onChange={(e) => setUrl(e.target.value)}
              />
              <div className="info-box" style={{ marginBottom: '1rem' }}>
                <strong>How it works:</strong> after creating this monitor you&apos;ll receive a unique
                heartbeat URL. Install the agent on your server — it sends CPU, memory and disk metrics
                every <strong>{interval}s</strong>. No open ports needed.
              </div>
            </>
          ) : (
            <>
              <label className="form-label">URL</label>
              <input
                className="form-input" type="url" value={url} required
                placeholder="https://example.com"
                onChange={(e) => setUrl(e.target.value)}
              />
            </>
          )}

          {isApi && (
            <ApiConfigForm
              method={apiMethod} setMethod={setApiMethod}
              headers={apiHeaders} setHeaders={setApiHeaders}
              requestBody={apiRequestBody} setRequestBody={setApiRequestBody}
              expectedStatusCodes={apiExpectedStatusCodes} setExpectedStatusCodes={setApiExpectedStatusCodes}
              assertJsonPath={apiAssertJsonPath} setAssertJsonPath={setApiAssertJsonPath}
              assertJsonValue={apiAssertJsonValue} setAssertJsonValue={setApiAssertJsonValue}
            />
          )}

          <label className="form-label">Check Interval</label>
          <select className="form-input" value={interval} onChange={(e) => setInterval(e.target.value)}>
            <option value="30">Every 30 seconds</option>
            <option value="60">Every 60 seconds</option>
            <option value="300">Every 5 minutes</option>
            <option value="600">Every 10 minutes</option>
          </select>

          <label className="form-label">Description <span className="form-label-hint">(optional)</span></label>
          <textarea
            className="form-input form-textarea" value={description} rows={2}
            placeholder="Short description shown on the status page…"
            onChange={(e) => setDescription(e.target.value)}
          />

          <label className="form-label">Webhook URL <span className="form-label-hint">(optional)</span></label>
          <input
            className="form-input" type="url" value={webhookUrl}
            placeholder="https://hooks.example.com/notify"
            onChange={(e) => { setWebhookUrl(e.target.value); setWebhookStatus(''); }}
          />
          {webhookUrl && (
            <div className="webhook-test-row">
              <button type="button" className="btn-test" onClick={handleTestWebhook}>
                Send test
              </button>
              {webhookStatus && (
                <span className="webhook-status" style={{ color: webhookStatusColor }}>
                  {webhookStatus}
                </span>
              )}
            </div>
          )}

          {error && <p className="error-msg">{error}</p>}
          <div className="form-btn-row">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Adding…' : isServer ? 'Add & Get Setup Guide →' : 'Add Monitor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

