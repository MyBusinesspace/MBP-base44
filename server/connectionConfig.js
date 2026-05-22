import parse from 'pg-connection-string';
import {
  toSupabaseDirectUrl,
  toSupabasePoolerUrl,
  extractProjectRef,
  isPoolerUrl,
} from './supabaseUrl.js';

/**
 * Parse and validate DATABASE_URL. Incomplete URLs (no @host) parse as host "base" → ENOTFOUND base.
 */
export function prepareDatabaseUrl(raw) {
  if (!raw || typeof raw !== 'string') {
    throw new Error('DATABASE_URL is not set');
  }

  let trimmed = raw.trim().replace(/^["']|["']$/g, '');
  if (trimmed.includes('[') || trimmed.includes('YOUR-PASSWORD')) {
    throw new Error('DATABASE_URL still contains placeholders — paste the real Supabase URI');
  }

  if (!trimmed.startsWith('postgres://') && !trimmed.startsWith('postgresql://')) {
    throw new Error(
      'DATABASE_URL must start with postgresql:// — paste the full URI from Supabase (not just password or host)'
    );
  }

  if (!trimmed.includes('@')) {
    throw new Error(
      'DATABASE_URL is incomplete (missing @hostname). Example: postgresql://postgres.REF:PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres'
    );
  }

  let parsed;
  try {
    parsed = parse(trimmed);
  } catch (e) {
    throw new Error(`DATABASE_URL is invalid: ${e.message}`);
  }

  const host = parsed.host || '';
  if (!host || host === 'base' || host.length < 4) {
    throw new Error(
      `DATABASE_URL resolves to invalid host "${host}". Paste the complete Supabase connection string from Dashboard → Database → URI.`
    );
  }

  const user = parsed.user || 'postgres';
  const password = parsed.password ?? '';
  const port = parsed.port || (isPoolerUrl(trimmed) ? '6543' : '5432');
  const database = (parsed.database || 'postgres').split('?')[0];

  return `postgresql://${user}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}

export function normalizeForRuntime(raw) {
  // Migration scripts only (setup-supabase.ps1 child processes).
  // SKIP_SCHEMA_ON_BOOT only skips DDL in initDatabase() — must NOT force db.xxx on Vercel.
  if (process.env.SUPABASE_FORCE_DIRECT === 'true') {
    return prepareDatabaseUrl(toSupabaseDirectUrl(raw));
  }

  const prepared = prepareDatabaseUrl(raw);
  const ref = extractProjectRef(prepared);

  try {
    const url = new URL(prepared);
    const isAwsPooler = url.hostname.includes('pooler.supabase.com');
    const isDirect = /^db\.[a-z0-9]+\.supabase\.co$/i.test(url.hostname);
    const onVercel =
      (process.env.VERCEL === '1' || process.env.VERCEL === 'true') &&
      Boolean(process.env.VERCEL_ENV);
    const preferPooler = onVercel || process.env.SUPABASE_USE_POOLER === 'true';

    // Pooler URI from Dashboard — keep IPv4 host (never rewrite to db.xxx).
    if (isAwsPooler && ref) {
      if (url.username === 'postgres') {
        url.username = `postgres.${ref}`;
      }
      url.port = url.port || '6543';
      return url.toString().replace(/\?.*$/, '');
    }

    // Direct db.xxx on Vercel → build pooler (db.xxx is IPv6-only → ENOTFOUND).
    if (isDirect && ref && preferPooler) {
      return prepareDatabaseUrl(toSupabasePoolerUrl(raw));
    }

    return prepared;
  } catch (e) {
    if (
      (process.env.VERCEL === '1' || process.env.VERCEL === 'true') &&
      Boolean(process.env.VERCEL_ENV)
    ) {
      throw new Error(`Failed to configure Supabase Pooler URL on Vercel: ${e.message}`);
    }
    return prepared;
  }
}

export function getConnectionDiagnostics(connectionString) {
  try {
    const parsed = parse(connectionString);
    return {
      host: parsed.host,
      port: parsed.port,
      database: parsed.database,
      user: parsed.user,
      is_pooler: (parsed.host || '').includes('pooler'),
    };
  } catch (e) {
    return { error: e.message };
  }
}
