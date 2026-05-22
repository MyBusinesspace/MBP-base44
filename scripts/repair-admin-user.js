/**
 * One-time: align admin extra.first_name/last_name with full_name column (fixes "Cesar" ghost name in UI).
 * Run: node scripts/repair-admin-user.js
 */
import { pool } from '../server/db.js';
import { entityToTable } from '../server/entitySchema.js';

const table = entityToTable('User');
const { rows } = await pool.query(`SELECT id, email, full_name, extra FROM ${table} WHERE id = 'local-admin-user'`);
if (!rows[0]) {
  console.log('No local-admin-user row');
  process.exit(0);
}

const full = (rows[0].full_name || 'Local Admin').trim();
const parts = full.split(/\s+/).filter(Boolean);
const extra =
  typeof rows[0].extra === 'string' ? JSON.parse(rows[0].extra) : { ...(rows[0].extra || {}) };

extra.first_name = parts[0] || full;
extra.last_name = parts.slice(1).join(' ') || '';

await pool.query(`UPDATE ${table} SET extra = $1::jsonb WHERE id = 'local-admin-user'`, [
  JSON.stringify(extra),
]);

console.log('Repaired admin display names →', full);
await pool.end();
