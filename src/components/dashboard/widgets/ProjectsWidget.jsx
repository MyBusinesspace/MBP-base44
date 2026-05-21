import React, { useMemo } from "react";
import { useData } from "@/components/DataProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";

export default function ProjectsWidget({ size = "sm", maxItems = 6 }) {
  const { projects } = useData();
  const [workOrders, setWorkOrders] = React.useState([]);
  const [fallbackProjects, setFallbackProjects] = React.useState([]);

  React.useEffect(() => {
    base44.entities.TimeEntry.list('-updated_date', 500).then(setWorkOrders).catch(() => setWorkOrders([]));
    if (!projects || projects.length === 0) {
      base44.entities.Project.list('-updated_date', 300).then(setFallbackProjects).catch(()=>{});
    }
  }, [projects]);

  const projectsData = (projects && projects.length > 0) ? projects : fallbackProjects;
  const [months, setMonths] = React.useState(3);
  const windowStart = React.useMemo(() => { const d = new Date(); d.setMonth(d.getMonth() - months); return d; }, [months]);
  const total = Array.isArray(projectsData) ? projectsData.length : 0;

  const { customers } = useData();
  const [fallbackCustomers, setFallbackCustomers] = React.useState([]);
  React.useEffect(() => {
    if (!customers || customers.length === 0) {
      base44.entities.Customer.list('-updated_date', 200).then(setFallbackCustomers).catch(()=>{});
    }
  }, [customers]);
  const customersData = (customers && customers.length > 0) ? customers : fallbackCustomers;

  const ranked = useMemo(() => {
    const counts = new Map();
    (workOrders || []).forEach((wo) => {
      if (!wo.project_id) return;
      counts.set(wo.project_id, (counts.get(wo.project_id) || 0) + 1);
    });
    let items = (projectsData || []).map((p) => ({
      id: p.id,
      name: p.name,
      customerName: (customersData.find(c => c.id === p.customer_id)?.name) || '—',
      orders: counts.get(p.id) || 0,
    }));
    items = items.sort((a, b) => b.orders - a.orders).slice(0, maxItems);
    if (items.length === 0 && (projectsData || []).length > 0) {
      items = (projectsData || []).slice(0, maxItems).map(p => ({ id: p.id, name: p.name, customerName: (customersData.find(c => c.id === p.customer_id)?.name) || '—', orders: counts.get(p.id) || 0 }));
    }
    return items;
  }, [projectsData, workOrders, customersData, maxItems]);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-slate-600">Top projects (active orders)</div>
        <div className="flex items-center gap-2">
          <div className="text-xs text-slate-500">{months}m</div>
          <div className="flex border rounded overflow-hidden">
            <button className={`px-2 py-0.5 text-xs ${months===3?'bg-slate-200':'bg-white'}`} onClick={()=>setMonths(3)}>3m</button>
            <button className={`px-2 py-0.5 text-xs ${months===6?'bg-slate-200':'bg-white'}`} onClick={()=>setMonths(6)}>6m</button>
          </div>
        </div>
      </div>
      <div className="overflow-x-auto overflow-y-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500">
              <th className="py-1 pr-2">Project</th>
              <th className="py-1 pr-2">Client</th>
              <th className="py-1 pr-2 text-right">Active orders</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50 cursor-pointer" onClick={()=>window.location.href=createPageUrl('projects')}>
                <td className="py-1 pr-2 truncate">{p.name}</td>
                <td className="py-1 pr-2 truncate text-slate-600">{p.customerName}</td>
                <td className="py-1 pr-2 text-right"><Badge variant="outline">{p.orders}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 text-right">
        <a href={createPageUrl("projects")}>
          <Button size="sm" variant="outline">View projects</Button>
        </a>
      </div>
    </div>
  );
}