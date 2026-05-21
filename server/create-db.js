import pg from 'pg';

const adminUrl =
  process.env.PG_ADMIN_URL || 'postgresql://postgres:postgres@localhost:5432/postgres';
const dbName = 'mpb_crm';

const pool = new pg.Pool({ connectionString: adminUrl });
const { rows } = await pool.query(
  'SELECT 1 FROM pg_database WHERE datname = $1',
  [dbName]
);
if (!rows.length) {
  await pool.query(`CREATE DATABASE ${dbName}`);
  console.log(`Created database ${dbName}`);
} else {
  console.log(`Database ${dbName} already exists`);
}
await pool.end();
