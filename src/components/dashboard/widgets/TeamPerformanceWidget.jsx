import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '@/components/DataProvider';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { base44 } from '@/api/base44Client';
import { parseISO, startOfMonth, endOfMonth, differenceInHours } from 'date-fns';

const COLORS = ['#6366f1', '#10b981'];

export default function TeamPerformanceWidget({ size, maxItems = 6 }) {
  const { teams } = useData();
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

  const teamPerformance = useMemo(() => {
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

    const teamStats = {};

    filteredEntries.forEach(entry => {
      const entryTeams = entry.team_ids || [];
      entryTeams.forEach(teamId => {
        if (!teamStats[teamId]) {
          const team = teams.find(t => t.id === teamId);
          teamStats[teamId] = {
            name: team?.name || 'Unknown',
            total: 0,
            closed: 0,
          };
        }

        teamStats[teamId].total++;
        if (entry.status === 'closed') teamStats[teamId].closed++;
      });
    });

    return Object.values(teamStats)
      .map(team => ({
        ...team,
        rate: team.total > 0 ? ((team.closed / team.total) * 100).toFixed(0) : 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, maxItems);
  }, [entries, teams, maxItems]);

  return (
    <div className="h-full flex flex-col">
      <div className="mb-3">
        <ResponsiveContainer width="100%" height={size === 'lg' ? 240 : 140}>
          <BarChart data={teamPerformance}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} />
            <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#fff', 
                border: '1px solid #e2e8f0', 
                borderRadius: '6px',
                fontSize: '11px'
              }}
            />
            <Bar dataKey="total" fill={COLORS[0]} name="Total" radius={[4, 4, 0, 0]} />
            <Bar dataKey="closed" fill={COLORS[1]} name="Closed" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="space-y-2">
        {teamPerformance.map((team, idx) => (
          <div key={idx} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-slate-50 transition-colors">
            <div className="flex-1">
              <p className="text-xs font-medium text-slate-900">{team.name}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-2xl font-light text-slate-900">{team.total}</p>
                <p className="text-[10px] text-indigo-600 uppercase tracking-wide">Total</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-light text-green-600">{team.closed}</p>
                <p className="text-[10px] text-indigo-600 uppercase tracking-wide">Closed</p>
              </div>
              <div className="text-right">
                <p className={`text-2xl font-light ${
                  parseInt(team.rate) > 80 ? 'text-green-600' : 
                  parseInt(team.rate) > 50 ? 'text-yellow-600' : 'text-red-600'
                }`}>{team.rate}%</p>
                <p className="text-[10px] text-indigo-600 uppercase tracking-wide">Rate</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}