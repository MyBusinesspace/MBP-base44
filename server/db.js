import pg from 'pg';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { generateFullSchemaSQL } from './schemaGenerator.js';
import { prepareDatabaseUrl, getConnectionDiagnostics } from './connectionConfig.js';
import { isVercelRuntime } from './config/env.js';
import {
  toSupabaseDirectUrl,
  toSupabasePoolerUrl,
  extractProjectRef,
} from './supabaseUrl.js';

if (!process.env.VERCEL && !process.env.VERCEL_ENV) {
  dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '..', '.env') });
}

const { Pool } = pg;

/**
 * Resolve DB URL for runtime. Vercel cannot use db.xxx (IPv6-only).
 * SKIP_SCHEMA_ON_BOOT must never force direct on serverless.
 */
function resolveConnectionString() {
  const raw = (process.env.DATABASE_URL || '').trim();
  const poolerEnv = (process.env.DATABASE_POOLER_URL || process.env.SUPABASE_DATABASE_URL || '').trim();
  const defaultLocal = 'postgresql://postgres:postgres@localhost:5432/mpb_crm';

  if (process.env.SUPABASE_FORCE_DIRECT === 'true') {
    return prepareDatabaseUrl(toSupabaseDirectUrl(raw || defaultLocal));
  }

  if (isVercelRuntime()) {
    if (poolerEnv.includes('pooler.supabase.com')) {
      return prepareDatabaseUrl(poolerEnv);
    }
    if (raw.includes('pooler.supabase.com')) {
      return prepareDatabaseUrl(raw);
    }
    if (raw) {
      try {
        return prepareDatabaseUrl(toSupabasePoolerUrl(raw));
      } catch (e) {
        const ref = extractProjectRef(raw);
        if (ref === 'aevwxwintewlcgxwvkrc') {
          const url = new URL(prepareDatabaseUrl(raw));
          const pass = url.password ? decodeURIComponent(url.password) : '';
          console.warn('[db] Using pooler fallback aws-1-ap-south-1 for Vercel');
          return `postgresql://postgres.${ref}:${encodeURIComponent(pass)}@aws-1-ap-south-1.pooler.supabase.com:6543/postgres`;
        }
        throw e;
      }
    }
    throw new Error('DATABASE_URL is not set on Vercel');
  }

  if (!raw) return defaultLocal;
  if (raw.includes('pooler.supabase.com')) {
    return prepareDatabaseUrl(raw);
  }
  return prepareDatabaseUrl(raw);
}

let connectionString;
let connectionError;

try {
  connectionString = resolveConnectionString();
  if (isVercelRuntime()) {
    console.log('[db] Vercel host:', getConnectionDiagnostics(connectionString).host);
  }
} catch (e) {
  connectionError = e;
  console.error('[db]', e.message);
  connectionString = 'postgresql://postgres:postgres@localhost:5432/mpb_crm';
}

const isSupabase =
  connectionString.includes('supabase.com') ||
  connectionString.includes('supabase.co') ||
  process.env.SUPABASE_DB === 'true';

export const pool = new Pool({
  connectionString,
  ssl: isSupabase ? { rejectUnauthorized: false } : undefined,
  max: isSupabase ? 3 : 10,
});

export function getDbConfigError() {
  return connectionError?.message || null;
}

export function isSupabasePoolerError(err) {
  const msg = String(err?.message || err || '');
  return (
    msg.includes('Tenant or user not found') ||
    msg.includes('password authentication failed') ||
    msg.includes('ENOTFOUND base')
  );
}

export function isInvalidDatabaseUrlError(err) {
  const msg = String(err?.message || err || '');
  return (
    msg.includes('ENOTFOUND base') ||
    (msg.includes('ENOTFOUND') && msg.includes('db.') && msg.includes('supabase.co')) ||
    msg.includes('incomplete') ||
    msg.includes('invalid host') ||
    msg.includes('DATABASE_URL')
  );
}

export function getSafeDbDiagnostics() {
  return getConnectionDiagnostics(connectionString);
}

export async function runSchema() {
  if (connectionError) throw connectionError;
  const basePath = join(dirname(fileURLToPath(import.meta.url)), 'schema.sql');
  const baseSql = readFileSync(basePath, 'utf8');
  await pool.query(baseSql);

  const { sql: tablesSql } = generateFullSchemaSQL();
  await pool.query(tablesSql);
}

export async function testConnection() {
  if (connectionError) throw connectionError;
  const r = await pool.query('SELECT 1 AS ok');
  return r.rows[0]?.ok === 1;
}

export async function initDatabase() {
  if (connectionError) {
    console.error('[db]', connectionError.message);
    return false;
  }

  const skipBootSchema =
    process.env.SKIP_SCHEMA_ON_BOOT === 'true' || isVercelRuntime();

  try {
    if (!skipBootSchema) {
      await runSchema();
    }
    const ok = await testConnection();
    if (ok) {
      const { syncLegacyUsersToTables } = await import('./syncLegacyUsers.js');
      await syncLegacyUsersToTables();
    }
    return ok;
  } catch (e) {
    console.error('[db]', e.message);
    return false;
  }
}
