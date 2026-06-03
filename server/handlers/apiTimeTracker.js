import { createEntity, updateEntity, listEntities, getEntity } from '../entityStore.js';
import { getUserById } from '../userPersistence.js';
import { normalizeMobileUserId } from '../utils/mobileUserId.js';
import { stripSensitiveUser } from '../auth/password.js';

function fail(message, status = 400) {
  return { success: false, error: message, status };
}

function normAction(raw) {
  return String(raw || '').trim();
}

function actionIs(action, expected) {
  return normAction(action).toLowerCase() === expected.toLowerCase();
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

function normalizeCoords(coords) {
  if (!coords || typeof coords !== 'object') return coords;
  const out = { ...coords };
  if (out.lng != null && out.lon == null) out.lon = out.lng;
  if (out.lon != null && out.lng == null) out.lng = out.lon;
  return out;
}

async function handleGetSettings() {
  const keys = [
    'timesheet_require_photo_clock_out',
    'timesheet_require_photo_switch',
    'timesheet_require_photo_clock_in',
    'timesheet_track_gps',
  ];
  const settings = await listEntities('AppSettings', { limit: 500 });
  const settingsMap = {};
  for (const s of settings) {
    if (!keys.includes(s.setting_key)) continue;
    let value = s.setting_value;
    if (s.setting_type === 'boolean') value = value === 'true' || value === true;
    else if (s.setting_type === 'number') value = Number(value);
    settingsMap[s.setting_key] = value;
  }
  if (Object.keys(settingsMap).length === 0) {
    return { success: true, data: null };
  }
  return {
    success: true,
    data: {
      require_photo_clock_out: settingsMap.timesheet_require_photo_clock_out ?? false,
      require_photo_switch: settingsMap.timesheet_require_photo_switch ?? false,
      require_photo_clock_in: settingsMap.timesheet_require_photo_clock_in ?? false,
      track_gps: settingsMap.timesheet_track_gps ?? false,
    },
  };
}

async function enrichActiveTimesheet(activeTimesheet, userId) {
  const validSegments = (activeTimesheet.work_order_segments || []).filter((s) => s.work_order_id);
  const workOrderIds = [...new Set(validSegments.map((s) => s.work_order_id).filter(Boolean))];

  let workOrders = [];
  if (workOrderIds.length) {
    const all = await listEntities('TimeEntry', { limit: 2000 });
    workOrders = all.filter((w) => workOrderIds.includes(w.id));
  }

  if (validSegments.length > 0 && workOrders.length === 0) {
    await updateEntity('TimesheetEntry', activeTimesheet.id, {
      is_active: false,
      status: 'completed',
    });
    return null;
  }

  const workOrderMap = Object.fromEntries(workOrders.map((w) => [w.id, w]));
  const projectIds = [...new Set(workOrders.map((w) => w.project_id).filter(Boolean))];
  let projects = [];
  if (projectIds.length) {
    const allProjects = await listEntities('Project', { limit: 1000 });
    projects = allProjects.filter((p) => projectIds.includes(p.id));
  }
  const projectMap = Object.fromEntries(projects.map((p) => [p.id, p]));
  const customerIds = [...new Set(projects.map((p) => p.customer_id).filter(Boolean))];
  let customers = [];
  if (customerIds.length) {
    const allCustomers = await listEntities('Customer', { limit: 1000 });
    customers = allCustomers.filter((c) => customerIds.includes(c.id));
  }
  const customerMap = Object.fromEntries(customers.map((c) => [c.id, c]));

  const enrichedSegments = validSegments.map((segment) => {
    const workOrder = workOrderMap[segment.work_order_id];
    if (!workOrder) {
      return {
        ...segment,
        work_order_number: null,
        work_order_title: null,
        work_order_address: null,
        work_order_status: null,
        work_order_project_id: null,
        work_order_project_name: null,
        work_order_customer_name: null,
        work_order_project_logo: null,
        work_order_raw: null,
      };
    }
    const project = workOrder.project_id ? projectMap[workOrder.project_id] : null;
    const customer = project?.customer_id ? customerMap[project.customer_id] : null;
    return {
      ...segment,
      work_order_number: workOrder.work_order_number || null,
      work_order_title: workOrder.title || 'N/A',
      work_order_address: workOrder.start_address,
      work_order_status: workOrder.status,
      work_order_project_id: workOrder.project_id,
      work_order_project_name: project?.name ?? 'N/A',
      work_order_customer_name: customer?.name ?? 'N/A',
      work_order_project_logo: project?.logo ?? null,
      work_order_raw: workOrder,
    };
  });

  const allTimesheets = await listEntities('TimesheetEntry', {
    query: { employee_id: userId },
    limit: 500,
  });
  const today = new Date().toISOString().split('T')[0];
  const filteredTimesheets = allTimesheets.filter((ts) =>
    ts.clock_in_time?.split('T')[0] === today
  );
  const totalDurationMinutesToday = filteredTimesheets.reduce(
    (sum, ts) => sum + (ts.total_duration_minutes || 0),
    0
  );

  const employeeData = (await getUserById(activeTimesheet.employee_id)) || null;

  return {
    ...activeTimesheet,
    work_order_segments: enrichedSegments,
    total_duration_minutes_today: totalDurationMinutesToday,
    employee: employeeData ? stripSensitiveUser(employeeData) : null,
  };
}

async function handleGetActiveTimesheet(userId) {
  let timesheets = await listEntities('TimesheetEntry', {
    query: { employee_id: userId, is_active: true },
    limit: 5,
    sort: '-clock_in_time',
  });
  let activeTimesheet = timesheets[0] || null;

  // Fallback: status=active but is_active not set
  if (!activeTimesheet) {
    const candidates = await listEntities('TimesheetEntry', {
      query: { employee_id: userId, status: 'active' },
      limit: 10,
      sort: '-clock_in_time',
    });
    const open = (candidates || []).find((ts) => !ts.clock_out_time);
    if (open) {
      try {
        await updateEntity('TimesheetEntry', open.id, { is_active: true });
      } catch {
        /* ignore */
      }
      activeTimesheet = open;
    }
  }
  if (!activeTimesheet) {
    return { success: true, data: null };
  }
  const enriched = await enrichActiveTimesheet(activeTimesheet, userId);
  if (!enriched) {
    return { success: true, data: null };
  }
  return { success: true, data: enriched };
}

async function handleClockIn(userId, body) {
  const {
    work_order_id,
    task_id,
    clock_in_coords,
    clock_in_photo_url,
    clock_in_address,
    timesheet_type,
    department_name,
  } = body || {};

  if (!work_order_id) return fail('work_order_id is required', 400);
  if (!task_id) return fail('task_id is required', 400);

  const activeTimesheets = await listEntities('TimesheetEntry', {
    query: { employee_id: userId, is_active: true },
    limit: 5,
  });
  if (activeTimesheets.length > 0) {
    return {
      success: false,
      error: 'User already has an active timesheet',
      active_timesheet: activeTimesheets[0],
      status: 400,
    };
  }

  let department_id = null;
  if (department_name && department_name !== 'unknown') {
    const departments = await listEntities('Department', { limit: 500 });
    const dept = departments.find(
      (d) => String(d.name || '').toLowerCase() === String(department_name).toLowerCase()
    );
    department_id = dept?.id || null;
  }

  const now = new Date().toISOString();
  const newTimesheet = await createEntity('TimesheetEntry', {
    employee_id: userId,
    clock_in_time: now,
    clock_in_coords: normalizeCoords(clock_in_coords) || null,
    clock_in_photo_url: clock_in_photo_url || null,
    clock_in_address: clock_in_address || null,
    timesheet_type: timesheet_type || 'field_work',
    department_id,
    is_active: true,
    status: 'active',
    work_order_segments: [
      {
        work_order_id,
        task_id,
        start_time: now,
        end_time: null,
        duration_minutes: 0,
      },
    ],
    live_tracking_points: [],
    was_edited: false,
  });

  try {
    await updateEntity('TimeEntry', work_order_id, {
      is_active: true,
      start_time: now,
      start_coords: normalizeCoords(clock_in_coords) || null,
      start_address: clock_in_address || null,
    });
  } catch (err) {
    console.warn('[apiTimeTracker] TimeEntry update on clock-in:', err.message);
  }

  console.log('[apiTimeTracker] clockIn', userId, newTimesheet.id, work_order_id);
  return {
    success: true,
    data: newTimesheet,
    message: 'Clocked in successfully',
  };
}

async function handleClockOut(userId, body) {
  const {
    clock_out_coords,
    clock_out_photo_url,
    clock_out_address,
    notes,
    work_order_id,
    status,
  } = body || {};

  let activeTimesheets = await listEntities('TimesheetEntry', {
    query: { employee_id: userId, is_active: true },
    limit: 5,
    sort: '-clock_in_time',
  });

  // Fallback: some clients saved status=active but is_active=false (or missed is_active)
  if (!activeTimesheets.length) {
    const candidates = await listEntities('TimesheetEntry', {
      query: { employee_id: userId, status: 'active' },
      limit: 10,
      sort: '-clock_in_time',
    });
    const open = (candidates || []).find((ts) => !ts.clock_out_time);
    if (open) {
      try {
        await updateEntity('TimesheetEntry', open.id, { is_active: true });
      } catch {
        /* ignore */
      }
      activeTimesheets = [open];
    }
  }

  if (!activeTimesheets.length) return fail('No active timesheet found', 404);

  const timesheet = activeTimesheets[0];
  const clockOutTime = new Date();
  const clockInTime = new Date(timesheet.clock_in_time);
  const totalDurationMinutes = Math.round((clockOutTime - clockInTime) / 60000);

  const segments = [...(timesheet.work_order_segments || [])];
  if (segments.length > 0) {
    const lastSegment = segments[segments.length - 1];
    if (!lastSegment.end_time) {
      const segmentStartTime = new Date(lastSegment.start_time);
      lastSegment.end_time = clockOutTime.toISOString();
      lastSegment.duration_minutes = Math.round((clockOutTime - segmentStartTime) / 60000);
    }
  }

  const updatedTimesheet = await updateEntity('TimesheetEntry', timesheet.id, {
    clock_out_time: clockOutTime.toISOString(),
    clock_out_coords: normalizeCoords(clock_out_coords) || null,
    clock_out_photo_url: clock_out_photo_url || null,
    clock_out_address: clock_out_address || null,
    notes: notes || timesheet.notes,
    is_active: false,
    status: 'completed',
    total_duration_minutes: totalDurationMinutes,
    work_order_segments: segments,
  });

  const workOrderId =
    work_order_id || segments[segments.length - 1]?.work_order_id || body?.work_order_id;

  let workOrderUpdated = false;
  let workOrder = null;

  if (workOrderId) {
    try {
      const woUpdate = {
        is_active: false,
        end_time: clockOutTime.toISOString(),
        end_coords: normalizeCoords(clock_out_coords) || null,
        end_address: clock_out_address || null,
        duration_minutes: totalDurationMinutes,
      };
      if (status) {
        woUpdate.status = status;
        woUpdate.completed_date = clockOutTime.toISOString();
      }
      workOrder = await updateEntity('TimeEntry', workOrderId, woUpdate);
      workOrderUpdated = true;

      if (status && Array.isArray(workOrder?.tasks)) {
        const tasks = workOrder.tasks.map((t) => ({
          ...t,
          status: status === 'completed' ? 'completed' : t.status,
        }));
        await updateEntity('TimeEntry', workOrderId, { tasks });
      }
      workOrder = await getEntity('TimeEntry', workOrderId);
    } catch (err) {
      console.warn('[apiTimeTracker] TimeEntry update on clock-out:', err.message);
    }
  }

  // Shape compatible with Base44 mobile client expectations
  const timesheetPayload = {
    ...updatedTimesheet,
    notes: updatedTimesheet.notes ?? null,
    approval_notes: updatedTimesheet.approval_notes ?? null,
    department_id: updatedTimesheet.department_id ?? null,
    regular_hours_calculated: updatedTimesheet.regular_hours_calculated ?? null,
    overtime_hours_non_paid_calculated: updatedTimesheet.overtime_hours_non_paid_calculated ?? null,
    overtime_hours_paid_calculated: updatedTimesheet.overtime_hours_paid_calculated ?? null,
    clock_in_photo_url: updatedTimesheet.clock_in_photo_url ?? null,
    clock_out_photo_url: updatedTimesheet.clock_out_photo_url ?? null,
    switch_photo_urls: updatedTimesheet.switch_photo_urls ?? [],
    was_edited: updatedTimesheet.was_edited ?? false,
  };

  return {
    success: true,
    message: 'Clocked out successfully',
    data: {
      timesheet: timesheetPayload,
      work_order_updated: workOrderUpdated,
      work_order: workOrder,
    },
  };
}

async function handleAddTrackingPoint(userId, body) {
  const { lat, lon } = body || {};
  if (lat == null || lon == null) return fail('lat and lon are required', 400);

  const activeTimesheets = await listEntities('TimesheetEntry', {
    query: { employee_id: userId, is_active: true },
    limit: 5,
  });
  if (!activeTimesheets.length) return fail('No active timesheet found', 404);

  const timesheet = activeTimesheets[0];
  const trackingPoints = Array.isArray(timesheet.live_tracking_points)
    ? [...timesheet.live_tracking_points]
    : [];
  trackingPoints.push({
    timestamp: new Date().toISOString(),
    lat,
    lon,
  });

  const updatedTimesheet = await updateEntity('TimesheetEntry', timesheet.id, {
    live_tracking_points: trackingPoints,
  });

  return { success: true, data: updatedTimesheet, message: 'Tracking point added' };
}

export async function handleApiTimeTracker(req) {
  const method = req.method?.toUpperCase();
  const action = normAction(req.query?.action);

  const currentUser = await resolveUser(req);
  if (!currentUser) {
    return fail('Unauthorized - User not found. Provide X-User-ID header.', 401);
  }
  const userId = currentUser.id;

  if (method === 'GET' && actionIs(action, 'getSettings')) {
    try {
      return await handleGetSettings();
    } catch (e) {
      return fail(e.message, 500);
    }
  }

  if (method === 'GET' && actionIs(action, 'getActiveTimesheet')) {
    try {
      return await handleGetActiveTimesheet(userId);
    } catch (e) {
      return fail(e.message, 500);
    }
  }

  if (method === 'POST' && (actionIs(action, 'clockIn') || actionIs(action, 'clockin'))) {
    try {
      return await handleClockIn(userId, req.body || {});
    } catch (e) {
      console.error('[apiTimeTracker] clockIn', e.message);
      return fail(e.message, 500);
    }
  }

  if (method === 'POST' && (actionIs(action, 'clockOut') || actionIs(action, 'clockout'))) {
    try {
      return await handleClockOut(userId, req.body || {});
    } catch (e) {
      console.error('[apiTimeTracker] clockOut', e.message);
      return fail(e.message, 500);
    }
  }

  if (method === 'POST' && actionIs(action, 'addTrackingPoint')) {
    try {
      return await handleAddTrackingPoint(userId, req.body || {});
    } catch (e) {
      console.error('[apiTimeTracker] addTrackingPoint', e.message);
      return fail(e.message, 500);
    }
  }

  return fail(`Invalid or unimplemented action: ${action}`, 400);
}
