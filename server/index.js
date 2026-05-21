import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync } from 'fs';

import { pool, runSchema, testConnection } from './db.js';
import entityRoutes from './routes/entities.js';
import functionRoutes from './routes/functions.js';
import integrationRoutes from './routes/integrations.js';
import authRoutes from './routes/auth.js';
import { env } from './config/env.js';

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '..', '.env') });

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.API_PORT || 3001);
const APP_ID = process.env.VITE_APP_ID || 'mpb-local';

const uploadsDir = join(__dirname, 'uploads');
if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true });

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(uploadsDir));

const WEB_PORT = process.env.WEB_PORT || '5173';

app.get('/', (_req, res) => {
  res.type('html').send(`<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head><meta charset="utf-8"><title>MPB API</title>
<style>body{font-family:system-ui;max-width:32rem;margin:3rem auto;padding:0 1rem;line-height:1.6}
code{background:#f1f5f9;padding:.15rem .4rem;border-radius:4px}a{color:#2563eb}</style></head>
<body>
  <h1>MyBusinessPace — API</h1>
  <p>هذا الخادم للبيانات فقط (REST API)، وليس واجهة التطبيق.</p>
  <p><strong>افتح التطبيق من:</strong><br>
  <a href="http://localhost:${WEB_PORT}">http://localhost:${WEB_PORT}</a></p>
  <p>فحص الصحة: <a href="/health">/health</a></p>
  <p>مثال كيانات: <code>/apps/${APP_ID}/entities/Branch</code></p>
</body></html>`);
});

// Public app settings (AuthContext)
app.get('/api/apps/public/prod/public-settings/by-id/:appId', (_req, res) => {
  res.json({
    id: APP_ID,
    public_settings: {
      auth_required: env.authRequired,
      google_login_enabled: Boolean(env.googleOAuthClientId),
      email_login_enabled: true,
    },
  });
});

// Google OAuth + session
app.use('/api/auth', authRoutes);

// Entity CRUD — same paths as @base44/sdk
app.use(`/apps/${APP_ID}/entities`, entityRoutes);
app.use(`/apps/:appId/entities`, entityRoutes);

// Custom functions
app.use(`/apps/${APP_ID}/functions`, functionRoutes);
app.use(`/apps/:appId/functions`, functionRoutes);

// Integrations (file upload, etc.)
app.use(`/apps/${APP_ID}/integration-endpoints`, integrationRoutes);
app.use(`/apps/:appId/integration-endpoints`, integrationRoutes);

app.get('/health', async (_req, res) => {
  try {
    await testConnection();
    res.json({ ok: true, appId: APP_ID });
  } catch (e) {
    res.status(503).json({ ok: false, error: e.message });
  }
});

/** Which integrations are configured (no secret values exposed) */
app.get('/api/config/status', (_req, res) => {
  res.json({
    google_maps: Boolean(env.googlePlacesApiKey),
    daily_video: Boolean(env.dailyApiKey),
    customers_api: Boolean(env.customersApiKey),
    zapier: Boolean(env.zapierWebhookUrl),
  });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Internal error' });
});

async function start() {
  await runSchema();
  const connected = await testConnection();
  if (!connected) {
    console.error(
      'Cannot connect to PostgreSQL. Set DATABASE_URL in .env\n' +
        'Example: postgresql://mpb:mpb_local@localhost:5432/mpb_crm'
    );
    process.exit(1);
  }

  const server = app.listen(PORT, () => {
    console.log(`\n🚀 MPB API (backend): http://localhost:${PORT}`);
    console.log(`   App UI (open in browser): http://localhost:${WEB_PORT}`);
    console.log(`   App ID: ${APP_ID}`);
    console.log(`   Health: http://localhost:${PORT}/health`);
    console.log(`   Config:  http://localhost:${PORT}/api/config/status`);
    console.log(`   Keys:    Google Maps ${env.googlePlacesApiKey ? '✓' : '✗ (set GOOGLE_PLACES_API_KEY in .env)'}`);
    console.log(`            Daily.co   ${env.dailyApiKey ? '✓' : '✗ (set DAILY_API_KEY in .env)'}`);
    console.log(`            Google OAuth ${env.googleOAuthClientId ? '✓' : '✗ (set GOOGLE_OAUTH_CLIENT_ID in .env)'}`);
    console.log(`   Run seed: npm run db:seed\n`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(
        `\n❌ Port ${PORT} is already in use (another API instance is running).\n` +
          `   Fix: npm run api:stop\n` +
          `   Or:  taskkill /F /IM node.exe   (stops all Node processes)\n` +
          `   Then run: npm run dev:local\n`
      );
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
