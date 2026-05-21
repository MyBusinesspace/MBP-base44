import { verifyToken, getBearerToken } from '../auth/token.js';
import { env } from '../config/env.js';
import { getEntity, getDevUser } from '../entityStore.js';

export async function resolveRequestUser(req) {
  const token = getBearerToken(req);
  if (!token) return null;

  const payload = verifyToken(token, env.jwtSecret);
  if (!payload?.sub) return null;

  try {
    return await getEntity('User', payload.sub);
  } catch {
    return null;
  }
}

/** Attach req.user when a valid Bearer token is present. */
export async function authenticateOptional(req, _res, next) {
  try {
    req.user = (await resolveRequestUser(req)) || null;
    next();
  } catch (e) {
    next(e);
  }
}

/** Require auth unless Google OAuth is not configured (local dev bypass). */
export async function authenticateUserMe(req, res, next) {
  try {
    const user = await resolveRequestUser(req);
    if (user) {
      req.user = user;
      return next();
    }

    if (!env.googleOAuthClientId) {
      req.user = getDevUser();
      return next();
    }

    return res.status(401).json({ message: 'Unauthorized' });
  } catch (e) {
    next(e);
  }
}
