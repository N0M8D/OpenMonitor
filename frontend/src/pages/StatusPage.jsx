import { useState, useEffect, useCallback } from 'react';
import UptimeBars from '../components/UptimeBars.jsx';
import IncidentCard from '../components/IncidentCard.jsx';

const OVERALL_META = {
    operational: { label: 'All systems operational', color: '#22c55e', bg: '#14532d' },
    maintenance: { label: 'Under maintenance', color: '#f59e0b', bg: '#451a03' },
    degraded: { label: 'Partial outage', color: '#f59e0b', bg: '#451a03' },
    outage: { label: 'Major outage', color: '#ef4444', bg: '#450a0a' },
};

function statusColor(m) {
    if (m.maintenance_active) return '#f59e0b';
    if (m.is_up === true) return '#22c55e';
    if (m.is_up === false) return '#ef4444';
    return '#94a3b8';
}

function formatTime(ts) {
    if (!ts) return '—';
    return new Date(ts).toLocaleString();
}

export default function StatusPage() {
    const [data, setData] = useState(null);
    const [activity, setActivity] = useState([]);
    const [publicIncidents, setPublicIncidents] = useState([]);
    const [error, setError] = useState(null);

    const load = useCallback(async () => {
        try {
            const [res, actRes, incRes] = await Promise.all([
                fetch('/api/status'),
                fetch('/api/activity'),
                fetch('/api/public-incidents'),
            ]);
            if (!res.ok) throw new Error('Failed to load status');
            const json = await res.json();
            const actJson = actRes.ok ? await actRes.json() : [];
            const incJson = incRes.ok ? await incRes.json() : [];
            setData(json);
            setActivity(actJson);
            setPublicIncidents(incJson);
            setError(null);
        } catch (e) {
            setError(e.message);
        }
    }, []);

    useEffect(() => {
        load();
        const interval = setInterval(load, 30000);
        return () => clearInterval(interval);
    }, [load]);

    const meta = OVERALL_META[data?.overall] || OVERALL_META.operational;

    return (
        <div className="status-page">
            <div className="status-header">
                <h1 className="status-page-title">OpenMonitor</h1>
                <a href="/" className="status-login-link">← Dashboard</a>
            </div>

            {/* Overall status banner */}
            {data && (
                <div className="status-banner" style={{ background: meta.bg, borderColor: meta.color }}>
                    <span className="status-banner-dot" style={{ background: meta.color }} />
                    <span className="status-banner-label" style={{ color: meta.color }}>{meta.label}</span>
                    <span className="status-banner-time">Updated {formatTime(data.updated_at)}</span>
                </div>
            )}

            {error && <p style={{ color: '#ef4444', textAlign: 'center' }}>{error}</p>}
            {!data && !error && <p style={{ color: '#94a3b8', textAlign: 'center' }}>Loading…</p>}

            {/* Monitor list */}
            {data && (
                <div className="status-monitor-list">
                    {data.monitors.length === 0 && (
                        <p style={{ color: '#94a3b8', textAlign: 'center' }}>No monitors configured.</p>
                    )}
                    {data.monitors.map((m) => {
                        const color = statusColor(m);
                        const badgeLabel = m.maintenance_active ? 'MAINT'
                            : m.is_up === true ? 'UP'
                                : m.is_up === false ? 'DOWN' : 'UNKNOWN';
                        return (
                            <div key={m.id} className={`status-monitor-row${m.maintenance_active ? ' status-monitor-row--maint' : ''}`}>
                                <div className="status-monitor-header">
                                    <span className="status-monitor-dot" style={{ background: color }} />
                                    <div className="status-monitor-header-text">
                                        <div className="status-monitor-name">{m.name}</div>
                                        {m.description && (
                                            <div className="status-monitor-desc">{m.description}</div>
                                        )}
                                        <div className="status-monitor-meta">
                                            <span className="tag">{m.type}</span>
                                            {m.uptime_pct != null && (
                                                <span style={{ color: '#94a3b8', fontSize: '0.8rem', marginLeft: '0.5rem' }}>
                                                    {m.uptime_pct}% up (24h)
                                                </span>
                                            )}
                                            {m.avg_response_time_ms != null && (
                                                <span style={{ color: '#64748b', fontSize: '0.8rem', marginLeft: '0.5rem' }}>
                                                    avg {m.avg_response_time_ms} ms
                                                </span>
                                            )}
                                        </div>
                                        {m.maintenance_active && (
                                            <div className="status-maint-info">
                                                🔧 Maintenance
                                                {m.maintenance_description && ` — ${m.maintenance_description}`}
                                                {m.maintenance_end_at && (
                                                    <span style={{ color: '#94a3b8', marginLeft: '0.4rem', fontSize: '0.78rem' }}>
                                                        until {formatTime(m.maintenance_end_at)}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <span className="badge status-monitor-badge" style={{ background: color + '22', color }}>
                                        {badgeLabel}
                                    </span>
                                </div>
                                <div className="status-monitor-bars">
                                    <UptimeBars bars={m.daily_bars} createdAt={m.created_at} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Activity / Maintenance history */}
            {/* Open incidents (prominent, above monitor list would be ideal but here below for simplicity) */}
            {publicIncidents.filter((inc) => inc.status === 'open').length > 0 && (
                <div className="status-open-incidents">
                    <h2 className="status-open-incidents-title">⚠ Active Incidents</h2>
                    <div className="incident-list">
                        {publicIncidents
                            .filter((inc) => inc.status === 'open')
                            .map((inc) => (
                                <IncidentCard key={inc.id} incident={inc} monitorId={inc.monitor_id} canWrite={false} />
                            ))}
                    </div>
                </div>
            )}

            {activity.length > 0 && (
                <div className="status-activity">
                    <h2 className="status-activity-title">Maintenance History</h2>
                    <div className="activity-list">
                        {activity.map((a) => (
                            <div key={a.id} className={`activity-item activity-item--${a.status}`}>
                                <span className={`maint-badge maint-badge--${a.status}`}>
                                    {a.status === 'active' ? '🔧 active'
                                        : a.status === 'scheduled' ? '📅 scheduled'
                                            : '✓ completed'}
                                </span>
                                <div className="activity-item-body">
                                    <span className="activity-monitor-name">{a.monitor_name}</span>
                                    {a.description && <span className="activity-desc">{a.description}</span>}
                                    <span className="activity-time">
                                        {new Date(a.start_at).toLocaleString()}
                                        {a.end_at && ` – ${new Date(a.end_at).toLocaleString()}`}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Incident history */}
            {publicIncidents.filter((inc) => inc.status === 'resolved').length > 0 && (
                <div className="status-activity">
                    <h2 className="status-activity-title">Incident History</h2>
                    <div className="incident-list">
                        {publicIncidents
                            .filter((inc) => inc.status === 'resolved')
                            .map((inc) => (
                                <IncidentCard key={inc.id} incident={inc} monitorId={inc.monitor_id} canWrite={false} />
                            ))}
                    </div>
                </div>
            )}

            <div className="status-footer">
                Powered by <strong>OpenMonitor</strong>
            </div>
        </div>
    );
}
