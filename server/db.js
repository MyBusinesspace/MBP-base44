import pg from 'pg';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { generateFullSchemaSQL } from './schemaGenerator.js';

if (!process.env.VERCEL && !process.env.VERCEL_ENV) {
  dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '..', '.env') });
}

const { Pool } = pg;

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/mpb_crm';

const isSupabase =
  connectionString.includes('supabase.com') ||
  connectionString.includes('supabase.co') ||
  process.env.SUPABASE_DB === 'true';

export const pool = new Pool({
  connectionString,
  ssl: isSupabase ? { rejectUnauthorized: false } : undefined,
  max: isSupabase ? 3 : 10,
});

export async function runSchema() {
  const basePath = join(dirname(fileURLToPath(import.meta.url)), 'schema.sql');
  const baseSql = readFileSync(basePath, 'utf8');
  await pool.query(baseSql);

  const { sql: tablesSql } = generateFullSchemaSQL();
  await pool.query(tablesSql);
}

export async function testConnection() {
  const r = await pool.query('SELECT 1 AS ok');
  return r.rows[0]?.ok === 1;
}

/** Local: run migrations on boot. Vercel/Supabase: run `npm run db:setup` once manually. */
export async function initDatabase() {
  const url = process.env.DATABASE_URL || '';
  if (!url || url.includes('[') || url.includes('YOUR-PASSWORD')) {
    console.error('[db] Invalid DATABASE_URL — set Supabase URI in Vercel Environment Variables');
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
    console.error('[db]', e.message);
    return false;
  }
}
