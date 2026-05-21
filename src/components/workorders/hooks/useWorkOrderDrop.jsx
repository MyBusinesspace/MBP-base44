import { useCallback, useRef } from 'react';
import { parseISO, format } from 'date-fns';
import { toast } from 'sonner';
import { TimeEntry } from '@/entities/all';

export function useWorkOrderDrop(currentUser, loadData) {
  const isUpdatingRef = useRef(false);

  const handleDrop = useCallback(async (wo, eid, dt, setEntries, setDraggedWorkOrder) => {
    if (!wo?.id || !dt || isUpdatingRef.current) return;
    isUpdatingRef.current = true;
    
    console.log('🔴 [DROP START] Work order being moved:', {
      id: wo.id?.slice(0, 8),
      title: wo.title,
      oldPlanned: wo.planned_start_time,
      targetDateTime: dt
    });
    
    try {
      const newStart = dt instanceof Date ? dt : parseISO(dt);
      const oldStart = parseISO(wo.planned_start_time);
      const oldEnd = wo.planned_end_time ? parseISO(wo.planned_end_time) : null;
      
      console.log('🟡 [DROP DATES] Old vs New:', {
        oldStart: format(oldStart, 'yyyy-MM-dd HH:mm'),
        newStart: format(newStart, 'yyyy-MM-dd HH:mm'),
        oldEnd: oldEnd ? format(oldEnd, 'yyyy-MM-dd HH:mm') : 'none'
      });
      
      // ✅ Calculate new end time preserving duration
      const newEnd = oldEnd 
        ? new Date(newStart.getTime() + (oldEnd.getTime() - oldStart.getTime())) 
        : new Date(newStart.getTime() + 3600000);
      
      // ✅ Calculate day offset
      const oldDate = new Date(oldStart);
      oldDate.setHours(0, 0, 0, 0);
      const newDate = new Date(newStart);
      newDate.setHours(0, 0, 0, 0);
      const dayOffset = Math.round((newDate - oldDate) / (24 * 60 * 60 * 1000));
      
      console.log('🟡 [DROP OFFSET] Day difference:', {
        dayOffset,
        oldDateOnly: format(oldDate, 'yyyy-MM-dd'),
        newDateOnly: format(newDate, 'yyyy-MM-dd')
      });
      
      // ✅ CRITICAL: Update task dates with the day offset
      console.log('🟡 [DROP TASKS] Before update:', wo.tasks?.map(t => ({
        name: t.name,
        date: t.date
      })));
      
      const updatedTasks = (wo.tasks || []).map(task => {
        if (!task.date) return task;
        const taskDate = new Date(task.date + 'T00:00:00');
        taskDate.setDate(taskDate.getDate() + dayOffset);
        const newTaskDate = format(taskDate, 'yyyy-MM-dd');
        console.log(`  - Task "${task.name}": ${task.date} → ${newTaskDate}`);
        return {
          ...task,
          date: newTaskDate,
          status: task.status
        };
      });
      
      console.log('🟡 [DROP TASKS] After update:', updatedTasks.map(t => ({
        name: t.name,
        date: t.date
      })));
      
      const update = {
        planned_start_time: newStart.toISOString(),
        planned_end_time: newEnd.toISOString(),
        tasks: updatedTasks,
        updated_by: currentUser?.email
      };
      
      console.log('🟡 [DROP UPDATE] Sending to DB:', {
        id: wo.id?.slice(0, 8),
        planned_start_time: update.planned_start_time,
        planned_end_time: update.planned_end_time,
        tasksCount: update.tasks.length
      });
      
      // ✅ Optimistic update
      setEntries(prev => {
        const updated = prev.map(x => x.id === wo.id ? { ...x, ...update } : x);
        console.log('🟢 [DROP OPTIMISTIC] State updated, entries count:', updated.length);
        return updated;
      });
      setDraggedWorkOrder(null);
      
      // ✅ Save to DB
      await TimeEntry.update(wo.id, update);
      console.log('🟢 [DROP DB] Saved successfully');
      toast.success('Moved');
      
      // ✅ Reload after DB sync
      setTimeout(() => {
        console.log('🟢 [DROP RELOAD] Triggering loadData...');
        loadData(false, true);
      }, 800);
    } catch (error) {
      console.error('❌ [DROP ERROR]', error);
      toast.error('Failed to move work order');
    } finally {
      setTimeout(() => {
        isUpdatingRef.current = false;
        console.log('🔵 [DROP END] Drop operation complete');
      }, 1000);
    }
  }, [currentUser, loadData]);

  return { handleDrop };
}