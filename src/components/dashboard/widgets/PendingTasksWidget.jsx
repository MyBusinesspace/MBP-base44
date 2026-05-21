import React from "react";
import { base44 } from "@/api/base44Client";
import { CheckSquare, Circle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export default function PendingTasksWidget() {
  const [tasks, setTasks] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [filterStatus, setFilterStatus] = React.useState('open');

  React.useEffect(() => {
    (async () => {
      try {
        const allTasks = await base44.entities.QuickTask.filter({ status: filterStatus }, '-created_date', 100);
        setTasks(allTasks.slice(0, 10));
      } catch (err) {
        console.error('Error loading tasks:', err);
        setTasks([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [filterStatus]);

  if (loading) {
    return <div className="flex items-center justify-center h-32 text-sm text-slate-400">Loading...</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFilterStatus('open')}
            className={cn(
              "h-7 px-3 text-xs font-medium transition-all",
              filterStatus === 'open'
                ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                : "text-slate-600 hover:bg-slate-100"
            )}
          >
            Pending
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFilterStatus('completed')}
            className={cn(
              "h-7 px-3 text-xs font-medium transition-all",
              filterStatus === 'completed'
                ? "bg-green-100 text-green-700 hover:bg-green-200"
                : "text-slate-600 hover:bg-slate-100"
            )}
          >
            Completed
          </Button>
        </div>
        <Badge variant="outline" className="text-xs">{tasks.length}</Badge>
      </div>

      {tasks.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-sm text-slate-400">
          <div className="text-center">
            <CheckSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No pending tasks</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-2">
          {tasks.map((task) => (
            <div key={task.id} className="flex items-start gap-2 p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
              <Circle className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-700 truncate">{task.title}</p>
                {task.due_date && (
                  <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                    <Clock className="w-3 h-3" />
                    {format(new Date(task.due_date), 'MMM d')}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}