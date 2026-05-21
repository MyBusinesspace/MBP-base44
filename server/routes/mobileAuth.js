import { listEntities, getDevUser } from '../entityStore.js';

/** Resolve user from X-User-ID / user_id / api_key (query or headers). */
export async function resolveMobileUser(req) {
  const userId =
    req.headers['x-user-id'] ||
    req.headers['user_id'] ||
    req.query.user_id;

  const apiKey =
    req.headers['x-api-key'] ||
    req.headers['api_key'] ||
    req.query.api_key;

  if (!userId && !apiKey) {
    const err = new Error(
      'Authentication required. Provide user_id or api_key in headers or query params.'
    );
    err.status = 401;
    throw err;
  }

  const users = await listEntities('User', { limit: 5000 });
  const key = userId || apiKey;
  let user = users.find((u) => u.id === key || u.email === key);

  if (!user && (userId === getDevUser().id || apiKey === getDevUser().id)) {
    user = getDevUser();
  }

  if (!user) {
    const err = new Error('Invalid user_id');
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
