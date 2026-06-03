import {
  createEntity,
  updateEntity,
  deleteEntity,
  listEntities,
  getEntity,
} from '../entityStore.js';
import { getUserById } from '../userPersistence.js';
import { normalizeMobileUserId } from '../utils/mobileUserId.js';
import { stripSensitiveUser } from '../auth/password.js';
import { storeUpload } from '../utils/storeUpload.js';

function fail(message, status = 400) {
  return { success: false, error: message, status };
}

function normAction(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase();
}

async function resolveUser(req) {
  const raw =
    req.headers['x-user-id'] ||
    req.headers['user_id'] ||
    req.query?.user_id;
  if (!raw) return null;
  const id = normalizeMobileUserId(raw) || String(raw).trim();
  return getUserById(id);
}

function collectUserIdsFromPosts(items) {
  const ids = new Set();
  for (const item of items) {
    const authorId = item.created_by_user_id || item.created_by_id;
    if (authorId) ids.add(authorId);
    for (const uid of item.likes_user_ids || []) {
      if (uid) ids.add(uid);
    }
    for (const c of item.comments || []) {
      if (c?.user_id) ids.add(c.user_id);
    }
  }
  return Array.from(ids);
}

async function loadUserMap(userIds) {
  const userMap = {};
  await Promise.all(
    userIds.map(async (id) => {
      const normalized = normalizeMobileUserId(id) || id;
      const user = await getUserById(normalized);
      if (user) userMap[id] = stripSensitiveUser(user);
    })
  );
  return userMap;
}

function enrichPost(item, userMap) {
  const authorId = item.created_by_user_id || item.created_by_id;
  return {
    ...item,
    user: userMap[authorId] || null,
    likes_users: (item.likes_user_ids || []).map((id) => userMap[id] || null),
    comments: (item.comments || []).map((c) => ({
      ...c,
      user: userMap[c.user_id] || null,
    })),
  };
}

async function handleList(req) {
  const limitParam = req.query?.limit;
  const limit = Math.max(1, Math.min(parseInt(limitParam || '50', 10) || 50, 500));

  const items = await listEntities('WallPost', { sort: '-created_date', limit });
  const userMap = await loadUserMap(collectUserIdsFromPosts(items));
  const enrichedItems = items.map((item) => enrichPost(item, userMap));

  return { success: true, data: enrichedItems };
}

async function handleGet(req) {
  const id = req.query?.id;
  if (!id) return fail('Missing id', 400);

  const rows = await listEntities('WallPost', { query: { id }, limit: 1 });
  const item = rows?.[0];
  if (!item) return fail('Not found', 404);

  const userMap = await loadUserMap(collectUserIdsFromPosts([item]));
  return { success: true, data: enrichPost(item, userMap) };
}

async function processMediaItems(media_items) {
  const finalMediaItems = [];
  for (const item of media_items || []) {
    if (item?.url) {
      finalMediaItems.push(item);
      continue;
    }
    if (item?.file) {
      try {
        const buffer = Buffer.from(item.file, 'base64');
        const mimetype = item.type === 'video' ? 'video/mp4' : 'image/jpeg';
        const upload = await storeUpload({
          buffer,
          mimetype,
          originalname: item.type === 'video' ? 'upload.mp4' : 'upload.jpg',
          prefix: 'wall',
        });
        if (upload?.file_url) {
          finalMediaItems.push({
            url: upload.file_url,
            type: item.type || 'image',
          });
        }
      } catch (e) {
        console.warn('[apiWallPost] media upload:', e.message);
      }
    }
  }
  return finalMediaItems;
}

async function handleCreate(userId, body) {
  if (!body || typeof body !== 'object') {
    return fail('Body must be a JSON object', 400);
  }

  const { title, content, media_items = [], ...rest } = body;
  if (!title) return fail('Field title is required', 400);

  const finalMediaItems = await processMediaItems(media_items);

  const cleanData = {
    title,
    content: content ?? '',
    media_items: finalMediaItems,
    created_by_id: userId,
    created_by_user_id: userId,
    likes_user_ids: [],
    comments: [],
    ...rest,
  };
  delete cleanData.id;
  delete cleanData.created_date;
  delete cleanData.updated_date;

  const created = await createEntity('WallPost', cleanData);
  const userMap = await loadUserMap(collectUserIdsFromPosts([created]));
  return { success: true, data: enrichPost(created, userMap) };
}

async function handleUpdate(req) {
  const id = req.query?.id || req.body?.id;
  if (!id) return fail('Missing id (query or body.id)', 400);

  const body = req.body || {};
  const payload =
    body.data && typeof body.data === 'object'
      ? { ...body.data }
      : (() => {
          const { id: _id, data: _data, ...rest } = body;
          return rest;
        })();

  if (!payload || typeof payload !== 'object' || Object.keys(payload).length === 0) {
    return fail('Missing update data (body or body.data)', 400);
  }

  const updated = await updateEntity('WallPost', id, payload);
  const userMap = await loadUserMap(collectUserIdsFromPosts([updated]));
  return { success: true, data: enrichPost(updated, userMap) };
}

async function handleDelete(req) {
  const id = req.query?.id;
  if (!id) return fail('Missing id', 400);
  await deleteEntity('WallPost', id);
  return { success: true, id };
}

async function handleAddComment(userId, body) {
  if (!body || typeof body !== 'object') {
    return fail('Body must be a JSON object', 400);
  }

  const { postId, content } = body;
  if (!postId || !content) {
    return fail('Body must contain postId and content', 400);
  }

  let post;
  try {
    post = await getEntity('WallPost', postId);
  } catch {
    return fail('Post not found', 404);
  }

  const newComment = {
    user_id: userId,
    content,
    timestamp: new Date().toISOString(),
  };

  await updateEntity('WallPost', postId, {
    comments: [...(post.comments || []), newComment],
  });

  const user = await getUserById(userId);
  return {
    success: true,
    data: {
      ...newComment,
      user: user ? stripSensitiveUser(user) : null,
    },
  };
}

async function handleToggleLike(userId, body) {
  if (!body || typeof body !== 'object') {
    return fail('Body must be a JSON object', 400);
  }

  const { postId } = body;
  if (!postId) return fail('Body must contain postId', 400);

  let post;
  try {
    post = await getEntity('WallPost', postId);
  } catch {
    return fail('Post not found', 404);
  }

  const likes = new Set(post.likes_user_ids || []);
  let likeAction;
  if (likes.has(userId)) {
    likes.delete(userId);
    likeAction = 'unliked';
  } else {
    likes.add(userId);
    likeAction = 'liked';
  }

  const updatedPost = await updateEntity('WallPost', postId, {
    likes_user_ids: Array.from(likes),
  });

  const userMap = await loadUserMap(collectUserIdsFromPosts([updatedPost]));
  return {
    success: true,
    action: likeAction,
    data: enrichPost(updatedPost, userMap),
  };
}

export async function handleApiWallPost(req) {
  const method = req.method?.toUpperCase();
  const action = normAction(req.query?.action);

  const rawUserId =
    req.headers['x-user-id'] ||
    req.headers['user_id'] ||
    req.query?.user_id;
  if (!rawUserId) {
    return fail('Unauthorized: missing x-user-id header', 401);
  }

  const currentUser = await resolveUser(req);
  const userId = currentUser?.id || normalizeMobileUserId(rawUserId) || String(rawUserId).trim();

  if (!action) {
    return fail('Missing action. Use ?action=list|get|create|update|delete', 400);
  }

  try {
    if (action === 'list' && method === 'GET') {
      return await handleList(req);
    }
    if (action === 'get' && method === 'GET') {
      return await handleGet(req);
    }
    if (action === 'create' && (method === 'POST' || method === 'PUT')) {
      return await handleCreate(userId, req.body || {});
    }
    if (action === 'update' && (method === 'POST' || method === 'PUT')) {
      return await handleUpdate(req);
    }
    if (action === 'delete' && (method === 'POST' || method === 'GET' || method === 'DELETE')) {
      return await handleDelete(req);
    }
    if (action === 'addcomment' && (method === 'POST' || method === 'PUT')) {
      return await handleAddComment(userId, req.body || {});
    }
    if (action === 'togglelike' && (method === 'POST' || method === 'PUT')) {
      return await handleToggleLike(userId, req.body || {});
    }

    return fail(`Unsupported action: ${action}`, 400);
  } catch (e) {
    console.error('[apiWallPost]', action, e.message);
    return fail(e.message || 'Internal error', e.status || 500);
  }
}
