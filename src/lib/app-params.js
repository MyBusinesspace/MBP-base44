/**
 * App runtime params (local-only; no Base44 OAuth).
 */
const storage = typeof window !== 'undefined' ? window.localStorage : null;

export const appParams = {
  appId: import.meta.env.VITE_APP_ID || 'mpb-local',
  token: storage?.getItem('mpb_access_token') || null,
};
