/**
 * Migrates data from entity_records (JSON blob) → per-entity tables.
 * Run once: npm run db:migrate-tables
 */
import { pool } from './db.js';
import { generateFullSchemaSQL } from './schemaGenerator.js';
import { getEntityPropertyNames, entityToTable } from './entitySchema.js';

const { sql } = generateFullSchemaSQL();

console.log('Creating per-entity tables...');
await pool.query(sql);

const { rows: legacy } = await pool.query(
  `SELECT * FROM entity_records WHERE entity_name != '_counter' ORDER BY entity_name, created_date`
);

const byEntity = {};
for (const row of legacy) {
  if (!byEntity[row.entity_name]) byEntity[row.entity_name] = [];
  byEntity[row.entity_name].push(row);
}

let migrated = 0;
let skipped = 0;

for (const [entityName, records] of Object.entries(byEntity)) {
  const table = entityToTable(entityName);
  const props = new Set(getEntityPropertyNames(entityName));

  const tableExists = await pool.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`,
    [table]
  );
  if (!tableExists.rows.length) {
    console.warn(`  Skip ${entityName}: no table ${table}`);
    skipped += records.length;
    continue;
  }

  for (const row of records) {
    const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data || {};
    const cols = {};
    const extra = {};

    for (const [k, v] of Object.entries(data)) {
      if (props.has(k)) cols[k] = v;
      else extra[k] = v;
    }

    const insertCols = ['id', 'created_date', 'updated_date', 'created_by', 'created_by_id', 'extra'];
    const values = [
      row.id,
      row.created_date,
      row.updated_date,
      row.created_by,
      row.created_by_id,
      JSON.stringify(extra),
    ];
    const ph = ['$1', '$2', '$3', '$4', '$5', '$6::jsonb'];
    let idx = 7;

    for (const [key, val] of Object.entries(cols)) {
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
      `INSERT INTO ${table} (${insertCols.join(', ')})
       VALUES (${ph.join(', ')})
       ON CONFLICT (id) DO NOTHING`,
      values
    );
    migrated++;
  }
  console.log(`  ✓ ${entityName} → ${table} (${records.length} rows)`);
}

console.log(`\nDone: ${migrated} migrated, ${skipped} skipped.`);
console.log('Legacy entity_records kept as backup (optional: DROP TABLE entity_records later).');
await pool.end();
