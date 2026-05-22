import { pool } from '../server/db.js';
import { syncLegacyUsersToTables, countUsersInDb } from '../server/syncLegacyUsers.js';

console.log('counts before:', await countUsersInDb());
await syncLegacyUsersToTables();
console.log('counts after:', await countUsersInDb());

const ent = await pool.query(
  `SELECT id, email, full_name, role FROM ent_user ORDER BY created_date`
);
console.log('\n=== ent_user ===');
for (const r of ent.rows) console.log(r);

const leg = await pool.query(
  `SELECT id, data->>'email' AS email, data->>'full_name' AS name, data->>'role' AS role
   FROM entity_records WHERE entity_name = 'User' ORDER BY created_date`
);
console.log('\n=== entity_records (User) ===');
for (const r of leg.rows) console.log(r);

await pool.end();
process.exit(0);
