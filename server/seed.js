import { pool, runSchema, testConnection } from './db.js';
import { createEntity, getDevUser, updateEntity, getEntity } from './entityStore.js';
import { entityToTable } from './entitySchema.js';
import { hashPassword } from './auth/password.js';

const APP_ID = process.env.VITE_APP_ID || 'mpb-local';
const ADMIN_PASSWORD = process.env.LOCAL_ADMIN_PASSWORD || 'admin123';

async function seed() {
  await runSchema();
  const ok = await testConnection();
  if (!ok) throw new Error('Database connection failed');

  const branchId = 'local-branch-1';
  const user = getDevUser();

  const { rows: existingBranch } = await pool.query(
    `SELECT id FROM ${entityToTable('Branch')} WHERE id = $1`,
    [branchId]
  );

  if (!existingBranch.length) {
    await createEntity('Branch', {
      id: branchId,
      name: 'Red Crane (Local)',
      is_default: true,
    });
    console.log('✓ Seeded Branch');
  }

  const { rows: existingUser } = await pool.query(
    `SELECT id FROM ${entityToTable('User')} WHERE id = $1`,
    [user.id]
  );

  if (!existingUser.length) {
    await createEntity('User', {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      branch_id: branchId,
      company_id: branchId,
      sort_order: 0,
      password: hashPassword(ADMIN_PASSWORD),
      status: 'Active',
    });
    console.log('✓ Seeded User (admin@local.dev)');
  } else {
    const existing = await getEntity('User', user.id);
    if (!existing.password) {
      await updateEntity('User', user.id, { password: hashPassword(ADMIN_PASSWORD) });
      console.log('✓ Set password for admin@local.dev');
    }
  }

  const settings = [
    { setting_key: 'payroll_currency', setting_value: 'AED' },
    { setting_key: 'orders_column_open_label', setting_value: 'Open' },
    { setting_key: 'orders_column_closed_label', setting_value: 'Closed' },
  ];

  const appTable = entityToTable('AppSettings');
  for (const s of settings) {
    const { rows } = await pool.query(
      `SELECT id FROM ${appTable} WHERE setting_key = $1`,
      [s.setting_key]
    );
    if (!rows.length) {
      await createEntity('AppSettings', s);
      console.log(`✓ Seeded AppSettings: ${s.setting_key}`);
    }
  }

  console.log(`\nLocal API ready (app id: ${APP_ID})`);
  console.log(`Login: admin@local.dev / ${ADMIN_PASSWORD}\n`);
}

seed()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
