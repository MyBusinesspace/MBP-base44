import { randomUUID } from 'crypto';
import { pool } from '../server/db.js';
import { createEntity, listAllUsers, findUserByEmail } from '../server/entityStore.js';

const testEmail = process.argv[2] || 'test-google-user@example.com';

const existing = await findUserByEmail(testEmail);
if (!existing) {
  const u = await createEntity('User', {
    id: randomUUID(),
    email: testEmail,
    full_name: 'Test Google User',
    role: 'user',
    branch_id: 'local-branch-1',
    company_id: 'local-branch-1',
    sort_order: 999,
    archived: false,
    status: 'Active',
  });
  console.log('Created:', u.id, u.email);
} else {
  console.log('Already exists:', existing.id);
}

const all = await listAllUsers({ limit: 100 });
console.log(
  'All users:',
  all.map((x) => ({ id: x.id, email: x.email, full_name: x.full_name }))
);
await pool.end();
