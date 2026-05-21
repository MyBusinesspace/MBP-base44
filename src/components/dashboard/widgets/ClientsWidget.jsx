import React, { useMemo } from "react";
import { useData } from "@/components/DataProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";

export default function ClientsWidget({ size = "sm", maxItems = 6 }) {
  const { customers, projects } = useData();
  const [fallbackCustomers, setFallbackCustomers] = React.useState([]);
  const [fallbackProjects, setFallbackProjects] = React.useState([]);
  React.useEffect(() => {
    if (!customers || customers.length === 0) {
      base44.entities.Customer.list('-updated_date', 200).then(setFallbackCustomers).catch(()=>{});
    }
    if (!projects || projects.length === 0) {
      base44.entities.Project.list('-updated_date', 200).then(setFallbackProjects).catch(()=>{});
    }
  }, [customers, projects]);

  const customersData = (customers && customers.length > 0) ? customers : fallbackCustomers;
  const projectsData = (projects && projects.length > 0) ? projects : fallbackProjects;
  const [months, setMonths] = React.useState(3);
  const windowStart = React.useMemo(() => { const d = new Date(); d.setMonth(d.getMonth() - months); return d; }, [months]);
  const total = Array.isArray(customersData) ? customersData.filter(c => !c.archived).length : 0;

  const ranked = useMemo(() => {
    const counts = new Map();
    (projectsData || []).forEach((p) => {
      if (!p.customer_id) return;
      counts.set(p.customer_id, (counts.get(p.customer_id) || 0) + 1);
    });
    let items = (customersData || []).map((c) => ({
      id: c.id,
      name: c.name,
      contact: c.contact_person || (Array.isArray(c.contact_persons) ? c.contact_persons[0] : ''),
      projects: counts.get(c.id) || 0,
    }));
    items = items.sort((a, b) => b.projects - a.projects).slice(0, maxItems);
    if (items.length === 0 && (customersData || []).length > 0) {
      items = (customersData || []).slice(0, maxItems).map(c => ({ id: c.id, name: c.name, contact: c.contact_person || (Array.isArray(c.contact_persons) ? c.contact_persons[0] : ''), projects: counts.get(c.id) || 0 }));
    }
    return items;
  }, [customersData, projectsData, maxItems]);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-slate-600">Top clients (active projects)</div>
        <div className="flex items-center gap-2">
          <div className="text-xs text-slate-500">{months}m</div>
          <div className="flex border rounded overflow-hidden">
            <button className={`px-2 py-0.5 text-xs ${months===3?'bg-slate-200':'bg-white'}`} onClick={()=>setMonths(3)} aria-label="3 months">3m</button>
            <button className={`px-2 py-0.5 text-xs ${months===6?'bg-slate-200':'bg-white'}`} onClick={()=>setMonths(6)} aria-label="6 months">6m</button>
          </div>
        </div>
      </div>
      <div className="overflow-x-auto overflow-y-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500">
              <th className="py-1 pr-2">Client</th>
              <th className="py-1 pr-2">Contact</th>
              <th className="py-1 pr-2 text-right">Active projects</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50 cursor-pointer" onClick={()=>window.location.href=createPageUrl('clients')}>
                <td className="py-1 pr-2 truncate">{c.name}</td>
                <td className="py-1 pr-2 truncate text-slate-600">{c.contact || '—'}</td>
                <td className="py-1 pr-2 text-right"><Badge variant="outline">{c.projects}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 text-right">
        <a href={createPageUrl("clients")}>
          <Button size="sm" variant="outline">View clients</Button>
        </a>
      </div>
    </div>
  );
}