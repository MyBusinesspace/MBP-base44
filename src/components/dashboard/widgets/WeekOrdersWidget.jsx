import React from "react";
import { base44 } from "@/api/base44Client";
import { startOfWeek, endOfWeek, isWithinInterval, format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createPageUrl } from "@/utils";

export default function WeekOrdersWidget({ maxItems = 6 }) {
  const [orders, setOrders] = React.useState([]);

  React.useEffect(() => {
    (async () => {
      try {
        const all = await base44.entities.TimeEntry.list('-updated_date', 500);
        const s = startOfWeek(new Date(), { weekStartsOn: 1 });
        const e = endOfWeek(new Date(), { weekStartsOn: 1 });
        const week = all.filter(wo => wo.planned_start_time && wo.status !== 'closed' && isWithinInterval(new Date(wo.planned_start_time), { start: s, end: e }));
        week.sort((a, b) => {
          const ua = a.is_urgent ? 1 : 0; const ub = b.is_urgent ? 1 : 0; if (ua !== ub) return ub - ua;
          const ta = a.planned_start_time ? new Date(a.planned_start_time).getTime() : 0;
          const tb = b.planned_start_time ? new Date(b.planned_start_time).getTime() : 0;
          return ta - tb;
        });
        setOrders(week);
      } catch { setOrders([]); }
    })();
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-slate-600">Orders this week</div>
        <div className="text-base font-semibold">{orders.length}</div>
      </div>
      <ul className="space-y-1">
        {orders.slice(0, maxItems).map(wo => (
          <li key={wo.id} className="flex items-center justify-between text-sm">
            <span className="truncate pr-2">{wo.work_order_number || 'N/A'}</span>
            <Badge variant="outline">{wo.planned_start_time ? format(new Date(wo.planned_start_time), 'EEE HH:mm') : '--'}</Badge>
          </li>
        ))}
      </ul>
      <div className="mt-3 text-right">
        <a href={createPageUrl('work-orders')}>
          <Button size="sm" variant="outline">Open planner</Button>
        </a>
      </div>
    </div>
  );
}