import { useState, useEffect } from 'react';
import { updateMonitor, testWebhook, getUsers, getMonitorAccess, setMonitorAccess } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
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
    const [description, setDescription] = useState(monitor.description || '');
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

    const { user: currentUser } = useAuth();
    const isAdmin = currentUser?.role === 'admin';

    // Access management (admin only)
    const [userList, setUserList] = useState([]);       // users with role='user'
    const [accessIds, setAccessIds] = useState(new Set());
    const [accessLoading, setAccessLoading] = useState(false);
    const [accessSaving, setAccessSaving] = useState(false);
    const [accessError, setAccessError] = useState('');
    const [accessSaved, setAccessSaved] = useState(false);

    useEffect(() => {
        if (!isAdmin) return;
        setAccessLoading(true);
        Promise.all([getUsers(), getMonitorAccess(monitor.id)])
            .then(([users, accessUsers]) => {
                setUserList(users.filter((u) => u.role === 'user' && u.isActive));
                setAccessIds(new Set(accessUsers.map((u) => u.id)));
            })
            .catch((err) => setAccessError(err.message))
            .finally(() => setAccessLoading(false));
    }, [monitor.id, isAdmin]);

    const toggleAccess = (userId) => {
        setAccessIds((prev) => {
            const next = new Set(prev);
            if (next.has(userId)) next.delete(userId);
            else next.add(userId);
            return next;
        });
        setAccessSaved(false);
    };

    const handleSaveAccess = async () => {
        setAccessSaving(true);
        setAccessError('');
        setAccessSaved(false);
        try {
            await setMonitorAccess(monitor.id, [...accessIds]);
            setAccessSaved(true);
        } catch (err) {
            setAccessError(err.message);
        } finally {
            setAccessSaving(false);
        }
    };

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
                description: description || null,
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

                {isAdmin && (
                    <div className="access-section">
                        <h3 className="access-title">User Access</h3>
                        <p className="access-hint" style={{ marginBottom: '0.75rem' }}>
                            Users with role <em>User</em> only see monitors they are granted access to.
                        </p>
                        {accessLoading ? (
                            <p className="access-hint">Loading…</p>
                        ) : userList.length === 0 ? (
                            <p className="access-hint">No active users with role 'User' exist.</p>
                        ) : (
                            <div className="access-user-list">
                                {userList.map((u) => (
                                    <label key={u.id} className="access-user-row">
                                        <input
                                            type="checkbox"
                                            checked={accessIds.has(u.id)}
                                            onChange={() => toggleAccess(u.id)}
                                        />
                                        <span className="access-username">{u.username}</span>
                                        {u.email && <span className="access-email">{u.email}</span>}
                                    </label>
                                ))}
                            </div>
                        )}
                        {accessError && <p className="error-msg">{accessError}</p>}
                        {userList.length > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.75rem' }}>
                                <button
                                    className="btn btn-primary"
                                    onClick={handleSaveAccess}
                                    disabled={accessSaving}
                                >
                                    {accessSaving ? 'Saving…' : 'Save Access'}
                                </button>
                                {accessSaved && <span style={{ color: '#22c55e', fontSize: '0.85rem' }}>✓ Saved</span>}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
