import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { getMonitors, getChecks } from '../api/client.js';

const styles = {
  container: { maxWidth: 1000, margin: '0 auto', padding: '2rem 1.5rem' },
  backBtn: {
    background: 'transparent', border: '1px solid #334155', color: '#94a3b8',
    borderRadius: 8, padding: '0.4rem 0.9rem', fontSize: '0.88rem', marginBottom: '1.5rem',
  },
  header: { marginBottom: '2rem' },
  name: { fontSize: '1.75rem', fontWeight: 700, color: '#f1f5f9', marginBottom: '0.35rem' },
  url: { fontSize: '0.9rem', color: '#94a3b8', wordBreak: 'break-all' },
  badge: (color) => ({
    display: 'inline-block', padding: '0.25rem 0.8rem', borderRadius: 20,
    fontSize: '0.85rem', fontWeight: 700, background: color + '22', color, marginLeft: '1rem',
  }),
  section: { background: '#1e293b', borderRadius: 12, padding: '1.5rem', marginBottom: '1.5rem', border: '1px solid #334155' },
  sectionTitle: { fontSize: '1rem', fontWeight: 600, color: '#94a3b8', marginBottom: '1rem' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' },
  th: { textAlign: 'left', padding: '0.5rem 0.75rem', color: '#64748b', borderBottom: '1px solid #334155', fontWeight: 600 },
  td: { padding: '0.5rem 0.75rem', borderBottom: '1px solid #1e293b', color: '#cbd5e1' },
};

function statusColor(is_up) {
  if (is_up === true) return '#22c55e';
  if (is_up === false) return '#ef4444';
  return '#94a3b8';
}

function formatTime(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString();
}

export default function MonitorDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [monitor, setMonitor] = useState(null);
  const [checks, setChecks] = useState([]);

  const load = useCallback(async () => {
    try {
      const [monitors, checksData] = await Promise.all([getMonitors(), getChecks(id)]);
      const m = monitors.find((x) => String(x.id) === String(id));
      setMonitor(m || null);
      setChecks(checksData);
    } catch (e) {
      console.error(e);
    }
  }, [id]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  if (!monitor) return <div style={{ padding: '2rem', color: '#94a3b8' }}>Loading…</div>;

  const color = statusColor(monitor.is_up);
  const chartData = [...checks].reverse().map((c) => ({
    time: new Date(c.checked_at).toLocaleTimeString(),
    ms: c.response_time_ms,
  }));

  return (
    <div style={styles.container}>
      <button style={styles.backBtn} onClick={() => navigate('/')}>← Back</button>

      <div style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h1 style={styles.name}>{monitor.name}</h1>
          <span style={styles.badge(color)}>
            {monitor.is_up === true ? 'UP' : monitor.is_up === false ? 'DOWN' : 'UNKNOWN'}
          </span>
        </div>
        <div style={styles.url}>{monitor.url}</div>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>Response Time (last 100 checks)</div>
        {chartData.length === 0 ? (
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>No data yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} unit=" ms" />
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
                labelStyle={{ color: '#94a3b8' }}
                itemStyle={{ color: '#3b82f6' }}
              />
              <Line type="monotone" dataKey="ms" stroke="#3b82f6" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>Recent Checks</div>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Time</th>
              <th style={styles.th}>Status Code</th>
              <th style={styles.th}>Response Time</th>
              <th style={styles.th}>Result</th>
            </tr>
          </thead>
          <tbody>
            {checks.slice(0, 20).map((c) => (
              <tr key={c.id}>
                <td style={styles.td}>{formatTime(c.checked_at)}</td>
                <td style={styles.td}>{c.status_code ?? '—'}</td>
                <td style={styles.td}>{c.response_time_ms != null ? `${c.response_time_ms} ms` : '—'}</td>
                <td style={styles.td}>
                  <span style={{
                    color: statusColor(c.is_up), fontWeight: 600, fontSize: '0.82rem',
                  }}>
                    {c.is_up ? 'UP' : 'DOWN'}
                  </span>
                  {c.error && <span style={{ color: '#94a3b8', fontSize: '0.78rem', marginLeft: '0.5rem' }}>{c.error}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {checks.length === 0 && <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '0.5rem' }}>No checks yet.</p>}
      </div>
    </div>
  );
}
