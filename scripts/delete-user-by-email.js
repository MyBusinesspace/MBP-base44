import { pool } from '../server/db.js';
import { entityToTable } from '../server/entitySchema.js';

const email = process.argv[2];
if (!email) {
  console.error('Usage: node scripts/delete-user-by-email.js <email>');
  process.exit(1);
}
const table = entityToTable('User');
await pool.query(`DELETE FROM ${table} WHERE LOWER(email) = LOWER($1)`, [email]);
console.log('Deleted:', email);
await pool.end();
