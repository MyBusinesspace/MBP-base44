import { listEntities, getEntity } from '../entityStore.js';
import { getUserById } from '../userPersistence.js';
import { normalizeMobileUserId } from '../utils/mobileUserId.js';
import {
  resolveEmployeeIdAliases,
  employeeIdMatches,
  formatLeaveRequestForMobile,
} from '../utils/employeeIdAliases.js';
import { isAdmin as userIsAdmin } from '../routes/mobileAuth.js';

function fail(message, status = 400) {
  return { success: false, error: message, status };
}

function onDate(value, date) {
  return value && String(value).includes(date);
}

function defaultNavigation(company = {}) {
  return [
    {
      title: 'Admin',
      items: [
        { name: 'Calendar', icon: 'CalendarDays', path: '/calendar', type: 'page', color: 'bg-purple-100 text-purple-600', customIconUrl: company.calendar_tab_icon_url },
        { name: 'Clients', icon: 'Building2', path: '/clients', type: 'page', color: 'bg-indigo-100 text-indigo-600', customIconUrl: company.clients_tab_icon_url },
      ],
    },
    {
      title: 'Operations',
      items: [
        { name: 'Planner', icon: 'ClipboardList', path: '/work-orders', type: 'page', color: 'bg-orange-100 text-orange-600', customIconUrl: company.schedule_tab_icon_url },
        { name: 'Time Tracker', icon: 'Clock', path: '/time-tracker', type: 'page', color: 'bg-blue-600 text-white', customIconUrl: company.time_tracker_tab_icon_url },
        { name: 'Quick Tasks', icon: 'ListTodo', path: '/quick-tasks', type: 'page', color: 'bg-emerald-100 text-emerald-600', customIconUrl: company.quick_tasks_tab_icon_url },
        { name: 'Projects', icon: 'Briefcase', path: '/projects', type: 'page', color: 'bg-pink-100 text-pink-600', customIconUrl: company.projects_tab_icon_url },
        { name: 'Contacts', icon: 'Building', path: '/contacts', type: 'page', color: 'bg-cyan-100 text-cyan-600', customIconUrl: company.contacts_tab_icon_url },
      ],
    },
    {
      title: 'Connection',
      items: [
        { name: 'AI Assistant', icon: 'Bot', path: '/ai-assistant', type: 'page', badge: 'AI', color: 'bg-violet-100 text-violet-600', customIconUrl: company.ai_assistant_tab_icon_url },
        { name: 'Chat', icon: 'MessageSquare', path: '/chat', type: 'page', color: 'bg-green-100 text-green-600', customIconUrl: company.chat_tab_icon_url },
      ],
    },
    {
      title: 'Resources',
      items: [
        { name: 'Assets', icon: 'Package', path: '/assets', type: 'page', customIconUrl: company.documents_assets_tab_icon_url },
        { name: 'Client Equipment', icon: 'Equipment', path: '/equipment', type: 'page', customIconUrl: company.calendar_tab_icon_url },
      ],
    },
    {
      title: 'HR',
      items: [
        { name: 'Users', icon: 'Users', path: '/users', type: 'page', adminOnly: true, customIconUrl: company.users_tab_icon_url },
        { name: 'Petty Cash', icon: 'Wallet', path: '/petty-cash', type: 'page', customIconUrl: company.petty_cash_tab_icon_url },
        { name: 'Payroll', icon: 'Dollar', path: '/payroll', type: 'page', customIconUrl: company.payroll_tab_icon_url },
      ],
    },
  ];
}

async function resolveHelperUser(req) {
  const raw =
    req.headers['x-user-id'] ||
    req.headers['user_id'] ||
    req.query?.user_id ||
    req.headers['apikey'] ||
    req.headers['apiKey'];
  if (!raw) return null;
  const id = normalizeMobileUserId(raw) || String(raw).trim();
  return (await getUserById(id)) || null;
}

function hasAccessToEvent(event, currentUser, admin) {
  if (!event) return false;
  if (admin) return true;
  if (event.participant_user_ids?.includes(currentUser.id)) return true;
  if (currentUser.team_id && event.participant_team_ids?.includes(currentUser.team_id)) return true;
  if (event.created_by === currentUser.email) return true;
  return false;
}

async function checkAppVersion(req) {
  const clientVersion = req.headers['x-app-version'];
  const settings = await listEntities('AppSettings', { limit: 200 });
  const versionSetting = settings.find((s) => s.setting_key === 'mobile_app_version');
  const linkSetting = settings.find((s) => s.setting_key === 'mobile_app_link');
  const requiredVersion = versionSetting?.setting_value || versionSetting?.value;
  const appLink = linkSetting?.setting_value || linkSetting?.value;
  if (requiredVersion && clientVersion && clientVersion !== String(requiredVersion)) {
    return {
      block: true,
      body: {
        success: false,
        update_required: true,
        message: 'A new update is available for the app, please update to continue.',
        current_version: clientVersion,
        required_version: requiredVersion,
        update_link: appLink,
        status: 426,
      },
    };
  }
  return { block: false };
}

async function handleAppInit(currentUser, admin, date) {
  const today = date || new Date().toISOString().split('T')[0];

  const [timesheets, workOrders, calendarEvents, pettyCashEntries, leaveRequests, allUsers, allCategories] =
    await Promise.all([
      listEntities('TimesheetEntry', { sort: '-clock_in_time', limit: 500 }),
      listEntities('TimeEntry', { sort: '-planned_start_time', limit: 500 }),
      listEntities('CalendarEvent', { sort: '-start_time', limit: 500 }),
      listEntities('PettyCashEntry', { sort: '-created_date', limit: 200 }),
      listEntities('LeaveRequest', { sort: '-created_date', limit: 200 }),
      listEntities('User', { limit: 5000 }),
      listEntities('PettyCashCategory', { limit: 200 }),
    ]);

  const todayTimesheets = timesheets.filter((ts) => onDate(ts.clock_in_time, today));
  const totalMinutes = todayTimesheets.reduce((sum, ts) => sum + (ts.total_duration_minutes || 0), 0);
  const todayWorkOrders = workOrders.filter((wo) => onDate(wo.planned_start_time, today));

  const projectIds = [...new Set(todayWorkOrders.map((w) => w.project_id).filter(Boolean))];
  let projects = [];
  if (projectIds.length) {
    const allProjects = await listEntities('Project', { limit: 500 });
    projects = allProjects.filter((p) => projectIds.includes(p.id));
  }

  const filteredCalendar = calendarEvents
    .filter((e) => onDate(e.start_time, today))
    .filter((e) => hasAccessToEvent(e, currentUser, admin));

  const userMap = Object.fromEntries(
    allUsers.map((u) => [u.id, u.full_name || u.name || u.email])
  );
  const categoryMap = Object.fromEntries(allCategories.map((c) => [c.id, c.name]));

  const pcRaw = pettyCashEntries.filter((e) =>
    admin ? true : e.employee_id === currentUser.id
  );
  const pc = pcRaw.map((entry) => ({
    ...entry,
    employee_name: userMap[entry.employee_id] || 'Unknown',
    category_name: categoryMap[entry.category_id] || 'General',
  }));

  const totalExpenses = pc.filter((e) => e.type === 'expense').reduce((sum, e) => sum + Math.abs(e.amount || 0), 0);
  const totalInputs = pc.filter((e) => e.type === 'input').reduce((sum, e) => sum + (e.amount || 0), 0);

  const leaveAliases = admin ? null : await resolveEmployeeIdAliases(currentUser);
  const leavesRaw = leaveRequests.filter((l) =>
    admin ? true : employeeIdMatches(l.employee_id, leaveAliases)
  );
  const sortedLeaves = [...leavesRaw]
    .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
    .map((l) =>
      formatLeaveRequestForMobile(l, userMap[l.employee_id] || 'Unknown', currentUser.id)
    );

  return {
    success: true,
    data: {
      date: today,
      stats: {
        timesheets: {
          count: todayTimesheets.length,
          total_minutes: totalMinutes,
          total_hours: (totalMinutes / 60).toFixed(2),
          active: todayTimesheets.filter((t) => t.is_active).length,
        },
        work_orders: {
          count: todayWorkOrders.length,
          by_status: {
            open: todayWorkOrders.filter((w) => w.status === 'open').length,
            closed: todayWorkOrders.filter((w) => w.status === 'closed').length,
          },
          items: todayWorkOrders.map((wo) => ({
            id: wo.id,
            work_order_number: wo.work_order_number,
            title: wo.title,
            status: wo.status,
            project_id: wo.project_id,
            planned_start_time: wo.planned_start_time,
          })),
        },
      },
      calendar: filteredCalendar,
      projects,
      petty_cash: {
        summary: {
          total_expenses: totalExpenses,
          total_inputs: totalInputs,
          balance: totalInputs - totalExpenses,
        },
        transactions: pc.slice(0, 10),
      },
      leaves: {
        count: sortedLeaves.length,
        pending: sortedLeaves.filter((l) => String(l.status).toLowerCase() === 'pending').length,
        approved: sortedLeaves.filter((l) => String(l.status).toLowerCase() === 'approved').length,
        items: sortedLeaves.slice(0, 10),
      },
    },
    authenticated_as: { user_id: currentUser.id, role: currentUser.role },
  };
}

async function handleGetStats(currentUser, admin, userId, date) {
  if (!date) return fail('date parameter is required (YYYY-MM-DD)', 400);

  const currentMonth = date.substring(0, 7);
  const [year, month] = currentMonth.split('-').map(Number);

  const [rawTimesheets, rawWorkOrders, allUsers, settings, overtimeRules] = await Promise.all([
    listEntities('TimesheetEntry', { limit: 5000 }),
    listEntities('TimeEntry', { query: { archived: false }, sort: '-planned_start_time', limit: 1000 }),
    admin ? listEntities('User', { limit: 500 }) : Promise.resolve([]),
    listEntities('AppSettings', { sort: 'setting_key', limit: 1000 }),
    listEntities('OvertimeRulePeriod', { sort: '-start_date', limit: 100 }),
  ]);

  const globalHoursSettings = { regular_hours_per_day: 8, non_payable_overtime_hours: 0 };
  settings.forEach((s) => {
    if (s.setting_key?.startsWith('timesheet_hours_')) {
      const key = s.setting_key.replace('timesheet_hours_', '');
      const val = parseFloat(s.setting_value);
      if (!Number.isNaN(val)) globalHoursSettings[key] = val;
    }
  });

  const getActiveRule = (dateStr) =>
    overtimeRules.find((r) => r.start_date <= dateStr && r.end_date >= dateStr) || null;

  const dayTimesheets = rawTimesheets.filter(
    (ts) => ts.employee_id === userId && onDate(ts.clock_in_time, date)
  );

  const totalDayMinutes = dayTimesheets.reduce((sum, ts) => sum + (ts.total_duration_minutes || 0), 0);
  const activeRule = getActiveRule(date);
  const regularHoursPerDay =
    activeRule?.regular_hours_per_day ?? globalHoursSettings.regular_hours_per_day ?? 8;
  const nonPayableOvertimeHours =
    activeRule?.non_payable_overtime_hours ?? globalHoursSettings.non_payable_overtime_hours ?? 0;

  const totalHours = totalDayMinutes / 60;
  const extraHours = Math.max(0, totalHours - regularHoursPerDay);
  const unpaidOTHours = Math.min(extraHours, nonPayableOvertimeHours);
  const paidOTHours = Math.max(0, extraHours - unpaidOTHours);
  const totalRegularHours = Math.min(totalHours, regularHoursPerDay);

  const assignedTasks = [];
  rawWorkOrders.forEach((wo) => {
    if (!onDate(wo.planned_start_time, date) || !Array.isArray(wo.tasks)) return;
    wo.tasks.forEach((task) => {
      const assigned =
        (Array.isArray(task.employee_ids) && task.employee_ids.includes(userId)) ||
        task.leader_id === userId;
      if (assigned) {
        assignedTasks.push({
          task_id: task.id,
          task_name: task.name,
          status: task.status || 'pending',
          parent_wo_title: wo.title,
        });
      }
    });
  });

  const completedTasks = assignedTasks.filter((t) => t.status === 'completed').length;

  const dailyBreakdown = {};
  const daysInMonth = new Date(year, month, 0).getDate();
  for (let i = 1; i <= daysInMonth; i++) {
    const dayString = `${currentMonth}-${String(i).padStart(2, '0')}`;
    dailyBreakdown[dayString] = { completed: 0, pending: 0, overtime: 0 };
  }

  rawTimesheets
    .filter((ts) => ts.employee_id === userId)
    .forEach((ts) => {
      if (!ts.clock_in_time?.includes(currentMonth)) return;
      const day = ts.clock_in_time.split('T')[0];
      if (!dailyBreakdown[day]) return;
      const rule = getActiveRule(day);
      const regH = rule?.regular_hours_per_day ?? globalHoursSettings.regular_hours_per_day ?? 8;
      const nonPayH = rule?.non_payable_overtime_hours ?? globalHoursSettings.non_payable_overtime_hours ?? 0;
      const mins = ts.total_duration_minutes || 0;
      const totalH = mins / 60;
      const extraH = Math.max(0, totalH - regH);
      const unpaidH = Math.min(extraH, nonPayH);
      const paidH = Math.max(0, extraH - unpaidH);
      dailyBreakdown[day].overtime += paidH;
    });

  rawWorkOrders.forEach((wo) => {
    if (!wo.planned_start_time?.includes(currentMonth) || !Array.isArray(wo.tasks)) return;
    const day = wo.planned_start_time.split('T')[0];
    if (!dailyBreakdown[day]) return;
    wo.tasks.forEach((task) => {
      const assigned =
        (Array.isArray(task.employee_ids) && task.employee_ids.includes(userId)) ||
        task.leader_id === userId;
      if (!assigned) return;
      if (task.status === 'completed') dailyBreakdown[day].completed++;
      else dailyBreakdown[day].pending++;
    });
  });

  const projectIds = [
    ...new Set(
      rawWorkOrders.filter((wo) => onDate(wo.planned_start_time, date)).map((wo) => wo.project_id).filter(Boolean)
    ),
  ];
  let projects = [];
  if (projectIds.length) {
    const allProjects = await listEntities('Project', { limit: 500 });
    projects = allProjects.filter((p) => projectIds.includes(p.id)).slice(0, 20);
  }

  return {
    success: true,
    data: {
      date,
      user_id: userId,
      is_admin: admin,
      timesheets: {
        count: dayTimesheets.length,
        total_hours: totalHours.toFixed(2),
        total_minutes: totalDayMinutes,
        active: dayTimesheets.filter((ts) => ts.is_active === true).length,
        overtime: {
          paid: paidOTHours.toFixed(2),
          non_paid: unpaidOTHours.toFixed(2),
          total: extraHours.toFixed(2),
        },
        regular_hours: totalRegularHours.toFixed(2),
      },
      tasks: {
        total_count: assignedTasks.length,
        completed_count: completedTasks,
        pending_count: assignedTasks.length - completedTasks,
        items: assignedTasks,
      },
      projects: projects.map((p) => ({ id: p.id, name: p.name })),
      monthly_stats: {
        month: currentMonth,
        daily_detail: dailyBreakdown,
        total_monthly_overtime: Object.values(dailyBreakdown)
          .reduce((sum, day) => sum + day.overtime, 0)
          .toFixed(2),
        total_monthly_completed_tasks: Object.values(dailyBreakdown).reduce(
          (sum, day) => sum + day.completed,
          0
        ),
        total_monthly_pending_tasks: Object.values(dailyBreakdown).reduce(
          (sum, day) => sum + day.pending,
          0
        ),
      },
      admin_stats: null,
    },
  };
}

export async function handleApiHelper(req) {
  const version = await checkAppVersion(req);
  if (version.block) {
    const err = new Error(version.body.message);
    err.status = 426;
    err.data = version.body;
    throw err;
  }

  const method = req.method?.toUpperCase();
  if (method !== 'GET') return fail('GET only', 405);

  const action = req.query?.action;
  if (!action) return fail('action query parameter is required', 400);

  const currentUser = await resolveHelperUser(req);
  if (!currentUser) {
    return fail('Unauthorized - User not found. Check X-User-ID header (google:SUB → google-SUB in DB).', 401);
  }

  const admin = userIsAdmin(currentUser);
  const userId = currentUser.id;

  if (action === 'getCurrentCompany') {
    if (!currentUser.company_id) return fail('User is not assigned to any company', 400);
    try {
      const company = await getEntity('Branch', currentUser.company_id);
      return { success: true, data: company };
    } catch {
      return fail('Company not found', 404);
    }
  }

  if (action === 'appInit') {
    try {
      return await handleAppInit(currentUser, admin, req.query?.date);
    } catch (e) {
      return fail(e.message || 'Data processing error', 500);
    }
  }

  if (action === 'getStats' || action === 'getState') {
    try {
      return await handleGetStats(currentUser, admin, userId, req.query?.date);
    } catch (e) {
      return fail(e.message || 'Stats processing error', 500);
    }
  }

  if (action === 'getSidebarItems') {
    let currentCompany = {};
    if (currentUser.company_id) {
      try {
        currentCompany = await getEntity('Branch', currentUser.company_id);
      } catch {
        /* optional */
      }
    }

    let navConfig;
    try {
      const configs = await listEntities('NavigationConfig', { query: { is_active: true }, limit: 5 });
      navConfig = configs[0];
    } catch {
      /* default nav */
    }

    const navigation = navConfig?.sections || defaultNavigation(currentCompany);
    const filteredNavigation = navigation
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => !(item.adminOnly === true && !admin)),
      }))
      .filter((section) => section.items.length > 0);

    return {
      success: true,
      data: {
        user: {
          id: currentUser.id,
          full_name: currentUser.full_name,
          email: currentUser.email,
          role: currentUser.role,
          avatar_url: currentUser.avatar_url,
        },
        navigation: filteredNavigation,
      },
    };
  }

  return fail(`Invalid action: ${action}`, 400);
}
