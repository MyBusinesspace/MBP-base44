/**
 * One-time Supabase setup: schema + tables + seed.
 * Uses DIRECT connection (port 5432) — transaction pooler (6543) cannot run migrations.
 *
 * Usage:
 *   node server/setup-supabase.js "postgresql://postgres:pass@db.xxx.supabase.co:5432/postgres"
 */
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { toSupabaseDirectUrl, isPoolerUrl, extractProjectRef } from './supabaseUrl.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const inputUrl = process.argv[2] || process.env.DATABASE_URL;
if (!inputUrl) {
  console.error('Usage: node server/setup-supabase.js "<DATABASE_URL>"');
  process.exit(1);
}

const directUrl = toSupabaseDirectUrl(inputUrl);
const ref = extractProjectRef(inputUrl);

const childEnv = {
  ...process.env,
  DATABASE_URL: directUrl,
  SUPABASE_DB: 'true',
  SKIP_SCHEMA_ON_BOOT: 'true',
  SUPABASE_FORCE_DIRECT: 'true',
  // Prevent accidental pooler redirect when VERCEL is set in the shell.
  VERCEL: '',
  VERCEL_ENV: '',
};

console.log('\n📦 MPB Supabase setup');
console.log('   Project ref:', ref || '(unknown)');
if (isPoolerUrl(inputUrl)) {
  console.log('   Migrations use DIRECT (5432) — pooler (6543) is for Vercel runtime only.\n');
}
console.log('   Using:', directUrl.replace(/:([^:@/]+)@/, ':***@'));

function runNodeScript(relativePath) {
  const scriptPath = join(root, relativePath);
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath], {
      stdio: 'inherit',
      env: childEnv,
      shell: false,
      cwd: root,
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${relativePath} exited with code ${code}`));
    });
  });
}

async function main() {
  try {
    console.log('\n1/3 Schema (entity_records + tables)...');
    await runNodeScript('server/run-schema.js');

    console.log('\n2/3 Migrate to per-entity tables...');
    await runNodeScript('server/migrate-to-tables.js');

    console.log('\n3/3 Seed data...');
    await runNodeScript('server/seed.js');

    console.log('\n✅ Supabase setup complete.');
    console.log('   Login: admin@local.dev / admin123');
    console.log('\n   Vercel DATABASE_URL → use POOLER (6543):');
    if (isPoolerUrl(inputUrl)) {
      console.log('  ', inputUrl.replace(/:([^:@/]+)@/, ':***@'));
    } else if (ref) {
      console.log(
        '   postgresql://postgres.' +
          ref +
          ':***@aws-0-eu-central-1.pooler.supabase.com:6543/postgres'
      );
      console.log('   (Confirm region in Supabase Dashboard → Database)');
    }
    console.log('');
  } catch (e) {
    console.error('\n❌ Setup failed:', e.message);
    console.error('\nTips:');
    console.error('  • Use Direct URI from Supabase (port 5432)');
    console.error('  • Check password in connection string');
    console.error('  • Reset DB password in Supabase if needed\n');
    process.exit(1);
  }
}

main();
