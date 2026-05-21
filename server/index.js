import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { pool, initDatabase } from './db.js';
import { createApp } from './app.js';
import { env } from './config/env.js';

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '..', '.env') });

const PORT = Number(process.env.API_PORT || 3001);
const APP_ID = process.env.VITE_APP_ID || 'mpb-local';
const WEB_PORT = process.env.WEB_PORT || '5173';

async function start() {
  const connected = await initDatabase();
  if (!connected) {
    console.error(
      'Cannot connect to PostgreSQL. Set DATABASE_URL in .env\n' +
        'Local: postgresql://postgres:postgres@localhost:5432/mpb_crm\n' +
        'Supabase: use the connection string from Project Settings → Database'
    );
    process.exit(1);
  }

  const app = createApp();
  const server = app.listen(PORT, () => {
    console.log(`\n🚀 MPB API (backend): http://localhost:${PORT}`);
    console.log(`   App UI (open in browser): http://localhost:${WEB_PORT}`);
    console.log(`   App ID: ${APP_ID}`);
    console.log(`   Health: http://localhost:${PORT}/health`);
    console.log(`   Config:  http://localhost:${PORT}/api/config/status`);
    console.log(`   Keys:    Google Maps ${env.googlePlacesApiKey ? '✓' : '✗'}`);
    console.log(`            Daily.co   ${env.dailyApiKey ? '✓' : '✗'}`);
    console.log(`            Google OAuth ${env.googleOAuthClientId ? '✓' : '✗'}`);
    console.log(`   DB:      ${env.isSupabase ? 'Supabase' : 'local PostgreSQL'}`);
    console.log(`   Run seed: npm run db:seed\n`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n❌ Port ${PORT} is in use. Run: npm run api:stop\n`);
      process.exit(1);
    }
    throw err;
  });
}

start().catch((e) => {
  console.error(e);
  process.exit(1);
});

process.on('SIGINT', () => {
  pool.end();
  process.exit(0);
});
