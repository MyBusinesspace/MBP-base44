import { createHmac, timingSafeEqual } from 'crypto';

function b64url(input) {
  return Buffer.from(input).toString('base64url');
}

function parseB64url(str) {
  return JSON.parse(Buffer.from(str, 'base64url').toString('utf8'));
}

export function signToken(payload, secret, expiresInSec = 7 * 86400) {
  if (!secret) throw new Error('JWT_SECRET is not configured');
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(
    JSON.stringify({
      ...payload,
      exp: Math.floor(Date.now() / 1000) + expiresInSec,
    })
  );
  const sig = createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

export function verifyToken(token, secret) {
  if (!token || !secret) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [header, body, sig] = parts;
  const expected = createHmac('sha256', secret)
    .update(`${header}.${body}`)
    .digest('base64url');

  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }

  const payload = parseB64url(body);
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

export function getBearerToken(req) {
  const auth = req.headers.authorization || req.headers.Authorization;
  if (auth?.startsWith('Bearer ')) return auth.slice(7).trim();
  if (req.query?.token) return String(req.query.token);
  return null;
}
