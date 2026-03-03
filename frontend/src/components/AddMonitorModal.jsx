import { useState } from 'react';
import { createMonitor } from '../api/client.js';

const overlay = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
};
const modal = {
  background: '#1e293b', borderRadius: 14, padding: '2rem',
  width: '100%', maxWidth: 440, border: '1px solid #334155',
};
const label = { display: 'block', marginBottom: '0.35rem', fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600 };
const input = {
  width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: 8,
  color: '#e2e8f0', padding: '0.55rem 0.75rem', fontSize: '0.95rem', marginBottom: '1rem',
};
const btnRow = { display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' };
const cancelBtn = {
  background: 'transparent', border: '1px solid #334155', color: '#94a3b8',
  borderRadius: 8, padding: '0.5rem 1.1rem', fontSize: '0.9rem',
};
const submitBtn = {
  background: '#3b82f6', border: 'none', color: '#fff',
  borderRadius: 8, padding: '0.5rem 1.2rem', fontSize: '0.9rem', fontWeight: 600,
};

export default function AddMonitorModal({ onClose, onCreated }) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [interval, setInterval] = useState('60');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await createMonitor({ name, url, interval_seconds: parseInt(interval, 10) });
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={modal}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1.5rem', color: '#f1f5f9' }}>
          Add Monitor
        </h2>
        <form onSubmit={handleSubmit}>
          <label style={label}>Name</label>
          <input
            style={input} type="text" value={name} required
            placeholder="My Website"
            onChange={(e) => setName(e.target.value)}
          />
          <label style={label}>URL</label>
          <input
            style={input} type="url" value={url} required
            placeholder="https://example.com"
            onChange={(e) => setUrl(e.target.value)}
          />
          <label style={label}>Check Interval</label>
          <select
            style={input} value={interval}
            onChange={(e) => setInterval(e.target.value)}
          >
            <option value="30">Every 30 seconds</option>
            <option value="60">Every 60 seconds</option>
            <option value="300">Every 5 minutes</option>
            <option value="600">Every 10 minutes</option>
          </select>
          {error && <p style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: '0.75rem' }}>{error}</p>}
          <div style={btnRow}>
            <button type="button" style={cancelBtn} onClick={onClose}>Cancel</button>
            <button type="submit" style={submitBtn} disabled={loading}>
              {loading ? 'Adding…' : 'Add Monitor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
