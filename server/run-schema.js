import { runSchema, testConnection } from './db.js';

await runSchema();
const ok = await testConnection();
if (!ok) {
  console.error('Database connection failed after schema');
  process.exit(1);
}
console.log('Schema OK');
