import multer from 'multer';
import { listEntities, getEntity, updateEntity } from '../../entityStore.js';
import { resolveMobileUser, isAdmin } from '../mobileAuth.js';
import { storeUpload } from '../../utils/storeUpload.js';
import { env } from '../../config/env.js';
import {
  buildWorkOrderReportHtml,
  loadWorkOrderReportContext,
} from '../../utils/workOrderPdfHtml.js';

function normStr(v) {
  return String(v ?? '').trim();
}

function eqCI(a, b) {
  return normStr(a).toLowerCase() === normStr(b).toLowerCase();
}

async function parseMultipartSingle(req, fieldName) {
  const upload = multer({ storage: multer.memoryStorage() }).single(fieldName);
  await new Promise((resolve, reject) => {
    upload(req, /** @type {any} */ ({}), (err) => (err ? reject(err) : resolve()));
  });
  return req.file || null;
}

function fileToDataUrl(file) {
  if (!file?.buffer) return null;
  const mime = file.mimetype || 'application/octet-stream';
  return `data:${mime};base64,${file.buffer.toString('base64')}`;
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

async function getTaskReport(req) {
  const taskId = req.query?.taskId || req.query?.task_id;
  if (!taskId) {
    const err = new Error('Task ID is required');
    err.status = 400;
    throw err;
  }

  // 1) Find work order containing the task
  const allWorkOrders = await listEntities('TimeEntry', { limit: 5000, sort: '-planned_start_time' });
  const wo = (allWorkOrders || []).find((w) => (w.tasks || []).some((t) => t.id === taskId));
  if (!wo) {
    const err = new Error('Task associated Work Order not found');
    err.status = 404;
    throw err;
  }
  const currentTask = (wo.tasks || []).find((t) => t.id === taskId);

  // 2) Locate segment in timesheets
  const allTimesheets = await listEntities('TimesheetEntry', { limit: 5000, sort: '-clock_in_time' });
  let taskSegment = null;
  for (const ts of allTimesheets || []) {
    if (!Array.isArray(ts.work_order_segments)) continue;
    const found = ts.work_order_segments.find((s) => s.task_id === taskId);
    if (found) {
      taskSegment = found;
      break;
    }
  }

  // 3) Times
  let clockIn = 'N/A';
  let clockOut = 'N/A';
  let calculatedDuration = '0h 0m';
  if (taskSegment) {
    clockIn = taskSegment.start_time || 'N/A';
    clockOut = taskSegment.end_time || 'In Progress';
    if (taskSegment.start_time && taskSegment.end_time) {
      const start = new Date(taskSegment.start_time);
      const end = new Date(taskSegment.end_time);
      const diffMs = end - start;
      if (diffMs > 0) {
        const totalMinutes = Math.floor(diffMs / (1000 * 60));
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        calculatedDuration = `${hours}h ${minutes}m`;
      }
    } else if (taskSegment.duration_minutes) {
      const h = Math.floor(taskSegment.duration_minutes / 60);
      const m = taskSegment.duration_minutes % 60;
      calculatedDuration = `${h}h ${m}m`;
    }
  }

  // 4) Project, customer, users, teams
  const [project, allUsers, allTeams] = await Promise.all([
    wo.project_id ? getEntity('Project', wo.project_id).catch(() => null) : null,
    listEntities('User', { limit: 5000 }).catch(() => []),
    listEntities('Team', { limit: 5000 }).catch(() => []),
  ]);

  const userMap = Object.fromEntries((allUsers || []).map((u) => [u.id, u.full_name || u.email]));
  const teamMap = Object.fromEntries((allTeams || []).map((t) => [t.id, t.name]));

  const customer =
    project?.customer_id ? await getEntity('Customer', project.customer_id).catch(() => null) : null;

  const getWorkerNames = (ids) => {
    if (!ids || !Array.isArray(ids)) return 'N/A';
    return ids.map((id) => userMap[id]).filter(Boolean).join(', ') || 'N/A';
  };

  const reportData = {
    header: {
      work_order_no: wo.work_order_number || 'N/A',
      working_report_no: wo.work_order_ref || '-',
      title: wo.title || '',
    },
    general_information: {
      company: customer?.name || 'N/A',
      category: 'Service HST',
      location: wo.start_address || '-',
      project: project?.name || 'N/A',
      date: currentTask?.date || (clockIn !== 'N/A' ? String(clockIn).split('T')[0] : 'N/A'),
      time: `${currentTask?.start_time || '07:00'} - ${currentTask?.end_time || '17:00'}`,
      management_instructions: [
        {
          task_name: currentTask?.name,
          instruction: currentTask?.instructions,
        },
      ],
    },
    assigned_resources: {
      teams:
        currentTask?.team_ids?.map((id) => teamMap[id]).filter(Boolean).join(', ') || 'N/A',
      workers: getWorkerNames(currentTask?.employee_ids),
    },
    site_report: {
      work_done: currentTask?.work_done_items || [],
      work_pending: currentTask?.work_pending_items || [],
      spare_parts_installed: currentTask?.spare_parts_items || [],
      spare_parts_pending: currentTask?.spare_parts_pending_items || [],
      status: currentTask?.status,
    },
    time_tracker: {
      clock_in: clockIn,
      clock_out: clockOut,
      duration: calculatedDuration,
    },
    client_approval: {
      worker_names: getWorkerNames(currentTask?.employee_ids),
      client_name: wo.client_representative_name || '-',
      client_signature_url:
        wo.client_signature_url && String(wo.client_signature_url).startsWith('/')
          ? `${env.webUrl}${wo.client_signature_url}`
          : wo.client_signature_url || '',
    },
  };

  return { success: true, data: reportData };
}

/** Base44 generatePdf: returns HTML report (mobile prints/saves as PDF). */
async function generatePdf(req) {
  const id = req.query?.id || req.query?.work_order_id;
  if (!id) {
    const err = new Error('id required');
    err.status = 400;
    throw err;
  }

  let workOrder;
  try {
    workOrder = await getEntity('TimeEntry', id);
  } catch {
    const err = new Error('Work order not found');
    err.status = 404;
    throw err;
  }

  const ctx = await loadWorkOrderReportContext(workOrder);
  const html = buildWorkOrderReportHtml(workOrder, ctx);
  return { _rawHtml: true, html, status: 200 };
}

async function updateWorkOrder(req, user) {
  if (!isAdmin(user)) {
    const err = new Error('Only admins can update work orders');
    err.status = 403;
    err.data = { your_role: user.role };
    throw err;
  }

  const workOrderId = req.query?.id || req.query?.work_order_id || req.body?.id;
  if (!workOrderId) {
    const err = new Error('Invalid work order ID');
    err.status = 400;
    throw err;
  }

  const body = req.body || {};
  const systemFields = new Set(['id', 'created_date', 'updated_date', 'created_by_id', 'created_by']);
  const updateData = {};
  for (const [key, value] of Object.entries(body)) {
    if (systemFields.has(key)) continue;
    if (value !== undefined) updateData[key] = value;
  }
  if (Object.keys(updateData).length === 0) {
    const err = new Error('No valid fields to update');
    err.status = 400;
    throw err;
  }

  // Important: mobile may send partial task objects when editing reports.
  // Merge tasks by id to avoid wiping planner fields (date/start_time/end_time/name...).
  if (Array.isArray(updateData.tasks)) {
    try {
      const existing = await getEntity('TimeEntry', workOrderId);
      const prevTasks = Array.isArray(existing?.tasks) ? existing.tasks : [];
      const prevById = new Map(prevTasks.filter((t) => t?.id).map((t) => [t.id, t]));
      updateData.tasks = updateData.tasks.map((t) => {
        const id = t?.id;
        if (!id || !prevById.has(id)) return t;
        const prev = prevById.get(id);
        const merged = { ...prev, ...t };

        // Some mobile clients send employee_ids/team_ids as [] even when not editing assignments.
        // Preserve previous non-empty assignment arrays in that case.
        if (Array.isArray(t.employee_ids) && t.employee_ids.length === 0 && Array.isArray(prev.employee_ids) && prev.employee_ids.length > 0) {
          merged.employee_ids = prev.employee_ids;
        }
        if (Array.isArray(t.team_ids) && t.team_ids.length === 0 && Array.isArray(prev.team_ids) && prev.team_ids.length > 0) {
          merged.team_ids = prev.team_ids;
        }

        return merged;
      });
    } catch {
      /* ignore merge if existing fetch fails */
    }
  }

  // Keep current work_order_number if it exists and looks valid
  try {
    const existing = await getEntity('TimeEntry', workOrderId);
    const current = existing?.work_order_number;
    const isValid = typeof current === 'string' && /^\d{4}\/\d{2}$/.test(current);
    if (isValid) updateData.work_order_number = current;
  } catch {
    /* ignore */
  }

  const updated = await updateEntity('TimeEntry', workOrderId, updateData);
  return {
    success: true,
    data: updated,
    message: 'Work order updated successfully',
    updated_by: { user_id: user.id, email: user.email },
  };
}

async function uploadTimesheetPhoto(req, user) {
  const timesheetId = req.query?.id_timesheet;
  const photoType = req.query?.type; // clock_in | clock_out | switch
  if (!timesheetId || !photoType) {
    const err = new Error('Missing parameters');
    err.status = 400;
    err.data = {
      example:
        'POST /apps/mpb-local/functions/work-orders?action=upload-timesheet-photo&id_timesheet=<id>&type=clock_in',
    };
    throw err;
  }

  const file = await parseMultipartSingle(req, 'photo');
  if (!file) {
    const err = new Error('Photo file is required');
    err.status = 400;
    err.data = { example: 'Send multipart/form-data with field name \"photo\"' };
    throw err;
  }

  const timesheet = await getEntity('TimesheetEntry', timesheetId);
  if (timesheet.employee_id !== user.id) {
    const err = new Error('Unauthorized: You can only upload photos for your own timesheet');
    err.status = 403;
    throw err;
  }

  // For mobile tests: keep previous behavior (store as data URL) to avoid storage config.
  const photoUrl = fileToDataUrl(file);
  if (!photoUrl) {
    const err = new Error('Photo upload failed');
    err.status = 500;
    throw err;
  }

  let updateData = {};
  if (photoType === 'clock_in') updateData = { clock_in_photo_url: photoUrl };
  else if (photoType === 'clock_out') updateData = { clock_out_photo_url: photoUrl };
  else if (photoType === 'switch') {
    updateData = { switch_photo_urls: [...(timesheet.switch_photo_urls || []), photoUrl] };
  } else {
    const err = new Error('Invalid photo type. Use: clock_in, clock_out, or switch');
    err.status = 400;
    throw err;
  }

  const updatedTimesheet = await updateEntity('TimesheetEntry', timesheetId, updateData);
  return {
    success: true,
    message: `${photoType} photo uploaded successfully`,
    data: { photo_url: photoUrl, timesheet: updatedTimesheet },
  };
}

async function uploadSignature(req, user) {
  const workOrderId = req.query?.id_work_order;
  if (!workOrderId) {
    const err = new Error('id_work_order parameter is required');
    err.status = 400;
    err.data = {
      example: 'POST /apps/mpb-local/functions/work-orders?action=upload-signature&id_work_order=<work-order-id>',
    };
    throw err;
  }

  const file = await parseMultipartSingle(req, 'signature');
  if (!file) {
    const err = new Error('Signature file is required');
    err.status = 400;
    err.data = { example: 'Send multipart/form-data with field name \"signature\"' };
    throw err;
  }

  const workOrder = await getEntity('TimeEntry', workOrderId);
  const isAssigned = (workOrder.employee_ids || []).includes(user.id);
  if (!isAdmin(user) && !isAssigned) {
    const err = new Error('You do not have permission to upload signature for this work order');
    err.status = 403;
    err.data = { your_role: user.role };
    throw err;
  }

  // Signature must persist. Prefer Supabase Storage; fall back to data URL if not configured.
  let signatureUrl = null;
  try {
    const stored = await storeUpload({
      buffer: file.buffer,
      mimetype: file.mimetype,
      originalname: file.originalname,
      prefix: `signatures/${workOrderId}`,
    });
    signatureUrl = stored.file_url;
  } catch (e) {
    console.warn('[upload-signature] storage fallback:', e.message);
    signatureUrl = fileToDataUrl(file);
  }
  if (!signatureUrl) {
    const err = new Error('Signature upload failed');
    err.status = 500;
    throw err;
  }

  const updatedWorkOrder = await updateEntity('TimeEntry', workOrderId, {
    client_signature_url: signatureUrl,
  });

  return {
    success: true,
    message: 'Signature uploaded successfully',
    data: { signature_url: signatureUrl, work_order: updatedWorkOrder },
  };
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

  if (
    method === 'GET' &&
    (eqCI(a, 'get') ||
      eqCI(a, 'getWorkOrder') ||
      eqCI(a, 'getWorkOrderById') ||
      eqCI(a, 'getWorkorder'))
  ) {
    return getWorkOrderById(req, user);
  }

  if (method === 'GET' && eqCI(a, 'getTaskReport')) {
    return getTaskReport(req);
  }

  if (method === 'GET' && eqCI(a, 'generatePdf')) {
    return generatePdf(req);
  }

  if (method === 'POST' && (eqCI(a, 'update') || eqCI(a, 'put') || eqCI(a, 'updateWorkOrder'))) {
    return updateWorkOrder(req, user);
  }

  if (method === 'POST' && eqCI(a, 'upload-timesheet-photo')) {
    return uploadTimesheetPhoto(req, user);
  }

  if (method === 'POST' && eqCI(a, 'upload-signature')) {
    return uploadSignature(req, user);
  }

  const err = new Error(
    action
      ? `Action "${action}" is not implemented locally for work-orders`
      : 'Missing action query parameter (e.g. ?action=listTasks)'
  );
  err.status = 400;
  throw err;
}
