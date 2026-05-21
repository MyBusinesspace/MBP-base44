import pg from 'pg';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { generateFullSchemaSQL } from './schemaGenerator.js';

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '..', '.env') });

const { Pool } = pg;

export const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    'postgresql://mpb:mpb_local@localhost:5432/mpb_crm',
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
