import { TimeEntry } from '@/entities/all';
import { base44 } from '@/api/base44Client';
import { format, parseISO, addDays, addWeeks, addMonths, addYears } from 'date-fns';

export async function saveMultipleWorkOrders({ workOrdersData, currentUser, currentCompany, loadData, setShowMultiplePanel, toast }) {
  let totalCreated = 0;
  const createdWorkOrders = [];
  const userName = currentUser?.nickname || currentUser?.first_name || currentUser?.full_name || currentUser?.email || 'Unknown';

  for (const wo of workOrdersData) {
    const defaultStatus = wo.status || 'open';

    if (wo.is_repeating && wo.recurrence_type && wo.recurrence_end_date) {
      const startDate = parseISO(wo.planned_start_time);
      const endDate = wo.planned_end_time ? parseISO(wo.planned_end_time) : null;
      const recurrenceEndDate = parseISO(wo.recurrence_end_date);
      let currentDate = new Date(startDate);
      const occurrences = [];
      let iterationCount = 0;
      const maxIterations = 365;

      while (currentDate <= recurrenceEndDate && iterationCount < maxIterations) {
        const dayOfWeek = currentDate.getDay();
        let effectiveDateForOccurrence = new Date(currentDate);
        let movedFromSunday = false;

        if (wo.skip_weekends) {
          if (dayOfWeek === 0) {
            effectiveDateForOccurrence.setDate(effectiveDateForOccurrence.getDate() - 1);
            movedFromSunday = true;
          } else if (dayOfWeek === 6) {
            if (wo.recurrence_type === 'daily') currentDate = addDays(currentDate, wo.recurrence_interval || 1);
            else if (wo.recurrence_type === 'weekly') currentDate = addWeeks(currentDate, wo.recurrence_interval || 1);
            else if (wo.recurrence_type === 'monthly') currentDate = addMonths(currentDate, wo.recurrence_interval || 1);
            else if (wo.recurrence_type === 'yearly') currentDate = addYears(currentDate, wo.recurrence_interval || 1);
            else currentDate = addDays(currentDate, 1);
            iterationCount++; continue;
          }
        }

        const newStartTime = new Date(effectiveDateForOccurrence);
        newStartTime.setHours(startDate.getHours(), startDate.getMinutes(), 0, 0);
        const newEndTime = endDate ? new Date(effectiveDateForOccurrence) : null;
        if (newEndTime && endDate) {
          newEndTime.setHours(endDate.getHours(), endDate.getMinutes(), 0, 0);
          if (newEndTime <= newStartTime) newEndTime.setDate(newEndTime.getDate() + 1);
        }
        occurrences.push({ planned_start_time: newStartTime.toISOString(), planned_end_time: newEndTime ? newEndTime.toISOString() : null, moved_from_sunday: movedFromSunday });

        if (wo.recurrence_type === 'daily') currentDate = addDays(currentDate, wo.recurrence_interval || 1);
        else if (wo.recurrence_type === 'weekly') currentDate = addWeeks(currentDate, wo.recurrence_interval || 1);
        else if (wo.recurrence_type === 'monthly') currentDate = addMonths(currentDate, wo.recurrence_interval || 1);
        else if (wo.recurrence_type === 'yearly') currentDate = addYears(currentDate, wo.recurrence_interval || 1);
        else currentDate = addDays(currentDate, 1);
        iterationCount++;
      }

      for (const occurrence of occurrences) {
        const { is_repeating, recurrence_type, recurrence_end_date, recurrence_interval, skip_weekends, ...woData } = wo;
        let activityDetails = `Working report created (repeating).`;
        if (occurrence.moved_from_sunday) activityDetails += ` Moved from Sunday to Saturday.`;
        const activity_log = [{ timestamp: new Date().toISOString(), action: 'Created', user_email: currentUser?.email || 'unknown', user_name: userName, details: activityDetails }];
        const newWO = { ...woData, planned_start_time: occurrence.planned_start_time, planned_end_time: occurrence.planned_end_time, moved_from_sunday: occurrence.moved_from_sunday || false, status: defaultStatus, project_id: wo.project_id, branch_id: currentCompany?.id, employee_ids: wo.employee_ids || [], team_ids: wo.team_ids || [], customer_id: wo.customer_id, work_order_category_id: wo.work_order_category_id, shift_type_id: wo.shift_type_id, equipment_ids: wo.equipment_ids || [], file_urls: wo.file_urls || [], updated_by: currentUser?.email || 'unknown', activity_log };
        const createdWorkOrder = await TimeEntry.create(newWO);
        try { await base44.functions.invoke('syncWorkOrderTeams', { work_order_id: createdWorkOrder.id }); } catch (_) {}
        createdWorkOrders.push({ date: format(parseISO(occurrence.planned_start_time), 'MMM d, yyyy'), status: defaultStatus, project_id: newWO.project_id, employee_ids: newWO.employee_ids, team_ids: newWO.team_ids, moved_from_sunday: newWO.moved_from_sunday });
        totalCreated++;
      }
    } else {
      const { is_repeating, recurrence_type, recurrence_end_date, recurrence_interval, skip_weekends, ...woData } = wo;
      const activity_log = [{ timestamp: new Date().toISOString(), action: 'Created', user_email: currentUser?.email || 'unknown', user_name: userName, details: `Work report created.` }];
      const defaultTask = { id: `task_${Date.now()}`, name: woData.title || 'Task', instructions: woData.work_notes || '', date: format(parseISO(woData.planned_start_time), 'yyyy-MM-dd'), start_time: format(parseISO(woData.planned_start_time), 'HH:mm'), end_time: woData.planned_end_time ? format(parseISO(woData.planned_end_time), 'HH:mm') : '17:00', team_ids: woData.team_ids || [], employee_ids: woData.employee_ids || [], status: 'pending' };
      const newWO = { ...woData, tasks: (woData.tasks && woData.tasks.length > 0) ? woData.tasks : [defaultTask], status: defaultStatus, file_urls: wo.file_urls || [], branch_id: currentCompany?.id, updated_by: currentUser?.email || 'unknown', activity_log };
      const createdWorkOrder = await TimeEntry.create(newWO);
      try { await base44.functions.invoke('syncWorkOrderTeams', { work_order_id: createdWorkOrder.id }); } catch (_) {}
      createdWorkOrders.push({ date: format(parseISO(wo.planned_start_time), 'MMM d, yyyy'), status: defaultStatus });
      totalCreated++;
    }
  }

  loadData(false, true, true);
  setShowMultiplePanel(false);
  if (totalCreated > 1) {
    const firstDate = createdWorkOrders[0]?.date;
    const lastDate = createdWorkOrders[createdWorkOrders.length - 1]?.date;
    toast.success(`${totalCreated} work orders created! From ${firstDate} to ${lastDate}. Navigate weeks to see all.`, { duration: 6000 });
  } else {
    toast.success(`Work order created successfully`);
  }
}