/**
 * Supabase connection URL helpers.
 * - Direct (db.xxx:5432): migrations, db:setup, local dev
 * - Pooler (postgres.xxx:6543): Vercel / serverless runtime
 */

export function extractProjectRef(urlString) {
  try {
    const url = new URL(urlString);
    if (url.username?.startsWith('postgres.')) {
      return url.username.slice('postgres.'.length);
    }
    const m = url.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/i);
    return m?.[1] || null;
  } catch {
    return null;
  }
}

/** Pooler / mixed URL → direct connection for DDL (migrations). */
export function toSupabaseDirectUrl(urlString) {
  try {
    const url = new URL(urlString);
    const ref = extractProjectRef(urlString);
    if (!ref) return urlString;

    if (/^db\.[a-z0-9]+\.supabase\.co$/i.test(url.hostname) && url.port === '5432') {
      return urlString;
    }

    url.username = 'postgres';
    url.hostname = `db.${ref}.supabase.co`;
    url.port = '5432';
    url.searchParams.delete('pgbouncer');
    return url.toString();
  } catch {
    return urlString;
  }
}

export function isPoolerUrl(urlString) {
  return urlString.includes('pooler.supabase.com') || urlString.includes(':6543');
}
