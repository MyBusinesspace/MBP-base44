import express from 'express';
import cors from 'cors';
import { testConnection } from './db.js';
import entityRoutes from './routes/entities.js';
import functionRoutes from './routes/functions.js';
import integrationRoutes from './routes/integrations.js';
import authRoutes from './routes/auth.js';
import { env } from './config/env.js';
import { getUploadsDir, ensureUploadsDir } from './utils/uploadsPath.js';

export function createApp() {
  const APP_ID = process.env.VITE_APP_ID || 'mpb-local';
  const WEB_PORT = process.env.WEB_PORT || '5173';

  const uploadsDir = ensureUploadsDir(getUploadsDir());

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true }));
  if (uploadsDir) {
    app.use('/uploads', express.static(uploadsDir));
  }

  app.get('/', (_req, res) => {
    res.type('html').send(`<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head><meta charset="utf-8"><title>MPB API</title></head>
<body>
  <h1>MyBusinessPace — API</h1>
  <p>App ID: <code>${APP_ID}</code></p>
  <p><a href="/health">/health</a></p>
</body></html>`);
  });

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

  app.use('/api/auth', authRoutes);

  app.use(`/apps/${APP_ID}/entities`, entityRoutes);
  app.use('/apps/:appId/entities', entityRoutes);

  app.use(`/apps/${APP_ID}/functions`, functionRoutes);
  app.use('/apps/:appId/functions', functionRoutes);

  app.use(`/apps/${APP_ID}/integration-endpoints`, integrationRoutes);
  app.use('/apps/:appId/integration-endpoints', integrationRoutes);

  app.get('/health', async (_req, res) => {
    try {
      await testConnection();
      res.json({ ok: true, appId: APP_ID, env: env.isVercel ? 'vercel' : 'local' });
    } catch (e) {
      res.status(503).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/config/status', (_req, res) => {
    res.json({
      runtime: env.isVercel ? 'vercel' : 'local',
      google_maps: Boolean(env.googlePlacesApiKey),
      google_oauth: Boolean(env.googleOAuthClientId),
      daily_video: Boolean(env.dailyApiKey),
      customers_api: Boolean(env.customersApiKey),
      zapier: Boolean(env.zapierWebhookUrl),
      database: env.databaseUrl ? 'configured' : 'missing',
      jwt: Boolean(env.jwtSecret && env.jwtSecret !== 'mpb-local-dev-secret-change-me'),
      web_url: env.webUrl,
    });
  });

  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(err.status || 500).json({ message: err.message || 'Internal error' });
  });

  return app;
}
