import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";

export default function ActiveWorkersWidget({ size = "sm", maxItems = 6 }) {
  const [timesheets, setTimesheets] = React.useState([]);
  const [users, setUsers] = React.useState([]);

  React.useEffect(() => {
    (async () => {
      try {
        const [ts, us] = await Promise.all([
          base44.entities.TimesheetEntry.list('-updated_date', 300),
          base44.entities.User.list()
        ]);
        setTimesheets(ts);
        setUsers(us);
      } catch {
        setTimesheets([]);
        setUsers([]);
      }
    })();
  }, []);

  const active = React.useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return timesheets.filter(ts => {
      if (!ts.is_active) return false;
      if (ts.start_time) {
        const startDate = new Date(ts.start_time);
        if (startDate < todayStart) return false;
      }
      return true;
    });
  }, [timesheets]);
  const total = active.length;
  
  const stats = React.useMemo(() => {
    const fieldUsers = users.filter(u => u.work_location_type === 'field' || !u.work_location_type);
    const officeUsers = users.filter(u => u.work_location_type === 'office');
    const fieldActive = active.filter(ts => {
      const u = users.find(x => x.id === ts.employee_id);
      return u && (u.work_location_type === 'field' || !u.work_location_type);
    });
    const officeActive = active.filter(ts => {
      const u = users.find(x => x.id === ts.employee_id);
      return u && u.work_location_type === 'office';
    });
    return {
      field: { active: fieldActive.length, total: fieldUsers.length },
      office: { active: officeActive.length, total: officeUsers.length }
    };
  }, [active, users]);

  const items = React.useMemo(() => {
    const arr = active.map(ts => {
      const u = users.find((x) => x.id === ts.employee_id);
      const name = u?.nickname || u?.first_name || u?.full_name || u?.email || 'Unknown';
      return { id: ts.id, name };
    });
    // No priority available; keep original order
    return arr.slice(0, maxItems);
  }, [active, users, maxItems]);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-slate-600">Active workers</div>
        <div className="text-base font-semibold">{total}</div>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
          <div className="text-blue-600 font-semibold mb-1">Field</div>
          <div className="text-slate-700">
            <span className="font-bold text-blue-600">{stats.field.active}</span> active / <span className="text-slate-500">{stats.field.total}</span> assigned
          </div>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-2">
          <div className="text-purple-600 font-semibold mb-1">Office</div>
          <div className="text-slate-700">
            <span className="font-bold text-purple-600">{stats.office.active}</span> active / <span className="text-slate-500">{stats.office.total}</span> available
          </div>
        </div>
      </div>
      <ul className="space-y-1">
        {items.map((it) => (
          <li key={it.id} className="flex items-center justify-between text-sm">
            <span className="truncate pr-2">{it.name}</span>
            <Badge variant="outline">Active</Badge>
          </li>
        ))}
      </ul>
      <div className="mt-3 text-right">
        <a href={createPageUrl("time-tracker")}>
          <Button size="sm" variant="outline">Open Time Tracker</Button>
        </a>
      </div>
    </div>
  );
}