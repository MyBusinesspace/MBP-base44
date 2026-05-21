import { mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Writable uploads path: local disk vs Vercel /tmp (serverless FS is read-only except /tmp). */
export function getUploadsDir() {
  if (process.env.VERCEL === '1' || process.env.VERCEL === 'true' || process.env.VERCEL_ENV) {
    return join(os.tmpdir(), 'mpb-uploads');
  }
  return join(__dirname, '..', 'uploads');
}

export function ensureUploadsDir(dir = getUploadsDir()) {
  if (existsSync(dir)) return dir;
  try {
    mkdirSync(dir, { recursive: true });
    return dir;
  } catch (err) {
    console.warn('[uploads] Cannot create directory:', dir, err.message);
    return null;
  }
}
