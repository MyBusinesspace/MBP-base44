import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { startOfDay, endOfDay, isWithinInterval } from "date-fns";
import { createPageUrl } from "@/utils";

export default function LateWorkersWidget({ size = "sm", maxItems = 6 }) {
  const [orders, setOrders] = React.useState([]);
  const [timesheets, setTimesheets] = React.useState([]);
  const [users, setUsers] = React.useState([]);

  React.useEffect(() => {
    (async () => {
      try {
        const [wo, ts, us] = await Promise.all([
          base44.entities.TimeEntry.list('-updated_date', 500),
          base44.entities.TimesheetEntry.list('-updated_date', 500),
          base44.entities.User.list(),
        ]);
        setOrders(wo);
        setTimesheets(ts);
        setUsers(us);
      } catch {
        setOrders([]); setTimesheets([]); setUsers([]);
      }
    })();
  }, []);

  const lateList = React.useMemo(() => {
    const items = [];
    const now = new Date();
    const graceMs = 15 * 60 * 1000;
    const start = startOfDay(now), end = endOfDay(now);

    const todays = orders.filter(wo => wo.planned_start_time && wo.status !== 'closed' && isWithinInterval(new Date(wo.planned_start_time), { start, end }));

    todays.forEach(wo => {
      const ids = Array.isArray(wo.employee_ids) ? wo.employee_ids : (wo.employee_id ? [wo.employee_id] : []);
      const planned = new Date(wo.planned_start_time);
      const threshold = new Date(planned.getTime() + graceMs);
      if (threshold > now) return; // not late yet

      ids.filter(Boolean).forEach(empId => {
        const isActive = timesheets.some(ts => ts.employee_id === empId && ts.is_active);
        // If already clocked-in today on any timesheet, exclude
        if (isActive) return;
        const user = users.find(u => u.id === empId);
        const name = user?.nickname || user?.first_name || user?.full_name || user?.email || 'Unknown';
        items.push({ id: `${wo.id}_${empId}`, name, order: wo.work_order_number || 'N/A' });
      });
    });
    // highest priority: urgent orders first
    return items.slice(0, maxItems);
  }, [orders, timesheets, users, maxItems]);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-slate-600">Late today</div>
        <div className="text-base font-semibold">{lateList.length}</div>
      </div>
      <ul className="space-y-1">
        {lateList.map((it) => (
          <li key={it.id} className="flex items-center justify-between text-sm">
            <span className="truncate pr-2">{it.name}</span>
            <Badge className="bg-red-600 text-white">Late</Badge>
          </li>
        ))}
      </ul>
      <div className="mt-3 text-right">
        <a href={createPageUrl("time-tracker")}>
          <Button size="sm" variant="outline">Review</Button>
        </a>
      </div>
    </div>
  );
}