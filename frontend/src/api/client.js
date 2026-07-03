const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8010';

let onUnauthorized = () => {};
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

async function request(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = localStorage.getItem('access_token');
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    onUnauthorized();
    const err = await res.json().catch(() => ({ detail: 'Not authenticated' }));
    throw new ApiError(err.detail || 'Not authenticated', 401);
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `Request failed (${res.status})` }));
    throw new ApiError(err.detail || `Request failed (${res.status})`, res.status);
  }

  if (res.status === 204) return null;
  return res.json();
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  delete: (path) => request(path, { method: 'DELETE' }),
  login: (username, password) =>
    request('/api/admin/login', { method: 'POST', body: { username, password }, auth: false }),
};
