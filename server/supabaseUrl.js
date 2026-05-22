/**
 * Supabase connection URL helpers.
 * - Direct (db.xxx:5432): migrations, local dev (IPv6 OK on most desktops)
 * - Pooler (aws-*-REGION.pooler.supabase.com:6543): Vercel — IPv4 required
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

/** Resolve IPv4 pooler hostname (Vercel cannot use db.xxx — IPv6 only). */
export function resolvePoolerHost() {
  if (process.env.SUPABASE_POOLER_HOST) {
    return process.env.SUPABASE_POOLER_HOST.replace(/^https?:\/\//, '').split('/')[0];
  }
  let region = process.env.SUPABASE_REGION;
  if (!region && (process.env.VERCEL === '1' || process.env.VERCEL_ENV)) {
    region = 'ap-south-1';
  }
  if (!region) return null;
  const prefix = process.env.SUPABASE_POOLER_PREFIX || 'aws-1';
  return `${prefix}-${region}.pooler.supabase.com`;
}

/** Pooler / mixed URL → direct connection for DDL (migrations). */
export function toSupabaseDirectUrl(urlString) {
  try {
    const url = new URL(urlString);
    const ref = extractProjectRef(urlString);
    if (!ref) return urlString;

    if (/^db\.[a-z0-9]+\.supabase\.co$/i.test(url.hostname)) {
      url.username = 'postgres';
      url.port = '5432';
      url.searchParams.delete('pgbouncer');
      return url.toString();
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

/**
 * Serverless pooler URL (IPv4). db.xxx does NOT work on Vercel (IPv6-only DNS).
 * Set SUPABASE_REGION (from Dashboard) or paste full pooler URI in DATABASE_URL.
 */
export function toSupabasePoolerUrl(urlString) {
  const ref = extractProjectRef(urlString);
  if (!ref) return urlString;

  let url;
  try {
    url = new URL(urlString);
  } catch {
    return urlString;
  }

  const password = url.password ? decodeURIComponent(url.password) : '';

  if (url.hostname.includes('pooler.supabase.com')) {
    const user = url.username === 'postgres' ? `postgres.${ref}` : url.username;
    const port = url.port || '6543';
    return `postgresql://${user}:${encodeURIComponent(password)}@${url.hostname}:${port}/postgres`;
  }

  const poolerHost = resolvePoolerHost();
  if (!poolerHost) {
    throw new Error(
      'Supabase db.* host is IPv6-only and fails on Vercel (ENOTFOUND). ' +
        'In Vercel add SUPABASE_REGION from Dashboard (e.g. ap-south-1) and SUPABASE_POOLER_PREFIX=aws-1, ' +
        'or set DATABASE_URL to the Transaction pooler URI (aws-*-REGION.pooler.supabase.com:6543).'
    );
  }

  return `postgresql://postgres.${ref}:${encodeURIComponent(password)}@${poolerHost}:6543/postgres`;
}
