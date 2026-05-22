import { randomUUID } from 'crypto';
import { pool } from './db.js';
import { getEntityRegistry, getTableName, getEntityPropertyNames } from './entitySchema.js';
import { env } from './config/env.js';
import { normalizeUserForApi, normalizeUsersForApi } from './userNormalize.js';

const DEV_USER = {
  id: 'local-admin-user',
  email: 'admin@local.dev',
  full_name: 'Local Admin',
  role: 'admin',
  branch_id: 'local-branch-1',
  company_id: 'local-branch-1',
  sort_order: 0,
};

const SERVER_FIELDS = new Set(['id', 'created_date', 'updated_date', 'created_by', 'created_by_id']);

export function getDevUser() {
  return {
    ...DEV_USER,
    created_date: new Date().toISOString(),
    updated_date: new Date().toISOString(),
    created_by: DEV_USER.email,
    created_by_id: DEV_USER.id,
  };
}

function shouldInjectDevUser() {
  return !env.googleOAuthClientId && !env.isVercel && process.env.AUTH_REQUIRED !== 'true';
}

/** Strict email lookup — never return a random user from listEntities. */
export async function findUserByEmail(email) {
  const normalized = email?.toLowerCase()?.trim();
  if (!normalized) return null;

  const table = getTableName('User');
  const { rows } = await pool.query(
    `SELECT * FROM ${table}
     WHERE LOWER(TRIM(email)) = $1
        OR LOWER(TRIM(extra->>'email')) = $1
     LIMIT 1`,
    [normalized]
  );
  if (rows[0]) return normalizeUserForApi(recordFromRow(rows[0], 'User'));

  const legacy = await pool.query(
    `SELECT id, data, created_by, created_by_id FROM entity_records
     WHERE entity_name = 'User' AND LOWER(TRIM(data->>'email')) = $1 LIMIT 1`,
    [normalized]
  );
  if (!legacy.rows[0]) return null;

  const data =
    typeof legacy.rows[0].data === 'string'
      ? JSON.parse(legacy.rows[0].data)
      : legacy.rows[0].data || {};
  return normalizeUserForApi(
    await createEntity(
      'User',
      {
        ...data,
        id: legacy.rows[0].id,
        email: normalized,
        status: data.status || 'Active',
        archived: data.archived ?? false,
      },
      { created_by: legacy.rows[0].created_by, created_by_id: legacy.rows[0].created_by_id }
    )
  );
}

/** All users for Users page — ent_user + legacy entity_records (deduped). */
export async function listAllUsers({ sort, limit = 5000, skip = 0, query } = {}) {
  const { syncLegacyUsersToTables } = await import('./syncLegacyUsers.js');
  await syncLegacyUsersToTables();

  const table = getTableName('User');
  const { rows } = await pool.query(`SELECT * FROM ${table} ORDER BY sort_order ASC NULLS LAST, created_date ASC`);
  const byId = new Map();
  for (const row of rows) {
    const rec = normalizeUserForApi(recordFromRow(row, 'User'));
    if (rec?.id) byId.set(rec.id, rec);
  }

  const legacy = await pool.query(
    `SELECT id, data FROM entity_records WHERE entity_name = 'User'`
  );
  for (const row of legacy.rows) {
    if (byId.has(row.id)) continue;
    const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data || {};
    if (!data.email) continue;
    byId.set(row.id, normalizeUserForApi({ ...data, id: row.id }));
  }

  let records = Array.from(byId.values());
  if (query && Object.keys(query).length > 0) {
    records = records.filter((r) => matchQuery(r, query));
  }
  records = sortRecords(records, sort);
  const lim = Math.min(Number(limit) || 5000, 5000);
  const sk = Number(skip) || 0;
  return records.slice(sk, sk + lim);
}

function safeColumn(name) {
  if (!name || !/^[a-z_][a-z0-9_]*$/i.test(name)) {
    throw new Error(`Invalid column: ${name}`);
  }
  return name;
}

function parseSort(sort) {
  if (!sort) return { field: 'created_date', dir: 'DESC' };
  const s = String(sort);
  if (s.startsWith('-')) return { field: s.slice(1), dir: 'DESC' };
  if (s.startsWith('+')) return { field: s.slice(1), dir: 'ASC' };
  return { field: s, dir: 'ASC' };
}

function recordFromRow(row, entityName) {
  const props = getEntityPropertyNames(entityName);
  const record = {
    id: row.id,
    created_date: new Date(row.created_date).toISOString(),
    updated_date: new Date(row.updated_date).toISOString(),
  };
  if (row.created_by != null) record.created_by = row.created_by;
  if (row.created_by_id != null) record.created_by_id = row.created_by_id;

  for (const key of props) {
    if (row[key] !== undefined && row[key] !== null) {
      record[key] = row[key];
    }
  }
  const extra = row.extra;
  if (extra && typeof extra === 'object') {
    Object.assign(record, extra);
  }
  return record;
}

function splitPayload(entityName, data) {
  const props = new Set(getEntityPropertyNames(entityName));
  const cols = {};
  const extra = {};
  for (const [key, val] of Object.entries(data)) {
    if (SERVER_FIELDS.has(key)) continue;
    if (props.has(key)) cols[key] = val;
    else extra[key] = val;
  }
  return { cols, extra };
}

function matchValue(fieldVal, criteria) {
  if (criteria === null || criteria === undefined) {
    return fieldVal === null || fieldVal === undefined;
  }
  if (criteria === false) {
    return fieldVal === false || fieldVal === undefined || fieldVal === null;
  }
  if (criteria === true) return fieldVal === true;
  if (Array.isArray(criteria)) {
    return criteria.some((c) => matchValue(fieldVal, c));
  }
  if (typeof criteria === 'object' && criteria !== null && !Array.isArray(criteria)) {
    if (criteria.$eq !== undefined) return fieldVal === criteria.$eq;
    if (criteria.$ne !== undefined) return fieldVal !== criteria.$ne;
    if (criteria.$in !== undefined) {
      return Array.isArray(criteria.$in) && criteria.$in.includes(fieldVal);
    }
    if (criteria.$nin !== undefined) {
      return Array.isArray(criteria.$nin) && !criteria.$nin.includes(fieldVal);
    }
    if (criteria.$gt !== undefined) return fieldVal > criteria.$gt;
    if (criteria.$gte !== undefined) return fieldVal >= criteria.$gte;
    if (criteria.$lt !== undefined) return fieldVal < criteria.$lt;
    if (criteria.$lte !== undefined) return fieldVal <= criteria.$lte;
    if (criteria.$exists !== undefined) {
      const exists = fieldVal !== null && fieldVal !== undefined;
      return criteria.$exists ? exists : !exists;
    }
    if (criteria.$regex !== undefined) {
      return new RegExp(criteria.$regex, 'i').test(String(fieldVal ?? ''));
    }
    if (criteria.$not !== undefined) return !matchValue(fieldVal, criteria.$not);
  }
  return fieldVal === criteria;
}

function matchQuery(record, query) {
  if (!query || typeof query !== 'object') return true;
  if (query.$and) return query.$and.every((q) => matchQuery(record, q));
  if (query.$or) return query.$or.some((q) => matchQuery(record, q));
  if (query.$nor) return !query.$nor.some((q) => matchQuery(record, q));
  return Object.entries(query).every(([key, val]) => {
    if (key.startsWith('$')) return true;
    return matchValue(record[key], val);
  });
}

/** Build SQL WHERE for simple filters (single-table columns). */
function buildSqlFilter(entityName, query, params) {
  if (!query || Object.keys(query).length === 0) return { clause: '', params };

  const props = new Set(getEntityPropertyNames(entityName));
  const parts = [];

  for (const [key, val] of Object.entries(query)) {
    if (key.startsWith('$') || !props.has(key)) continue;
    const col = safeColumn(key);

    if (val === false) {
      parts.push(`(${col} IS NULL OR ${col} = false)`);
      continue;
    }
    if (val === true) {
      parts.push(`${col} = true`);
      continue;
    }
    if (val === null) {
      parts.push(`${col} IS NULL`);
      continue;
    }
    if (typeof val !== 'object') {
      params.push(val);
      parts.push(`${col} = $${params.length}`);
      continue;
    }
    if (val.$eq !== undefined) {
      params.push(val.$eq);
      parts.push(`${col} = $${params.length}`);
    } else if (val.$in && Array.isArray(val.$in)) {
      params.push(val.$in);
      parts.push(`${col} = ANY($${params.length})`);
    } else if (val.$ne !== undefined) {
      params.push(val.$ne);
      parts.push(`${col} IS DISTINCT FROM $${params.length}`);
    }
  }

  if (query.$and) {
    for (const sub of query.$and) {
      const subFilter = buildSqlFilter(entityName, sub, params);
      if (subFilter.clause) parts.push(`(${subFilter.clause.replace(/^ AND /, '')})`);
    }
  }

  if (parts.length === 0) return { clause: '', params, needsMemoryFilter: true };
  return { clause: ` AND ${parts.join(' AND ')}`, params, needsMemoryFilter: false };
}

export async function listEntities(entityName, { sort, limit = 50, skip = 0, query } = {}) {
  if (entityName === 'User') {
    return listAllUsers({ sort, limit, skip, query });
  }

  const table = getTableName(entityName);
  if (!table) {
    return legacyListEntities(entityName, { sort, limit, skip, query });
  }

  const { field, dir } = parseSort(sort);
  const sortCol = safeColumn(
    ['id', 'created_date', 'updated_date', ...getEntityPropertyNames(entityName)].includes(field)
      ? field
      : 'created_date'
  );
  const lim = Math.min(Number(limit) || 50, 5000);
  const sk = Number(skip) || 0;

  const params = [];
  const { clause, needsMemoryFilter } = buildSqlFilter(entityName, query, params);

  const hasComplexQuery =
    needsMemoryFilter ||
    query?.$or ||
    query?.$nor ||
    Object.keys(query || {}).some((k) => k.startsWith('$') && k !== '$and');

  if (hasComplexQuery) {
    const { rows } = await pool.query(`SELECT * FROM ${table}`);
    let records = rows.map((r) => recordFromRow(r, entityName));
    if (query && Object.keys(query).length > 0) {
      records = records.filter((r) => matchQuery(r, query));
    }
    if (entityName === 'User' && records.length === 0 && shouldInjectDevUser()) {
      records = [getDevUser()];
    }
    records = sortRecords(records, sort);
    const slice = records.slice(sk, sk + lim);
    return entityName === 'User' ? normalizeUsersForApi(slice) : slice;
  }

  params.push(lim, sk);
  const sql = `SELECT * FROM ${table} WHERE 1=1${clause} ORDER BY ${sortCol} ${dir} LIMIT $${params.length - 1} OFFSET $${params.length}`;
  const { rows } = await pool.query(sql, params);
  let records = rows.map((r) => recordFromRow(r, entityName));

  if (entityName === 'User' && records.length === 0 && sk === 0 && shouldInjectDevUser()) {
    records = [getDevUser()];
  }
  return entityName === 'User' ? normalizeUsersForApi(records) : records;
}

function sortRecords(records, sort) {
  const { field, dir } = parseSort(sort);
  const mult = dir === 'DESC' ? -1 : 1;
  return [...records].sort((a, b) => {
    const av = a[field];
    const bv = b[field];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * mult;
    return String(av).localeCompare(String(bv)) * mult;
  });
}

export async function getEntity(entityName, id) {
  const table = getTableName(entityName);
  if (!table) return legacyGetEntity(entityName, id);

  const { rows } = await pool.query(`SELECT * FROM ${table} WHERE id = $1`, [id]);
  if (!rows[0]) {
    const err = new Error('Not found');
    err.status = 404;
    throw err;
  }
  const record = recordFromRow(rows[0], entityName);
  return entityName === 'User' ? normalizeUserForApi(record) : record;
}

export async function createEntity(entityName, data, meta = {}) {
  const table = getTableName(entityName);
  const id = data.id || randomUUID();
  const dev = getDevUser();
  const { cols, extra } = splitPayload(entityName, data);

  if (!table) return legacyCreateEntity(entityName, data, meta);

  const insertCols = ['id', 'created_by', 'created_by_id', 'extra'];
  const values = [
    id,
    meta.created_by || dev.email,
    meta.created_by_id || dev.id,
    JSON.stringify(extra),
  ];
  const ph = ['$1', '$2', '$3', '$4::jsonb'];
  let idx = 5;

  for (const [key, val] of Object.entries(cols)) {
    safeColumn(key);
    insertCols.push(key);
    if (val !== null && typeof val === 'object') {
      ph.push(`$${idx}::jsonb`);
      values.push(JSON.stringify(val));
    } else {
      ph.push(`$${idx}`);
      values.push(val);
    }
    idx++;
  }

  await pool.query(
    `INSERT INTO ${table} (${insertCols.join(', ')}) VALUES (${ph.join(', ')})`,
    values
  );

  return getEntity(entityName, id);
}

export async function updateEntity(entityName, id, data) {
  const table = getTableName(entityName);
  if (!table) return legacyUpdateEntity(entityName, id, data);

  const existing = await getEntity(entityName, id);
  const merged = { ...existing, ...data };
  const { cols, extra } = splitPayload(entityName, merged);

  const sets = ['updated_date = NOW()', `extra = $1::jsonb`];
  const values = [JSON.stringify(extra)];
  for (const [key, val] of Object.entries(cols)) {
    if (SERVER_FIELDS.has(key)) continue;
    safeColumn(key);
    values.push(val !== null && typeof val === 'object' ? JSON.stringify(val) : val);
    const cast = val !== null && typeof val === 'object' ? '::jsonb' : '';
    sets.push(`${key} = $${values.length}${cast}`);
  }
  values.push(id);
  await pool.query(`UPDATE ${table} SET ${sets.join(', ')} WHERE id = $${values.length}`, values);
  return getEntity(entityName, id);
}

export async function deleteEntity(entityName, id) {
  const table = getTableName(entityName);
  if (!table) return legacyDeleteEntity(entityName, id);

  const r = await pool.query(`DELETE FROM ${table} WHERE id = $1`, [id]);
  if (r.rowCount === 0) {
    const err = new Error('Not found');
    err.status = 404;
    throw err;
  }
  return { success: true };
}

export async function bulkCreate(entityName, items) {
  const out = [];
  for (const item of items) out.push(await createEntity(entityName, item));
  return out;
}

/* Legacy fallback (entity_records) for unknown entity types */
async function legacyListEntities(entityName, opts) {
  const { rows } = await pool.query(
    'SELECT * FROM entity_records WHERE entity_name = $1',
    [entityName]
  );
  let records = rows.map((row) => {
    const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data || {};
    return { ...data, id: row.id, created_date: new Date(row.created_date).toISOString(), updated_date: new Date(row.updated_date).toISOString() };
  });
  if (opts.query && Object.keys(opts.query).length > 0) {
    records = records.filter((r) => matchQuery(r, opts.query));
  }
  records = sortRecords(records, opts.sort);
  const lim = Math.min(Number(opts.limit) || 50, 5000);
  const sk = Number(opts.skip) || 0;
  return records.slice(sk, sk + lim);
}

async function legacyGetEntity(entityName, id) {
  const { rows } = await pool.query(
    'SELECT * FROM entity_records WHERE entity_name = $1 AND id = $2',
    [entityName, id]
  );
  if (!rows[0]) {
    const err = new Error('Not found');
    err.status = 404;
    throw err;
  }
  const data = typeof rows[0].data === 'string' ? JSON.parse(rows[0].data) : rows[0].data;
  return { ...data, id: rows[0].id };
}

async function legacyCreateEntity(entityName, data, meta) {
  const id = data.id || randomUUID();
  const { id: _i, created_date, updated_date, created_by, created_by_id, ...rest } = data;
  const dev = getDevUser();
  await pool.query(
    `INSERT INTO entity_records (id, entity_name, data, created_by, created_by_id) VALUES ($1,$2,$3::jsonb,$4,$5)`,
    [id, entityName, JSON.stringify(rest), meta.created_by || dev.email, meta.created_by_id || dev.id]
  );
  return legacyGetEntity(entityName, id);
}

async function legacyUpdateEntity(entityName, id, data) {
  const existing = await legacyGetEntity(entityName, id);
  const merged = { ...existing, ...data };
  const { id: _i, created_date, updated_date, created_by, created_by_id, ...rest } = merged;
  await pool.query(
    `UPDATE entity_records SET data = $1::jsonb, updated_date = NOW() WHERE entity_name = $2 AND id = $3`,
    [JSON.stringify(rest), entityName, id]
  );
  return legacyGetEntity(entityName, id);
}

async function legacyDeleteEntity(entityName, id) {
  const r = await pool.query(
    'DELETE FROM entity_records WHERE entity_name = $1 AND id = $2',
    [entityName, id]
  );
  if (r.rowCount === 0) {
    const err = new Error('Not found');
    err.status = 404;
    throw err;
  }
  return { success: true };
}
