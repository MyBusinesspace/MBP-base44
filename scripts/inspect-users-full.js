import { pool } from '../server/db.js';
import { entityToTable } from '../server/entitySchema.js';
import { findUserByEmail } from '../server/entityStore.js';

const table = entityToTable('User');
const { rows } = await pool.query(`SELECT * FROM ${table} ORDER BY created_date`);
console.log('COUNT', rows.length);
for (const r of rows) {
  const extra = typeof r.extra === 'string' ? JSON.parse(r.extra) : r.extra;
  console.log({
    id: r.id,
    email: r.email,
    extra_email: extra?.email,
    full_name: r.full_name,
    role: r.role,
  });
}

for (const test of ['newuser.test@gmail.com', 'admin@local.dev', 'random@x.com']) {
  const u = await findUserByEmail(test);
  console.log('findUserByEmail', test, '=>', u ? u.id + ' ' + u.email : null);
}

await pool.end();
