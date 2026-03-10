const BASE_URL = import.meta.env.VITE_API_URL || '';

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    credentials: 'include', // send session cookie on every request
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export const login = (username, password) =>
  request('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
export const logout = () => request('/api/auth/logout', { method: 'POST' });
export const getMe = () => request('/api/auth/me');
export const getSetupNeeded = () => request('/api/auth/setup-needed');
export const setupAdmin = (username, password) =>
  request('/api/auth/setup', { method: 'POST', body: JSON.stringify({ username, password }) });
export const changePassword = (current_password, new_password) =>
  request('/api/auth/password', { method: 'PATCH', body: JSON.stringify({ current_password, new_password }) });

// ── Users (admin) ─────────────────────────────────────────────────────────────
export const getUsers = () => request('/api/users');
export const createUser = (data) => request('/api/users', { method: 'POST', body: JSON.stringify(data) });
export const updateUser = (id, data) => request(`/api/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
export const deleteUser = (id) => request(`/api/users/${id}`, { method: 'DELETE' });
export const resetPassword = (id, new_password) =>
  request(`/api/users/${id}/reset-password`, { method: 'POST', body: JSON.stringify({ new_password }) });

// ── Monitor access (admin) ────────────────────────────────────────────────────
export const getMonitorAccess = (monitorId) => request(`/api/monitors/${monitorId}/access`);
export const setMonitorAccess = (monitorId, user_ids) =>
  request(`/api/monitors/${monitorId}/access`, { method: 'PUT', body: JSON.stringify({ user_ids }) });

// ── Monitors ──────────────────────────────────────────────────────────────────
export const getMonitors = () => request('/api/monitors');
export const createMonitor = (data) => request('/api/monitors', { method: 'POST', body: JSON.stringify(data) });
export const updateMonitor = (id, data) => request(`/api/monitors/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
export const deleteMonitor = (id) => request(`/api/monitors/${id}`, { method: 'DELETE' });
export const getChecks = (monitorId, range) => {
  const qs = range ? `?range=${encodeURIComponent(range)}` : '';
  return request(`/api/monitors/${monitorId}/checks${qs}`);
};
export const getIncidents = (monitorId) => request(`/api/monitors/${monitorId}/incidents`);
export const updateIncident = (monitorId, iId, data) =>
  request(`/api/monitors/${monitorId}/incidents/${iId}`, { method: 'PATCH', body: JSON.stringify(data) });
export const addIncidentUpdate = (monitorId, iId, data) =>
  request(`/api/monitors/${monitorId}/incidents/${iId}/updates`, { method: 'POST', body: JSON.stringify(data) });
export const deleteIncidentUpdate = (monitorId, iId, uId) =>
  request(`/api/monitors/${monitorId}/incidents/${iId}/updates/${uId}`, { method: 'DELETE' });
export const getPublicIncidents = () => request('/api/public-incidents');
export const getStatus = () => request('/api/status');
export const getActivity = () => request('/api/activity');

// ── Maintenance windows ───────────────────────────────────────────────────────
export const getMaintenance = (monitorId) => request(`/api/monitors/${monitorId}/maintenance`);
export const createMaintenance = (monitorId, data) =>
  request(`/api/monitors/${monitorId}/maintenance`, { method: 'POST', body: JSON.stringify(data) });
export const updateMaintenance = (monitorId, mwId, data) =>
  request(`/api/monitors/${monitorId}/maintenance/${mwId}`, { method: 'PATCH', body: JSON.stringify(data) });
export const stopMaintenance = (monitorId, mwId) =>
  request(`/api/monitors/${monitorId}/maintenance/${mwId}/stop`, { method: 'POST' });
export const deleteMaintenance = (monitorId, mwId) =>
  request(`/api/monitors/${monitorId}/maintenance/${mwId}`, { method: 'DELETE' });
export const testWebhook = (webhookUrl) => request('/api/webhooks/test', { method: 'POST', body: JSON.stringify({ webhook_url: webhookUrl }) });
export const regenerateToken = (id) => request(`/api/monitors/${id}/regenerate-token`, { method: 'POST' });

