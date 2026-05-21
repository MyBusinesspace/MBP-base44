import { parseISO, format } from 'date-fns';
import { toast } from 'sonner';

/**
 * Creates a handleDrop function with all necessary context
 */
export function createHandleDropFn({
  viewBy,
  currentUser,
  entries,
  users,
  teams,
  approvedLeaves,
  loadData,
  TimeEntry,
  setEntries,
  setDraggedWorkOrder,
  isUpdatingRef
}) {
  const isUserAvailableForDate = (userId, dateISO) => {
    const user = users.find(u => u.id === userId);
    if (!user) return false;
    
    if (user.archived && user.archived_date) {
      const archivedDate = new Date(user.archived_date);
      archivedDate.setHours(0, 0, 0, 0);
      const woDate = new Date(dateISO);
      woDate.setHours(0, 0, 0, 0);
      if (woDate >= archivedDate) return false;
    } else if (user.archived) {
      return false;
    }
    
    const woDateStr = format(new Date(dateISO), 'yyyy-MM-dd');
    const onLeave = approvedLeaves.some(leave => {
      if (leave.employee_id !== userId) return false;
      return woDateStr >= leave.start_date && woDateStr <= leave.end_date;
    });
    
    return !onLeave;
  };

  return async (workOrder, targetEntityId, targetDate) => {
    console.log('🎯 [DROP] Starting drop operation:', {
      woId: workOrder?.id?.slice(0, 8),
      woTitle: workOrder?.title,
      currentPlannedTime: workOrder?.planned_start_time,
      targetDate: targetDate instanceof Date ? targetDate.toISOString() : targetDate,
      targetEntityId: targetEntityId
    });
    
    if (!workOrder || !targetDate) {
      console.error('❌ [DROP] Invalid drop - missing workOrder or targetDate');
      toast.error('Invalid drop operation');
      return;
    }

    if (isUpdatingRef.current) {
      console.log('⏭️ [DROP] Update in progress, queueing...');
      return;
    }

    let targetDateObj;
    if (targetDate instanceof Date) {
      targetDateObj = targetDate;
    } else if (typeof targetDate === 'string') {
      try {
        targetDateObj = parseISO(targetDate);
      } catch (error) {
        console.error('❌ [DROP] Failed to parse date string:', targetDate);
        toast.error('Invalid date format');
        return;
      }
    } else {
      console.error('❌ [DROP] Invalid date type:', typeof targetDate);
      toast.error('Invalid date type');
      return;
    }

    if (!targetDateObj || isNaN(targetDateObj.getTime())) {
      console.error('❌ [DROP] Invalid target date object:', targetDateObj);
      toast.error('Invalid target date');
      return;
    }

    try {
      const original = (entries || []).find(e => e.id === workOrder?.id) || workOrder;
      const hasClockIn = !!(original?.start_time || original?.is_active);
      if (hasClockIn) {
        if (currentUser?.role !== 'admin') {
          toast.error('This work order has a clocked-in report and cannot be rescheduled.');
          return;
        }
        toast.warning('Clocked-in report detected. Admins can force move.');
        const confirmForce = window.confirm('This work order has a clocked-in report. Force reschedule as admin?');
        if (!confirmForce) {
          toast.info('Reschedule cancelled');
          return;
        }
      }
    } catch (_) {}

    try {
      isUpdatingRef.current = true;
      
      let newStartTime = new Date(targetDateObj);
      const origStart = workOrder.planned_start_time ? parseISO(workOrder.planned_start_time) : new Date();
      const origEnd = workOrder.planned_end_time ? parseISO(workOrder.planned_end_time) : null;
      
      let newEndTime;
      if (origEnd) {
        const durationMs = origEnd.getTime() - origStart.getTime();
        newEndTime = new Date(newStartTime.getTime() + durationMs);
      } else {
        newEndTime = new Date(newStartTime);
        newEndTime.setHours(newEndTime.getHours() + 1);
      }

      const origDate = new Date(origStart);
      origDate.setHours(0, 0, 0, 0);
      const newDate = new Date(targetDateObj);
      newDate.setHours(0, 0, 0, 0);
      const daysDiff = Math.round((newDate - origDate) / (24 * 60 * 60 * 1000));

      // ✅ CRITICAL: Update task dates AND preserve status
      const updatedTasks = (workOrder.tasks || []).map(task => {
        if (!task.date) return task;
        const taskDate = new Date(task.date + 'T00:00:00');
        const newTaskDate = new Date(taskDate);
        newTaskDate.setDate(newTaskDate.getDate() + daysDiff);
        return {
          ...task,
          date: format(newTaskDate, 'yyyy-MM-dd'),
          status: task.status // ✅ PRESERVE status
        };
      });

      console.log('📝 [DROP] Preparing updates:', {
        newStartTime: newStartTime.toISOString(),
        newEndTime: newEndTime.toISOString(),
        daysDiff: daysDiff,
        updatedTasksCount: updatedTasks.length
      });

      const updates = {
        planned_start_time: newStartTime.toISOString(),
        planned_end_time: newEndTime.toISOString(),
        tasks: updatedTasks,
        updated_by: currentUser?.email || 'unknown'
      };

      if ((!updates.tasks || updates.tasks.length === 0) && (workOrder.team_ids?.length > 0 || workOrder.employee_ids?.length > 0)) {
        console.log('🔄 [DROP] Legacy WO without tasks - creating default task from WO data');
        const taskDate = format(newStartTime, 'yyyy-MM-dd');
        const taskStartTime = format(newStartTime, 'HH:mm');
        const taskEndTime = newEndTime ? format(newEndTime, 'HH:mm') : '17:00';
        
        updates.tasks = [{
          id: `task_${Date.now()}`,
          name: workOrder.title || 'Task',
          instructions: workOrder.work_notes || '',
          date: taskDate,
          start_time: taskStartTime,
          end_time: taskEndTime,
          team_ids: workOrder.team_ids || [],
          employee_ids: workOrder.employee_ids || [],
          status: 'pending'
        }];
      }

      if (viewBy === 'project' && targetEntityId && targetEntityId !== workOrder.project_id) {
        updates.project_id = targetEntityId;
      } else if (viewBy === 'team' && targetEntityId) {
        if (updates.tasks && updates.tasks.length > 0) {
          const teamUsers = users
            .filter(u => u.team_id === targetEntityId && isUserAvailableForDate(u.id, newStartTime.toISOString()))
            .map(u => u.id);
          
          if (teamUsers.length === 0) {
            const targetTeam = teams.find(t => t.id === targetEntityId);
            toast.error(`Cannot move: ${targetTeam?.name || 'Target team'} has no available workers for this date`);
            isUpdatingRef.current = false;
            return;
          }
          
          updates.tasks = updates.tasks.map(task => ({
            ...task,
            team_ids: [targetEntityId],
            employee_ids: teamUsers,
            status: task.status // ✅ PRESERVE status
          }));
        }
      } else if (viewBy === 'user' && targetEntityId) {
        const targetUser = users.find(u => u.id === targetEntityId);
        if (updates.tasks && updates.tasks.length > 0) {
          updates.tasks = updates.tasks.map(task => ({
            ...task,
            team_ids: targetUser?.team_id ? [targetUser.team_id] : task.team_ids || [],
            employee_ids: [targetEntityId],
            status: task.status // ✅ PRESERVE status
          }));
        }
      }

      const originalEntry = entries.find(e => e.id === workOrder.id);
      const activity_log = originalEntry?.activity_log || [];
      const userName = currentUser?.nickname || currentUser?.first_name || currentUser?.full_name || currentUser?.email || 'Unknown';

      activity_log.push({
        timestamp: new Date().toISOString(),
        action: 'Dropped',
        user_email: currentUser?.email || 'unknown',
        user_name: userName,
        details: `Work order moved to ${format(newStartTime, 'dd/MM/yyyy HH:mm')}`
      });
      updates.activity_log = activity_log;

      setEntries(prevEntries => prevEntries.map(e => e.id === workOrder.id ? { ...e, ...updates } : e));
      setDraggedWorkOrder(null);

      console.log('💾 [DROP] Calling TimeEntry.update with ID:', workOrder.id);
      await TimeEntry.update(workOrder.id, updates);
      console.log('✅ [DROP] TimeEntry.update completed');

      try {
        const verifyResult = await TimeEntry.filter({ id: workOrder.id });
        const verified = verifyResult?.[0];
        
        if (verified?.planned_start_time !== updates.planned_start_time) {
          console.error('❌ [DROP VERIFY] MISMATCH!');
          toast.error('Failed to save changes - data mismatch detected');
        } else {
          console.log('✅ [DROP VERIFY] DB matches expected values');
          toast.success('Work order moved to ' + format(newStartTime, 'dd/MM/yyyy HH:mm'));
        }
      } catch (verifyError) {
        console.error('❌ [DROP VERIFY] Failed to verify:', verifyError);
      }

      setTimeout(() => {
        console.log('🔄 [DROP] Executing reload now...');
        loadData(false, true);
      }, 500);

    } finally {
      setTimeout(() => {
        isUpdatingRef.current = false;
      }, 1000);
    }
  };
}