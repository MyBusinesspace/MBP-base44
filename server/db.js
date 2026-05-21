import pg from 'pg';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { generateFullSchemaSQL } from './schemaGenerator.js';
import { normalizeForRuntime, getConnectionDiagnostics } from './connectionConfig.js';

if (!process.env.VERCEL && !process.env.VERCEL_ENV) {
  dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '..', '.env') });
}

const { Pool } = pg;

let connectionString;
let connectionError;

try {
  connectionString = normalizeForRuntime(
    process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/mpb_crm'
  );
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
    process.env.SKIP_SCHEMA_ON_BOOT === 'true' ||
    process.env.VERCEL === '1' ||
    process.env.VERCEL === 'true' ||
    Boolean(process.env.VERCEL_ENV);

  try {
    if (!skipBootSchema) {
      await runSchema();
    }
    return await testConnection();
  } catch (e) {
    if (isSupabasePoolerError(e) || isInvalidDatabaseUrlError(e)) {
      console.error('[db]', e.message);
    } else {
      console.error('[db]', e.message);
    }
    return false;
  }
}
