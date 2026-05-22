import { http } from './http.js';

const APP_ID = import.meta.env.VITE_APP_ID || 'mpb-local';

function entityHandler(entityName) {
  const base = `/apps/${APP_ID}/entities/${entityName}`;

  return {
    list(sort, limit, skip, fields) {
      const params = new URLSearchParams();
      if (sort) params.set('sort', sort);
      if (limit) params.set('limit', String(limit));
      if (skip) params.set('skip', String(skip));
      if (fields) {
        params.set('fields', Array.isArray(fields) ? fields.join(',') : fields);
      }
      const q = params.toString();
      return http.get(q ? `${base}?${q}` : base);
    },

    filter(query, sort, limit, skip, fields) {
      const params = new URLSearchParams({ q: JSON.stringify(query) });
      if (sort) params.set('sort', sort);
      if (limit) params.set('limit', String(limit));
      if (skip) params.set('skip', String(skip));
      if (fields) {
        params.set('fields', Array.isArray(fields) ? fields.join(',') : fields);
      }
      return http.get(`${base}?${params}`);
    },

    get(id) {
      return http.get(`${base}/${id}`);
    },

    create(data) {
      return http.post(base, data);
    },

    update(id, data) {
      return http.put(`${base}/${id}`, data);
    },

    delete(id) {
      return http.delete(`${base}/${id}`);
    },

    deleteMany(query) {
      return http.delete(base, { body: query });
    },

    bulkCreate(data) {
      return http.post(`${base}/bulk`, data);
    },

    bulkUpdate(data) {
      return http.put(`${base}/bulk`, data);
    },

    updateMany(query, data) {
      return http.post(`${base}/update-many`, { query, data });
    },

    subscribe(_callback) {
      return () => {};
    },
  };
}

function createEntitiesModule() {
  return new Proxy(
    {},
    {
      get(_target, entityName) {
        if (typeof entityName !== 'string' || entityName === 'then' || entityName.startsWith('_')) {
          return undefined;
        }
        return entityHandler(entityName);
      },
    }
  );
}

function createIntegrationsModule() {
  return new Proxy(
    {},
    {
      get(_target, packageName) {
        if (typeof packageName !== 'string' || packageName === 'then') return undefined;
        return new Proxy(
          {},
          {
            get(_t, endpointName) {
              if (typeof endpointName !== 'string' || endpointName === 'then') return undefined;
              return async (data) => {
                let body = data;
                let headers = {};
                if (data instanceof FormData) {
                  body = data;
                } else if (data && Object.values(data).some((v) => v instanceof File)) {
                  body = new FormData();
                  Object.entries(data).forEach(([k, v]) => {
                    if (v instanceof File) body.append(k, v, v.name);
                    else if (typeof v === 'object' && v !== null) body.append(k, JSON.stringify(v));
                    else body.append(k, v);
                  });
                }
                const url =
                  packageName === 'Core'
                    ? `/apps/${APP_ID}/integration-endpoints/Core/${endpointName}`
                    : `/apps/${APP_ID}/integration-endpoints/installable/${packageName}/integration-endpoints/${endpointName}`;
                return http.post(url, body, { headers });
              };
            },
          }
        );
      },
    }
  );
}

export function createAppClient() {
  const entities = createEntitiesModule();

  return {
    entities,
    integrations: createIntegrationsModule(),

    auth: {
      me: () => http.get('/api/auth/me'),
      updateMe: (data) => http.put(`/apps/${APP_ID}/entities/User/me`, data),
      logout(redirectUrl) {
        try {
          localStorage.removeItem('mpb_access_token');
          localStorage.removeItem('token');
          localStorage.removeItem('viewAsUser');
        } catch {
          /* ignore */
        }
        window.dispatchEvent(new Event('mpb:logout'));
        try {
          sessionStorage.setItem('mpb_logged_out', '1');
        } catch {
          /* ignore */
        }
        fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
        if (redirectUrl !== false && typeof window !== 'undefined') {
          window.location.href = redirectUrl || '/';
        }
      },
      redirectToLogin() {
        if (typeof window !== 'undefined') {
          window.location.href = '/';
        }
      },
      loginWithRedirect() {
        if (typeof window !== 'undefined') {
          window.location.href = '/api/auth/google';
        }
      },
    },

    functions: {
      invoke(functionName, data, options = {}) {
        const method = (options.method || 'POST').toUpperCase();
        const url = `/apps/${APP_ID}/functions/${functionName}`;
        if (method === 'DELETE') return http.delete(url);
        if (method === 'GET') return http.get(url);
        return http.post(url, data ?? {});
      },
    },

    asServiceRole: {
      entities,
    },

    // No-op stubs (were Base44 cloud-only features)
    appLogs: {
      logUserInApp: async () => {},
    },
    analytics: {
      track: async () => {},
    },
    agents: {
      getWhatsAppConnectURL: () => null,
      listConversations: async () => [],
      subscribeToConversation: () => () => {},
      createConversation: async () => ({ id: 'local-conversation' }),
      addMessage: async () => ({}),
    },
  };
}

/** Primary app API — fully local, no Base44 cloud. */
export const api = createAppClient();
