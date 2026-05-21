import { format, parseISO } from 'date-fns';
import { TimeEntry } from '@/entities/all';
import { base44 } from '@/api/base44Client';

/**
 * Sanitize WO for copy: preserve WO number and structure
 * ✅ CRITICAL: Keeps work_order_number so the same WO can have tasks on different dates
 */
export const sanitizeWorkOrderForCopy = (wo) => ({
  project_id: wo.project_id || null,
  work_order_number: wo.work_order_number, // ✅ PRESERVE WO NUMBER
  team_ids: Array.isArray(wo.team_ids) ? wo.team_ids : (wo.team_id ? [wo.team_id] : []),
  employee_ids: Array.isArray(wo.employee_ids) ? wo.employee_ids : (wo.employee_id ? [wo.employee_id] : []),
  work_order_category_id: wo.work_order_category_id || null,
  shift_type_id: wo.shift_type_id || null,
  title: wo.title || '',
  work_notes: '', // ✅ Do NOT copy work notes/comments — start fresh
  equipment_ids: Array.isArray(wo.equipment_ids) ? wo.equipment_ids : (wo.equipment_id ? [wo.equipment_id] : []),
  // ✅ CRITICAL: Copy tasks with all their assignments intact
  tasks: Array.isArray(wo.tasks) ? wo.tasks.map((task, idx) => ({
    ...task,
    id: `task_${Date.now()}_${Math.random()}`, // Generate unique task ID
    ref: null, // Clear ref — will be regenerated based on new WO number on save
    team_ids: Array.isArray(task.team_ids) ? task.team_ids : [],
    employee_ids: Array.isArray(task.employee_ids) ? task.employee_ids : [],
    status: 'pending', // Reset task status for copied tasks
    // ✅ Clear all report data entered from mobile app - start completely fresh
    work_done_items: [],
    spare_parts_items: [],
    work_pending_items: [],
    spare_parts_pending_items: [],
    other_file_urls: [],
    // ✅ Clear time tracker data (these come from mobile clock-in, not from scheduling)
    start_time_actual: null,
    end_time_actual: null,
    is_signed: false,
    // ✅ Clear any other report-related fields
    work_notes: '',
    job_completion_status: null,
    client_feedback_comments: '',
    client_representative_name: '',
    client_representative_phone: '',
  })) : [],
  // Keep planned times only to compute duration; they will be adjusted on paste
  planned_start_time: wo.planned_start_time || null,
  planned_end_time: wo.planned_end_time || null,
  status: 'open',
  // ✅ Clear ALL WO-level report/signature fields
  client_signature_url: null,
  job_completion_status: null,
  client_feedback_comments: '',
  client_representative_name: '',
  client_representative_phone: '',
  file_urls: [],
});

/**
 * Build new WO payload for paste operation
 * ✅ PRESERVES work_order_number so tasks belong to the same WO
 */
export const buildPastePayload = (wo, updatedTasks, newStartDate, newEndDate, currentUser, currentCompany, userName) => {
  const activity_log = [{
    timestamp: new Date().toISOString(),
    action: 'Pasted',
    user_email: currentUser?.email || 'unknown',
    user_name: userName,
    details: `Working report created by pasting with smart time allocation.`
  }];

  return {
    project_id: wo.project_id || null,
    work_order_number: wo.work_order_number, // ✅ PRESERVE WO NUMBER
    team_ids: Array.isArray(wo.team_ids) ? wo.team_ids : [],
    employee_ids: Array.isArray(wo.employee_ids) ? wo.employee_ids : [],
    tasks: updatedTasks,
    work_order_category_id: wo.work_order_category_id || null,
    shift_type_id: wo.shift_type_id || null,
    title: wo.title || '',
    work_notes: '',
    equipment_ids: Array.isArray(wo.equipment_ids) ? wo.equipment_ids : [],
    planned_start_time: newStartDate.toISOString(),
    planned_end_time: newEndDate.toISOString(),
    status: 'open',
    branch_id: currentCompany?.id,
    updated_by: currentUser?.email || 'unknown',
    activity_log
  };
};

/**
 * Execute paste: create WOs on targetDate with shifted task dates and smart time allocation.
 */
export const pasteWorkOrders = async ({ copiedWorkOrders, targetDate, entries, currentUser, currentCompany, setEntries }) => {
  const { workOrders } = copiedWorkOrders;
  const userName = currentUser?.nickname || currentUser?.first_name || currentUser?.full_name || currentUser?.email || 'Unknown';
  const createdWorkOrders = [];

  for (let i = 0; i < workOrders.length; i++) {
    const wo = workOrders[i];
    const originalStart = wo.planned_start_time ? parseISO(wo.planned_start_time) : null;
    const originalEnd = wo.planned_end_time ? parseISO(wo.planned_end_time) : null;
    const durationMs = (originalStart && originalEnd)
      ? Math.max(30 * 60 * 1000, originalEnd.getTime() - originalStart.getTime())
      : 4 * 60 * 60 * 1000;

    const originalDate = originalStart ? new Date(originalStart) : new Date();
    originalDate.setHours(0, 0, 0, 0);
    const targetDateObj = new Date(targetDate);
    targetDateObj.setHours(0, 0, 0, 0);
    const daysDiff = Math.round((targetDateObj - originalDate) / (24 * 60 * 60 * 1000));

    let newStartDate, newEndDate;
    if (i === 0) {
      newStartDate = new Date(targetDate);
      originalStart ? newStartDate.setHours(originalStart.getHours(), originalStart.getMinutes(), 0, 0) : newStartDate.setHours(7, 0, 0, 0);
      newEndDate = new Date(newStartDate.getTime() + durationMs);
    } else {
      const prev = createdWorkOrders[i - 1];
      if (prev?.planned_end_time) {
        newStartDate = new Date(prev.planned_end_time);
        newEndDate = new Date(newStartDate.getTime() + durationMs);
      } else {
        newStartDate = new Date(targetDate); newStartDate.setHours(17 + i, 0, 0, 0);
        newEndDate = new Date(newStartDate.getTime() + durationMs);
      }
    }

    const updatedTasks = Array.isArray(wo.tasks) && wo.tasks.length > 0
      ? wo.tasks.map(task => {
          if (!task.date) return { ...task, id: `task_${Date.now()}_${Math.random()}`, status: 'pending', work_done_items:[], spare_parts_items:[], work_pending_items:[], spare_parts_pending_items:[], other_file_urls:[] };
          const newTaskDate = new Date(task.date + 'T00:00:00');
          newTaskDate.setDate(newTaskDate.getDate() + daysDiff);
          return { id: `task_${Date.now()}_${Math.random()}`, name: task.name, instructions: task.instructions||'', date: format(newTaskDate, 'yyyy-MM-dd'), start_time: task.start_time, end_time: task.end_time, leader_id: task.leader_id||null, team_ids: Array.isArray(task.team_ids)?task.team_ids:[], employee_ids: Array.isArray(task.employee_ids)?task.employee_ids:[], shift_type_id: task.shift_type_id||null, status:'pending', work_done_items:[], spare_parts_items:[], work_pending_items:[], spare_parts_pending_items:[], other_file_urls:[] };
        })
      : [{ id: `task_${Date.now()}`, name: wo.title || 'Task', instructions: '', date: format(newStartDate, 'yyyy-MM-dd'), start_time: format(newStartDate, 'HH:mm'), end_time: format(newEndDate, 'HH:mm'), team_ids: Array.isArray(wo.team_ids)?wo.team_ids:[], employee_ids: Array.isArray(wo.employee_ids)?wo.employee_ids:[], status: 'pending' }];

    const newWO = buildPastePayload(wo, updatedTasks, newStartDate, newEndDate, currentUser, currentCompany, userName);
    const created = await TimeEntry.create(newWO);
    createdWorkOrders.push(created);
    if (setEntries) setEntries(prev => [...prev, created]);
    try { await base44.functions.invoke('syncWorkOrderTeams', { work_order_id: created.id }); } catch {}
  }

  return createdWorkOrders;
};