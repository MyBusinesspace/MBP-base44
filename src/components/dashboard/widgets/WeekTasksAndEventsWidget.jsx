import React, { useState, useEffect } from 'react';
import { CalendarEvent, QuickTask } from '@/entities/all';
import { format, startOfWeek, endOfWeek, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { CheckCircle2, Circle, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function WeekTasksAndEventsWidget({ size = 'sm', maxItems = 6 }) {
  const [tasks, setTasks] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
        const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });

        // Load tasks
        const tasksData = await QuickTask.list('-due_date', 100);
        const weekTasks = (tasksData || [])
          .filter(t => t.due_date && isWithinInterval(startOfDay(new Date(t.due_date)), { start: weekStart, end: weekEnd }))
          .sort((a, b) => new Date(a.due_date) - new Date(b.due_date));

        // Load events
        const eventsData = await CalendarEvent.list('-start_time', 100);
        const weekEvents = (eventsData || [])
          .filter(e => {
            try {
              return isWithinInterval(startOfDay(new Date(e.start_time)), { start: weekStart, end: weekEnd });
            } catch {
              return false;
            }
          })
          .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

        setTasks(weekTasks.slice(0, maxItems));
        setEvents(weekEvents.slice(0, maxItems));
      } catch (error) {
        console.error('Error loading week data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
    const unsubscribe = QuickTask.subscribe(() => loadData());
    return () => unsubscribe();
  }, [maxItems]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  const allItems = [
    ...tasks.map(t => ({ type: 'task', data: t, date: t.due_date })),
    ...events.map(e => ({ type: 'event', data: e, date: e.start_time }))
  ].sort((a, b) => new Date(a.date) - new Date(b.date));

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="space-y-2 overflow-y-auto flex-1 pr-2">
        {allItems.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-slate-400 text-sm">
            No tasks or events this week
          </div>
        ) : (
          allItems.map((item, idx) => {
            if (item.type === 'task') {
              const task = item.data;
              return (
                <div key={`task-${task.id}`} className="flex items-start gap-2 p-2 rounded-lg hover:bg-slate-50 group">
                  <button className="mt-0.5 flex-shrink-0">
                    {task.status === 'completed' ? (
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                    ) : (
                      <Circle className="w-4 h-4 text-slate-300 group-hover:text-slate-400" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-xs truncate", task.status === 'completed' && "line-through text-slate-400")}>
                      {task.title}
                    </p>
                    {task.due_date && (
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {format(new Date(task.due_date), 'EEE, MMM d')}
                      </p>
                    )}
                  </div>
                </div>
              );
            } else {
              const event = item.data;
              return (
                <div key={`event-${event.id}`} className="flex items-start gap-2 p-2 rounded-lg hover:bg-slate-50 group">
                  <Calendar className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs truncate font-medium text-slate-900">
                      {event.title}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {format(new Date(event.start_time), 'EEE, MMM d')}
                    </p>
                  </div>
                </div>
              );
            }
          })
        )}
      </div>
    </div>
  );
}