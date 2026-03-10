import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMonitors, deleteMonitor, getActivity, createMaintenance, stopMaintenance } from '../api/client.js';
import AddMonitorModal from '../components/AddMonitorModal.jsx';
import EditMonitorModal from '../components/EditMonitorModal.jsx';
import MaintenanceModal from '../components/MaintenanceModal.jsx';
import UptimeBars from '../components/UptimeBars.jsx';

function statusColor(monitor) {
  if (monitor.maintenance_active) return '#f59e0b';
  if (monitor.is_up === true) return '#22c55e';
  if (monitor.is_up === false) return '#ef4444';
  return '#94a3b8';
}

function statusLabel(monitor) {
  if (monitor.maintenance_active) return 'MAINT';
  if (monitor.is_up === true) return 'UP';
  if (monitor.is_up === false) return 'DOWN';
  return 'UNKNOWN';
}

function formatTime(ts) {
  if (!ts) return 'Never';
  return new Date(ts).toLocaleString();
}

export default function Dashboard() {
  const [monitors, setMonitors] = useState([]);
  const [activity, setActivity] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editMonitor, setEditMonitor] = useState(null);
  const [maintMonitor, setMaintMonitor] = useState(null); // monitor whose maintenance modal is open
  const [initialLoading, setInitialLoading] = useState(true);
  const [filterText, setFilterText] = useState('');
  const [showDownOnly, setShowDownOnly] = useState(false);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    try {
      const data = await getMonitors();
      setMonitors(data);
      const actData = await getActivity().catch(() => []);
      setActivity(actData);
    } catch (e) {
      console.error(e);
      // on refresh failure keep existing data — don't wipe the grid
    } finally {
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!confirm('Delete this monitor?')) return;
    await deleteMonitor(id);
    load();
  };

  const handleEdit = (e, monitor) => {
    e.stopPropagation();
    setEditMonitor(monitor);
  };

  const handleMaintenance = (e, monitor) => {
    e.stopPropagation();
    setMaintMonitor(monitor);
  };

  const handleQuickMaintStart = async (e, monitor) => {
    e.stopPropagation();
    if (!confirm(`Start maintenance for "${monitor.name}" now?`)) return;
    try {
      await createMaintenance(monitor.id, {});
      load();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleQuickMaintStop = async (e, monitor) => {
    e.stopPropagation();
    if (!confirm(`Stop maintenance for "${monitor.name}" now?`)) return;
    try {
      await stopMaintenance(monitor.id, monitor.maintenance_id);
      load();
    } catch (err) {
      alert(err.message);
    }
  };

  const filtered = monitors.filter((m) => {
    if (showDownOnly && m.is_up !== false) return false;
    if (filterText.trim()) {
      const q = filterText.toLowerCase();
      return m.name.toLowerCase().includes(q) || m.url.toLowerCase().includes(q);
    }
    return true;
  });

  const upCount = monitors.filter((m) => m.is_up === true).length;
  const downCount = monitors.filter((m) => m.is_up === false).length;
  const pausedCount = monitors.filter((m) => m.is_active === false).length;

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">OpenMonitor</h1>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <a href="/status" target="_blank" rel="noopener noreferrer" className="btn btn-ghost" style={{ fontSize: '0.85rem' }}>
            Status page ↗
          </a>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Add Monitor</button>
        </div>
      </div>

      {/* Summary bar */}
      {!initialLoading && monitors.length > 0 && (
        <div className="summary-bar">
          <span className="summary-item summary-item--total">{monitors.length} total</span>
          <span className="summary-item summary-item--up">{upCount} UP</span>
          {downCount > 0 && <span className="summary-item summary-item--down">{downCount} DOWN</span>}
          {pausedCount > 0 && <span className="summary-item summary-item--paused">{pausedCount} paused</span>}
        </div>
      )}

      {/* Filter bar */}
      <div className="dash-filter-bar">
        <input
          className="dash-filter-input"
          type="text"
          placeholder="Search monitors…"
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
        />
        <button
          className={`btn-sm btn-sm-red${showDownOnly ? ' btn-sm-red--active' : ''}`}
          onClick={() => setShowDownOnly((v) => !v)}
          title="Show only DOWN monitors"
        >
          {showDownOnly ? 'DOWN only ✕' : 'DOWN only'}
        </button>
      </div>

      {initialLoading && <p className="empty-state">Loading…</p>}
      {!initialLoading && monitors.length === 0 && (
        <p className="empty-state">No monitors yet. Add one to get started.</p>
      )}
      {!initialLoading && monitors.length > 0 && filtered.length === 0 && (
        <p className="empty-state">No monitors match your filter.</p>
      )}

      {!initialLoading && filtered.length > 0 && <div className="monitor-grid">
        {filtered.map((m) => {
          const color = statusColor(m);
          return (
            <div
              key={m.id}
              className={`monitor-card${m.is_active === false ? ' monitor-card--paused' : ''}`}
              onClick={() => navigate(`/monitors/${m.id}`)}
            >
              <div className="card-name">
                {m.name}
                <span className="tag">{m.type}</span>
                {m.is_active === false && <span className="tag tag-paused">paused</span>}
                {m.maintenance_active && <span className="maint-badge maint-badge--active" style={{ fontSize: '0.7rem' }}>🔧 maint</span>}
              </div>
              <div className="card-url">{m.url}</div>
              <div className="card-status-row">
                <span
                  className="badge"
                  style={{ background: color + '22', color }}
                >
                  {statusLabel(m)}
                </span>
                <div className="card-metrics">
                  {m.uptime_pct != null && (
                    <span className="card-metric-uptime">{m.uptime_pct}% up</span>
                  )}
                  {m.avg_response_time_ms != null && (
                    <span className="card-metric-ms">{m.avg_response_time_ms} ms</span>
                  )}
                </div>
              </div>
              <div className="card-bars-section">
                <div className="bars-label">Last 60 days</div>
                <UptimeBars bars={m.daily_bars} createdAt={m.monitor_created_at || m.created_at} />
              </div>
              <div className="card-meta">Last checked: {formatTime(m.checked_at)}</div>
              <div className="card-btn-row">
                <button className="btn-sm btn-sm-blue" onClick={(e) => handleEdit(e, m)}>Edit</button>
                <button
                  className={`btn-sm${m.maintenance_active ? ' btn-sm-amber' : ' btn-sm-blue'}`}
                  onClick={(e) => m.maintenance_active ? handleQuickMaintStop(e, m) : handleMaintenance(e, m)}
                  title={m.maintenance_active ? 'Stop maintenance' : 'Maintenance'}
                >
                  {m.maintenance_active ? '🔧 Stop maint' : '🔧 Maint'}
                </button>
                <button className="btn-sm btn-sm-red" onClick={(e) => handleDelete(e, m.id)}>Delete</button>
              </div>
            </div>
          );
        })}
      </div>}

      {showModal && (
        <AddMonitorModal
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); load(); }}
        />
      )}
      {editMonitor && (
        <EditMonitorModal
          monitor={editMonitor}
          onClose={() => setEditMonitor(null)}
          onSaved={() => { setEditMonitor(null); load(); }}
        />
      )}
      {maintMonitor && (
        <MaintenanceModal
          monitorId={maintMonitor.id}
          windows={[]}
          onClose={() => setMaintMonitor(null)}
          onChanged={() => { setMaintMonitor(null); load(); }}
        />
      )}

      {/* Activity / History feed */}
      {!initialLoading && activity.length > 0 && (
        <div className="activity-feed">
          <h2 className="activity-feed-title">Activity & Maintenance History</h2>
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
    </div>
  );
}
