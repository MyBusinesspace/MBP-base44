import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";

export default function LeavesWidget({ size = "sm", maxItems = 6 }) {
  const [leaves, setLeaves] = React.useState([]);
  const [users, setUsers] = React.useState([]);

  React.useEffect(() => {
    (async () => {
      try {
        const [lr, us] = await Promise.all([
          base44.entities.LeaveRequest.list('-updated_date', 200),
          base44.entities.User.list()
        ]);
        setLeaves(lr);
        setUsers(us);
      } catch { setLeaves([]); setUsers([]); }
    })();
  }, []);

  const nowStr = React.useMemo(() => new Date().toISOString().slice(0,10), []);

  const active = React.useMemo(() => {
    const a = (leaves || []).filter(lr => String(lr.status || '').toLowerCase() === 'approved' && lr.start_date <= nowStr && lr.end_date >= nowStr);
    a.sort((x, y) => (x.end_date || '').localeCompare(y.end_date || ''));
    return a;
  }, [leaves, nowStr]);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-slate-600">Active leaves</div>
        <div className="text-base font-semibold">{active.length}</div>
      </div>
      <ul className="space-y-1">
        {active.slice(0, maxItems).map(lr => {
          const u = users.find(x => x.id === lr.employee_id);
          const name = u?.nickname || u?.first_name || u?.full_name || u?.email || lr.employee_id;
          return (
            <li key={lr.id} className="flex items-center justify-between text-sm">
              <span className="truncate pr-2">{name}</span>
              <Badge variant="outline">Return {lr.end_date}</Badge>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 text-right">
        <a href={createPageUrl("leave-absences")}>
          <Button size="sm" variant="outline">Manage leaves</Button>
        </a>
      </div>
    </div>
  );
}