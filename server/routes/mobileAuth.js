import { listEntities, getDevUser } from '../entityStore.js';
import { getUserById } from '../userPersistence.js';
import { normalizeMobileUserId } from '../utils/mobileUserId.js';

/** Resolve user from X-User-ID / user_id / api_key (query or headers). */
export async function resolveMobileUser(req) {
  const rawId =
    req.headers['x-user-id'] ||
    req.headers['user_id'] ||
    req.query.user_id;

  const apiKey =
    req.headers['x-api-key'] ||
    req.headers['apikey'] ||
    req.headers['api_key'] ||
    req.query.api_key;

  if (!rawId && !apiKey) {
    const err = new Error(
      'Authentication required. Provide user_id or api_key in headers or query params.'
    );
    err.status = 401;
    throw err;
  }

  const normalizedId = normalizeMobileUserId(rawId);
  if (normalizedId) {
    const byId = await getUserById(normalizedId);
    if (byId) {
      if (byId.archived) {
        const err = new Error('User account is archived');
        err.status = 403;
        throw err;
      }
      return byId;
    }
  }

  const users = await listEntities('User', { limit: 5000 });
  const key = normalizedId || String(rawId || '').trim() || apiKey;
  let user = users.find((u) => u.id === key || u.email === key);

  if (!user && (key === getDevUser().id || apiKey === getDevUser().id)) {
    user = getDevUser();
  }

  if (!user) {
    const err = new Error(`Invalid user_id: ${rawId || apiKey}`);
    err.status = 401;
    throw err;
  }

  if (user.archived) {
    const err = new Error('User account is archived');
    err.status = 403;
    throw err;
  }

  return user;
}

export function isAdmin(user) {
  return user?.role === 'admin';
}
