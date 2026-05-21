import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format, startOfDay, endOfDay, isWithinInterval } from "date-fns";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { useData } from "@/components/DataProvider";

export default function TodayOrdersWidget({ size = "lg" }) {
  const [orders, setOrders] = React.useState([]);
  const { projects, customers } = useData();
  const [fallbackProjects, setFallbackProjects] = React.useState([]);
  const [sortBy, setSortBy] = React.useState('time');
  const [sortOrder, setSortOrder] = React.useState('asc');

  const loadOrders = React.useCallback(async () => {
    try {
      const all = await base44.entities.TimeEntry.list('-updated_date', 500);
      const start = startOfDay(new Date());
      const end = endOfDay(new Date());
      
      // Ajuste de timezone GMT+4 (Dubai)
      const dubaiStart = new Date(start.getTime() - (4 * 60 * 60 * 1000));
      const dubaiEnd = new Date(end.getTime() - (4 * 60 * 60 * 1000));
      
      const todays = all.filter((wo) => {
        if (!wo.planned_start_time) return false;
        const dt = new Date(wo.planned_start_time);
        return wo.status !== 'closed' && isWithinInterval(dt, { start: dubaiStart, end: dubaiEnd });
      });
      
      todays.sort((a, b) => {
        const ua = a.is_urgent ? 1 : 0;
        const ub = b.is_urgent ? 1 : 0;
        if (ua !== ub) return ub - ua;
        const ta = a.planned_start_time ? new Date(a.planned_start_time).getTime() : 0;
        const tb = b.planned_start_time ? new Date(b.planned_start_time).getTime() : 0;
        return ta - tb;
      });
      
      setOrders(todays);
    } catch {
      setOrders([]);
    }
  }, []);

  React.useEffect(() => {
    let mounted = true;
    loadOrders();
    
    if (!projects || projects.length === 0) {
      base44.entities.Project.list('-updated_date', 300).then(setFallbackProjects).catch(()=>{});
    }
    
    // ✅ Suscripción en tiempo real
    const unsubscribe = base44.entities.TimeEntry.subscribe((event) => {
      if (mounted && (event.type === 'create' || event.type === 'update' || event.type === 'delete')) {
        loadOrders();
      }
    });
    
    return () => { 
      mounted = false;
      unsubscribe();
    };
  }, [projects, loadOrders]);

  const projectsData = (projects && projects.length > 0) ? projects : fallbackProjects;

  const formatWONumber = (val, refISO) => {
    if (!val) return '';
    const s = String(val).trim();
    if (/^\d{3,4}\/\d{2}$/.test(s)) return s;
    let m = s.match(/^WO-(\d{4})-(\d{1,4})$/i) || s.match(/^WR-(\d{4})-(\d{1,4})$/i);
    if (m) return `${String(m[2]).padStart(4,'0')}/${String(m[1]).slice(-2)}`;
    m = s.match(/^(\d{1,4})$/);
    if (m) {
      const yy = (() => { try { return new Date(refISO || new Date()).getFullYear().toString().slice(-2); } catch { return new Date().getFullYear().toString().slice(-2); } })();
      return `${String(m[1]).padStart(4,'0')}/${yy}`;
    }
    return '';
  };

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  const sortedOrders = React.useMemo(() => {
    const sorted = [...orders];
    sorted.sort((a, b) => {
      let aVal, bVal;
      
      if (sortBy === 'wo_number') {
        const parseSerial = (str) => {
          const m = String(str || '').match(/^(\d{3,4})\/(\d{2})$/);
          if (!m) return -1;
          const year = parseInt(m[2], 10);
          const num = parseInt(m[1], 10);
          return year * 10000 + num;
        };
        const fa = formatWONumber(a.work_order_number, a.planned_start_time || a.created_date);
        const fb = formatWONumber(b.work_order_number, b.planned_start_time || b.created_date);
        aVal = parseSerial(fa);
        bVal = parseSerial(fb);
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      } else if (sortBy === 'client') {
        const projA = projectsData.find(p => p.id === a.project_id);
        const projB = projectsData.find(p => p.id === b.project_id);
        const custA = projA?.customer_id ? customers?.find(c => c.id === projA.customer_id) : null;
        const custB = projB?.customer_id ? customers?.find(c => c.id === projB.customer_id) : null;
        aVal = custA?.name?.toLowerCase() || '';
        bVal = custB?.name?.toLowerCase() || '';
      } else if (sortBy === 'project') {
        const projA = projectsData.find(p => p.id === a.project_id);
        const projB = projectsData.find(p => p.id === b.project_id);
        aVal = projA?.name?.toLowerCase() || '';
        bVal = projB?.name?.toLowerCase() || '';
      } else if (sortBy === 'categories') {
        const projA = projectsData.find(p => p.id === a.project_id);
        const projB = projectsData.find(p => p.id === b.project_id);
        aVal = projA?.category_ids?.[0] || '';
        bVal = projB?.category_ids?.[0] || '';
      } else if (sortBy === 'time') {
        aVal = a.planned_start_time ? new Date(a.planned_start_time).getTime() : 0;
        bVal = b.planned_start_time ? new Date(b.planned_start_time).getTime() : 0;
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      } else if (sortBy === 'open_closed') {
        aVal = a.status === 'open' ? 1 : 0;
        bVal = b.status === 'open' ? 1 : 0;
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return 0;
    });
    return sorted;
  }, [orders, sortBy, sortOrder, projectsData, customers]);

  const SortButton = ({ column, children }) => (
    <button
      onClick={() => handleSort(column)}
      className="flex items-center gap-1 hover:text-indigo-600 transition-colors cursor-pointer font-semibold"
    >
      {children}
      {sortBy === column && (
        <span className="text-[10px]">
          {sortOrder === 'asc' ? '↑' : '↓'}
        </span>
      )}
    </button>
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-2 flex-shrink-0">
        <div className="text-sm text-slate-600">Today's orders</div>
        <div className="text-base font-semibold">{orders.length}</div>
      </div>
      <div className="flex-1 overflow-auto min-h-0">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white">
            <tr className="text-left text-xs text-slate-500">
              <th className="py-1 pr-2"><SortButton column="wo_number">WO #</SortButton></th>
              <th className="py-1 pr-2"><SortButton column="client">Client</SortButton></th>
              <th className="py-1 pr-2"><SortButton column="project">Project</SortButton></th>
              <th className="py-1 pr-2"><SortButton column="categories">Categories</SortButton></th>
              <th className="py-1 pr-2"><SortButton column="open_closed">Open</SortButton></th>
              <th className="py-1 pr-2"><SortButton column="open_closed">Closed</SortButton></th>
              <th className="py-1 pr-2 text-right"><SortButton column="time">Time Open</SortButton></th>
              <th className="py-1 pr-2 text-right"><SortButton column="time">Open</SortButton></th>
            </tr>
          </thead>
          <tbody>
            {sortedOrders.map((wo) => {
              const proj = projectsData.find(p => p.id === wo.project_id);
              const customer = proj?.customer_id ? customers?.find(c => c.id === proj.customer_id) : null;
              const woNum = formatWONumber(wo.work_order_number, wo.planned_start_time || wo.created_date);
              return (
                <tr key={wo.id} className="hover:bg-slate-50 cursor-pointer" onClick={()=>window.location.href=createPageUrl('work-orders')}>
                  <td className="py-1 pr-2 truncate font-mono text-xs">{woNum || 'N/A'} {wo.is_urgent && <span className="ml-1 text-[10px] text-red-600">• Urgent</span>}</td>
                  <td className="py-1 pr-2 truncate text-slate-600 text-xs">{customer?.name || '—'}</td>
                  <td className="py-1 pr-2 truncate text-slate-600 text-xs">{proj?.name || '—'}</td>
                  <td className="py-1 pr-2 truncate text-slate-600 text-xs">—</td>
                  <td className="py-1 pr-2 text-center text-xs">{wo.status === 'open' ? '1' : '-'}</td>
                  <td className="py-1 pr-2 text-center text-xs">{wo.status === 'closed' ? '1' : '-'}</td>
                  <td className="py-1 pr-2 text-right text-xs">—</td>
                  <td className="py-1 pr-2 text-right"><Badge variant="outline" className="text-xs">{wo.planned_start_time ? format(new Date(wo.planned_start_time), 'HH:mm') : '--:--'}</Badge></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-3 text-right flex-shrink-0">
        <a href={createPageUrl("work-orders")}>
          <Button size="sm" variant="outline">Open planner</Button>
        </a>
      </div>
    </div>
  );
}