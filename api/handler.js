import serverless from 'serverless-http';
import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { initDatabase } from '../server/db.js';
import { createApp } from '../server/app.js';

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '..', '.env') });

let app;
let handler;
let dbReady;

async function bootstrap() {
  if (!dbReady) {
    dbReady = initDatabase();
    await dbReady;
    app = createApp();
    handler = serverless(app);
  }
  return handler;
}

export default async function vercelHandler(req, res) {
  const h = await bootstrap();
  return h(req, res);
}

export const config = {
  api: {
    bodyParser: false,
    maxDuration: 30,
  },
};
