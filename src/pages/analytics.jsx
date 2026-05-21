import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '@/components/DataProvider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  ComposedChart,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Clock,
  Users,
  Briefcase,
  DollarSign,
  Activity,
  CheckCircle,
  Loader2,
  Calendar,
  Building2,
  Target,
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, parseISO, differenceInHours } from 'date-fns';
import { cn } from '@/lib/utils';
import { base44 } from '@/api/base44Client';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#14b8a6', '#f97316'];

export default function AnalyticsPage() {
  const { currentUser, loadProjects, loadUsers, loadCustomers, teams } = useData();

  const [entries, setEntries] = useState([]);
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [timesheets, setTimesheets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [dateRange, setDateRange] = useState('month');
  const [startDate, setStartDate] = useState(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState(endOfMonth(new Date()));

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (dateRange === 'month') {
      setStartDate(startOfMonth(new Date()));
      setEndDate(endOfMonth(new Date()));
    } else if (dateRange === 'week') {
      const today = new Date();
      setStartDate(new Date(today.setDate(today.getDate() - 7)));
      setEndDate(new Date());
    }
  }, [dateRange]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [entriesData, projectsData, usersData, customersData, timesheetsData] = await Promise.all([
        base44.entities.TimeEntry.list('-updated_date', 5000),
        loadProjects(),
        loadUsers(),
        loadCustomers(),
        base44.entities.TimesheetEntry.list('-created_date', 5000),
      ]);

      setEntries(entriesData || []);
      setProjects(projectsData || []);
      setUsers(usersData || []);
      setCustomers(customersData || []);
      setTimesheets(timesheetsData || []);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredEntries = useMemo(() => {
    return entries.filter(entry => {
      if (!entry.planned_start_time) return false;
      try {
        const entryDate = parseISO(entry.planned_start_time);
        return entryDate >= startDate && entryDate <= endDate;
      } catch {
        return false;
      }
    });
  }, [entries, startDate, endDate]);

  const kpis = useMemo(() => {
    const total = filteredEntries.length;
    const closed = filteredEntries.filter(e => e.status === 'closed').length;
    const open = filteredEntries.filter(e => e.status === 'open').length;

    let totalHours = 0;
    filteredEntries.forEach(entry => {
      if (entry.planned_start_time && entry.planned_end_time) {
        try {
          const hours = differenceInHours(parseISO(entry.planned_end_time), parseISO(entry.planned_start_time));
          if (hours > 0) totalHours += hours;
        } catch (e) {}
      }
    });

    return {
      total,
      closed,
      open,
      totalHours: Math.round(totalHours),
      completionRate: total > 0 ? ((closed / total) * 100).toFixed(1) : 0,
      activeTeams: new Set(filteredEntries.flatMap(e => e.team_ids || [])).size,
      activeUsers: new Set(filteredEntries.flatMap(e => e.employee_ids || [])).size,
      activeProjects: new Set(filteredEntries.map(e => e.project_id).filter(Boolean)).size,
    };
  }, [filteredEntries]);

  const teamPerformance = useMemo(() => {
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
            hours: 0,
          };
        }

        teamStats[teamId].total++;
        if (entry.status === 'closed') teamStats[teamId].closed++;

        if (entry.planned_start_time && entry.planned_end_time) {
          try {
            const hours = differenceInHours(parseISO(entry.planned_end_time), parseISO(entry.planned_start_time));
            if (hours > 0) teamStats[teamId].hours += hours;
          } catch (e) {}
        }
      });
    });

    return Object.values(teamStats)
      .map(team => ({
        ...team,
        completionRate: team.total > 0 ? ((team.closed / team.total) * 100).toFixed(1) : 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [filteredEntries, teams]);

  const projectMetrics = useMemo(() => {
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
          total: 0,
          closed: 0,
          hours: 0,
        };
      }

      projectStats[projectId].total++;
      if (entry.status === 'closed') projectStats[projectId].closed++;

      if (entry.planned_start_time && entry.planned_end_time) {
        try {
          const hours = differenceInHours(parseISO(entry.planned_end_time), parseISO(entry.planned_start_time));
          if (hours > 0) projectStats[projectId].hours += hours;
        } catch (e) {}
      }
    });

    return Object.values(projectStats)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [filteredEntries, projects, customers]);

  const statusDistribution = useMemo(() => {
    return [
      { name: 'Open', value: kpis.open, color: COLORS[3] },
      { name: 'Closed', value: kpis.closed, color: COLORS[4] },
    ].filter(s => s.value > 0);
  }, [kpis]);

  const timelineData = useMemo(() => {
    const dailyStats = {};
    filteredEntries.forEach(entry => {
      if (!entry.planned_start_time) return;
      try {
        const date = format(parseISO(entry.planned_start_time), 'MMM dd');
        if (!dailyStats[date]) {
          dailyStats[date] = { date, total: 0, closed: 0, hours: 0 };
        }
        dailyStats[date].total++;
        if (entry.status === 'closed') dailyStats[date].closed++;
        
        if (entry.planned_start_time && entry.planned_end_time) {
          try {
            const hours = differenceInHours(parseISO(entry.planned_end_time), parseISO(entry.planned_start_time));
            if (hours > 0) dailyStats[date].hours += hours;
          } catch (e) {}
        }
      } catch (e) {}
    });
    return Object.values(dailyStats).sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [filteredEntries]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Analytics Dashboard</h1>
            <p className="text-slate-600 mt-1">Business insights and performance metrics</p>
          </div>
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Last 7 Days</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white border-0">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-indigo-100 text-sm font-medium">Work Orders</p>
                  <p className="text-4xl font-bold mt-2">{kpis.total}</p>
                  <p className="text-indigo-200 text-xs mt-1">{kpis.closed} closed</p>
                </div>
                <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
                  <Activity className="w-7 h-7" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white border-0">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-green-100 text-sm font-medium">Completion Rate</p>
                  <p className="text-4xl font-bold mt-2">{kpis.completionRate}%</p>
                  <div className="flex items-center gap-1 mt-1">
                    <TrendingUp className="w-3 h-3 text-green-200" />
                    <p className="text-green-200 text-xs">On track</p>
                  </div>
                </div>
                <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
                  <CheckCircle className="w-7 h-7" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-blue-100 text-sm font-medium">Total Hours</p>
                  <p className="text-4xl font-bold mt-2">{kpis.totalHours.toLocaleString()}</p>
                  <p className="text-blue-200 text-xs mt-1">Across all orders</p>
                </div>
                <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
                  <Clock className="w-7 h-7" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-0">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-purple-100 text-sm font-medium">Active Resources</p>
                  <p className="text-4xl font-bold mt-2">{kpis.activeTeams}</p>
                  <p className="text-purple-200 text-xs mt-1">{kpis.activeUsers} users · {kpis.activeProjects} projects</p>
                </div>
                <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
                  <Users className="w-7 h-7" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Status Distribution */}
          <Card className="shadow-lg">
            <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-slate-100">
              <CardTitle className="text-lg flex items-center gap-2">
                <Target className="w-5 h-5 text-indigo-600" />
                Status Distribution
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={statusDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {statusDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Team Performance */}
          <Card className="shadow-lg">
            <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-slate-100">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-600" />
                Team Performance
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={teamPerformance}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                  />
                  <Legend />
                  <Bar dataKey="total" fill={COLORS[0]} name="Total" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="closed" fill={COLORS[4]} name="Closed" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Timeline Chart */}
        <Card className="shadow-lg">
          <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-slate-100">
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-600" />
              Work Orders Timeline
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <ResponsiveContainer width="100%" height={350}>
              <AreaChart data={timelineData}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS[0]} stopOpacity={0.8}/>
                    <stop offset="95%" stopColor={COLORS[0]} stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorClosed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS[4]} stopOpacity={0.8}/>
                    <stop offset="95%" stopColor={COLORS[4]} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                />
                <Legend />
                <Area type="monotone" dataKey="total" stroke={COLORS[0]} fillOpacity={1} fill="url(#colorTotal)" name="Total" />
                <Area type="monotone" dataKey="closed" stroke={COLORS[4]} fillOpacity={1} fill="url(#colorClosed)" name="Closed" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Tables */}
        <div className="grid grid-cols-1 gap-6">
          {/* Team Stats Table */}
          <Card className="shadow-lg">
            <CardHeader className="border-b bg-gradient-to-r from-indigo-50 to-purple-50">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-600" />
                Team Performance Statistics
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b-2 border-indigo-200">
                      <th className="text-left p-4 text-sm font-bold text-slate-700">Team</th>
                      <th className="text-right p-4 text-sm font-bold text-slate-700">Total Orders</th>
                      <th className="text-right p-4 text-sm font-bold text-slate-700">Closed</th>
                      <th className="text-right p-4 text-sm font-bold text-slate-700">Completion %</th>
                      <th className="text-right p-4 text-sm font-bold text-slate-700">Hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamPerformance.map((team, idx) => (
                      <tr key={idx} className="border-b border-slate-100 hover:bg-indigo-50/50 transition-colors">
                        <td className="p-4 text-sm font-semibold text-slate-800">{team.name}</td>
                        <td className="p-4 text-sm text-right">
                          <Badge variant="outline" className="font-semibold">{team.total}</Badge>
                        </td>
                        <td className="p-4 text-sm text-right">
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">{team.closed}</Badge>
                        </td>
                        <td className="p-4 text-sm text-right">
                          <Badge 
                            className={cn(
                              "font-semibold",
                              parseFloat(team.completionRate) > 80 
                                ? "bg-green-500 hover:bg-green-500" 
                                : parseFloat(team.completionRate) > 50
                                ? "bg-yellow-500 hover:bg-yellow-500"
                                : "bg-red-500 hover:bg-red-500"
                            )}
                          >
                            {team.completionRate}%
                          </Badge>
                        </td>
                        <td className="p-4 text-sm text-right font-semibold text-indigo-600">{team.hours}h</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Projects Table */}
          <Card className="shadow-lg">
            <CardHeader className="border-b bg-gradient-to-r from-blue-50 to-indigo-50">
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-600" />
                Top Projects by Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b-2 border-blue-200">
                      <th className="text-left p-4 text-sm font-bold text-slate-700">Project</th>
                      <th className="text-left p-4 text-sm font-bold text-slate-700">Customer</th>
                      <th className="text-right p-4 text-sm font-bold text-slate-700">Total Orders</th>
                      <th className="text-right p-4 text-sm font-bold text-slate-700">Closed</th>
                      <th className="text-right p-4 text-sm font-bold text-slate-700">Hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projectMetrics.map((proj, idx) => (
                      <tr key={idx} className="border-b border-slate-100 hover:bg-blue-50/50 transition-colors">
                        <td className="p-4 text-sm font-semibold text-slate-800">{proj.name}</td>
                        <td className="p-4 text-sm text-slate-600">{proj.customer}</td>
                        <td className="p-4 text-sm text-right">
                          <Badge variant="outline" className="font-semibold">{proj.total}</Badge>
                        </td>
                        <td className="p-4 text-sm text-right">
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">{proj.closed}</Badge>
                        </td>
                        <td className="p-4 text-sm text-right font-semibold text-blue-600">{proj.hours}h</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}