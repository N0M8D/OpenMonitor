const BASE_URL = import.meta.env.VITE_API_URL || '';

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

export const getMonitors = () => request('/api/monitors');
export const createMonitor = (data) => request('/api/monitors', { method: 'POST', body: JSON.stringify(data) });
export const deleteMonitor = (id) => request(`/api/monitors/${id}`, { method: 'DELETE' });
export const getChecks = (monitorId) => request(`/api/monitors/${monitorId}/checks`);
