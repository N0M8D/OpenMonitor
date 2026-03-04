import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMonitors, deleteMonitor } from '../api/client.js';
import AddMonitorModal from '../components/AddMonitorModal.jsx';
import EditMonitorModal from '../components/EditMonitorModal.jsx';
import UptimeBars from '../components/UptimeBars.jsx';

function statusColor(monitor) {
  if (monitor.is_up === true) return '#22c55e';
  if (monitor.is_up === false) return '#ef4444';
  return '#94a3b8';
}

function statusLabel(monitor) {
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
  const [showModal, setShowModal] = useState(false);
  const [editMonitor, setEditMonitor] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    try {
      const data = await getMonitors();
      setMonitors(data);
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

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">OpenMonitor</h1>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Add Monitor</button>
      </div>

      {initialLoading && <p className="empty-state">Loading…</p>}
      {!initialLoading && monitors.length === 0 && (
        <p className="empty-state">No monitors yet. Add one to get started.</p>
      )}

      {!initialLoading && <div className="monitor-grid">
        {monitors.map((m) => {
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
                <div className="bars-label">Last 24 hours</div>
                <UptimeBars bars={m.hourly_bars} />
              </div>
              <div className="card-meta">Last checked: {formatTime(m.checked_at)}</div>
              <div className="card-btn-row">
                <button className="btn-sm btn-sm-blue" onClick={(e) => handleEdit(e, m)}>Edit</button>
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
    </div>
  );
}
