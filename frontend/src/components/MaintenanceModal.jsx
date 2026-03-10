import { useState } from 'react';
import { createMaintenance, stopMaintenance, deleteMaintenance } from '../api/client.js';

function toLocalDatetimeValue(date) {
    if (!date) return '';
    const d = new Date(date);
    // Format as value for datetime-local input (YYYY-MM-DDTHH:MM)
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function nowLocalValue() {
    return toLocalDatetimeValue(new Date());
}

/**
 * MaintenanceModal
 *
 * Props:
 *   monitorId   – current monitor id
 *   windows     – array of existing maintenance windows for this monitor
 *   onClose     – close handler
 *   onChanged   – called after any mutation so parent can reload
 */
export default function MaintenanceModal({ monitorId, windows, onClose, onChanged }) {
    const [description, setDescription] = useState('');
    const [startAt, setStartAt] = useState(nowLocalValue());
    const [endAt, setEndAt] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const activeWindow = windows.find((w) => w.is_active);
    const upcoming = windows.filter((w) => !w.is_active && new Date(w.start_at) > new Date());

    const isScheduled = startAt && new Date(startAt) > new Date(Date.now() + 30000); // >30s in future = scheduled

    const handleCreate = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await createMaintenance(monitorId, {
                description: description || undefined,
                start_at: startAt ? new Date(startAt).toISOString() : undefined,
                end_at: endAt ? new Date(endAt).toISOString() : undefined,
            });
            setDescription('');
            setStartAt(nowLocalValue());
            setEndAt('');
            onChanged();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleStop = async (mwId) => {
        if (!confirm('Stop this maintenance window now?')) return;
        try {
            await stopMaintenance(monitorId, mwId);
            onChanged();
        } catch (err) {
            setError(err.message);
        }
    };

    const handleDelete = async (mwId) => {
        if (!confirm('Delete this maintenance window?')) return;
        try {
            await deleteMaintenance(monitorId, mwId);
            onChanged();
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="modal">
                <h2 className="modal-title">Maintenance Windows</h2>

                {/* Active maintenance banner */}
                {activeWindow && (
                    <div className="maint-active-banner">
                        <span className="maint-badge maint-badge--active">🔧 MAINTENANCE ACTIVE</span>
                        <div className="maint-active-details">
                            {activeWindow.description && <p>{activeWindow.description}</p>}
                            <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                                Started: {new Date(activeWindow.start_at).toLocaleString()}
                                {activeWindow.end_at && ` · Ends: ${new Date(activeWindow.end_at).toLocaleString()}`}
                            </p>
                        </div>
                        <button
                            className="btn btn-ghost"
                            style={{ marginTop: '0.5rem' }}
                            onClick={() => handleStop(activeWindow.id)}
                        >
                            Stop maintenance now
                        </button>
                    </div>
                )}

                {/* Upcoming scheduled windows */}
                {upcoming.length > 0 && (
                    <div style={{ marginBottom: '1.25rem' }}>
                        <h3 style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Scheduled
                        </h3>
                        {upcoming.map((w) => (
                            <div key={w.id} className="maint-window-row">
                                <div className="maint-window-info">
                                    <span className="maint-badge maint-badge--scheduled">scheduled</span>
                                    <span className="maint-window-time">{new Date(w.start_at).toLocaleString()}</span>
                                    {w.end_at && <span className="maint-window-time">→ {new Date(w.end_at).toLocaleString()}</span>}
                                    {w.description && <span className="maint-window-desc">{w.description}</span>}
                                </div>
                                <button className="btn-sm btn-sm-red" onClick={() => handleDelete(w.id)}>Cancel</button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Create new window form */}
                <h3 style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {activeWindow ? 'Schedule another window' : 'Start or schedule maintenance'}
                </h3>
                <form onSubmit={handleCreate}>
                    <label className="form-label">Description <span className="form-label-hint">(optional)</span></label>
                    <input
                        className="form-input" type="text" value={description}
                        placeholder="e.g. Planned DB upgrade"
                        onChange={(e) => setDescription(e.target.value)}
                    />

                    <label className="form-label">Start</label>
                    <input
                        className="form-input" type="datetime-local" value={startAt}
                        onChange={(e) => setStartAt(e.target.value)}
                    />

                    <label className="form-label">End <span className="form-label-hint">(optional — leave blank for indefinite)</span></label>
                    <input
                        className="form-input" type="datetime-local" value={endAt}
                        onChange={(e) => setEndAt(e.target.value)}
                    />

                    {error && <p className="error-msg">{error}</p>}
                    <div className="form-btn-row">
                        <button type="button" className="btn btn-ghost" onClick={onClose}>Close</button>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? 'Saving…' : isScheduled ? '📅 Schedule maintenance' : '🔧 Start maintenance now'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
