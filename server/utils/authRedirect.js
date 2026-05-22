import { env } from '../config/env.js';

/**
 * After Google OAuth — redirect back to the SPA with ?auth_token=...
 * On Vercel use same-origin relative URL (avoids malformed WEB_URL → /api/auth/google/=https:/...).
 */
export function buildAuthRedirect(queryString) {
  if (env.isVercel) {
    return `/?${queryString}`;
  }
  const base = env.webUrl;
  return base ? `${base}/?${queryString}` : `/?${queryString}`;
}
