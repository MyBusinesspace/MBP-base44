import { randomUUID } from 'crypto';
import { pool } from './db.js';
import { entityToTable } from './entitySchema.js';
import { getEntityPropertyNames } from './entitySchema.js';
import { normalizeUserForApi, PROTECTED_USER_IDS } from './userNormalize.js';

const USER_COLS = new Set(getEntityPropertyNames('User'));

export async function getUserByEmail(email) {
  const normalized = email?.toLowerCase()?.trim();
  if (!normalized) return null;

  const table = entityToTable('User');
  const { rows } = await pool.query(
    `SELECT * FROM ${table} WHERE LOWER(TRIM(COALESCE(email, ''))) = $1 LIMIT 1`,
    [normalized]
  );
  if (!rows[0]) return null;
  return rowToUser(rows[0]);
}

export async function getUserById(id) {
  const table = entityToTable('User');
  const { rows } = await pool.query(`SELECT * FROM ${table} WHERE id = $1`, [id]);
  if (!rows[0]) return null;
  return rowToUser(rows[0]);
}

function rowToUser(row) {
  const extra = typeof row.extra === 'string' ? JSON.parse(row.extra) : row.extra || {};
  return normalizeUserForApi({
    id: row.id,
    email: row.email,
    full_name: row.full_name,
    role: row.role,
    branch_id: row.branch_id,
    company_id: row.company_id,
    sort_order: row.sort_order,
    archived: row.archived,
    created_date: new Date(row.created_date).toISOString(),
    updated_date: new Date(row.updated_date).toISOString(),
    created_by: row.created_by,
    created_by_id: row.created_by_id,
    ...extra,
  });
}

export async function saveUser(data, { id: preferredId } = {}) {
  const table = entityToTable('User');
  const email = data.email?.toLowerCase()?.trim();
  if (!email) throw new Error('email is required');

  const existing = await getUserByEmail(email);
  const id = existing?.id || preferredId || data.id || randomUUID();

  const cols = { email };
  const extra = {};
  for (const [key, val] of Object.entries(data)) {
    if (['id', 'email', 'created_date', 'updated_date', 'created_by', 'created_by_id'].includes(key))
      continue;
    if (USER_COLS.has(key)) cols[key] = val;
    else if (val !== undefined) extra[key] = val;
  }

  if (cols.full_name) {
    const parts = String(cols.full_name).trim().split(/\s+/).filter(Boolean);
    extra.first_name = data.first_name ?? parts[0] ?? '';
    extra.last_name = data.last_name ?? parts.slice(1).join(' ') ?? '';
  }

  if (existing) {
    const { rows: prev } = await pool.query(`SELECT extra FROM ${table} WHERE id = $1`, [id]);
    const prevExtra =
      typeof prev[0]?.extra === 'string' ? JSON.parse(prev[0].extra) : prev[0]?.extra || {};
    const sets = ['updated_date = NOW()', 'extra = $1::jsonb'];
    const values = [JSON.stringify({ ...prevExtra, ...extra })];
    let i = 2;
    for (const [k, v] of Object.entries(cols)) {
      sets.push(`${k} = $${i}`);
      values.push(v);
      i++;
    }
    values.push(id);
    await pool.query(`UPDATE ${table} SET ${sets.join(', ')} WHERE id = $${i}`, values);
  } else {
    const insertCols = ['id', 'email', 'extra', 'created_by', 'created_by_id'];
    const values = [id, email, JSON.stringify(extra), data.created_by || 'system', data.created_by_id || id];
    const ph = ['$1', '$2', '$3::jsonb', '$4', '$5'];
    let i = 6;
    for (const [k, v] of Object.entries(cols)) {
      if (k === 'email') continue;
      insertCols.push(k);
      values.push(v);
      ph.push(`$${i++}`);
    }
    await pool.query(
      `INSERT INTO ${table} (${insertCols.join(', ')}) VALUES (${ph.join(', ')})`,
      values
    );
  }

  const saved = await getUserById(id);
  if (!saved) throw new Error('User save failed — not found after write');
  console.log('[userPersistence] saved', saved.id, saved.email);
  return saved;
}

export async function saveGoogleUser(profile, branchId) {
  const email = profile.email?.toLowerCase()?.trim();
  if (!email) throw new Error('Google account has no email');

  const googleId = profile.sub ? `google-${profile.sub}` : randomUUID();
  const displayName = (profile.name || email.split('@')[0]).trim();
  const parts = displayName.split(/\s+/).filter(Boolean);
  const now = new Date().toISOString();

  let existing = await getUserById(googleId);
  if (!existing) {
    const byEmail = await getUserByEmail(email);
    // Never attach a Google login to seed admin (old API bug wrote OAuth data into local-admin-user).
    if (byEmail && !PROTECTED_USER_IDS.has(byEmail.id)) {
      existing = byEmail;
    }
  }

  const id = existing?.id || googleId;

  return saveUser(
    {
      id,
      email,
      full_name: displayName,
      first_name: parts[0] || displayName,
      last_name: parts.slice(1).join(' ') || '',
      role: existing?.role || 'user',
      branch_id: branchId,
      company_id: branchId,
      sort_order: existing?.sort_order ?? 999,
      archived: false,
      avatar_url: profile.picture || null,
      last_login: now,
      status: 'Active',
    },
    { id }
  );
}
