import {
  createEntity,
  updateEntity,
  deleteEntity,
  listEntities,
} from '../entityStore.js';
import { getUserById } from '../userPersistence.js';
import { normalizeMobileUserId } from '../utils/mobileUserId.js';
import { stripSensitiveUser } from '../auth/password.js';
import {
  resolveEmployeeIdAliases,
  employeeIdMatches,
} from '../utils/employeeIdAliases.js';

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
    req.headers['X-User-ID'] ||
    req.headers['user_id'] ||
    req.query?.user_id;
  if (!raw) return null;
  const id = normalizeMobileUserId(raw) || String(raw).trim();
  return getUserById(id);
}

async function getOneTask(id) {
  const rows = await listEntities('QuickTask', { query: { id }, limit: 1 });
  return rows?.[0] || null;
}

function taskAssignedToUser(task, aliasIds) {
  return (task.assigned_to_user_ids || []).some((uid) => employeeIdMatches(uid, aliasIds));
}

function taskAssignedToTeam(task, teamId) {
  return (task.assigned_to_team_ids || []).includes(teamId);
}

async function buildUserMap(userIds) {
  const map = {};
  const unique = [...new Set((userIds || []).filter(Boolean))];
  await Promise.all(
    unique.map(async (id) => {
      const normalized = normalizeMobileUserId(id) || id;
      const user = await getUserById(normalized);
      if (user) map[id] = stripSensitiveUser(user);
    })
  );
  return map;
}

async function buildTeamMap(teamIds) {
  const map = {};
  const unique = [...new Set((teamIds || []).filter(Boolean))];
  if (!unique.length) return map;
  const allTeams = await listEntities('Team', { limit: 5000 });
  for (const tid of unique) {
    const team = allTeams.find((t) => t.id === tid);
    if (team) map[tid] = team;
  }
  return map;
}

function enrichTask(task, userMap, teamMap) {
  return {
    ...task,
    assigned_to_users: (task.assigned_to_user_ids || []).map(
      (id) => userMap[id] || { id }
    ),
    working_on_by_users: (task.working_on_by_user_ids || []).map(
      (id) => userMap[id] || { id }
    ),
    assigned_to_teams: (task.assigned_to_team_ids || []).map(
      (id) => teamMap[id] || { id }
    ),
  };
}

async function enrichTasks(tasks) {
  const allUserIds = new Set();
  const allTeamIds = new Set();
  for (const t of tasks) {
    (t.assigned_to_user_ids || []).forEach((id) => allUserIds.add(id));
    (t.working_on_by_user_ids || []).forEach((id) => allUserIds.add(id));
    (t.assigned_to_team_ids || []).forEach((id) => allTeamIds.add(id));
  }
  const userMap = await buildUserMap([...allUserIds]);
  const teamMap = await buildTeamMap([...allTeamIds]);
  return tasks.map((t) => enrichTask(t, userMap, teamMap));
}

async function handleList(req) {
  const q = req.query;
  const query = {};

  if (q.status) query.status = q.status;
  if (q.department_id) query.department_id = q.department_id;
  if (q.customer_id) query.customer_id = q.customer_id;
  if (q.archived != null && q.archived !== '') {
    query.archived = q.archived === 'true';
  }
  if (q.is_draft != null && q.is_draft !== '') {
    query.is_draft = q.is_draft === 'true';
  }

  const sort = q.sort || '-created_date';
  const limit = Math.min(parseInt(q.limit || '1000', 10) || 1000, 5000);

  let tasks = await listEntities('QuickTask', { query, sort, limit });

  const assignedToUserId = q.assigned_to_user_id;
  const assignedToTeamId = q.assigned_to_team_id;

  if (assignedToUserId) {
    const aliases = await resolveEmployeeIdAliases(assignedToUserId);
    tasks = tasks.filter((t) => taskAssignedToUser(t, aliases));
  }
  if (assignedToTeamId) {
    tasks = tasks.filter((t) => taskAssignedToTeam(t, assignedToTeamId));
  }

  const enriched = await enrichTasks(tasks);
  return { success: true, data: enriched, count: enriched.length };
}

async function handleGet(req) {
  const taskId = req.query?.id_task || req.query?.id;
  if (!taskId) return fail('id_task parameter is required', 400);

  const task = await getOneTask(taskId);
  if (!task) return fail('Task not found', 404);

  const [enriched] = await enrichTasks([task]);
  return { success: true, data: enriched };
}

async function handleCreate(body) {
  if (!body?.title) return fail('title is required', 400);

  const newTask = await createEntity('QuickTask', {
    title: body.title,
    description: body.description || '',
    customer_id: body.customer_id || null,
    status: body.status || 'open',
    is_draft: body.is_draft || false,
    department_id: body.department_id || null,
    assigned_to_user_ids: body.assigned_to_user_ids || [],
    working_on_by_user_ids: body.working_on_by_user_ids || [],
    assigned_to_team_ids: body.assigned_to_team_ids || [],
    due_date: body.due_date || null,
    location: body.location || '',
    subtasks: body.subtasks || [],
    archived: body.archived || false,
    document_urls: body.document_urls || [],
  });

  const [enriched] = await enrichTasks([newTask]);
  return { success: true, data: enriched, message: 'Task created successfully' };
}

async function handleUpdate(req, body) {
  const taskId = req.query?.id_task || req.query?.id;
  if (!taskId) return fail('id_task is required', 400);

  const updates = { ...body };
  delete updates.id;
  const updatedTask = await updateEntity('QuickTask', taskId, updates);
  const [enriched] = await enrichTasks([updatedTask]);
  return { success: true, data: enriched, message: 'Task updated successfully' };
}

async function handleDelete(req) {
  const taskId = req.query?.id_task || req.query?.id;
  if (!taskId) return fail('id_task is required', 400);
  await deleteEntity('QuickTask', taskId);
  return { success: true, message: 'Task deleted successfully' };
}

async function handleAssign(req) {
  const taskId = req.query?.id_task;
  const userIdParam = req.query?.id_user;
  const teamIdParam = req.query?.id_team;
  if (!taskId) return fail('id_task is required', 400);

  const task = await getOneTask(taskId);
  if (!task) return fail('Task not found', 404);

  const updates = {};
  if (userIdParam) {
    const users = new Set(task.assigned_to_user_ids || []);
    users.add(normalizeMobileUserId(userIdParam) || userIdParam);
    updates.assigned_to_user_ids = Array.from(users);
  }
  if (teamIdParam) {
    const teams = new Set(task.assigned_to_team_ids || []);
    teams.add(teamIdParam);
    updates.assigned_to_team_ids = Array.from(teams);
  }

  const updatedTask = await updateEntity('QuickTask', taskId, updates);
  const [enriched] = await enrichTasks([updatedTask]);
  return { success: true, data: enriched, message: 'Task assignments updated' };
}

async function handleWorkingOn(req) {
  const taskId = req.query?.id_task;
  const targetUser = req.query?.id_user;
  const isWorking = req.query?.is_working_on === 'true';

  if (!taskId || !targetUser) return fail('id_task and id_user are required', 400);

  const task = await getOneTask(taskId);
  if (!task) return fail('Task not found', 404);

  const normalizedTarget = normalizeMobileUserId(targetUser) || targetUser;
  let working = [...(task.working_on_by_user_ids || [])];

  if (isWorking) {
    if (!working.some((id) => employeeIdMatches(id, [normalizedTarget, targetUser]))) {
      working.push(normalizedTarget);
    }
  } else {
    const aliases = await resolveEmployeeIdAliases(targetUser);
    working = working.filter((id) => !employeeIdMatches(id, aliases));
  }

  const updatedTask = await updateEntity('QuickTask', taskId, {
    working_on_by_user_ids: working,
  });
  const [enriched] = await enrichTasks([updatedTask]);
  return {
    success: true,
    data: enriched,
    message: isWorking ? 'Started working on task' : 'Stopped working on task',
  };
}

async function handleComplete(req) {
  const taskId = req.query?.id_task;
  if (!taskId) return fail('id_task is required', 400);

  const updatedTask = await updateEntity('QuickTask', taskId, {
    status: 'done',
    completed_date: new Date().toISOString(),
  });
  const [enriched] = await enrichTasks([updatedTask]);
  return { success: true, data: enriched, message: 'Task marked as complete' };
}

async function handleBulkDelete(body) {
  const task_ids = body?.task_ids;
  if (!task_ids?.length) return fail('task_ids required', 400);
  await Promise.all(task_ids.map((id) => deleteEntity('QuickTask', id)));
  return { success: true, message: `Deleted ${task_ids.length} tasks` };
}

async function handleBulkArchive(body) {
  const task_ids = body?.task_ids;
  if (!task_ids?.length) return fail('task_ids required', 400);
  await Promise.all(
    task_ids.map((id) => updateEntity('QuickTask', id, { archived: true }))
  );
  return { success: true, message: `Archived ${task_ids.length} tasks` };
}

export async function handleApiQuickTasks(req) {
  const method = req.method?.toUpperCase();
  const action = normAction(req.query?.action);
  const body = req.body || {};

  const currentUser = await resolveUser(req);
  if (!currentUser) {
    return fail('Unauthorized: X-User-ID header is required', 401);
  }

  const isAdmin = currentUser.role === 'admin';

  if (!action) {
    return fail('Missing action parameter', 400);
  }

  try {
    if (action === 'list' && method === 'GET') {
      return await handleList(req);
    }

    if (action === 'get' && method === 'GET') {
      return await handleGet(req);
    }

    if (action === 'create' && (method === 'POST' || method === 'PUT')) {
      return await handleCreate(body);
    }

    if (
      action === 'update' &&
      (method === 'PUT' || method === 'POST' || method === 'PATCH')
    ) {
      return await handleUpdate(req, body);
    }

    if (action === 'delete' && (method === 'DELETE' || method === 'POST' || method === 'GET')) {
      return await handleDelete(req);
    }

    if (action === 'assign' && (method === 'PUT' || method === 'POST')) {
      return await handleAssign(req);
    }

    if (action === 'working-on' && (method === 'PUT' || method === 'POST')) {
      return await handleWorkingOn(req);
    }

    if (action === 'complete' && (method === 'PUT' || method === 'POST')) {
      return await handleComplete(req);
    }

    if (action === 'bulk-delete' && (method === 'PUT' || method === 'POST')) {
      if (!isAdmin) return fail('Forbidden', 403);
      return await handleBulkDelete(body);
    }

    if (action === 'bulk-archive' && (method === 'PUT' || method === 'POST')) {
      if (!isAdmin) return fail('Forbidden', 403);
      return await handleBulkArchive(body);
    }

    return fail(
      `Invalid action: ${action}. Available: list, get, create, update, delete, assign, complete, working-on, bulk-delete, bulk-archive`,
      400
    );
  } catch (e) {
    console.error('[apiQuickTasks]', action, e.message);
    return fail(e.message || 'Internal server error', e.status || 500);
  }
}
