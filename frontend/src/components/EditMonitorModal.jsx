import { useState } from 'react';
import { updateMonitor, testWebhook } from '../api/client.js';
import ServerSetupGuide from './ServerSetupGuide.jsx';
import ApiConfigForm from './ApiConfigForm.jsx';

/** Convert stored headers object → [{key,value}] array for the form. */
function headersObjectToArray(obj) {
    if (!obj || typeof obj !== 'object') return [];
    return Object.entries(obj).map(([key, value]) => ({ key, value: String(value) }));
}

/** Convert [{key,value}] → plain object, skipping empty keys. */
function headersArrayToObject(arr) {
    const obj = {};
    for (const { key, value } of arr) {
        if (key.trim()) obj[key.trim()] = value;
    }
    return Object.keys(obj).length ? obj : null;
}

/**
 * EditMonitorModal – edit all fields of an existing monitor.
 * Props:
 *   monitor  – the monitor object (from getMonitors(), snake_case from raw SQL)
 *   onClose  – close without saving
 *   onSaved  – called after successful save
 */
export default function EditMonitorModal({ monitor, onClose, onSaved }) {
    const [name, setName] = useState(monitor.name || '');
    const [url, setUrl] = useState(monitor.url || '');
    const [type, setType] = useState(monitor.type || 'web');
    const [interval, setInterval] = useState(String(monitor.interval_seconds || 60));
    const [isActive, setIsActive] = useState(monitor.is_active !== false);
    const [webhookUrl, setWebhookUrl] = useState(monitor.webhook_url || '');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [webhookStatus, setWebhookStatus] = useState('');
    // Local token state so regeneration updates the guide without closing the modal
    const [token, setToken] = useState(monitor.secret_token || '');

    // API-type config fields (initialise from stored monitor data)
    const [apiMethod, setApiMethod] = useState(monitor.method || 'GET');
    const [apiHeaders, setApiHeaders] = useState(() => headersObjectToArray(monitor.request_headers));
    const [apiRequestBody, setApiRequestBody] = useState(monitor.request_body || '');
    const [apiExpectedStatusCodes, setApiExpectedStatusCodes] = useState(monitor.expected_status_codes || '');
    const [apiAssertJsonPath, setApiAssertJsonPath] = useState(monitor.assert_json_path || '');
    const [apiAssertJsonValue, setApiAssertJsonValue] = useState(monitor.assert_json_value || '');

    const isServer = type === 'server';
    const isApi = type === 'api';

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const payload = {
                name,
                url,
                type,
                interval_seconds: parseInt(interval, 10),
                is_active: isActive,
                webhook_url: webhookUrl || null,
            };
            if (isApi) {
                payload.method = apiMethod;
                payload.request_headers = headersArrayToObject(apiHeaders);
                payload.request_body = apiRequestBody || null;
                payload.expected_status_codes = apiExpectedStatusCodes || null;
                payload.assert_json_path = apiAssertJsonPath || null;
                payload.assert_json_value = apiAssertJsonValue || null;
            }
            await updateMonitor(monitor.id, payload);
            onSaved();
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

    const toggleStyle = {
        background: isActive ? '#22c55e22' : '#ef444422',
        border: `1px solid ${isActive ? '#22c55e' : '#ef4444'}`,
        color: isActive ? '#22c55e' : '#ef4444',
    };

    return (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="modal">
                <h2 className="modal-title">Edit Monitor</h2>
                <form onSubmit={handleSubmit}>
                    <label className="form-label">Name</label>
                    <input
                        className="form-input" type="text" value={name} required
                        onChange={(e) => setName(e.target.value)}
                    />

                    <label className="form-label">
                        {isServer ? 'Server address' : 'URL'}
                        {isServer && <span className="form-label-hint"> (label only)</span>}
                    </label>
                    <input
                        className="form-input"
                        type={isServer ? 'text' : 'url'}
                        value={url}
                        required
                        placeholder={isServer ? '192.168.1.100 or my-server.example.com' : 'https://example.com'}
                        onChange={(e) => setUrl(e.target.value)}
                    />

                    <label className="form-label">Type</label>
                    <select className="form-input" value={type} onChange={(e) => setType(e.target.value)}>
                        <option value="web">Web / HTTP</option>
                        <option value="api">API</option>
                        <option value="service">Service</option>
                        <option value="server">Server (agent-based)</option>
                        <option value="other">Other</option>
                    </select>

                    <label className="form-label">Check Interval</label>
                    <select className="form-input" value={interval} onChange={(e) => setInterval(e.target.value)}>
                        <option value="30">Every 30 seconds</option>
                        <option value="60">Every 60 seconds</option>
                        <option value="300">Every 5 minutes</option>
                        <option value="600">Every 10 minutes</option>
                    </select>

                    <label className="form-label">Status</label>
                    <div className="status-toggle-row">
                        <button type="button" className="toggle-btn" style={toggleStyle} onClick={() => setIsActive((v) => !v)}>
                            {isActive ? 'Active – click to pause' : 'Paused – click to activate'}
                        </button>
                    </div>

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
                            {loading ? 'Saving…' : 'Save Changes'}
                        </button>
                    </div>
                </form>

                {isServer && (
                    <ServerSetupGuide
                        token={token}
                        monitorId={monitor.id}
                        interval={parseInt(interval, 10)}
                        onTokenChanged={(newToken) => setToken(newToken)}
                    />
                )}
            </div>
        </div>
    );
}
