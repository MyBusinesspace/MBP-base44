import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENTITIES_DIR = join(__dirname, '..', 'entities_del');

/** PascalCase → safe PostgreSQL table name (prefixed to avoid reserved words like "user") */
export function entityToTable(entityName) {
  const snake = entityName
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '');
  return `ent_${snake}`;
}

export function loadEntitySchemas() {
  const files = readdirSync(ENTITIES_DIR).filter((f) => f.endsWith('.js'));
  const schemas = {};

  for (const file of files) {
    const raw = readFileSync(join(ENTITIES_DIR, file), 'utf8');
    const schema = JSON.parse(raw);
    schemas[schema.name] = schema;
  }

  // Built-in User entity (not in entities_del)
  schemas.User = {
    name: 'User',
    type: 'object',
    properties: {
      email: { type: 'string' },
      full_name: { type: 'string' },
      role: { type: 'string' },
      branch_id: { type: 'string' },
      company_id: { type: 'string' },
      sort_order: { type: 'number' },
      archived: { type: 'boolean' },
      is_ghost: { type: 'boolean' },
      phone: { type: 'string' },
      employee_number: { type: 'string' },
      department_id: { type: 'string' },
      team_ids: { type: 'array', items: { type: 'string' } },
    },
  };

  // Used in UI but missing from entities_del export
  for (const name of ['FormFlowConfig', 'FormTemplate', 'FormDepartment']) {
    schemas[name] = {
      name,
      type: 'object',
      properties: {
        name: { type: 'string' },
        branch_id: { type: 'string' },
        data: { type: 'object', additionalProperties: true },
      },
    };
  }

  return schemas;
}

function pgType(prop) {
  const t = prop.type;
  if (t === 'boolean') return 'BOOLEAN';
  if (t === 'number' || t === 'integer') return 'DOUBLE PRECISION';
  if (t === 'array' || t === 'object') return 'JSONB';
  return 'TEXT';
}

export function buildCreateTableSQL(entityName, schema) {
  const table = entityToTable(entityName);
  const cols = [
    'id VARCHAR(36) PRIMARY KEY',
    'created_date TIMESTAMPTZ NOT NULL DEFAULT NOW()',
    'updated_date TIMESTAMPTZ NOT NULL DEFAULT NOW()',
    'created_by TEXT',
    'created_by_id VARCHAR(36)',
    "extra JSONB NOT NULL DEFAULT '{}'::jsonb",
  ];

  for (const [key, prop] of Object.entries(schema.properties || {})) {
    if (['id', 'created_date', 'updated_date', 'created_by', 'created_by_id'].includes(key)) {
      continue;
    }
    cols.push(`${key} ${pgType(prop)}`);
  }

  const indexes = [];
  for (const key of ['branch_id', 'customer_id', 'project_id', 'status', 'employee_id', 'setting_key']) {
    if (schema.properties?.[key]) {
      indexes.push(`CREATE INDEX IF NOT EXISTS idx_${table}_${key} ON ${table} (${key});`);
    }
  }
  if (schema.properties?.archived) {
    indexes.push(`CREATE INDEX IF NOT EXISTS idx_${table}_archived ON ${table} (archived);`);
  }
  indexes.push(`CREATE INDEX IF NOT EXISTS idx_${table}_created ON ${table} (created_date DESC);`);

  return {
    table,
    sql: `CREATE TABLE IF NOT EXISTS ${table} (\n  ${cols.join(',\n  ')}\n);\n${indexes.join('\n')}`,
    properties: Object.keys(schema.properties || {}),
  };
}

export function generateFullSchemaSQL() {
  const schemas = loadEntitySchemas();
  const parts = [
    'CREATE EXTENSION IF NOT EXISTS "pgcrypto";',
    '',
    'CREATE TABLE IF NOT EXISTS counters (',
    '  key TEXT PRIMARY KEY,',
    '  value INTEGER NOT NULL DEFAULT 0',
    ');',
    '',
  ];

  const meta = {};
  for (const [name, schema] of Object.entries(schemas)) {
    const built = buildCreateTableSQL(name, schema);
    meta[name] = built;
    parts.push(built.sql);
    parts.push('');
  }

  return { sql: parts.join('\n'), meta, schemas };
}
