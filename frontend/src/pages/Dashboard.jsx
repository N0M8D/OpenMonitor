import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMonitors, deleteMonitor } from '../api/client.js';
import AddMonitorModal from '../components/AddMonitorModal.jsx';

const styles = {
  container: { maxWidth: 1200, margin: '0 auto', padding: '2rem 1.5rem' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' },
  title: { fontSize: '1.75rem', fontWeight: 700, color: '#f1f5f9' },
  addBtn: {
    background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8,
    padding: '0.6rem 1.2rem', fontSize: '0.95rem', fontWeight: 600,
  },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.25rem' },
  card: {
    background: '#1e293b', borderRadius: 12, padding: '1.5rem',
    cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s',
    border: '1px solid #334155',
  },
  cardName: { fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.35rem', color: '#f1f5f9' },
  cardUrl: { fontSize: '0.8rem', color: '#94a3b8', marginBottom: '1rem', wordBreak: 'break-all' },
  statusRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  badge: (color) => ({
    display: 'inline-block', padding: '0.2rem 0.65rem', borderRadius: 20,
    fontSize: '0.78rem', fontWeight: 700, background: color + '22', color: color,
  }),
  meta: { fontSize: '0.78rem', color: '#64748b', marginTop: '0.75rem' },
  deleteBtn: {
    background: 'transparent', border: '1px solid #ef4444', color: '#ef4444',
    borderRadius: 6, padding: '0.2rem 0.5rem', fontSize: '0.75rem', marginTop: '0.75rem',
  },
  empty: { textAlign: 'center', color: '#64748b', marginTop: '4rem', fontSize: '1rem' },
};

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
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    try {
      const data = await getMonitors();
      setMonitors(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
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

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>OpenMonitor</h1>
        <button style={styles.addBtn} onClick={() => setShowModal(true)}>+ Add Monitor</button>
      </div>

      {loading && <p style={styles.empty}>Loading…</p>}
      {!loading && monitors.length === 0 && (
        <p style={styles.empty}>No monitors yet. Add one to get started.</p>
      )}

      <div style={styles.grid}>
        {monitors.map((m) => {
          const color = statusColor(m);
          return (
            <div
              key={m.id}
              style={styles.card}
              onClick={() => navigate(`/monitors/${m.id}`)}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.3)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
            >
              <div style={styles.cardName}>{m.name}</div>
              <div style={styles.cardUrl}>{m.url}</div>
              <div style={styles.statusRow}>
                <span style={styles.badge(color)}>{statusLabel(m)}</span>
                {m.avg_response_time_ms != null && (
                  <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>{m.avg_response_time_ms} ms avg</span>
                )}
              </div>
              <div style={styles.meta}>Last checked: {formatTime(m.checked_at)}</div>
              <button style={styles.deleteBtn} onClick={(e) => handleDelete(e, m.id)}>Delete</button>
            </div>
          );
        })}
      </div>

      {showModal && (
        <AddMonitorModal
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); load(); }}
        />
      )}
    </div>
  );
}
