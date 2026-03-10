import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { getMonitors, getChecks, getIncidents, getMaintenance } from '../api/client.js';
import MaintenanceModal from '../components/MaintenanceModal.jsx';
import IncidentCard from '../components/IncidentCard.jsx';

function statusColor(is_up) {
  if (is_up === true) return '#22c55e';
  if (is_up === false) return '#ef4444';
  return '#94a3b8';
}

function formatTime(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString();
}

function formatDuration(seconds) {
  if (seconds == null) return '—';
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return `${h}h ${rm}m`;
}

function formatUptime(seconds) {
  if (seconds == null) return '—';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatKbs(kbs) {
  if (kbs == null) return '—';
  if (kbs >= 1024 * 1024) return `${(kbs / 1024 / 1024).toFixed(1)} GB/s`;
  if (kbs >= 1024) return `${(kbs / 1024).toFixed(1)} MB/s`;
  return `${kbs} KB/s`;
}

function metricColor(pct) {
  if (pct == null) return '#3b82f6';
  if (pct >= 90) return '#ef4444';
  if (pct >= 70) return '#f59e0b';
  return '#22c55e';
}

function MetricBar({ label, value, unit = '%', fillPctOverride, color: colorProp, rightSlot }) {
  const displayPct = fillPctOverride != null ? fillPctOverride : (unit === '%' ? value : 0);
  const color = colorProp || metricColor(unit === '%' ? value : displayPct);
  return (
    <div className="metric-bar-row">
      <span className="metric-bar-label">{label}</span>
      <div className="metric-bar-track">
        <div className="metric-bar-fill" style={{ width: `${Math.min(displayPct ?? 0, 100)}%`, background: color }} />
      </div>
      <span className="metric-bar-value" style={{ color }}>
        {rightSlot || (value != null ? `${value}${unit}` : '—')}
      </span>
    </div>
  );
}

export default function MonitorDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [monitor, setMonitor] = useState(null);
  const [checks, setChecks] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [maintenanceWindows, setMaintenanceWindows] = useState([]);
  const [showMaintModal, setShowMaintModal] = useState(false);
  const [range, setRange] = useState('24h');

  const load = useCallback(async () => {
    try {
      const [monitors, checksData, incidentsData, maintData] = await Promise.all([
        getMonitors(),
        getChecks(id, range),
        getIncidents(id),
        getMaintenance(id).catch(() => []),
      ]);
      const m = monitors.find((x) => String(x.id) === String(id));
      setMonitor(m || null);
      setChecks(checksData);
      setIncidents(incidentsData);
      setMaintenanceWindows(maintData);
    } catch (e) {
      console.error(e);
    }
  }, [id, range]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  if (!monitor) return <div className="loading-text">Loading…</div>;

  const isServer = monitor.type === 'server';
  const color = statusColor(monitor.is_up);

  const uptimePct = monitor.uptime_pct != null
    ? monitor.uptime_pct
    : checks.length > 0
      ? ((checks.filter(c => c.is_up).length / checks.length) * 100).toFixed(2)
      : null;

  const uptimeColor = uptimePct == null ? '#f1f5f9'
    : Number(uptimePct) >= 99 ? '#22c55e'
      : Number(uptimePct) >= 90 ? '#f59e0b'
        : '#ef4444';

  const latestMeta = checks[0]?.metadata || null;

  const webChartData = isServer ? [] : [...checks].reverse().map((c) => ({
    time: new Date(c.checked_at).toLocaleTimeString(),
    ms: c.response_time_ms,
  }));

  const reversed = isServer ? [...checks].reverse() : [];

  const serverCpuMemData = reversed.map((c) => ({
    time: new Date(c.checked_at).toLocaleTimeString(),
    cpu: c.metadata?.cpu_pct ?? null,
    mem: c.metadata?.mem_pct ?? null,
  }));

  const serverDiskIoData = reversed.map((c) => ({
    time: new Date(c.checked_at).toLocaleTimeString(),
    read: c.metadata?.disk_read_kbs ?? null,
    write: c.metadata?.disk_write_kbs ?? null,
  }));

  const serverNetData = reversed.map((c) => ({
    time: new Date(c.checked_at).toLocaleTimeString(),
    in: c.metadata?.net_in_kbs ?? null,
    out: c.metadata?.net_out_kbs ?? null,
  }));

  const upChecks = checks.filter(c => c.response_time_ms != null);
  const avgMs = monitor.avg_response_time_ms;
  const minMs = upChecks.length > 0 ? Math.min(...upChecks.map(c => c.response_time_ms)) : null;
  const maxMs = upChecks.length > 0 ? Math.max(...upChecks.map(c => c.response_time_ms)) : null;

  const diskUsedGb = latestMeta?.disk_used_gb;
  const diskTotalGb = latestMeta?.disk_total_gb;
  const diskPct = latestMeta?.disk_pct;
  const memUsedGb = latestMeta?.mem_used_mb != null ? (latestMeta.mem_used_mb / 1024).toFixed(1) : null;
  const memTotalGb = latestMeta?.mem_total_mb != null ? (latestMeta.mem_total_mb / 1024).toFixed(1) : null;

  return (
    <div className="page-container page-container--narrow">
      <button className="btn btn-ghost" style={{ marginBottom: '1.5rem' }} onClick={() => navigate('/')}>← Back</button>

      <div style={{ marginBottom: '2rem' }}>
        <div className="detail-title-row">
          <h1 className="detail-name">{monitor.name}</h1>
          <span className="badge badge--lg" style={{ background: color + '22', color }}>
            {monitor.is_up === true ? 'UP' : monitor.is_up === false ? 'DOWN' : 'UNKNOWN'}
          </span>
          {monitor.maintenance_active && (
            <span className="maint-badge maint-badge--active">🔧 Maintenance</span>
          )}
          {!monitor.maintenance_active && monitor.maintenance_id && (
            <span className="maint-badge maint-badge--scheduled">scheduled</span>
          )}
          {monitor.type && <span className="tag tag--lg">{monitor.type}</span>}
          {monitor.is_active === false && (
            <span className="tag tag--lg tag-paused">paused</span>
          )}
          <button className="btn btn-ghost" style={{ marginLeft: 'auto', fontSize: '0.85rem' }} onClick={() => setShowMaintModal(true)}>
            🔧 Maintenance
          </button>
        </div>
        <div className="detail-url">{monitor.url}</div>
        {monitor.description && (
          <p className="detail-description">{monitor.description}</p>
        )}
        {monitor.maintenance_active && (
          <div className="maint-active-banner">
            <strong>🔧 Under maintenance</strong>
            {monitor.maintenance_description && <span> — {monitor.maintenance_description}</span>}
            {monitor.maintenance_end_at && (
              <span style={{ fontSize: '0.82rem', color: '#94a3b8', marginLeft: '0.5rem' }}>
                until {new Date(monitor.maintenance_end_at).toLocaleString()}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Stats row */}
      <div className="stats-row">
        {uptimePct != null && (
          <div className="stat-box">
            <div className="stat-value" style={{ color: uptimeColor }}>{uptimePct}%</div>
            <div className="stat-label">Uptime (24 h)</div>
          </div>
        )}
        {monitor.uptime_7d_pct != null && (
          <div className="stat-box">
            <div className="stat-value" style={{ color: Number(monitor.uptime_7d_pct) >= 99 ? '#22c55e' : Number(monitor.uptime_7d_pct) >= 90 ? '#f59e0b' : '#ef4444' }}>
              {monitor.uptime_7d_pct}%
            </div>
            <div className="stat-label">Uptime (7 d)</div>
          </div>
        )}
        {monitor.uptime_30d_pct != null && (
          <div className="stat-box">
            <div className="stat-value" style={{ color: Number(monitor.uptime_30d_pct) >= 99 ? '#22c55e' : Number(monitor.uptime_30d_pct) >= 90 ? '#f59e0b' : '#ef4444' }}>
              {monitor.uptime_30d_pct}%
            </div>
            <div className="stat-label">Uptime (30 d)</div>
          </div>
        )}
        {isServer ? (
          <>
            {latestMeta?.cpu_pct != null && (
              <div className="stat-box">
                <div className="stat-value" style={{ color: metricColor(latestMeta.cpu_pct) }}>{latestMeta.cpu_pct}%</div>
                <div className="stat-label">CPU</div>
              </div>
            )}
            {latestMeta?.mem_pct != null && (
              <div className="stat-box">
                <div className="stat-value" style={{ color: metricColor(latestMeta.mem_pct) }}>{latestMeta.mem_pct}%</div>
                <div className="stat-label">Memory</div>
              </div>
            )}
            {latestMeta?.disk_pct != null && (
              <div className="stat-box">
                <div className="stat-value" style={{ color: metricColor(latestMeta.disk_pct) }}>{latestMeta.disk_pct}%</div>
                <div className="stat-label">Disk</div>
              </div>
            )}
            {latestMeta?.uptime_seconds != null && (
              <div className="stat-box">
                <div className="stat-value">{formatUptime(latestMeta.uptime_seconds)}</div>
                <div className="stat-label">OS Uptime</div>
              </div>
            )}
          </>
        ) : (
          <>
            {avgMs != null && (
              <div className="stat-box">
                <div className="stat-value">{avgMs} ms</div>
                <div className="stat-label">Avg response (24 h)</div>
              </div>
            )}
            {minMs != null && (
              <div className="stat-box">
                <div className="stat-value">{minMs} ms</div>
                <div className="stat-label">Min response</div>
              </div>
            )}
            {maxMs != null && (
              <div className="stat-box">
                <div className="stat-value">{maxMs} ms</div>
                <div className="stat-label">Max response</div>
              </div>
            )}
            {latestMeta?.ssl_days_remaining != null && (() => {
              const d = latestMeta.ssl_days_remaining;
              const sslColor = d <= 7 ? '#ef4444' : d <= 30 ? '#f59e0b' : '#22c55e';
              return (
                <div className="stat-box">
                  <div className="stat-value" style={{ color: sslColor }}>
                    {d < 0 ? 'Expired' : `${d}d`}
                  </div>
                  <div className="stat-label">SSL expires</div>
                </div>
              );
            })()}
          </>
        )}
        <div className="stat-box">
          <div className="stat-value">{monitor.interval_seconds ?? 60}s</div>
          <div className="stat-label">Check interval</div>
        </div>
      </div>

      {/* Time range selector */}
      <div className="range-selector">
        {['6h', '24h', '7d'].map((r) => (
          <button
            key={r}
            className={`range-btn${range === r ? ' range-btn--active' : ''}`}
            onClick={() => setRange(r)}
          >
            {r}
          </button>
        ))}
        <span className="range-label">{checks.length} data points</span>
      </div>

      {/* Server: system info header */}
      {isServer && latestMeta && (
        <div className="server-info-header">
          {latestMeta.hostname && (
            <div className="server-info-item">
              <span className="server-info-icon">🖥</span>
              <span className="server-info-label">Hostname</span>
              <span className="server-info-value">{latestMeta.hostname}</span>
            </div>
          )}
          <div className="server-info-item">
            <span className="server-info-icon">⏱</span>
            <span className="server-info-label">OS Uptime</span>
            <span className="server-info-value">{formatUptime(latestMeta.uptime_seconds)}</span>
          </div>
          <div className="server-info-item">
            <span className="server-info-icon">📊</span>
            <span className="server-info-label">Load avg</span>
            <span className="server-info-value">{latestMeta.load_1 ?? '—'}</span>
          </div>
          <div className="server-info-item">
            <span className="server-info-icon">🕐</span>
            <span className="server-info-label">Last heartbeat</span>
            <span className="server-info-value">{formatTime(checks[0]?.checked_at)}</span>
          </div>
        </div>
      )}

      {/* Server: live resource gauges */}
      {isServer && latestMeta && (
        <div className="section">
          <div className="section-title">Current Resource Usage</div>
          <div className="metric-bars">
            <MetricBar
              label="CPU"
              value={latestMeta.cpu_pct}
              rightSlot={
                <span>{latestMeta.cpu_pct != null ? `${latestMeta.cpu_pct}%` : '—'}</span>
              }
            />
            <MetricBar
              label="Memory"
              value={latestMeta.mem_pct}
              rightSlot={
                <span>
                  <span style={{ color: metricColor(latestMeta.mem_pct) }}>{latestMeta.mem_pct != null ? `${latestMeta.mem_pct}%` : '—'}</span>
                  {memUsedGb && memTotalGb && (
                    <span className="metric-bar-detail">{memUsedGb} / {memTotalGb} GB</span>
                  )}
                </span>
              }
            />
            <MetricBar
              label="Disk"
              fillPctOverride={diskPct}
              color={metricColor(diskPct)}
              rightSlot={
                <span>
                  <span style={{ color: metricColor(diskPct) }}>{diskPct != null ? `${diskPct}%` : '—'}</span>
                  {diskUsedGb != null && diskTotalGb != null && (
                    <span className="metric-bar-detail">{diskUsedGb} / {diskTotalGb} GB</span>
                  )}
                </span>
              }
            />
          </div>
          {/* Disk capacity breakdown */}
          {diskUsedGb != null && diskTotalGb != null && (
            <div className="disk-capacity">
              <div className="disk-capacity-row">
                <div className="disk-capacity-item">
                  <div className="disk-capacity-label">Used disk space</div>
                  <div className="disk-capacity-val" style={{ color: metricColor(diskPct) }}>{diskUsedGb} GB</div>
                </div>
                <div className="disk-capacity-item disk-capacity-item--free">
                  <div className="disk-capacity-label">Free disk space</div>
                  <div className="disk-capacity-val" style={{ color: '#22c55e' }}>{(diskTotalGb - diskUsedGb).toFixed(0)} GB</div>
                </div>
                <div className="disk-capacity-item">
                  <div className="disk-capacity-label">Total disk space</div>
                  <div className="disk-capacity-val">{diskTotalGb} GB</div>
                </div>
              </div>
              <div className="disk-capacity-bar-track">
                <div className="disk-capacity-bar-fill" style={{ width: `${diskPct ?? 0}%`, background: metricColor(diskPct) }} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Chart: CPU & Mem or Response Time */}
      <div className="section">
        <div className="section-title">
          {isServer ? `CPU & Memory — last ${checks.length} heartbeats` : `Response Time — last ${checks.length} checks`}
        </div>
        {isServer ? (
          serverCpuMemData.length === 0 ? <p className="no-data">No data yet.</p> : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={serverCpuMemData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} unit="%" domain={[0, 100]} />
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }} labelStyle={{ color: '#94a3b8' }} />
                <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 12 }} />
                <Line type="monotone" dataKey="cpu" name="CPU %" stroke="#f59e0b" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="mem" name="Mem %" stroke="#3b82f6" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          )
        ) : (
          webChartData.length === 0 ? <p className="no-data">No data yet.</p> : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={webChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} unit=" ms" />
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }} labelStyle={{ color: '#94a3b8' }} itemStyle={{ color: '#3b82f6' }} />
                <Line type="monotone" dataKey="ms" stroke="#3b82f6" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          )
        )}
      </div>

      {/* Chart: Disk I/O */}
      {isServer && (
        <div className="section">
          <div className="section-title">Disk I/O — read / write</div>
          {serverDiskIoData.every(d => d.read == null) ? <p className="no-data">No disk I/O data yet.</p> : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={serverDiskIoData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={v => formatKbs(v)} width={70} />
                <Tooltip
                  contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
                  labelStyle={{ color: '#94a3b8' }}
                  formatter={(v) => [formatKbs(v)]}
                />
                <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 12 }} />
                <Line type="monotone" dataKey="read" name="Read" stroke="#22c55e" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="write" name="Write" stroke="#f97316" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {/* Chart: Network bandwidth */}
      {isServer && (
        <div className="section">
          <div className="section-title">Network bandwidth — in / out</div>
          {serverNetData.every(d => d.in == null) ? <p className="no-data">No network data yet.</p> : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={serverNetData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={v => formatKbs(v)} width={70} />
                <Tooltip
                  contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
                  labelStyle={{ color: '#94a3b8' }}
                  formatter={(v) => [formatKbs(v)]}
                />
                <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 12 }} />
                <Line type="monotone" dataKey="in" name="In" stroke="#a78bfa" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="out" name="Out" stroke="#f43f5e" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {/* Incident log */}
      <div className="section">
        <div className="section-title">Incident Log ({incidents.length})</div>
        {incidents.length === 0 ? (
          <p className="no-data">No incidents recorded — monitor has been up the entire time.</p>
        ) : (
          <div className="incident-list">
            {incidents.map((inc) => (
              <IncidentCard
                key={inc.id}
                incident={inc}
                monitorId={id}
                onUpdated={load}
                canWrite={true}
              />
            ))}
          </div>
        )}
      </div>

      {/* Checks / Heartbeats table */}
      <div className="section">
        <div className="section-title">Recent {isServer ? 'Heartbeats' : 'Checks'} ({checks.length})</div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Time</th>
              {isServer ? (
                <>
                  <th>CPU %</th>
                  <th>Memory</th>
                  <th>Disk</th>
                  <th>Disk I/O</th>
                  <th>Network</th>
                  <th>Load</th>
                  <th>OS Uptime</th>
                </>
              ) : (
                <>
                  <th>Status Code</th>
                  <th>Response Time</th>
                </>
              )}
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {checks.map((c) => (
              <tr key={c.id}>
                <td>{formatTime(c.checked_at)}</td>
                {isServer ? (
                  <>
                    <td>{c.metadata?.cpu_pct != null ? `${c.metadata.cpu_pct}%` : '—'}</td>
                    <td>
                      {c.metadata?.mem_pct != null ? `${c.metadata.mem_pct}%` : '—'}
                      {c.metadata?.mem_used_mb != null && c.metadata?.mem_total_mb != null && (
                        <span style={{ color: '#64748b', fontSize: '0.75rem', marginLeft: '0.3rem' }}>
                          ({(c.metadata.mem_used_mb / 1024).toFixed(1)}/{(c.metadata.mem_total_mb / 1024).toFixed(1)} GB)
                        </span>
                      )}
                    </td>
                    <td>
                      {c.metadata?.disk_pct != null ? `${c.metadata.disk_pct}%` : '—'}
                      {c.metadata?.disk_used_gb != null && c.metadata?.disk_total_gb != null && (
                        <span style={{ color: '#64748b', fontSize: '0.75rem', marginLeft: '0.3rem' }}>
                          ({c.metadata.disk_used_gb}/{c.metadata.disk_total_gb} GB)
                        </span>
                      )}
                    </td>
                    <td style={{ fontSize: '0.78rem' }}>
                      {c.metadata?.disk_read_kbs != null ? `↑ ${formatKbs(c.metadata.disk_read_kbs)}` : '—'}
                      {c.metadata?.disk_write_kbs != null && <span style={{ display: 'block', color: '#f97316' }}>↓ {formatKbs(c.metadata.disk_write_kbs)}</span>}
                    </td>
                    <td style={{ fontSize: '0.78rem' }}>
                      {c.metadata?.net_in_kbs != null ? `↓ ${formatKbs(c.metadata.net_in_kbs)}` : '—'}
                      {c.metadata?.net_out_kbs != null && <span style={{ display: 'block', color: '#f43f5e' }}>↑ {formatKbs(c.metadata.net_out_kbs)}</span>}
                    </td>
                    <td>{c.metadata?.load_1 ?? '—'}</td>
                    <td>{formatUptime(c.metadata?.uptime_seconds)}</td>
                  </>
                ) : (
                  <>
                    <td>{c.status_code ?? '—'}</td>
                    <td>{c.response_time_ms != null ? `${c.response_time_ms} ms` : '—'}</td>
                  </>
                )}
                <td>
                  <span style={{ color: statusColor(c.is_up), fontWeight: 600, fontSize: '0.82rem' }}>
                    {c.is_up ? 'UP' : 'DOWN'}
                  </span>
                  {c.error && <span style={{ color: '#94a3b8', fontSize: '0.78rem', marginLeft: '0.5rem' }}>{c.error}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {checks.length === 0 && <p className="no-data">No checks yet.</p>}
      </div>

      {showMaintModal && (
        <MaintenanceModal
          monitorId={monitor.id}
          windows={maintenanceWindows}
          onClose={() => setShowMaintModal(false)}
          onChanged={() => { load(); }}
        />
      )}
    </div>
  );
}
