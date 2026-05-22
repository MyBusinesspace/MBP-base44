import parse from 'pg-connection-string';
import { isVercelRuntime } from './config/env.js';
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

/** Host from raw DATABASE_URL env (for diagnostics). */
export function getEnvDatabaseHost(raw = process.env.DATABASE_URL) {
  try {
    const parsed = parse(prepareDatabaseUrl(raw));
    return parsed.host || null;
  } catch {
    return null;
  }
}

function isDbIpv6Host(hostname) {
  return /^db\.[a-z0-9]+\.supabase\.co$/i.test(hostname || '');
}

export function normalizeForRuntime(raw) {
  if (!raw || typeof raw !== 'string') {
    throw new Error('DATABASE_URL is not set');
  }

  const trimmed = raw.trim();

  // Migration scripts only (setup-supabase.ps1 child processes).
  if (process.env.SUPABASE_FORCE_DIRECT === 'true') {
    return prepareDatabaseUrl(toSupabaseDirectUrl(trimmed));
  }

  // Pooler URI from Dashboard — never rewrite to db.xxx (critical for Vercel).
  if (trimmed.includes('pooler.supabase.com')) {
    return prepareDatabaseUrl(trimmed);
  }

  const prepared = prepareDatabaseUrl(trimmed);
  const ref = extractProjectRef(prepared);

  try {
    const url = new URL(prepared);
    const isDirect = isDbIpv6Host(url.hostname);
    const onVercel = isVercelRuntime();
    const preferPooler = onVercel || process.env.SUPABASE_USE_POOLER === 'true';

    if (isDirect && ref && preferPooler) {
      return prepareDatabaseUrl(toSupabasePoolerUrl(trimmed));
    }

    let result = prepared;

    // Safety net: Vercel must never use db.xxx (IPv6-only → ENOTFOUND).
    if (onVercel && isDbIpv6Host(new URL(result).hostname)) {
      result = prepareDatabaseUrl(toSupabasePoolerUrl(trimmed));
    }

    return result;
  } catch (e) {
    if (isVercelRuntime()) {
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
