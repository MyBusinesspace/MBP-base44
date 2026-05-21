import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '@/components/DataProvider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  BarChart, Bar, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, AreaChart, Area, RadarChart,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ComposedChart,
} from 'recharts';
import {
  Calendar as CalendarIcon, Download, TrendingUp, TrendingDown, Clock,
  DollarSign, Activity, CheckCircle, Loader2, Settings, History,
  Briefcase, Package, BarChart3,
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, parseISO, differenceInHours, differenceInDays, startOfDay, endOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import OvertimeReport from '@/components/reports/OvertimeReport';
import CustomReportExplorer from '@/components/reports/CustomReportExplorer';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#14b8a6', '#f97316'];

export default function ReportsAnalytics() {
  const { currentUser, loadProjects, loadUsers, loadCustomers, teams, loadWorkOrderCategories, loadShiftTypes } = useData();

  const [entries, setEntries] = useState([]);
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [timesheets, setTimesheets] = useState([]);
  const [payrollProfiles, setPayrollProfiles] = useState([]);
  const [assets, setAssets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const [dateRange, setDateRange] = useState('month');
  const [startDate, setStartDate] = useState(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState(endOfMonth(new Date()));
  const [compareWithPrevious, setCompareWithPrevious] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (dateRange === 'month') {
      setStartDate(startOfMonth(new Date()));
      setEndDate(endOfMonth(new Date()));
    } else if (dateRange === 'year') {
      setStartDate(startOfYear(new Date()));
      setEndDate(endOfYear(new Date()));
    } else if (dateRange === 'week') {
      const today = new Date();
      setStartDate(startOfDay(new Date(today.setDate(today.getDate() - 7))));
      setEndDate(endOfDay(new Date()));
    }
  }, [dateRange]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [entriesData, projectsData, usersData, customersData, categoriesData, timesheetsData, payrollProfilesData, assetsData] = await Promise.all([
        base44.entities.TimeEntry.list('-updated_date', 10000),
        loadProjects(),
        loadUsers(),
        loadCustomers(),
        loadWorkOrderCategories(),
        base44.entities.TimesheetEntry.list('-created_date', 10000),
        base44.entities.EmployeePayrollProfile.list(),
        base44.entities.Asset.list(),
      ]);
      setEntries(entriesData || []);
      setProjects(projectsData || []);
      setUsers(usersData || []);
      setCustomers(customersData || []);
      setCategories(categoriesData || []);
      setTimesheets(timesheetsData || []);
      setPayrollProfiles(payrollProfilesData || []);
      setAssets(assetsData || []);
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('Failed to load reports data');
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
      } catch { return false; }
    });
  }, [entries, startDate, endDate]);

  const filteredTimesheets = useMemo(() => {
    return timesheets.filter(timesheet => {
      if (!timesheet.clock_in_time) return false;
      try {
        const clockInDate = parseISO(timesheet.clock_in_time);
        return clockInDate >= startDate && clockInDate <= endDate;
      } catch { return false; }
    });
  }, [timesheets, startDate, endDate]);

  const previousPeriodEntries = useMemo(() => {
    if (!compareWithPrevious) return [];
    const periodLength = endDate.getTime() - startDate.getTime();
    const prevStart = new Date(startDate.getTime() - periodLength);
    const prevEnd = new Date(endDate.getTime() - periodLength);
    return entries.filter(entry => {
      if (!entry.planned_start_time) return false;
      try {
        const entryDate = parseISO(entry.planned_start_time);
        return entryDate >= prevStart && entryDate <= prevEnd;
      } catch { return false; }
    });
  }, [entries, startDate, endDate, compareWithPrevious]);

  const kpis = useMemo(() => {
    const total = filteredEntries.length;
    const closed = filteredEntries.filter(e => e.status === 'closed').length;
    const ongoing = filteredEntries.filter(e => e.status === 'ongoing').length;
    const onQueue = filteredEntries.filter(e => e.status === 'on_queue').length;
    let totalHours = 0, totalCost = 0, completedOnTime = 0, totalCompleted = 0, totalDelayHours = 0, avgCompletionDays = 0;

    filteredEntries.forEach(entry => {
      if (entry.planned_start_time && entry.planned_end_time) {
        try {
          const hours = differenceInHours(parseISO(entry.planned_end_time), parseISO(entry.planned_start_time));
          if (hours > 0) { totalHours += hours; totalCost += hours * 25; }
        } catch (e) {}
      }
      if (entry.status === 'closed') {
        totalCompleted++;
        if (entry.planned_end_time && entry.end_time) {
          try {
            const plannedEnd = parseISO(entry.planned_end_time);
            const actualEnd = parseISO(entry.end_time);
            if (actualEnd <= plannedEnd) completedOnTime++;
            else totalDelayHours += differenceInHours(actualEnd, plannedEnd);
          } catch (e) {}
        }
      }
    });

    let prevTotal = 0, prevClosed = 0, prevHours = 0, prevCost = 0;
    if (compareWithPrevious) {
      prevTotal = previousPeriodEntries.length;
      prevClosed = previousPeriodEntries.filter(e => e.status === 'closed').length;
      previousPeriodEntries.forEach(entry => {
        if (entry.planned_start_time && entry.planned_end_time) {
          try {
            const hours = differenceInHours(parseISO(entry.planned_end_time), parseISO(entry.planned_start_time));
            if (hours > 0) { prevHours += hours; prevCost += hours * 25; }
          } catch (e) {}
        }
      });
    }

    return {
      total, closed, ongoing, onQueue,
      completionRate: total > 0 ? ((closed / total) * 100).toFixed(1) : 0,
      onTimeRate: totalCompleted > 0 ? ((completedOnTime / totalCompleted) * 100).toFixed(1) : 0,
      totalHours: Math.round(totalHours),
      totalCost: Math.round(totalCost),
      avgCompletionDays: totalCompleted > 0 ? (avgCompletionDays / totalCompleted).toFixed(1) : 0,
      totalDelayHours: Math.round(totalDelayHours),
      activeTeams: new Set(filteredEntries.flatMap(e => e.team_ids || [])).size,
      activeUsers: new Set(filteredEntries.flatMap(e => e.employee_ids || [])).size,
      activeProjects: new Set(filteredEntries.map(e => e.project_id).filter(Boolean)).size,
      totalChange: prevTotal > 0 ? (((total - prevTotal) / prevTotal) * 100).toFixed(1) : 0,
      closedChange: prevClosed > 0 ? (((closed - prevClosed) / prevClosed) * 100).toFixed(1) : 0,
      hoursChange: prevHours > 0 ? (((totalHours - prevHours) / prevHours) * 100).toFixed(1) : 0,
      costChange: prevCost > 0 ? (((totalCost - prevCost) / prevCost) * 100).toFixed(1) : 0,
    };
  }, [filteredEntries, previousPeriodEntries, compareWithPrevious]);

  const teamPerformance = useMemo(() => {
    const teamStats = {};
    filteredEntries.forEach(entry => {
      (entry.team_ids || []).forEach(teamId => {
        if (!teamStats[teamId]) {
          const team = teams.find(t => t.id === teamId);
          teamStats[teamId] = { id: teamId, name: team?.name || 'Unknown', total: 0, closed: 0, ongoing: 0, hours: 0, cost: 0, onTime: 0, delayed: 0 };
        }
        teamStats[teamId].total++;
        if (entry.status === 'closed') {
          teamStats[teamId].closed++;
          if (entry.planned_end_time && entry.end_time) {
            try {
              if (parseISO(entry.end_time) <= parseISO(entry.planned_end_time)) teamStats[teamId].onTime++;
              else teamStats[teamId].delayed++;
            } catch (e) {}
          }
        }
        if (entry.status === 'ongoing') teamStats[teamId].ongoing++;
        if (entry.planned_start_time && entry.planned_end_time) {
          try {
            const hours = differenceInHours(parseISO(entry.planned_end_time), parseISO(entry.planned_start_time));
            if (hours > 0) { teamStats[teamId].hours += hours; teamStats[teamId].cost += hours * 25; }
          } catch (e) {}
        }
      });
    });
    return Object.values(teamStats).map(team => ({
      ...team,
      completionRate: team.total > 0 ? ((team.closed / team.total) * 100).toFixed(1) : 0,
      onTimeRate: team.closed > 0 ? ((team.onTime / team.closed) * 100).toFixed(1) : 0,
      avgHoursPerWO: team.total > 0 ? (team.hours / team.total).toFixed(1) : 0,
    })).sort((a, b) => b.total - a.total);
  }, [filteredEntries, teams]);

  const userPerformance = useMemo(() => {
    const userStats = {};
    filteredEntries.forEach(entry => {
      (entry.employee_ids || []).forEach(userId => {
        if (!userStats[userId]) {
          const user = users.find(u => u.id === userId);
          userStats[userId] = { id: userId, name: user?.nickname || user?.full_name || 'Unknown', total: 0, closed: 0, hours: 0, cost: 0, onTime: 0 };
        }
        userStats[userId].total++;
        if (entry.status === 'closed') {
          userStats[userId].closed++;
          if (entry.planned_end_time && entry.end_time) {
            try { if (parseISO(entry.end_time) <= parseISO(entry.planned_end_time)) userStats[userId].onTime++; } catch (e) {}
          }
        }
        if (entry.planned_start_time && entry.planned_end_time) {
          try {
            const hours = differenceInHours(parseISO(entry.planned_end_time), parseISO(entry.planned_start_time));
            if (hours > 0) { userStats[userId].hours += hours; userStats[userId].cost += hours * 25; }
          } catch (e) {}
        }
      });
    });
    return Object.values(userStats).map(user => ({
      ...user,
      completionRate: user.total > 0 ? ((user.closed / user.total) * 100).toFixed(1) : 0,
      onTimeRate: user.closed > 0 ? ((user.onTime / user.closed) * 100).toFixed(1) : 0,
    })).sort((a, b) => b.total - a.total).slice(0, 20);
  }, [filteredEntries, users]);

  const projectMetrics = useMemo(() => {
    const projectStats = {};
    filteredEntries.forEach(entry => {
      const projectId = entry.project_id;
      if (!projectId) return;
      if (!projectStats[projectId]) {
        const project = projects.find(p => p.id === projectId);
        const customer = customers.find(c => c.id === project?.customer_id);
        projectStats[projectId] = { id: projectId, name: project?.name || 'Unknown', customer: customer?.name || '-', total: 0, closed: 0, hours: 0, cost: 0, avgDuration: 0, durationCount: 0 };
      }
      projectStats[projectId].total++;
      if (entry.status === 'closed') projectStats[projectId].closed++;
      if (entry.planned_start_time && entry.planned_end_time) {
        try {
          const hours = differenceInHours(parseISO(entry.planned_end_time), parseISO(entry.planned_start_time));
          if (hours > 0) { projectStats[projectId].hours += hours; projectStats[projectId].cost += hours * 25; projectStats[projectId].avgDuration += hours; projectStats[projectId].durationCount++; }
        } catch (e) {}
      }
    });
    return Object.values(projectStats).map(proj => ({
      ...proj,
      completionRate: proj.total > 0 ? ((proj.closed / proj.total) * 100).toFixed(1) : 0,
      avgDuration: proj.durationCount > 0 ? (proj.avgDuration / proj.durationCount).toFixed(1) : 0,
    })).sort((a, b) => b.total - a.total).slice(0, 15);
  }, [filteredEntries, projects, customers]);

  const statusDistribution = useMemo(() => [
    { name: 'On Queue', value: kpis.onQueue, color: COLORS[3] },
    { name: 'Ongoing', value: kpis.ongoing, color: COLORS[5] },
    { name: 'Closed', value: kpis.closed, color: COLORS[4] },
  ].filter(s => s.value > 0), [kpis]);

  const categoryDistribution = useMemo(() => {
    const catStats = {};
    filteredEntries.forEach(entry => {
      const catId = entry.work_order_category_id;
      if (!catId) { catStats['Uncategorized'] = (catStats['Uncategorized'] || 0) + 1; return; }
      const cat = categories.find(c => c.id === catId);
      const catName = cat?.name || 'Unknown';
      catStats[catName] = (catStats[catName] || 0) + 1;
    });
    return Object.entries(catStats).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filteredEntries, categories]);

  const timelineData = useMemo(() => {
    const dailyStats = {};
    filteredEntries.forEach(entry => {
      if (!entry.planned_start_time) return;
      try {
        const date = format(parseISO(entry.planned_start_time), 'MMM dd');
        if (!dailyStats[date]) dailyStats[date] = { date, total: 0, closed: 0, ongoing: 0, hours: 0 };
        dailyStats[date].total++;
        if (entry.status === 'closed') dailyStats[date].closed++;
        if (entry.status === 'ongoing') dailyStats[date].ongoing++;
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

  const efficiencyMetrics = useMemo(() => teamPerformance.map(team => ({
    team: team.name,
    efficiency: parseFloat(team.completionRate),
    onTime: parseFloat(team.onTimeRate),
    productivity: team.total,
  })).slice(0, 6), [teamPerformance]);

  const laborCostsByProject = useMemo(() => {
    const projectCosts = {};
    filteredTimesheets.forEach(timesheet => {
      const profile = payrollProfiles.find(p => p.employee_id === timesheet.employee_id);
      if (!profile) return;
      const hourlyRate = profile.ordinary_hourly_rate || 0;
      const overtimeRate = profile.overtime_hourly_rate || (hourlyRate * 1.5);
      const regularHours = timesheet.regular_hours_calculated || 0;
      const overtimeHours = (timesheet.overtime_hours_paid_calculated || 0) + (timesheet.overtime_hours_non_paid_calculated || 0);
      (timesheet.work_order_segments || []).forEach(segment => {
        const workOrder = entries.find(e => e.id === segment.work_order_id);
        if (!workOrder || !workOrder.project_id) return;
        const projectId = workOrder.project_id;
        if (!projectCosts[projectId]) {
          const project = projects.find(p => p.id === projectId);
          const customer = customers.find(c => c.id === project?.customer_id);
          projectCosts[projectId] = { id: projectId, name: project?.name || 'Unknown', customer: customer?.name || 'Unknown', regularHours: 0, overtimeHours: 0, regularCost: 0, overtimeCost: 0, totalCost: 0 };
        }
        const proportion = (timesheet.total_duration_minutes || 1) > 0 ? (segment.duration_minutes || 0) / (timesheet.total_duration_minutes || 1) : 0;
        const segRH = regularHours * proportion;
        const segOH = overtimeHours * proportion;
        projectCosts[projectId].regularHours += segRH;
        projectCosts[projectId].overtimeHours += segOH;
        projectCosts[projectId].regularCost += segRH * hourlyRate;
        projectCosts[projectId].overtimeCost += segOH * overtimeRate;
        projectCosts[projectId].totalCost += (segRH * hourlyRate) + (segOH * overtimeRate);
      });
    });
    return Object.values(projectCosts).sort((a, b) => b.totalCost - a.totalCost).slice(0, 15);
  }, [filteredTimesheets, payrollProfiles, entries, projects, customers]);

  const totalLaborCosts = useMemo(() => ({
    regularHours: laborCostsByProject.reduce((sum, p) => sum + p.regularHours, 0),
    overtimeHours: laborCostsByProject.reduce((sum, p) => sum + p.overtimeHours, 0),
    regularCost: laborCostsByProject.reduce((sum, p) => sum + p.regularCost, 0),
    overtimeCost: laborCostsByProject.reduce((sum, p) => sum + p.overtimeCost, 0),
    totalCost: laborCostsByProject.reduce((sum, p) => sum + p.totalCost, 0),
  }), [laborCostsByProject]);

  const assetMetrics = useMemo(() => {
    const calculateDepreciation = (asset) => {
      if (!asset.purchase_cost || !asset.purchase_date) return { currentValue: asset.purchase_cost || 0, accumulatedDepreciation: 0 };
      const purchaseCost = asset.purchase_cost;
      const salvageValue = asset.salvage_value || 0;
      const usefulLife = asset.useful_life_years || 5;
      const method = asset.depreciation_method || 'Straight Line';
      const yearsElapsed = Math.max(0, (new Date() - new Date(asset.purchase_date)) / (1000 * 60 * 60 * 24)) / 365.25;
      if (method === 'No Depreciation') return { currentValue: purchaseCost, accumulatedDepreciation: 0 };
      if (method === 'Straight Line') {
        const annualDep = (purchaseCost - salvageValue) / usefulLife;
        const accum = Math.min(annualDep * yearsElapsed, purchaseCost - salvageValue);
        return { currentValue: Math.max(purchaseCost - accum, salvageValue), accumulatedDepreciation: accum };
      }
      const multiplier = method === 'Double Declining Balance' ? 2 : 1.5;
      const rate = multiplier / usefulLife;
      let bookValue = purchaseCost, accum = 0;
      for (let i = 0; i < Math.floor(yearsElapsed); i++) {
        const dep = bookValue * rate;
        accum += dep; bookValue -= dep;
        if (bookValue <= salvageValue) { bookValue = salvageValue; break; }
      }
      const partial = yearsElapsed - Math.floor(yearsElapsed);
      if (partial > 0 && bookValue > salvageValue) {
        const pd = bookValue * rate * partial; accum += pd; bookValue -= pd;
      }
      return { currentValue: Math.max(bookValue, salvageValue), accumulatedDepreciation: Math.min(accum, purchaseCost - salvageValue) };
    };

    let totalPurchaseCost = 0, totalCurrentValue = 0, totalSalvageValue = 0, totalDepreciation = 0;
    const assetsByCategory = {}, assetsByStatus = {};
    assets.forEach(asset => {
      const qty = asset.quantity || 1;
      totalPurchaseCost += (asset.purchase_cost || 0) * qty;
      totalSalvageValue += (asset.salvage_value || 0) * qty;
      const dep = calculateDepreciation(asset);
      totalCurrentValue += dep.currentValue * qty;
      totalDepreciation += dep.accumulatedDepreciation * qty;
      const category = asset.category || 'Other';
      if (!assetsByCategory[category]) assetsByCategory[category] = { name: category, count: 0, purchaseCost: 0, currentValue: 0, depreciation: 0, salvageValue: 0 };
      assetsByCategory[category].count += qty;
      assetsByCategory[category].purchaseCost += (asset.purchase_cost || 0) * qty;
      assetsByCategory[category].currentValue += dep.currentValue * qty;
      assetsByCategory[category].depreciation += dep.accumulatedDepreciation * qty;
      assetsByCategory[category].salvageValue += (asset.salvage_value || 0) * qty;
      const status = asset.status || 'Available';
      if (!assetsByStatus[status]) assetsByStatus[status] = { name: status, count: 0, purchaseCost: 0, currentValue: 0 };
      assetsByStatus[status].count += qty;
      assetsByStatus[status].purchaseCost += (asset.purchase_cost || 0) * qty;
      assetsByStatus[status].currentValue += dep.currentValue * qty;
    });
    return {
      totalPurchaseCost, totalCurrentValue, totalSalvageValue, totalDepreciation, totalAssets: assets.length,
      byCategory: Object.values(assetsByCategory).sort((a, b) => b.currentValue - a.currentValue),
      byStatus: Object.values(assetsByStatus).sort((a, b) => b.count - a.count),
    };
  }, [assets]);

  const TrendIndicator = ({ value }) => {
    const numValue = parseFloat(value);
    if (!compareWithPrevious || isNaN(numValue) || numValue === 0) return null;
    const isPositive = numValue > 0;
    return (
      <span className={cn("text-xs font-medium flex items-center gap-1", isPositive ? "text-green-600" : "text-red-600")}>
        {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
        {Math.abs(numValue)}%
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}>
            <Settings className="w-4 h-4 mr-2" />
            Filters
          </Button>
          <Badge variant="secondary">{filteredEntries.length} work orders</Badge>
        </div>
        <Button onClick={() => {}} disabled={isExporting} size="sm" className="bg-indigo-600 hover:bg-indigo-700">
          {isExporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      {showAdvancedFilters && (
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Date Range</Label>
                <Select value={dateRange} onValueChange={setDateRange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="week">Last 7 Days</SelectItem>
                    <SelectItem value="month">This Month</SelectItem>
                    <SelectItem value="year">This Year</SelectItem>
                    <SelectItem value="custom">Custom Range</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {dateRange === 'custom' && (
                <>
                  <div>
                    <Label>Start Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start">
                          <CalendarIcon className="w-4 h-4 mr-2" />{format(startDate, 'MMM d, yyyy')}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar mode="single" selected={startDate} onSelect={setStartDate} />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <Label>End Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start">
                          <CalendarIcon className="w-4 h-4 mr-2" />{format(endDate, 'MMM d, yyyy')}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar mode="single" selected={endDate} onSelect={setEndDate} />
                      </PopoverContent>
                    </Popover>
                  </div>
                </>
              )}
              <div className="flex items-center space-x-2">
                <Switch id="compare" checked={compareWithPrevious} onCheckedChange={setCompareWithPrevious} />
                <Label htmlFor="compare" className="cursor-pointer">Compare with previous period</Label>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div><p className="text-sm font-medium text-slate-600">Total Work Orders</p>
              <p className="text-3xl font-bold text-slate-900 mt-2">{kpis.total}</p>
              <div className="flex items-center gap-2 mt-1"><p className="text-xs text-slate-500">{kpis.closed} closed · {kpis.ongoing} ongoing</p><TrendIndicator value={kpis.totalChange} /></div>
            </div>
            <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center"><Activity className="w-6 h-6 text-indigo-600" /></div>
          </div>
        </CardContent></Card>

        <Card><CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div><p className="text-sm font-medium text-slate-600">Completion Rate</p>
              <p className="text-3xl font-bold text-slate-900 mt-2">{kpis.completionRate}%</p>
              <div className="flex items-center gap-2 mt-1"><p className="text-xs text-slate-500">On-time: {kpis.onTimeRate}%</p><TrendIndicator value={kpis.closedChange} /></div>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center"><CheckCircle className="w-6 h-6 text-green-600" /></div>
          </div>
        </CardContent></Card>

        <Card><CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div><p className="text-sm font-medium text-slate-600">Total WO Hours</p>
              <p className="text-3xl font-bold text-slate-900 mt-2">{kpis.totalHours.toLocaleString()}</p>
              <div className="flex items-center gap-2 mt-1"><p className="text-xs text-slate-500">{kpis.totalDelayHours}h delay</p><TrendIndicator value={kpis.hoursChange} /></div>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center"><Clock className="w-6 h-6 text-blue-600" /></div>
          </div>
        </CardContent></Card>

        <Card><CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div><p className="text-sm font-medium text-slate-600">Total Labor Cost</p>
              <p className="text-3xl font-bold text-slate-900 mt-2">${totalLaborCosts.totalCost.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
              <p className="text-xs text-slate-500 mt-1">{totalLaborCosts.regularHours.toFixed(1)}h reg · {totalLaborCosts.overtimeHours.toFixed(1)}h OT</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center"><Briefcase className="w-6 h-6 text-purple-600" /></div>
          </div>
        </CardContent></Card>
      </div>

      {/* Analytics Tabs */}
      <Tabs defaultValue="overtime" className="space-y-4">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="teams">Teams</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="projects">Projects</TabsTrigger>
          <TabsTrigger value="labor-costs">Labor Costs</TabsTrigger>
          <TabsTrigger value="overtime" className="text-amber-700 font-semibold">Overtime</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card><CardHeader><CardTitle className="text-lg">Status Distribution</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={statusDistribution} cx="50%" cy="50%" labelLine={false} label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`} outerRadius={100} dataKey="value">
                      {statusDistribution.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card><CardHeader><CardTitle className="text-lg">Category Distribution</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={categoryDistribution}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Bar dataKey="value" fill={COLORS[0]} /></BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card><CardHeader><CardTitle className="text-lg">Team Efficiency Radar</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart data={efficiencyMetrics}><PolarGrid /><PolarAngleAxis dataKey="team" /><PolarRadiusAxis angle={90} domain={[0, 100]} />
                    <Radar name="Efficiency" dataKey="efficiency" stroke={COLORS[0]} fill={COLORS[0]} fillOpacity={0.6} />
                    <Radar name="On-Time %" dataKey="onTime" stroke={COLORS[4]} fill={COLORS[4]} fillOpacity={0.6} />
                    <Tooltip /><Legend />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card><CardHeader><CardTitle className="text-lg">Resource Utilization</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[{ label: 'Active Teams', value: kpis.activeTeams, total: teams.length, color: 'bg-indigo-600' },
                    { label: 'Active Users', value: kpis.activeUsers, total: users.length, color: 'bg-blue-600' },
                    { label: 'Active Projects', value: kpis.activeProjects, total: projects.length, color: 'bg-green-600' }].map(item => (
                    <div key={item.label}>
                      <div className="flex justify-between text-sm mb-2"><span className="text-slate-600">{item.label}</span><span className="font-semibold">{item.value} / {item.total}</span></div>
                      <div className="w-full bg-slate-200 rounded-full h-2"><div className={`${item.color} h-2 rounded-full`} style={{ width: `${item.total > 0 ? (item.value / item.total) * 100 : 0}%` }} /></div>
                    </div>
                  ))}
                  <div className="pt-4 border-t grid grid-cols-2 gap-4">
                    <div><p className="text-xs text-slate-600 mb-1">Avg Completion Time</p><p className="text-2xl font-bold text-slate-900">{kpis.avgCompletionDays}d</p></div>
                    <div><p className="text-xs text-slate-600 mb-1">Total Delay Hours</p><p className="text-2xl font-bold text-red-600">{kpis.totalDelayHours}h</p></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="teams" className="space-y-4">
          <Card><CardHeader><CardTitle className="text-lg">Team Performance</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <ComposedChart data={teamPerformance}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis yAxisId="left" /><YAxis yAxisId="right" orientation="right" /><Tooltip /><Legend />
                  <Bar yAxisId="left" dataKey="total" fill={COLORS[0]} name="Total WOs" />
                  <Bar yAxisId="left" dataKey="closed" fill={COLORS[4]} name="Closed" />
                  <Line yAxisId="right" type="monotone" dataKey="onTimeRate" stroke={COLORS[2]} strokeWidth={2} name="On-Time %" />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card><CardHeader><CardTitle className="text-lg">Detailed Team Statistics</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50"><tr>
                    {['Team','Total','Closed','Ongoing','Completion %','On-Time %','Avg h/WO','Cost'].map(h => <th key={h} className="text-left p-3 text-sm font-semibold text-slate-700">{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {teamPerformance.map((team, idx) => (
                      <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="p-3 text-sm font-medium">{team.name}</td>
                        <td className="p-3 text-sm text-right">{team.total}</td>
                        <td className="p-3 text-sm text-right">{team.closed}</td>
                        <td className="p-3 text-sm text-right">{team.ongoing}</td>
                        <td className="p-3 text-sm text-right"><Badge variant={parseFloat(team.completionRate) > 80 ? 'default' : 'secondary'}>{team.completionRate}%</Badge></td>
                        <td className="p-3 text-sm text-right"><Badge variant={parseFloat(team.onTimeRate) > 80 ? 'default' : 'secondary'}>{team.onTimeRate}%</Badge></td>
                        <td className="p-3 text-sm text-right">{team.avgHoursPerWO}h</td>
                        <td className="p-3 text-sm text-right font-semibold">${team.cost.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <Card><CardHeader><CardTitle className="text-lg">User Performance (Top 20)</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={500}>
                <BarChart data={userPerformance} layout="vertical"><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" /><YAxis dataKey="name" type="category" width={120} /><Tooltip /><Legend />
                  <Bar dataKey="total" fill={COLORS[1]} name="Total WOs" />
                  <Bar dataKey="closed" fill={COLORS[4]} name="Closed" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card><CardHeader><CardTitle className="text-lg">User Statistics</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50"><tr>
                    {['User','Total WOs','Closed','Completion %','On-Time %','Hours','WO Cost'].map(h => <th key={h} className="text-left p-3 text-sm font-semibold text-slate-700">{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {userPerformance.map((user, idx) => (
                      <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="p-3 text-sm font-medium">{user.name}</td>
                        <td className="p-3 text-sm text-right">{user.total}</td>
                        <td className="p-3 text-sm text-right">{user.closed}</td>
                        <td className="p-3 text-sm text-right"><Badge variant={parseFloat(user.completionRate) > 80 ? 'default' : 'secondary'}>{user.completionRate}%</Badge></td>
                        <td className="p-3 text-sm text-right"><Badge variant={parseFloat(user.onTimeRate) > 80 ? 'default' : 'secondary'}>{user.onTimeRate}%</Badge></td>
                        <td className="p-3 text-sm text-right">{user.hours}h</td>
                        <td className="p-3 text-sm text-right">${user.cost.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="projects" className="space-y-4">
          <Card><CardHeader><CardTitle className="text-lg">Top 15 Projects by Activity</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={500}>
                <BarChart data={projectMetrics} layout="vertical"><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" /><YAxis dataKey="name" type="category" width={180} /><Tooltip /><Legend />
                  <Bar dataKey="total" fill={COLORS[1]} name="Total WOs" />
                  <Bar dataKey="closed" fill={COLORS[4]} name="Closed" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card><CardHeader><CardTitle className="text-lg">Project Metrics</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50"><tr>
                    {['Project','Customer','Total WOs','Closed WOs','Avg Duration','WO Hours','WO Cost'].map(h => <th key={h} className="text-left p-3 text-sm font-semibold text-slate-700">{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {projectMetrics.map((proj, idx) => (
                      <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="p-3 text-sm font-medium">{proj.name}</td>
                        <td className="p-3 text-sm text-slate-600">{proj.customer}</td>
                        <td className="p-3 text-sm text-right">{proj.total}</td>
                        <td className="p-3 text-sm text-right">{proj.closed}</td>
                        <td className="p-3 text-sm text-right">{proj.avgDuration}h</td>
                        <td className="p-3 text-sm text-right">{proj.hours}h</td>
                        <td className="p-3 text-sm text-right font-semibold">${proj.cost.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="labor-costs" className="space-y-4">
          <Card><CardHeader><CardTitle className="text-lg">Labor Costs by Project</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={laborCostsByProject} layout="vertical"><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" /><YAxis dataKey="name" type="category" width={180} />
                  <Tooltip formatter={(v) => `$${v.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`} /><Legend />
                  <Bar dataKey="regularCost" fill={COLORS[0]} name="Regular Cost" />
                  <Bar dataKey="overtimeCost" fill={COLORS[6]} name="Overtime Cost" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card><CardHeader><CardTitle className="text-lg">Detailed Labor Costs by Project</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50"><tr>
                    {['Project','Customer','Reg. Hours','OT Hours','Reg. Cost','OT Cost','Total Cost'].map(h => <th key={h} className="text-left p-3 text-sm font-semibold text-slate-700">{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {laborCostsByProject.map((proj, idx) => (
                      <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="p-3 text-sm font-medium">{proj.name}</td>
                        <td className="p-3 text-sm text-slate-600">{proj.customer}</td>
                        <td className="p-3 text-sm text-right">{proj.regularHours.toFixed(1)}h</td>
                        <td className="p-3 text-sm text-right">{proj.overtimeHours.toFixed(1)}h</td>
                        <td className="p-3 text-sm text-right">${proj.regularCost.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                        <td className="p-3 text-sm text-right">${proj.overtimeCost.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                        <td className="p-3 text-sm text-right font-semibold">${proj.totalCost.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="overtime" className="space-y-4">
          <OvertimeReport timesheets={timesheets} users={users} />
        </TabsContent>

        <TabsContent value="timeline" className="space-y-4">
          <Card><CardHeader><CardTitle className="text-lg">Work Orders Over Time</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={timelineData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" /><YAxis /><Tooltip /><Legend />
                  <Area type="monotone" dataKey="total" stroke={COLORS[0]} fill={COLORS[0]} fillOpacity={0.3} name="Total" />
                  <Area type="monotone" dataKey="closed" stroke={COLORS[4]} fill={COLORS[4]} fillOpacity={0.3} name="Closed" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}