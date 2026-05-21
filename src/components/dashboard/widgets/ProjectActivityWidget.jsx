import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '@/components/DataProvider';
import { Badge } from '@/components/ui/badge';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { base44 } from '@/api/base44Client';
import { parseISO, startOfMonth, endOfMonth } from 'date-fns';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'];

export default function ProjectActivityWidget({ size, maxItems = 6 }) {
  const { loadProjects, loadCustomers } = useData();
  const [entries, setEntries] = useState([]);
  const [projects, setProjects] = useState([]);
  const [customers, setCustomers] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [entriesData, projectsData, customersData] = await Promise.all([
        base44.entities.TimeEntry.list('-updated_date', 3000),
        loadProjects(),
        loadCustomers(),
      ]);
      setEntries(entriesData || []);
      setProjects(projectsData || []);
      setCustomers(customersData || []);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  const projectMetrics = useMemo(() => {
    const startDate = startOfMonth(new Date());
    const endDate = endOfMonth(new Date());

    const filteredEntries = entries.filter(entry => {
      if (!entry.planned_start_time) return false;
      try {
        const entryDate = parseISO(entry.planned_start_time);
        return entryDate >= startDate && entryDate <= endDate;
      } catch {
        return false;
      }
    });

    const projectStats = {};

    filteredEntries.forEach(entry => {
      const projectId = entry.project_id;
      if (!projectId) return;

      if (!projectStats[projectId]) {
        const project = projects.find(p => p.id === projectId);
        const customer = customers.find(c => c.id === project?.customer_id);
        projectStats[projectId] = {
          name: project?.name || 'Unknown',
          customer: customer?.name || '-',
          value: 0,
        };
      }

      projectStats[projectId].value++;
    });

    return Object.values(projectStats)
      .sort((a, b) => b.value - a.value)
      .slice(0, maxItems);
  }, [entries, projects, customers, maxItems]);

  return (
    <div className="h-full flex flex-col">
      <div className="mb-3">
        <ResponsiveContainer width="100%" height={size === 'lg' ? 200 : 130}>
          <PieChart>
            <Pie
              data={projectMetrics}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
              outerRadius={size === 'lg' ? 75 : 50}
              fill="#8884d8"
              dataKey="value"
            >
              {projectMetrics.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#fff', 
                border: '1px solid #e2e8f0', 
                borderRadius: '6px',
                fontSize: '11px'
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="space-y-2 overflow-auto flex-1">
        {projectMetrics.map((proj, idx) => (
          <div key={idx} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-slate-50 transition-colors">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-slate-900 truncate">{proj.name}</p>
                <p className="text-[10px] text-indigo-600">{proj.customer}</p>
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-2xl font-light text-slate-900">{proj.value}</p>
              <p className="text-[10px] text-indigo-600 uppercase tracking-wide">Orders</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}