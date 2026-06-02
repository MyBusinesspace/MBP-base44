import { listEntities } from '../../entityStore.js';
import { resolveMobileUser, isAdmin } from '../mobileAuth.js';

function normStr(v) {
  return String(v ?? '').trim();
}

function eqCI(a, b) {
  return normStr(a).toLowerCase() === normStr(b).toLowerCase();
}

async function listTasks(req, user) {
  const q = req.query;
  const projectId = q.project_id;
  const teamId = q.team_id;
  const categoryId = q.category_id;
  const status = q.status;
  const filterDate = q.date;
  const filterEmployeeId = q.employee_id;
  const startDate = q.start_date;
  const endDate = q.end_date;

  let limit = parseInt(q.limit || '100', 10);
  if (limit > 500) limit = 500;
  const offset = parseInt(q.offset || '0', 10);

  const queryFilters = { archived: false };
  if (projectId && projectId !== 'null') queryFilters.project_id = projectId;
  if (categoryId && categoryId !== 'null') queryFilters.work_order_category_id = categoryId;

  let workOrders = await listEntities('TimeEntry', {
    query: queryFilters,
    sort: '-planned_start_time',
    limit: 500,
  });

  if (filterDate) {
    workOrders = workOrders.filter((wo) => {
      if (!wo.planned_start_time) return false;
      const ps = String(wo.planned_start_time);
      return (
        ps >= `${filterDate}T00:00:00.000Z` && ps <= `${filterDate}T23:59:59.999Z`
      );
    });
  }

  let myTeamIds = [];
  if (!isAdmin(user)) {
    const allTeams = await listEntities('Team', { limit: 5000 });
    myTeamIds = (allTeams || [])
      .filter((t) => (t.employee_ids || []).includes(user.id))
      .map((t) => t.id);

    workOrders = workOrders.filter((wo) => {
      if (wo.employee_id === user.id) return true;
      if ((wo.employee_ids || []).includes(user.id)) return true;
      if ((wo.team_ids || []).some((id) => myTeamIds.includes(id))) return true;
      if (wo.tasks && Array.isArray(wo.tasks)) {
        return wo.tasks.some(
          (task) =>
            (task.employee_ids || []).includes(user.id) ||
            (task.team_ids || []).some((id) => myTeamIds.includes(id))
        );
      }
      return false;
    });
  }

  let tasks = [];
  workOrders.forEach((wo) => {
    if (!wo.tasks || !Array.isArray(wo.tasks)) return;
    wo.tasks.forEach((task) => {
      tasks.push({
        ...task,
        work_order_id: wo.id,
        work_order_number: wo.work_order_number,
        work_order_title: wo.title,
        project_id: wo.project_id,
        branch_id: wo.branch_id,
        work_order_status: wo.status,
        work_order_category_id: wo.work_order_category_id,
        archived: wo.archived,
        planned_start_time: wo.planned_start_time,
      });
    });
  });

  tasks = tasks.filter((task) => {
    if (projectId && projectId !== 'null' && task.project_id !== projectId) return false;
    if (categoryId && categoryId !== 'null' && task.work_order_category_id !== categoryId)
      return false;
    if (status && !eqCI(task.status, status)) return false;
    if (teamId && !(task.team_ids || []).includes(teamId)) return false;
    if (filterEmployeeId && !(task.employee_ids || []).includes(filterEmployeeId))
      return false;
    if (
      filterDate &&
      (task.date || task.planned_start_time?.substring(0, 10)) !== filterDate
    ) {
      return false;
    }
    if ((startDate || endDate) && task.planned_start_time) {
      const woDate = new Date(task.planned_start_time);
      if (startDate && woDate < new Date(startDate)) return false;
      if (endDate && woDate > new Date(endDate)) return false;
    }
    return true;
  });

  const workOrderMap = Object.fromEntries(workOrders.map((wo) => [wo.id, wo]));

  const employeeIdsSet = new Set();
  const projectIdsSet = new Set();
  const teamIdsSet = new Set();
  const branchIdsSet = new Set();
  const customerIdsSet = new Set();

  tasks.forEach((task) => {
    const workOrder = workOrderMap[task.work_order_id];
    (task.employee_ids || []).forEach((id) => employeeIdsSet.add(id));
    (workOrder?.employee_ids || []).forEach((id) => employeeIdsSet.add(id));
    if (workOrder?.employee_id) employeeIdsSet.add(workOrder.employee_id);
    (task.team_ids || []).forEach((id) => teamIdsSet.add(id));
    (workOrder?.team_ids || []).forEach((id) => teamIdsSet.add(id));
    if (workOrder?.team_id) teamIdsSet.add(workOrder.team_id);
    if (task.project_id) projectIdsSet.add(task.project_id);
    if (task.branch_id) branchIdsSet.add(task.branch_id);
    if (workOrder?.customer_id) customerIdsSet.add(workOrder.customer_id);
  });

  const [employees, projects, teams, branches] = await Promise.all([
    employeeIdsSet.size
      ? listEntities('User', {
          query: { id: { $in: [...employeeIdsSet].slice(0, 100) } },
          limit: 100,
        })
      : [],
    projectIdsSet.size
      ? listEntities('Project', {
          query: { id: { $in: [...projectIdsSet].slice(0, 100) } },
          limit: 100,
        })
      : [],
    teamIdsSet.size
      ? listEntities('Team', {
          query: { id: { $in: [...teamIdsSet].slice(0, 100) } },
          limit: 100,
        })
      : [],
    branchIdsSet.size
      ? listEntities('Branch', {
          query: { id: { $in: [...branchIdsSet].slice(0, 100) } },
          limit: 100,
        })
      : [],
  ]);

  const employeeMap = Object.fromEntries(employees.map((e) => [e.id, e]));
  const projectMap = Object.fromEntries(projects.map((p) => [p.id, p]));
  const teamMap = Object.fromEntries(teams.map((t) => [t.id, t]));
  const branchMap = Object.fromEntries(branches.map((b) => [b.id, b]));

  projects.forEach((p) => {
    if (p.customer_id) customerIdsSet.add(p.customer_id);
  });

  const customers =
    customerIdsSet.size > 0
      ? await listEntities('Customer', {
          query: { id: { $in: [...customerIdsSet].slice(0, 100) } },
          limit: 100,
        })
      : [];
  const customerMap = Object.fromEntries(customers.map((c) => [c.id, c]));

  const enrichedTasks = tasks.map((task) => {
    const workOrder = workOrderMap[task.work_order_id];
    const project = task.project_id ? projectMap[task.project_id] : null;
    const customerId = workOrder?.customer_id || project?.customer_id || null;
    const customer = customerId ? customerMap[customerId] : null;

    const allEmployeeIds = new Set([
      ...(task.employee_ids || []),
      ...(workOrder?.employee_ids || []),
      ...(workOrder?.employee_id ? [workOrder.employee_id] : []),
    ]);
    const allTeamIds = new Set([
      ...(task.team_ids || []),
      ...(workOrder?.team_ids || []),
      ...(workOrder?.team_id ? [workOrder.team_id] : []),
    ]);

    return {
      ...task,
      employees: [...allEmployeeIds].map((id) => employeeMap[id]).filter(Boolean),
      teams: [...allTeamIds].map((id) => teamMap[id]).filter(Boolean),
      project: project ? { ...project, customer: customer || null } : null,
      customer: customer || null,
      branch: task.branch_id ? branchMap[task.branch_id] : null,
      work_order: workOrder || null,
    };
  });

  const paginated = enrichedTasks.slice(offset, offset + limit);

  return {
    success: true,
    data: paginated,
    pagination: {
      total: enrichedTasks.length,
      limit,
      offset,
      hasMore: enrichedTasks.length > offset + limit,
    },
    authenticated_as: { user_id: user.id, email: user.email, role: user.role },
  };
}

async function listWorkOrders(req, user) {
  const q = req.query;
  const projectId = q.project_id;
  const teamId = q.team_id;
  const categoryId = q.category_id;
  const status = q.status;
  const filterDate = q.date;

  let limit = parseInt(q.limit || '100', 10);
  if (limit > 500) limit = 500;
  const offset = parseInt(q.offset || '0', 10);

  const queryFilters = { archived: false };
  if (projectId && projectId !== 'null') queryFilters.project_id = projectId;
  if (categoryId && categoryId !== 'null') queryFilters.work_order_category_id = categoryId;
  if (status && status !== 'null') queryFilters.status = status;

  let workOrders = await listEntities('TimeEntry', {
    query: queryFilters,
    sort: '-planned_start_time',
    limit: 2000,
  });

  if (filterDate) {
    workOrders = workOrders.filter((wo) => {
      const ps = String(wo.planned_start_time || '');
      return ps && ps >= `${filterDate}T00:00:00.000Z` && ps <= `${filterDate}T23:59:59.999Z`;
    });
  }

  if (!isAdmin(user)) {
    const allTeams = await listEntities('Team', { limit: 5000 });
    const myTeamIds = (allTeams || [])
      .filter((t) => (t.employee_ids || []).includes(user.id))
      .map((t) => t.id);
    workOrders = workOrders.filter((wo) => {
      if (wo.employee_id === user.id) return true;
      if ((wo.employee_ids || []).includes(user.id)) return true;
      if ((wo.team_ids || []).some((id) => myTeamIds.includes(id))) return true;
      if (wo.team_id && myTeamIds.includes(wo.team_id)) return true;
      if (wo.tasks && Array.isArray(wo.tasks)) {
        return wo.tasks.some(
          (task) =>
            (task.employee_ids || []).includes(user.id) ||
            (task.team_ids || []).some((id) => myTeamIds.includes(id))
        );
      }
      return false;
    });
  }

  if (teamId && teamId !== 'null') {
    workOrders = workOrders.filter((wo) => {
      const ids = wo.team_ids || (wo.team_id ? [wo.team_id] : []);
      return ids.includes(teamId);
    });
  }

  const paginated = workOrders.slice(offset, offset + limit);
  return {
    success: true,
    data: paginated,
    pagination: {
      total: workOrders.length,
      limit,
      offset,
      hasMore: workOrders.length > offset + limit,
    },
    authenticated_as: { user_id: user.id, email: user.email, role: user.role },
  };
}

async function getWorkOrderById(req, _user) {
  const id = req.query?.id || req.query?.work_order_id;
  if (!id) {
    const err = new Error('Missing id query parameter');
    err.status = 400;
    throw err;
  }
  const wo = await listEntities('TimeEntry', { query: { id }, limit: 1 }).then((r) => r?.[0]);
  if (!wo) {
    const err = new Error('Work order not found');
    err.status = 404;
    throw err;
  }
  return { success: true, data: wo };
}

/** Mobile work-orders function (GET ?action=...). */
export async function handleWorkOrders(req) {
  const user = await resolveMobileUser(req);
  const action = req.query.action;
  const method = req.method.toUpperCase();

  const a = normStr(action);
  const isListTasks =
    eqCI(a, 'listTasks') ||
    eqCI(a, 'getTasks') ||
    eqCI(a, 'tasks') ||
    eqCI(a, 'list') ||
    a.toLowerCase().startsWith('listtasks');

  if (method === 'GET' && isListTasks) {
    return listTasks(req, user);
  }

  if (method === 'GET' && (eqCI(a, 'listWorkOrders') || eqCI(a, 'listWorkorders') || eqCI(a, 'listWorkOrdersV2'))) {
    return listWorkOrders(req, user);
  }

  if (method === 'GET' && (eqCI(a, 'getWorkOrder') || eqCI(a, 'getWorkOrderById') || eqCI(a, 'getWorkorder'))) {
    return getWorkOrderById(req, user);
  }

  const err = new Error(
    action
      ? `Action "${action}" is not implemented locally for work-orders`
      : 'Missing action query parameter (e.g. ?action=listTasks)'
  );
  err.status = 400;
  throw err;
}
