/**
 * Vercel Serverless entry — export Express app (native support, no serverless-http).
 * @see https://vercel.com/docs/frameworks/backend/express
 */
export const API_BUILD_ID = '2026-05-22-user-persist-v4';
import express from 'express';
import { createApp } from '../server/app.js';
import { initDatabase } from '../server/db.js';

initDatabase().catch((e) => console.error('[db] init:', e.message));

let app;

try {
  app = createApp();
} catch (e) {
  console.error('[api] createApp failed:', e);
  app = express();
  app.all('*', (_req, res) => {
    res.status(500).json({
      message: 'Server failed to start',
      error: e.message,
      hint: 'Check Vercel Environment Variables (DATABASE_URL, etc.)',
    });
  });
}

export default app;
