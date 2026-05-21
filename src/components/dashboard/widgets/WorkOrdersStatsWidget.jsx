import React, { useState, useEffect, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { base44 } from '@/api/base44Client';
import { parseISO, format, startOfMonth, endOfMonth } from 'date-fns';
import { TrendingUp, CheckCircle, Clock } from 'lucide-react';

const COLORS = ['#6366f1', '#10b981'];

export default function WorkOrdersStatsWidget({ size, maxItems = 7 }) {
  const [entries, setEntries] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const data = await base44.entities.TimeEntry.list('-updated_date', 3000);
      setEntries(data || []);
    } catch (error) {
      console.error('Failed to load entries:', error);
    }
  };

  const stats = useMemo(() => {
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

    const total = filteredEntries.length;
    const closed = filteredEntries.filter(e => e.status === 'closed').length;
    const completionRate = total > 0 ? ((closed / total) * 100).toFixed(1) : 0;

    // Timeline data
    const dailyStats = {};
    filteredEntries.slice(0, maxItems * 10).forEach(entry => {
      if (!entry.planned_start_time) return;
      try {
        const date = format(parseISO(entry.planned_start_time), 'MMM dd');
        if (!dailyStats[date]) {
          dailyStats[date] = { date, total: 0, closed: 0 };
        }
        dailyStats[date].total++;
        if (entry.status === 'closed') dailyStats[date].closed++;
      } catch (e) {}
    });

    const timeline = Object.values(dailyStats)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(-maxItems);

    return { total, closed, completionRate, timeline };
  }, [entries, maxItems]);

  return (
    <div className="h-full flex flex-col">
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-white rounded-lg p-3 border border-slate-200">
          <p className="text-3xl font-light text-slate-900">{stats.total}</p>
          <p className="text-[10px] text-indigo-600 uppercase tracking-wide mt-0.5">Total Orders</p>
        </div>

        <div className="bg-white rounded-lg p-3 border border-slate-200">
          <p className="text-3xl font-light text-green-600">{stats.closed}</p>
          <p className="text-[10px] text-indigo-600 uppercase tracking-wide mt-0.5">Completed</p>
        </div>

        <div className="bg-white rounded-lg p-3 border border-slate-200">
          <p className="text-3xl font-light text-slate-900">{stats.completionRate}%</p>
          <p className="text-[10px] text-indigo-600 uppercase tracking-wide mt-0.5">Rate</p>
        </div>
      </div>

      <div className="mb-3">
        <ResponsiveContainer width="100%" height={size === 'lg' ? 180 : 110}>
          <AreaChart data={stats.timeline}>
            <defs>
              <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS[0]} stopOpacity={0.3}/>
                <stop offset="95%" stopColor={COLORS[0]} stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorClosed" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS[1]} stopOpacity={0.3}/>
                <stop offset="95%" stopColor={COLORS[1]} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#64748b' }} />
            <YAxis tick={{ fontSize: 9, fill: '#64748b' }} />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#fff', 
                border: '1px solid #e2e8f0', 
                borderRadius: '6px',
                fontSize: '10px'
              }}
            />
            <Area 
              type="monotone" 
              dataKey="total" 
              stroke={COLORS[0]} 
              strokeWidth={2}
              fillOpacity={1} 
              fill="url(#colorTotal)" 
              name="Total"
            />
            <Area 
              type="monotone" 
              dataKey="closed" 
              stroke={COLORS[1]} 
              strokeWidth={2}
              fillOpacity={1} 
              fill="url(#colorClosed)" 
              name="Closed"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="space-y-1.5 overflow-auto flex-1">
        {stats.timeline.map((day, idx) => (
          <div key={idx} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-slate-50">
            <span className="text-[11px] text-slate-600">{day.date}</span>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <span className="text-lg font-light text-slate-900">{day.total}</span>
                <span className="text-[9px] text-indigo-600 uppercase ml-1">total</span>
              </div>
              <div className="text-right">
                <span className="text-lg font-light text-green-600">{day.closed}</span>
                <span className="text-[9px] text-indigo-600 uppercase ml-1">closed</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}