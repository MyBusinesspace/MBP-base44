/**
 * Minimal HTTP client for the local API (no external SDK).
 */
export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

function getAuthHeaders() {
  try {
    const token = localStorage.getItem('mpb_access_token');
    if (token && token !== 'local-dev') {
      return { Authorization: `Bearer ${token}` };
    }
  } catch {
    /* ignore */
  }
  return {};
}

async function request(method, url, { body, headers = {} } = {}) {
  const init = {
    method,
    headers: {
      Accept: 'application/json',
      ...getAuthHeaders(),
      ...headers,
    },
  };

  if (body instanceof FormData) {
    init.body = body;
  } else if (body !== undefined && body !== null) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  const res = await fetch(url, init);
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const message =
      (data && (data.message || data.detail || data.error)) || res.statusText || 'Request failed';
    throw new ApiError(message, res.status, data);
  }

  return data;
}

export const http = {
  get: (url, opts) => request('GET', url, opts),
  post: (url, body, opts) => request('POST', url, { body, ...opts }),
  put: (url, body, opts) => request('PUT', url, { body, ...opts }),
  delete: (url, opts) => request('DELETE', url, opts),
};
