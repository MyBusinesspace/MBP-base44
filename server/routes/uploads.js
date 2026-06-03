import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, extname } from 'path';
import { getUploadsDir } from '../utils/uploadsPath.js';
import { env } from '../config/env.js';
import { isSupabaseStorageConfigured } from '../utils/storeUpload.js';

const MIME = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
  '.pdf': 'application/pdf',
};

function guessMime(filename) {
  return MIME[extname(filename).toLowerCase()] || 'application/octet-stream';
}

function safeRelativePath(raw) {
  const p = String(raw || '')
    .replace(/^\/+/, '')
    .replace(/\\/g, '/');
  if (!p || p.includes('..')) return null;
  return p;
}

async function fetchFromSupabase(objectPath) {
  const base = env.supabaseUrl.replace(/\/$/, '');
  const bucket = encodeURIComponent(env.supabaseStorageBucket);

  const publicUrl = `${base}/storage/v1/object/public/${bucket}/${objectPath}`;
  let res = await fetch(publicUrl);
  if (res.ok) {
    return {
      buffer: Buffer.from(await res.arrayBuffer()),
      contentType: res.headers.get('content-type') || guessMime(objectPath),
    };
  }

  const privateUrl = `${base}/storage/v1/object/${bucket}/${objectPath}`;
  res = await fetch(privateUrl, {
    headers: {
      Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
      apikey: env.supabaseServiceRoleKey,
    },
  });
  if (!res.ok) return null;

  return {
    buffer: Buffer.from(await res.arrayBuffer()),
    contentType: res.headers.get('content-type') || guessMime(objectPath),
  };
}

function supabasePathCandidates(relativePath) {
  const base = relativePath;
  const filename = base.includes('/') ? base.split('/').pop() : base;
  const set = new Set([
    base,
    filename,
    `wall/${filename}`,
    `public/${filename}`,
    `private/${filename}`,
    `signatures/${filename}`,
  ]);
  return Array.from(set).filter(Boolean);
}

/**
 * Serve uploaded files: local disk (dev) or Supabase Storage (Vercel / persistent).
 */
export async function serveUpload(req, res, next) {
  try {
    const relativePath = safeRelativePath(req.path.replace(/^\/uploads\/?/, ''));
    if (!relativePath) {
      return res.status(400).send('Invalid path');
    }

    const filename = relativePath.includes('/')
      ? relativePath.split('/').pop()
      : relativePath;

    const uploadsDir = getUploadsDir();
    const localPath = join(uploadsDir, filename);
    if (existsSync(localPath)) {
      const buffer = await readFile(localPath);
      res.set('Content-Type', guessMime(filename));
      res.set('Cache-Control', 'public, max-age=31536000, immutable');
      return res.send(buffer);
    }

    if (isSupabaseStorageConfigured()) {
      for (const objectPath of supabasePathCandidates(relativePath)) {
        const file = await fetchFromSupabase(objectPath);
        if (file) {
          res.set('Content-Type', file.contentType);
          res.set('Cache-Control', 'public, max-age=31536000, immutable');
          return res.send(file.buffer);
        }
      }
    }

    return res.status(404).send('File not found');
  } catch (e) {
    console.error('[uploads] serve:', e.message);
    return next(e);
  }
}
