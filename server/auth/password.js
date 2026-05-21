import { scryptSync, randomBytes, timingSafeEqual } from 'crypto';

const KEY_LEN = 64;

export function hashPassword(plain) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(plain, salt, KEY_LEN).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(plain, stored) {
  if (!plain || !stored || typeof stored !== 'string') return false;
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const hashBuf = Buffer.from(hash, 'hex');
  const testBuf = scryptSync(plain, salt, hashBuf.length);
  try {
    return hashBuf.length === testBuf.length && timingSafeEqual(hashBuf, testBuf);
  } catch {
    return false;
  }
}

export function stripSensitiveUser(user) {
  if (!user) return user;
  const { password, verification_code, verification_code_expires_at, ...safe } = user;
  return safe;
}
