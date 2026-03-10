import { useState } from 'react';
import { addIncidentUpdate, deleteIncidentUpdate, updateIncident } from '../api/client.js';

const STATUS_LABELS = {
    investigating: { label: 'Investigating', color: '#f97316' },
    identified: { label: 'Identified', color: '#f59e0b' },
    monitoring: { label: 'Monitoring', color: '#3b82f6' },
    update: { label: 'Update', color: '#94a3b8' },
    resolved: { label: 'Resolved', color: '#22c55e' },
};

function formatTime(ts) {
    if (!ts) return '—';
    return new Date(ts).toLocaleString();
}

function formatDuration(startedAt, resolvedAt) {
    const endMs = resolvedAt ? new Date(resolvedAt).getTime() : Date.now();
    const secs = Math.round((endMs - new Date(startedAt).getTime()) / 1000);
    if (secs < 60) return `${secs}s`;
    const m = Math.floor(secs / 60);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    const rm = m % 60;
    return `${h}h ${rm}m`;
}

/**
 * IncidentCard — Reddit-style incident card.
 * Props:
 *   incident  – stored incident object with `updates[]`
 *   monitorId – string|number
 *   onUpdated – callback after any write
 *   canWrite  – bool (show add-update form / delete buttons)
 */
export default function IncidentCard({ incident, monitorId, onUpdated, canWrite = false }) {
    const [expanded, setExpanded] = useState(incident.status === 'open');
    const [newMsg, setNewMsg] = useState('');
    const [newStatus, setNewStatus] = useState('update');
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState(null);

    const isOpen = incident.status === 'open';
    const updates = incident.updates || [];

    const handleAddUpdate = async (e) => {
        e.preventDefault();
        if (!newMsg.trim()) return;
        setSaving(true);
        setErr(null);
        try {
            await addIncidentUpdate(monitorId, incident.id, { message: newMsg.trim(), status: newStatus });
            setNewMsg('');
            setNewStatus('update');
            onUpdated?.();
        } catch (ex) {
            setErr(ex.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteUpdate = async (uId) => {
        if (!confirm('Delete this update?')) return;
        try {
            await deleteIncidentUpdate(monitorId, incident.id, uId);
            onUpdated?.();
        } catch (ex) {
            alert(ex.message);
        }
    };

    const handleReopen = async () => {
        try {
            await updateIncident(monitorId, incident.id, { status: 'open', resolved_at: null });
            onUpdated?.();
        } catch (ex) {
            alert(ex.message);
        }
    };

    return (
        <div className={`incident-card${isOpen ? ' incident-card--open' : ''}`}>
            {/* Header — always visible */}
            <div
                className="incident-card-header"
                onClick={() => setExpanded((v) => !v)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && setExpanded((v) => !v)}
            >
                <span className={`incident-dot incident-dot--${isOpen ? 'open' : 'resolved'}`} />
                <div className="incident-header-body">
                    <span className="incident-title">
                        {incident.title || (isOpen ? 'Ongoing incident' : 'Incident')}
                    </span>
                    <span className="incident-duration">
                        {isOpen
                            ? `Ongoing · started ${formatTime(incident.started_at)}`
                            : `${formatDuration(incident.started_at, incident.resolved_at)} · ${formatTime(incident.started_at)}`}
                    </span>
                </div>
                <div className="incident-header-right">
                    <span className={`incident-badge incident-badge--${isOpen ? 'open' : 'resolved'}`}>
                        {isOpen ? 'Open' : 'Resolved'}
                    </span>
                    {updates.length > 0 && (
                        <span className="incident-update-count">{updates.length} update{updates.length !== 1 ? 's' : ''}</span>
                    )}
                    <span className="incident-chevron">{expanded ? '▲' : '▼'}</span>
                </div>
            </div>

            {/* Expandable body */}
            {expanded && (
                <div className="incident-card-body">
                    {/* Update timeline */}
                    {updates.length === 0 && (
                        <p className="incident-no-updates">No updates yet.</p>
                    )}
                    {updates.map((u) => {
                        const meta = STATUS_LABELS[u.status] || STATUS_LABELS.update;
                        return (
                            <div key={u.id} className="incident-update-row">
                                <span
                                    className={`incident-update-label incident-update-label--${u.status}`}
                                    style={{ color: meta.color }}
                                >
                                    {meta.label}
                                </span>
                                <div className="incident-update-body">
                                    <p className="incident-update-msg">{u.message}</p>
                                    <span className="incident-update-time">{formatTime(u.created_at)}</span>
                                </div>
                                {canWrite && (
                                    <button
                                        className="btn-sm btn-sm-red incident-update-del"
                                        onClick={() => handleDeleteUpdate(u.id)}
                                        title="Delete update"
                                    >
                                        ×
                                    </button>
                                )}
                            </div>
                        );
                    })}

                    {/* Add update form (write) */}
                    {canWrite && (
                        <form className="incident-add-form" onSubmit={handleAddUpdate}>
                            <select
                                className="incident-status-select"
                                value={newStatus}
                                onChange={(e) => setNewStatus(e.target.value)}
                            >
                                <option value="investigating">Investigating</option>
                                <option value="identified">Identified</option>
                                <option value="monitoring">Monitoring</option>
                                <option value="update">Update</option>
                                <option value="resolved">Resolved (closes incident)</option>
                            </select>
                            <textarea
                                className="incident-msg-input"
                                placeholder="Describe what's happening…"
                                value={newMsg}
                                onChange={(e) => setNewMsg(e.target.value)}
                                rows={2}
                            />
                            {err && <p className="form-error">{err}</p>}
                            <div className="incident-form-actions">
                                <button type="submit" className="btn btn-primary" disabled={saving || !newMsg.trim()}>
                                    {saving ? 'Posting…' : 'Post update'}
                                </button>
                                {!isOpen && (
                                    <button type="button" className="btn btn-ghost" onClick={handleReopen}>
                                        Re-open
                                    </button>
                                )}
                            </div>
                        </form>
                    )}
                </div>
            )}
        </div>
    );
}
