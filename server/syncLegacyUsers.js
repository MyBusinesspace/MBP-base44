import { pool } from './db.js';
import { createEntity } from './entityStore.js';
import { entityToTable } from './entitySchema.js';
import { PROTECTED_USER_IDS } from './userNormalize.js';

/** Copy User rows from entity_records → ent_user (Supabase Table Editor often only shows ent_user). */
export async function syncLegacyUsersToTables() {
  const table = entityToTable('User');
  const { rows: legacy } = await pool.query(
    `SELECT id, data, created_by, created_by_id FROM entity_records WHERE entity_name = 'User'`
  );
  if (!legacy.length) return 0;

  let synced = 0;
  for (const row of legacy) {
    const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data || {};
    const email = data.email?.toLowerCase?.();
    if (!email) continue;

    const { rows: exists } = await pool.query(
      `SELECT id FROM ${table} WHERE id = $1 OR LOWER(email) = $2 LIMIT 1`,
      [row.id, email]
    );
    if (exists.length) continue;

    await createEntity(
      'User',
      {
        ...data,
        id: row.id,
        email,
        status: data.status || 'Active',
        archived: data.archived ?? false,
      },
      { created_by: row.created_by, created_by_id: row.created_by_id }
    );
    synced++;
  }
  if (synced) console.log(`[db] Synced ${synced} User(s) from entity_records → ent_user`);
  return synced;
}

/** Keep seed admin extra.first_name/last_name aligned with full_name (legacy UI reads both). */
export async function repairProtectedUserDisplayNames() {
  const table = entityToTable('User');
  for (const id of PROTECTED_USER_IDS) {
    const { rows } = await pool.query(
      `SELECT full_name, extra FROM ${table} WHERE id = $1`,
      [id]
    );
    if (!rows[0]) continue;
    const full = String(rows[0].full_name || '').trim();
    if (!full) continue;
    const parts = full.split(/\s+/).filter(Boolean);
    const extra =
      typeof rows[0].extra === 'string' ? JSON.parse(rows[0].extra) : { ...(rows[0].extra || {}) };
    extra.first_name = parts[0] || full;
    extra.last_name = parts.slice(1).join(' ') || '';
    await pool.query(`UPDATE ${table} SET extra = $1::jsonb WHERE id = $2`, [
      JSON.stringify(extra),
      id,
    ]);
  }
}

export async function countUsersInDb() {
  const table = entityToTable('User');
  const ent = await pool.query(`SELECT COUNT(*)::int AS c FROM ${table}`);
  const legacy = await pool.query(
    `SELECT COUNT(*)::int AS c FROM entity_records WHERE entity_name = 'User'`
  );
  return {
    ent_user: ent.rows[0]?.c ?? 0,
    entity_records: legacy.rows[0]?.c ?? 0,
  };
}
