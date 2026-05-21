import React from "react";
import { base44 } from "@/api/base44Client";
import { Calendar, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format, startOfWeek, endOfWeek, isWithinInterval } from "date-fns";

export default function CalendarThisWeekWidget() {
  const [events, setEvents] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    (async () => {
      try {
        const now = new Date();
        const weekStart = startOfWeek(now, { weekStartsOn: 6 });
        const weekEnd = endOfWeek(now, { weekStartsOn: 6 });

        const allEvents = await base44.entities.CalendarEvent.list('-start_time', 200);
        
        const thisWeek = allEvents.filter(e => {
          if (!e.start_time) return false;
          const eventDate = new Date(e.start_time);
          return isWithinInterval(eventDate, { start: weekStart, end: weekEnd });
        });

        setEvents(thisWeek.slice(0, 8));
      } catch (err) {
        console.error('Error loading events:', err);
        setEvents([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-32 text-sm text-slate-400">Loading...</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-slate-600">This Week Events</div>
        <Badge variant="outline" className="text-xs">{events.length}</Badge>
      </div>

      {events.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-sm text-slate-400">
          <div className="text-center">
            <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No events this week</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-2">
          {events.map((event) => (
            <div key={event.id} className="flex items-start gap-2 p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
              <Calendar className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-700 truncate">{event.title}</p>
                <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                  <Clock className="w-3 h-3" />
                  {event.start_time ? format(new Date(event.start_time), 'MMM d, h:mm a') : 'No date'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}