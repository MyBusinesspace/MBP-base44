import { extname, join as pathJoin } from 'path';
import { randomUUID } from 'crypto';
import { env } from '../config/env.js';
import { ensureUploadsDir, getUploadsDir } from './uploadsPath.js';
import { writeFile } from 'fs/promises';

function safeExt(originalname, mimetype) {
  const ext = extname(originalname || '').toLowerCase();
  if (ext) return ext;
  if (mimetype === 'image/jpeg') return '.jpg';
  if (mimetype === 'image/png') return '.png';
  if (mimetype === 'image/webp') return '.webp';
  return '';
}

function joinUrlPath(parts) {
  // URL paths must use forward slashes; keep it relative (no leading slash)
  return parts
    .filter(Boolean)
    .map((p) => String(p).replace(/^\/+|\/+$/g, ''))
    .join('/');
}

export function isSupabaseStorageConfigured() {
  return Boolean(env.supabaseUrl && env.supabaseServiceRoleKey && env.supabaseStorageBucket);
}

/**
 * Store an uploaded file either:
 * - locally (disk /tmp on Vercel, ./server/uploads locally), or
 * - Supabase Storage (recommended for Vercel persistence)
 *
 * Returns { file_url, file_uri } like Base44 integrations.Core.UploadFile.
 */
export async function storeUpload({ buffer, mimetype, originalname, prefix = '' }) {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error('No file data');
  }

  const ext = safeExt(originalname, mimetype);
  const filename = `${randomUUID()}${ext}`;

  // Prefer Supabase when configured; fall back to disk so mobile uploads keep working.
  if (isSupabaseStorageConfigured()) {
    try {
      const objectPath = joinUrlPath([prefix, filename]);
      const url = `${env.supabaseUrl.replace(/\/$/, '')}/storage/v1/object/${encodeURIComponent(
        env.supabaseStorageBucket
      )}/${objectPath}`;

      const res = await fetch(url, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
          apikey: env.supabaseServiceRoleKey,
          'Content-Type': mimetype || 'application/octet-stream',
          'x-upsert': 'true',
        },
        body: buffer,
      });

      const text = await res.text();
      if (!res.ok) {
        throw new Error(`Supabase Storage upload failed: ${res.status} ${text}`);
      }

      const publicUrl = `${env.supabaseUrl.replace(
        /\/$/,
        ''
      )}/storage/v1/object/public/${encodeURIComponent(env.supabaseStorageBucket)}/${objectPath}`;

      return { file_url: publicUrl, file_uri: publicUrl, storage: 'supabase', path: objectPath };
    } catch (e) {
      console.warn('[storeUpload] Supabase upload failed, using local fallback:', e.message);
    }
  }

  // Fallback: write to local uploads folder (note: Vercel /tmp is ephemeral).
  const uploadsDir = ensureUploadsDir(getUploadsDir());
  if (!uploadsDir) {
    throw new Error(
      'Uploads not configured. Configure Supabase Storage (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + SUPABASE_STORAGE_BUCKET).'
    );
  }

  // uploadsDir is an absolute path (e.g. /tmp/mpb-uploads on Vercel); keep it absolute.
  const destPath = pathJoin(uploadsDir, filename);
  await writeFile(destPath, buffer);
  const rel = `/uploads/${filename}`;
  const base = env.webUrl || '';
  const abs = base ? `${base}${rel}` : rel;
  return { file_url: abs, file_uri: abs, storage: 'local', path: rel };
}

