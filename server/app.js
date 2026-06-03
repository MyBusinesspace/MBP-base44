import express from 'express';
import cors from 'cors';
import { testConnection, getDbConfigError, getSafeDbDiagnostics } from './db.js';
import { getEnvDatabaseHost } from './connectionConfig.js';
import { isVercelRuntime } from './config/env.js';
import { countUsersInDb } from './syncLegacyUsers.js';
import { isEmailConfigured, sendEmail, getEmailDiagnostics } from './utils/sendEmail.js';
import { resolveRequestUser } from './middleware/authenticate.js';
import entityRoutes from './routes/entities.js';
import functionRoutes from './routes/functions.js';
import integrationRoutes from './routes/integrations.js';
import authRoutes from './routes/auth.js';
import { env } from './config/env.js';
import { getUploadsDir, ensureUploadsDir } from './utils/uploadsPath.js';
import { serveUpload } from './routes/uploads.js';
import { isSupabaseStorageConfigured } from './utils/storeUpload.js';

export function createApp() {
  const APP_ID = process.env.VITE_APP_ID || 'mpb-local';
  const WEB_PORT = process.env.WEB_PORT || '5173';

  const uploadsDir = ensureUploadsDir(getUploadsDir());

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true }));
  // Dynamic handler: local disk + Supabase proxy (static alone fails on Vercel serverless /tmp).
  app.get(/^\/uploads\/(.+)$/, serveUpload);

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
      res.json({
        ok: true,
        appId: APP_ID,
        env: env.isVercel ? 'vercel' : 'local',
        auth_api_version: '2026-05-22-user-persist-v5',
      });
    } catch (e) {
      res.status(503).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/config/status', async (_req, res) => {
    const dbErr = getDbConfigError();
    const diag = getSafeDbDiagnostics();
    const envHost = getEnvDatabaseHost();
    const resolvedHost = diag?.host;
    const dbHostBadOnVercel =
      isVercelRuntime() && resolvedHost && /^db\./i.test(resolvedHost);
    let userCounts = null;
    try {
      userCounts = await countUsersInDb();
    } catch {
      /* db not ready */
    }
    res.json({
      runtime: env.isVercel ? 'vercel' : 'local',
      google_maps: Boolean(env.googlePlacesApiKey),
      google_oauth: Boolean(env.googleOAuthClientId),
      daily_video: Boolean(env.dailyApiKey),
      customers_api: Boolean(env.customersApiKey),
      zapier: Boolean(env.zapierWebhookUrl),
      database: dbErr ? 'invalid' : env.databaseUrl ? 'configured' : 'missing',
      database_error: dbErr,
      env_database_host: envHost,
      database_host: resolvedHost || diag?.error,
      database_port: diag?.port,
      database_user: diag?.user,
      database_pooler: diag?.is_pooler,
      database_warning: dbHostBadOnVercel
        ? 'Vercel is using db.xxx (IPv6). Set DATABASE_URL to aws-*-REGION.pooler.supabase.com:6543 in Vercel Environment Variables, then Redeploy.'
        : null,
      supabase_region_set: Boolean(process.env.SUPABASE_REGION),
      users_ent_user: userCounts?.ent_user,
      users_entity_records: userCounts?.entity_records,
      auth_api_version: '2026-05-22-user-persist-v5',
      email_configured: isEmailConfigured(),
      ...getEmailDiagnostics(),
      jwt: Boolean(env.jwtSecret && env.jwtSecret !== 'mpb-local-dev-secret-change-me'),
      web_url: env.webUrl,
      uploads_storage: isSupabaseStorageConfigured()
        ? 'supabase'
        : env.isVercel
          ? 'missing_supabase_config'
          : 'local_disk',
    });
  });

  /** Admin-only: send test email (debug Resend/SMTP without changing UI pages). */
  app.post('/api/email/test', async (req, res) => {
    try {
      const user = await resolveRequestUser(req);
      if (!user || user.role !== 'admin') {
        return res.status(401).json({ success: false, error: 'Admin access required' });
      }
      if (!isEmailConfigured()) {
        return res.status(503).json({ success: false, error: 'Email not configured' });
      }
      const to = req.body?.to?.trim() || user.email;
      const result = await sendEmail({
        to,
        subject: 'MyBusinessPace — test email',
        body: `Test email from MyBusinessPace (${env.webUrl}).\nIf you received this, Resend/SMTP is working.`,
        fromName: 'MyBusinessPace',
      });
      return res.json({
        success: true,
        to,
        ...result,
        ...getEmailDiagnostics(),
      });
    } catch (e) {
      console.error('[email/test]', e.message);
      return res.status(503).json({
        success: false,
        error: e.message,
        ...getEmailDiagnostics(),
      });
    }
  });

  app.use((err, _req, res, _next) => {
    console.error(err);
    const code = err.code || err.errno;
    const msg = err.message || '';
    if (msg.includes('Tenant or user not found')) {
      return res.status(503).json({
        message: 'Supabase: Tenant or user not found',
        hint:
          'Use Connection string → URI (Transaction pooler) from Supabase. Username must be postgres.[project-ref], port 6543.',
        detail: msg,
      });
    }
    if (code === 'ENOTFOUND' || code === 'ECONNREFUSED' || code === 'ETIMEDOUT') {
      const ipv6Hint = msg.includes('db.') && msg.includes('supabase.co');
      return res.status(503).json({
        message: 'Database connection failed',
        detail: err.message,
        hint: ipv6Hint
          ? 'db.xxx.supabase.co is IPv6-only and fails on Vercel. Set SUPABASE_REGION (from Supabase Dashboard) + SUPABASE_POOLER_PREFIX=aws-1, or use the pooler URI (aws-*-REGION.pooler.supabase.com:6543).'
          : 'Set a valid Supabase pooler DATABASE_URL in Vercel (port 6543, IPv4 host from Dashboard).',
      });
    }
    res.status(err.status || 500).json({ message: err.message || 'Internal error' });
  });

  return app;
}
