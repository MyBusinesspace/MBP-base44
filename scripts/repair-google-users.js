/**
 * One-time: ensure Google logins have their own ent_user row (not merged into local-admin-user).
 * Usage: node scripts/repair-google-users.js your@gmail.com
 */
import '../server/db.js';
import { pool } from '../server/db.js';
import { entityToTable } from '../server/entitySchema.js';
import { saveGoogleUser } from '../server/userPersistence.js';
import { getDefaultBranchId } from '../server/auth/branch.js';

const email = process.argv[2]?.toLowerCase()?.trim();
if (!email) {
  console.error('Usage: node scripts/repair-google-users.js your@gmail.com');
  process.exit(1);
}

const table = entityToTable('User');
const branchId = await getDefaultBranchId();

const { rows } = await pool.query(`SELECT * FROM ${table} WHERE LOWER(email) = $1`, [email]);
const admin = await pool.query(`SELECT * FROM ${table} WHERE id = 'local-admin-user'`);

if (rows[0] && rows[0].id !== 'local-admin-user') {
  console.log('User already exists:', rows[0].id, rows[0].email);
  process.exit(0);
}

const extra =
  typeof admin.rows[0]?.extra === 'string'
    ? JSON.parse(admin.rows[0].extra)
    : admin.rows[0]?.extra || {};

const displayName =
  [extra.first_name, extra.last_name].filter(Boolean).join(' ') ||
  admin.rows[0]?.full_name ||
  email.split('@')[0];

const saved = await saveGoogleUser(
  {
    sub: `repair-${email.replace(/[^a-z0-9]/gi, '-')}`,
    email,
    name: displayName,
    picture: extra.avatar_url || null,
  },
  branchId
);

console.log('Created/updated Google user:', saved.id, saved.email, saved.full_name);
