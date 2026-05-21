import React from 'react';
import { cn } from '@/lib/utils';
import { TimeEntry } from '@/entities/all';
import { toast } from 'sonner';
import { Check, Clock } from 'lucide-react';

/**
 * Task status switch badge for the week calendar view.
 * Shows two clear, clickable buttons: Pending (amber) or Completed (green).
 */
export default function WeekCalendarTaskBadge({
  entry,
  taskForDay,
  currentTaskStatus,
  localTaskStatusMap,
  setLocalTaskStatusMap,
  onDataChanged
}) {
  if (!taskForDay) return null;

  const isCompleted = currentTaskStatus === 'completed';

  const handleTaskStatusChange = async (ev, newStatus) => {
    ev.preventDefault();
    ev.stopPropagation();

    const updatedTasks = (entry.tasks || []).map(t =>
      t.id === taskForDay.id ? { ...t, status: newStatus } : t
    );

    // Optimistic update
    setLocalTaskStatusMap(prev => ({
      ...prev,
      [entry.id]: { ...(prev[entry.id] || {}), [taskForDay.id]: newStatus }
    }));

    try {
      await TimeEntry.update(entry.id, { tasks: updatedTasks });
      if (onDataChanged) onDataChanged();
    } catch {
      // Revert
      setLocalTaskStatusMap(prev => ({
        ...prev,
        [entry.id]: { ...(prev[entry.id] || {}), [taskForDay.id]: currentTaskStatus }
      }));
      toast.error('Failed to update task status');
    }
  };

  return (
    <div className="flex gap-1 z-20 mb-1">
      {/* Pending button */}
      <button
        onClick={(ev) => handleTaskStatusChange(ev, 'pending')}
        title="Mark as Pending"
        className={cn(
          "flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all duration-150 cursor-pointer",
          !isCompleted
            ? "bg-amber-400 text-white border-2 border-amber-600 shadow-lg font-bold"
            : "bg-slate-200 text-slate-500 border-2 border-slate-300 opacity-50"
        )}
      >
        <Clock className="w-3 h-3" />
        Pending
      </button>
      
      {/* Completed button */}
      <button
        onClick={(ev) => handleTaskStatusChange(ev, 'completed')}
        title="Mark as Completed"
        className={cn(
          "flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all duration-150 cursor-pointer",
          isCompleted
            ? "bg-green-500 text-white border-2 border-green-700 shadow-lg font-bold"
            : "bg-slate-200 text-slate-500 border-2 border-slate-300 opacity-50"
        )}
      >
        <Check className="w-3 h-3" />
        Completed
      </button>
    </div>
  );
}