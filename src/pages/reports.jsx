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
  BarChart,
  Bar,
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
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ComposedChart,
} from 'recharts';
import {
  Calendar as CalendarIcon,
  Download,
  TrendingUp,
  TrendingDown,
  Clock,
  DollarSign,
  Activity,
  CheckCircle,
  Loader2,
  Settings,
  History,
  Briefcase,
  Package,
  BarChart3,
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, parseISO, differenceInHours, differenceInDays, startOfDay, endOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { TimeEntry, TimesheetEntry, EmployeePayrollProfile, Asset } from '@/entities/all';
import { createPageUrl } from '@/utils';
import { Link } from 'react-router-dom';
import ReportsSettingsPanel from '@/components/reports/ReportsSettingsPanel';
import CustomReportExplorer from '@/components/reports/CustomReportExplorer';
import OvertimeReport from '@/components/reports/OvertimeReport';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#14b8a6', '#f97316'];

export default function ReportsPage() {
  const {
    currentUser,
    loadProjects,
    loadUsers,
    loadCustomers,
    teams,
    loadWorkOrderCategories,
    loadShiftTypes,
    users: contextUsers,
  } = useData();

  const [entries, setEntries] = useState([]);
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [shiftTypes, setShiftTypes] = useState([]);
  const [timesheets, setTimesheets] = useState([]);
  const [payrollProfiles, setPayrollProfiles] = useState([]);
  const [assets, setAssets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const [dateRange, setDateRange] = useState('month');
  const [startDate, setStartDate] = useState(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState(endOfMonth(new Date()));
  const [selectedTeams, setSelectedTeams] = useState([]);
  const [selectedProjects, setSelectedProjects] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [compareWithPrevious, setCompareWithPrevious] = useState(false);
  
  const [reportType, setReportType] = useState('summary');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

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
      const [entriesData, projectsData, usersData, customersData, categoriesData, shiftTypesData, timesheetsData, payrollProfilesData, assetsData] = await Promise.all([
        TimeEntry.list('-updated_date', 10000),
        loadProjects(),
        loadUsers(true),
        loadCustomers(),
        loadWorkOrderCategories(),
        loadShiftTypes(),
        TimesheetEntry.list('-created_date', 10000),
        EmployeePayrollProfile.list(),
        Asset.list(),
      ]);

      setEntries(entriesData || []);
      setProjects(projectsData || []);
      // Merge: use loaded users + context users to get the fullest list
      const mergedUsers = [...(usersData || [])];
      (contextUsers || []).forEach(u => {
        if (u && u.id && !mergedUsers.find(m => m.id === u.id)) mergedUsers.push(u);
      });
      setUsers(mergedUsers.length > 0 ? mergedUsers : (usersData || []));
      setCustomers(customersData || []);
      setCategories(categoriesData || []);
      setShiftTypes(shiftTypesData || []);
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
        if (entryDate < startDate || entryDate > endDate) return false;
      } catch {
        return false;
      }

      if (selectedTeams.length > 0) {
        const entryTeams = entry.team_ids || [];
        if (!entryTeams.some(id => selectedTeams.includes(id))) return false;
      }

      if (selectedProjects.length > 0) {
        if (!selectedProjects.includes(entry.project_id)) return false;
      }

      if (selectedCategories.length > 0) {
        if (!selectedCategories.includes(entry.work_order_category_id)) return false;
      }

      if (selectedUsers.length > 0) {
        const entryUsers = entry.employee_ids || [];
        if (!entryUsers.some(id => selectedUsers.includes(id))) return false;
      }

      return true;
    });
  }, [entries, startDate, endDate, selectedTeams, selectedProjects, selectedCategories, selectedUsers]);

  const filteredTimesheets = useMemo(() => {
    return timesheets.filter(timesheet => {
      if (!timesheet.clock_in_time) return false;
      
      try {
        const clockInDate = parseISO(timesheet.clock_in_time);
        return clockInDate >= startDate && clockInDate <= endDate;
      } catch {
        return false;
      }
    });
  }, [timesheets, startDate, endDate]);

  const previousPeriodEntries = useMemo(() => {
    if (!compareWithPrevious) return [];
    
    const periodLength = endDate.getTime() - startDate.getTime(); // Use getTime() for milliseconds
    const prevStart = new Date(startDate.getTime() - periodLength);
    const prevEnd = new Date(endDate.getTime() - periodLength);

    return entries.filter(entry => {
      if (!entry.planned_start_time) return false;
      try {
        const entryDate = parseISO(entry.planned_start_time);
        return entryDate >= prevStart && entryDate <= prevEnd;
      } catch {
        return false;
      }
    });
  }, [entries, startDate, endDate, compareWithPrevious]);

  const kpis = useMemo(() => {
    const total = filteredEntries.length;
    const closed = filteredEntries.filter(e => e.status === 'closed').length;
    const ongoing = filteredEntries.filter(e => e.status === 'ongoing').length;
    const onQueue = filteredEntries.filter(e => e.status === 'on_queue').length;

    let totalHours = 0;
    let totalCost = 0; // This is WO-related cost, not labor
    let completedOnTime = 0;
    let totalCompleted = 0;
    let totalDelayHours = 0;
    let avgCompletionDays = 0;

    filteredEntries.forEach(entry => {
      if (entry.planned_start_time && entry.planned_end_time) {
        try {
          const start = parseISO(entry.planned_start_time);
          const end = parseISO(entry.planned_end_time);
          const hours = differenceInHours(end, start);
          if (hours > 0) {
            totalHours += hours;
            totalCost += hours * 25; // Assuming average WO cost per hour
          }
        } catch (e) {}
      }

      if (entry.status === 'closed') {
        totalCompleted++;
        if (entry.planned_start_time && entry.end_time) {
          try {
            const startDate = parseISO(entry.planned_start_time);
            const endDate = parseISO(entry.end_time);
            const days = differenceInDays(endDate, startDate);
            avgCompletionDays += days;
          } catch (e) {}
        }
        
        if (entry.planned_end_time && entry.end_time) {
          try {
            const plannedEnd = parseISO(entry.planned_end_time);
            const actualEnd = parseISO(entry.end_time);
            if (actualEnd <= plannedEnd) {
              completedOnTime++;
            } else {
              totalDelayHours += differenceInHours(actualEnd, plannedEnd);
            }
          } catch (e) {}
        }
      }
    });

    avgCompletionDays = totalCompleted > 0 ? (avgCompletionDays / totalCompleted).toFixed(1) : 0;

    const completionRate = total > 0 ? ((closed / total) * 100).toFixed(1) : 0;
    const onTimeRate = totalCompleted > 0 ? ((completedOnTime / totalCompleted) * 100).toFixed(1) : 0;

    // Previous period comparison
    let prevTotal = 0;
    let prevClosed = 0;
    let prevHours = 0;
    let prevCost = 0;

    if (compareWithPrevious) {
      prevTotal = previousPeriodEntries.length;
      prevClosed = previousPeriodEntries.filter(e => e.status === 'closed').length;
      
      previousPeriodEntries.forEach(entry => {
        if (entry.planned_start_time && entry.planned_end_time) {
          try {
            const hours = differenceInHours(parseISO(entry.planned_end_time), parseISO(entry.planned_start_time));
            if (hours > 0) {
              prevHours += hours;
              prevCost += hours * 25;
            }
          } catch (e) {}
        }
      });
    }

    return {
      total,
      closed,
      ongoing,
      onQueue,
      completionRate,
      onTimeRate,
      totalHours: Math.round(totalHours),
      totalCost: Math.round(totalCost),
      avgCompletionDays,
      totalDelayHours: Math.round(totalDelayHours),
      activeTeams: new Set(filteredEntries.flatMap(e => e.team_ids || [])).size,
      activeUsers: new Set(filteredEntries.flatMap(e => e.employee_ids || [])).size,
      activeProjects: new Set(filteredEntries.map(e => e.project_id).filter(Boolean)).size,
      // Comparisons
      totalChange: prevTotal > 0 ? (((total - prevTotal) / prevTotal) * 100).toFixed(1) : 0,
      closedChange: prevClosed > 0 ? (((closed - prevClosed) / prevClosed) * 100).toFixed(1) : 0,
      hoursChange: prevHours > 0 ? (((totalHours - prevHours) / prevHours) * 100).toFixed(1) : 0,
      costChange: prevCost > 0 ? (((totalCost - prevCost) / prevCost) * 100).toFixed(1) : 0,
    };
  }, [filteredEntries, previousPeriodEntries, compareWithPrevious]);

  const teamPerformance = useMemo(() => {
    const teamStats = {};

    filteredEntries.forEach(entry => {
      const entryTeams = entry.team_ids || [];
      entryTeams.forEach(teamId => {
        if (!teamStats[teamId]) {
          const team = teams.find(t => t.id === teamId);
          teamStats[teamId] = {
            id: teamId,
            name: team?.name || 'Unknown',
            total: 0,
            closed: 0,
            ongoing: 0,
            hours: 0,
            cost: 0,
            onTime: 0,
            delayed: 0,
          };
        }

        teamStats[teamId].total++;
        if (entry.status === 'closed') {
          teamStats[teamId].closed++;
          
          if (entry.planned_end_time && entry.end_time) {
            try {
              const plannedEnd = parseISO(entry.planned_end_time);
              const actualEnd = parseISO(entry.end_time);
              if (actualEnd <= plannedEnd) {
                teamStats[teamId].onTime++;
              } else {
                teamStats[teamId].delayed++;
              }
            } catch (e) {}
          }
        }
        if (entry.status === 'ongoing') teamStats[teamId].ongoing++;

        if (entry.planned_start_time && entry.planned_end_time) {
          try {
            const hours = differenceInHours(parseISO(entry.planned_end_time), parseISO(entry.planned_start_time));
            if (hours > 0) {
              teamStats[teamId].hours += hours;
              teamStats[teamId].cost += hours * 25;
            }
          } catch (e) {}
        }
      });
    });

    return Object.values(teamStats)
      .map(team => ({
        ...team,
        completionRate: team.total > 0 ? ((team.closed / team.total) * 100).toFixed(1) : 0,
        onTimeRate: team.closed > 0 ? ((team.onTime / team.closed) * 100).toFixed(1) : 0,
        avgHoursPerWO: team.total > 0 ? (team.hours / team.total).toFixed(1) : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [filteredEntries, teams]);

  const userPerformance = useMemo(() => {
    const userStats = {};

    filteredEntries.forEach(entry => {
      const entryUsers = entry.employee_ids || [];
      entryUsers.forEach(userId => {
        if (!userStats[userId]) {
          const user = users.find(u => u.id === userId);
          userStats[userId] = {
            id: userId,
            name: user?.nickname || user?.full_name || 'Unknown',
            total: 0,
            closed: 0,
            hours: 0,
            cost: 0,
            onTime: 0,
          };
        }

        userStats[userId].total++;
        if (entry.status === 'closed') {
          userStats[userId].closed++;
          
          if (entry.planned_end_time && entry.end_time) {
            try {
              const plannedEnd = parseISO(entry.planned_end_time);
              const actualEnd = parseISO(entry.end_time);
              if (actualEnd <= plannedEnd) {
                userStats[userId].onTime++;
              }
            } catch (e) {}
          }
        }

        if (entry.planned_start_time && entry.planned_end_time) {
          try {
            const hours = differenceInHours(parseISO(entry.planned_end_time), parseISO(entry.planned_start_time));
            if (hours > 0) {
              userStats[userId].hours += hours;
              userStats[userId].cost += hours * 25;
            }
          } catch (e) {}
        }
      });
    });

    return Object.values(userStats)
      .map(user => ({
        ...user,
        completionRate: user.total > 0 ? ((user.closed / user.total) * 100).toFixed(1) : 0,
        onTimeRate: user.closed > 0 ? ((user.onTime / user.closed) * 100).toFixed(1) : 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 20);
  }, [filteredEntries, users]);

  const projectMetrics = useMemo(() => {
    const projectStats = {};

    filteredEntries.forEach(entry => {
      const projectId = entry.project_id;
      if (!projectId) return;

      if (!projectStats[projectId]) {
        const project = projects.find(p => p.id === projectId);
        const customer = customers.find(c => c.id === project?.customer_id);
        projectStats[projectId] = {
          id: projectId,
          name: project?.name || 'Unknown',
          customer: customer?.name || '-',
          total: 0,
          closed: 0,
          hours: 0,
          cost: 0,
          avgDuration: 0,
          durationCount: 0,
        };
      }

      projectStats[projectId].total++;
      if (entry.status === 'closed') projectStats[projectId].closed++;

      if (entry.planned_start_time && entry.planned_end_time) {
        try {
          const hours = differenceInHours(parseISO(entry.planned_end_time), parseISO(entry.planned_start_time));
          if (hours > 0) {
            projectStats[projectId].hours += hours;
            projectStats[projectId].cost += hours * 25;
            projectStats[projectId].avgDuration += hours;
            projectStats[projectId].durationCount++;
          }
        } catch (e) {}
      }
    });

    return Object.values(projectStats)
      .map(proj => ({
        ...proj,
        completionRate: proj.total > 0 ? ((proj.closed / proj.total) * 100).toFixed(1) : 0,
        avgDuration: proj.durationCount > 0 ? (proj.avgDuration / proj.durationCount).toFixed(1) : 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 15);
  }, [filteredEntries, projects, customers]);

  const statusDistribution = useMemo(() => {
    return [
      { name: 'On Queue', value: kpis.onQueue, color: COLORS[3] },
      { name: 'Ongoing', value: kpis.ongoing, color: COLORS[5] },
      { name: 'Closed', value: kpis.closed, color: COLORS[4] },
    ].filter(s => s.value > 0);
  }, [kpis]);

  const categoryDistribution = useMemo(() => {
    const catStats = {};
    filteredEntries.forEach(entry => {
      const catId = entry.work_order_category_id;
      if (!catId) {
        catStats['Uncategorized'] = (catStats['Uncategorized'] || 0) + 1;
        return;
      }
      const cat = categories.find(c => c.id === catId);
      const catName = cat?.name || 'Unknown';
      catStats[catName] = (catStats[catName] || 0) + 1;
    });
    return Object.entries(catStats)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredEntries, categories]);

  const timelineData = useMemo(() => {
    const dailyStats = {};
    filteredEntries.forEach(entry => {
      if (!entry.planned_start_time) return;
      try {
        const date = format(parseISO(entry.planned_start_time), 'MMM dd');
        if (!dailyStats[date]) {
          dailyStats[date] = { date, total: 0, closed: 0, ongoing: 0, hours: 0 };
        }
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

  const efficiencyMetrics = useMemo(() => {
    return teamPerformance.map(team => ({
      team: team.name,
      efficiency: parseFloat(team.completionRate),
      onTime: parseFloat(team.onTimeRate),
      productivity: team.total,
    })).slice(0, 6);
  }, [teamPerformance]);

  const laborCostsByProject = useMemo(() => {
    const projectCosts = {};

    filteredTimesheets.forEach(timesheet => {
      const profile = payrollProfiles.find(p => p.employee_id === timesheet.employee_id);
      if (!profile) return;

      const hourlyRate = profile.ordinary_hourly_rate || 0;
      const overtimeRate = profile.overtime_hourly_rate || (hourlyRate * 1.5); // Default to 1.5x if not specified
      const regularHours = timesheet.regular_hours_calculated || 0;
      const overtimeHours = (timesheet.overtime_hours_paid_calculated || 0) + (timesheet.overtime_hours_non_paid_calculated || 0);

      // Get work order segments to determine projects
      const segments = timesheet.work_order_segments || [];
      segments.forEach(segment => {
        const workOrder = entries.find(e => e.id === segment.work_order_id);
        if (!workOrder || !workOrder.project_id) return;

        const projectId = workOrder.project_id;
        if (!projectCosts[projectId]) {
          const project = projects.find(p => p.id === projectId);
          const customer = customers.find(c => c.id === project?.customer_id);
          
          projectCosts[projectId] = {
            id: projectId,
            name: project?.name || 'Unknown',
            customer: customer?.name || 'Unknown',
            regularHours: 0,
            overtimeHours: 0,
            regularCost: 0,
            overtimeCost: 0,
            totalCost: 0,
          };
        }

        // Calculate proportional hours for this segment
        const segmentDuration = segment.duration_minutes || 0;
        const totalDuration = timesheet.total_duration_minutes || 1;
        const proportion = totalDuration > 0 ? (segmentDuration / totalDuration) : 0;

        const segmentRegularHours = regularHours * proportion;
        const segmentOvertimeHours = overtimeHours * proportion;

        projectCosts[projectId].regularHours += segmentRegularHours;
        projectCosts[projectId].overtimeHours += segmentOvertimeHours;
        projectCosts[projectId].regularCost += segmentRegularHours * hourlyRate;
        projectCosts[projectId].overtimeCost += segmentOvertimeHours * overtimeRate;
        projectCosts[projectId].totalCost += (segmentRegularHours * hourlyRate) + (segmentOvertimeHours * overtimeRate);
      });
    });

    return Object.values(projectCosts)
      .sort((a, b) => b.totalCost - a.totalCost)
      .slice(0, 15);
  }, [filteredTimesheets, payrollProfiles, entries, projects, customers]);

  const laborCostsByCategory = useMemo(() => {
    const categoryCosts = {};

    filteredTimesheets.forEach(timesheet => {
      const profile = payrollProfiles.find(p => p.employee_id === timesheet.employee_id);
      if (!profile) return;

      const hourlyRate = profile.ordinary_hourly_rate || 0;
      const overtimeRate = profile.overtime_hourly_rate || (hourlyRate * 1.5);
      const regularHours = timesheet.regular_hours_calculated || 0;
      const overtimeHours = (timesheet.overtime_hours_paid_calculated || 0) + (timesheet.overtime_hours_non_paid_calculated || 0);

      const segments = timesheet.work_order_segments || [];
      segments.forEach(segment => {
        const workOrder = entries.find(e => e.id === segment.work_order_id);
        if (!workOrder) return;

        const categoryId = workOrder.work_order_category_id || 'uncategorized';
        if (!categoryCosts[categoryId]) {
          const category = categories.find(c => c.id === categoryId);
          
          categoryCosts[categoryId] = {
            id: categoryId,
            name: category?.name || 'Uncategorized',
            regularHours: 0,
            overtimeHours: 0,
            regularCost: 0,
            overtimeCost: 0,
            totalCost: 0,
          };
        }

        const segmentDuration = segment.duration_minutes || 0;
        const totalDuration = timesheet.total_duration_minutes || 1;
        const proportion = totalDuration > 0 ? (segmentDuration / totalDuration) : 0;

        const segmentRegularHours = regularHours * proportion;
        const segmentOvertimeHours = overtimeHours * proportion;

        categoryCosts[categoryId].regularHours += segmentRegularHours;
        categoryCosts[categoryId].overtimeHours += segmentOvertimeHours;
        categoryCosts[categoryId].regularCost += segmentRegularHours * hourlyRate;
        categoryCosts[categoryId].overtimeCost += segmentOvertimeHours * overtimeRate;
        categoryCosts[categoryId].totalCost += (segmentRegularHours * hourlyRate) + (segmentOvertimeHours * overtimeRate);
      });
    });

    return Object.values(categoryCosts)
      .sort((a, b) => b.totalCost - a.totalCost);
  }, [filteredTimesheets, payrollProfiles, entries, categories]);

  const laborCostsByCustomer = useMemo(() => {
    const customerCosts = {};

    filteredTimesheets.forEach(timesheet => {
      const profile = payrollProfiles.find(p => p.employee_id === timesheet.employee_id);
      if (!profile) return;

      const hourlyRate = profile.ordinary_hourly_rate || 0;
      const overtimeRate = profile.overtime_hourly_rate || (hourlyRate * 1.5);
      const regularHours = timesheet.regular_hours_calculated || 0;
      const overtimeHours = (timesheet.overtime_hours_paid_calculated || 0) + (timesheet.overtime_hours_non_paid_calculated || 0);

      const segments = timesheet.work_order_segments || [];
      segments.forEach(segment => {
        const workOrder = entries.find(e => e.id === segment.work_order_id);
        if (!workOrder || !workOrder.project_id) return;

        const project = projects.find(p => p.id === workOrder.project_id);
        const customerId = project?.customer_id || 'unknown';
        
        if (!customerCosts[customerId]) {
          const customer = customers.find(c => c.id === customerId);
          
          customerCosts[customerId] = {
            id: customerId,
            name: customer?.name || 'Unknown',
            regularHours: 0,
            overtimeHours: 0,
            regularCost: 0,
            overtimeCost: 0,
            totalCost: 0,
            projectCount: new Set(),
          };
        }

        customerCosts[customerId].projectCount.add(workOrder.project_id);

        const segmentDuration = segment.duration_minutes || 0;
        const totalDuration = timesheet.total_duration_minutes || 1;
        const proportion = totalDuration > 0 ? (segmentDuration / totalDuration) : 0;

        const segmentRegularHours = regularHours * proportion;
        const segmentOvertimeHours = overtimeHours * proportion;

        customerCosts[customerId].regularHours += segmentRegularHours;
        customerCosts[customerId].overtimeHours += segmentOvertimeHours;
        customerCosts[customerId].regularCost += segmentRegularHours * hourlyRate;
        customerCosts[customerId].overtimeCost += segmentOvertimeHours * overtimeRate;
        customerCosts[customerId].totalCost += (segmentRegularHours * hourlyRate) + (segmentOvertimeHours * overtimeRate);
      });
    });

    return Object.values(customerCosts)
      .map(c => ({
        ...c,
        projectCount: c.projectCount.size,
      }))
      .sort((a, b) => b.totalCost - a.totalCost);
  }, [filteredTimesheets, payrollProfiles, entries, projects, customers]);

  const totalLaborCosts = useMemo(() => {
    // Summing from laborCostsByProject (which should cover all relevant timesheets)
    return {
      regularHours: laborCostsByProject.reduce((sum, p) => sum + p.regularHours, 0),
      overtimeHours: laborCostsByProject.reduce((sum, p) => sum + p.overtimeHours, 0),
      regularCost: laborCostsByProject.reduce((sum, p) => sum + p.regularCost, 0),
      overtimeCost: laborCostsByProject.reduce((sum, p) => sum + p.overtimeCost, 0),
      totalCost: laborCostsByProject.reduce((sum, p) => sum + p.totalCost, 0),
    };
  }, [laborCostsByProject]);

  const assetMetrics = useMemo(() => {
    // Helper function to calculate depreciation
    const calculateAssetDepreciation = (asset) => {
      if (!asset.purchase_cost || !asset.purchase_date) {
        return {
          currentValue: asset.purchase_cost || 0,
          accumulatedDepreciation: 0
        };
      }

      const purchaseCost = asset.purchase_cost;
      const salvageValue = asset.salvage_value || 0;
      const usefulLife = asset.useful_life_years || 5;
      const method = asset.depreciation_method || 'Straight Line';

      const purchaseDate = new Date(asset.purchase_date);
      const today = new Date();
      const daysElapsed = Math.max(0, (today - purchaseDate) / (1000 * 60 * 60 * 24));
      const yearsElapsed = daysElapsed / 365.25;

      let currentValue = purchaseCost;
      let accumulatedDepreciation = 0;

      if (method === 'No Depreciation') {
        return { currentValue: purchaseCost, accumulatedDepreciation: 0 };
      }

      if (method === 'Straight Line') {
        const annualDepreciation = (purchaseCost - salvageValue) / usefulLife;
        accumulatedDepreciation = Math.min(annualDepreciation * yearsElapsed, purchaseCost - salvageValue);
        currentValue = Math.max(purchaseCost - accumulatedDepreciation, salvageValue);
      } else if (method === 'Declining Balance' || method === 'Double Declining Balance') {
        const multiplier = method === 'Declining Balance' ? 1.5 : 2;
        const rate = multiplier / usefulLife;
        let bookValue = purchaseCost;

        for (let i = 0; i < Math.floor(yearsElapsed); i++) {
          const yearDepreciation = bookValue * rate;
          accumulatedDepreciation += yearDepreciation;
          bookValue -= yearDepreciation;
          if (bookValue <= salvageValue) {
            bookValue = salvageValue;
            break;
          }
        }

        const partialYear = yearsElapsed - Math.floor(yearsElapsed);
        if (partialYear > 0 && bookValue > salvageValue) {
          const partialDepreciation = bookValue * rate * partialYear;
          accumulatedDepreciation += partialDepreciation;
          bookValue -= partialDepreciation;
        }

        currentValue = Math.max(bookValue, salvageValue);
      }

      return {
        currentValue: Math.max(0, currentValue),
        accumulatedDepreciation: Math.min(accumulatedDepreciation, purchaseCost - salvageValue)
      };
    };

    let totalPurchaseCost = 0;
    let totalCurrentValue = 0;
    let totalSalvageValue = 0;
    let totalDepreciation = 0;

    const assetsByCategory = {};
    const assetsByStatus = {};

    assets.forEach(asset => {
      const qty = asset.quantity || 1;
      totalPurchaseCost += (asset.purchase_cost || 0) * qty;
      totalSalvageValue += (asset.salvage_value || 0) * qty;

      const depreciation = calculateAssetDepreciation(asset);
      totalCurrentValue += depreciation.currentValue * qty;
      totalDepreciation += depreciation.accumulatedDepreciation * qty;

      // By category
      const category = asset.category || 'Other';
      if (!assetsByCategory[category]) {
        assetsByCategory[category] = {
          name: category,
          count: 0,
          purchaseCost: 0,
          currentValue: 0,
          depreciation: 0,
          salvageValue: 0
        };
      }
      assetsByCategory[category].count += qty;
      assetsByCategory[category].purchaseCost += (asset.purchase_cost || 0) * qty;
      assetsByCategory[category].currentValue += depreciation.currentValue * qty;
      assetsByCategory[category].depreciation += depreciation.accumulatedDepreciation * qty;
      assetsByCategory[category].salvageValue += (asset.salvage_value || 0) * qty;

      // By status
      const status = asset.status || 'Available';
      if (!assetsByStatus[status]) {
        assetsByStatus[status] = {
          name: status,
          count: 0,
          purchaseCost: 0,
          currentValue: 0
        };
      }
      assetsByStatus[status].count += qty;
      assetsByStatus[status].purchaseCost += (asset.purchase_cost || 0) * qty;
      assetsByStatus[status].currentValue += depreciation.currentValue * qty;
    });

    return {
      totalPurchaseCost,
      totalCurrentValue,
      totalSalvageValue,
      totalDepreciation,
      totalAssets: assets.length,
      byCategory: Object.values(assetsByCategory).sort((a, b) => b.currentValue - a.currentValue),
      byStatus: Object.values(assetsByStatus).sort((a, b) => b.count - a.count)
    };
  }, [assets]);

  const handleExportReport = async () => {
    setIsExporting(true);
    try {
      toast.loading('Generating report...', { id: 'export' });
      
      const reportData = {
        period: {
          start: format(startDate, 'yyyy-MM-dd'),
          end: format(endDate, 'yyyy-MM-dd'),
        },
        summary: kpis,
        teams: teamPerformance,
        projects: projectMetrics,
        users: userPerformance,
        categories: categoryDistribution,
        timeline: timelineData,
        laborCosts: { // New section for labor costs
          total: totalLaborCosts,
          byProject: laborCostsByProject,
          byCategory: laborCostsByCategory,
          byCustomer: laborCostsByCustomer,
        },
      };

      // Create CSV content
      let csv = 'MyBusinessPace - Analytics Report\n\n';
      csv += `Period: ${format(startDate, 'MMM d, yyyy')} - ${format(endDate, 'MMM d, yyyy')}\n`;
      csv += `Generated: ${format(new Date(), 'MMM d, yyyy HH:mm')}\n\n`;
      
      csv += 'SUMMARY\n';
      csv += `Total Work Orders,${kpis.total}\n`;
      csv += `Closed,${kpis.closed}\n`;
      csv += `Ongoing,${kpis.ongoing}\n`;
      csv += `Completion Rate,${kpis.completionRate}%\n`;
      csv += `On-Time Rate,${kpis.onTimeRate}%\n`;
      csv += `Total Hours,${kpis.totalHours}\n`;
      csv += `Total WO Cost,$${kpis.totalCost}\n\n`; // Renamed for clarity

      csv += 'LABOR COSTS SUMMARY\n'; // New section for labor cost summary
      csv += `Total Labor Cost,$${totalLaborCosts.totalCost.toFixed(2)}\n`;
      csv += `Regular Hours,${totalLaborCosts.regularHours.toFixed(2)}\n`;
      csv += `Regular Cost,$${totalLaborCosts.regularCost.toFixed(2)}\n`;
      csv += `Overtime Hours,${totalLaborCosts.overtimeHours.toFixed(2)}\n`;
      csv += `Overtime Cost,$${totalLaborCosts.overtimeCost.toFixed(2)}\n\n`;


      csv += 'TEAM PERFORMANCE\n';
      csv += 'Team,Total WOs,Closed,Completion %,Hours,Cost\n';
      teamPerformance.forEach(team => {
        csv += `${team.name},${team.total},${team.closed},${team.completionRate}%,${team.hours},$${team.cost}\n`;
      });
      csv += '\n';

      csv += 'PROJECT METRICS\n';
      csv += 'Project,Customer,Total WOs,Closed WOs,Avg Duration (h),Total WO Hours,Total WO Cost\n';
      projectMetrics.forEach(proj => {
          csv += `${proj.name},${proj.customer},${proj.total},${proj.closed},${proj.avgDuration}h,${proj.hours}h,$${proj.cost.toLocaleString()}\n`;
      });
      csv += '\n';

      csv += 'USER PERFORMANCE\n';
      csv += 'User,Total WOs,Closed WOs,Completion %,On-Time %,Hours,Cost\n';
      userPerformance.forEach(user => {
          csv += `${user.name},${user.total},${user.closed},${user.completionRate}%,${user.onTimeRate}%,${user.hours}h,$${user.cost.toLocaleString()}\n`;
      });
      csv += '\n';

      csv += 'CATEGORY DISTRIBUTION\n';
      csv += 'Category,Work Orders\n';
      categoryDistribution.forEach(cat => {
          csv += `${cat.name},${cat.value}\n`;
      });
      csv += '\n';

      csv += 'WORK ORDERS OVER TIME (DAILY)\n';
      csv += 'Date,Total WOs,Ongoing WOs,Closed WOs,Hours\n';
      timelineData.forEach(day => {
          csv += `${day.date},${day.total},${day.ongoing},${day.closed},${day.hours}\n`;
      });
      csv += '\n';

      csv += 'LABOR COSTS BY PROJECT\n'; // New section
      csv += 'Project,Customer,Regular Hours,Overtime Hours,Total Hours,Regular Cost,Overtime Cost,Total Cost\n';
      laborCostsByProject.forEach(proj => {
          csv += `${proj.name},${proj.customer},${proj.regularHours.toFixed(2)},${proj.overtimeHours.toFixed(2)},${(proj.regularHours + proj.overtimeHours).toFixed(2)},$${proj.regularCost.toFixed(2)},$${proj.overtimeCost.toFixed(2)},$${proj.totalCost.toFixed(2)}\n`;
      });
      csv += '\n';

      csv += 'LABOR COSTS BY CATEGORY\n'; // New section
      csv += 'Category,Regular Hours,Overtime Hours,Total Hours,Regular Cost,Overtime Cost,Total Cost\n';
      laborCostsByCategory.forEach(cat => {
          csv += `${cat.name},${cat.regularHours.toFixed(2)},${cat.overtimeHours.toFixed(2)},${(cat.regularHours + cat.overtimeHours).toFixed(2)},$${cat.regularCost.toFixed(2)},$${cat.overtimeCost.toFixed(2)},$${cat.totalCost.toFixed(2)}\n`;
      });
      csv += '\n';

      csv += 'LABOR COSTS BY CUSTOMER\n'; // New section
      csv += 'Customer,Projects,Regular Hours,Overtime Hours,Total Hours,Regular Cost,Overtime Cost,Total Cost\n';
      laborCostsByCustomer.forEach(cust => {
          csv += `${cust.name},${cust.projectCount},${cust.regularHours.toFixed(2)},${cust.overtimeHours.toFixed(2)},${(cust.regularHours + cust.overtimeHours).toFixed(2)},$${cust.regularCost.toFixed(2)},$${cust.overtimeCost.toFixed(2)},$${cust.totalCost.toFixed(2)}\n`;
      });
      csv += '\n';


      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `analytics-report-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success('Report exported successfully!', { id: 'export' });
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export report', { id: 'export' });
    } finally {
      setIsExporting(false);
    }
  };

  const TrendIndicator = ({ value, suffix = '' }) => {
    const numValue = parseFloat(value);
    if (!compareWithPrevious || isNaN(numValue) || numValue === 0) return null; // Only show if comparing and value is not zero
    
    const isPositive = numValue > 0;
    return (
      <span className={cn(
        "text-xs font-medium flex items-center gap-1",
        isPositive ? "text-green-600" : "text-red-600"
      )}>
        {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
        {Math.abs(numValue)}{suffix}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <Card className="p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <BarChart3 className="w-5 h-5 text-gray-600" />
              </div>
              <h1 className="text-xl font-bold text-slate-900">Analytics & Reports</h1>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}>
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </Button>
          </div>
        </Card>

        <div className="flex items-center gap-2">
          <Link to={createPageUrl('activity-log')}>
            <Button variant="outline" size="sm" className="gap-2">
              <History className="w-4 h-4" />
              Activity Log
            </Button>
          </Link>
          <Button onClick={handleExportReport} disabled={isExporting} size="sm" className="bg-indigo-600 hover:bg-indigo-700">
            {isExporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            Export Report
          </Button>
        </div>

        {showAdvancedFilters && (
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <Label>Date Range</Label>
                  <Select value={dateRange} onValueChange={setDateRange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
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
                            <CalendarIcon className="w-4 h-4 mr-2" />
                            {format(startDate, 'MMM d, yyyy')}
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
                            <CalendarIcon className="w-4 h-4 mr-2" />
                            {format(endDate, 'MMM d, yyyy')}
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
                  <Switch
                    id="compare"
                    checked={compareWithPrevious}
                    onCheckedChange={setCompareWithPrevious}
                  />
                  <Label htmlFor="compare" className="cursor-pointer">Compare with previous period</Label>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2">
                <Badge variant="secondary">
                  {filteredEntries.length} work orders in selected period
                </Badge>
                {compareWithPrevious && (
                  <Badge variant="outline">
                    vs {previousPeriodEntries.length} in previous period
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-600">Total Work Orders</p>
                  <p className="text-3xl font-bold text-slate-900 mt-2">{kpis.total}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-xs text-slate-500">
                      {kpis.closed} closed · {kpis.ongoing} ongoing
                    </p>
                    <TrendIndicator value={kpis.totalChange} suffix="%" />
                  </div>
                </div>
                <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <Activity className="w-6 h-6 text-indigo-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-600">Completion Rate</p>
                  <p className="text-3xl font-bold text-slate-900 mt-2">{kpis.completionRate}%</p>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-xs text-slate-500">On-time: {kpis.onTimeRate}%</p>
                    <TrendIndicator value={kpis.closedChange} suffix="%" />
                  </div>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-600">Total WO Hours</p>
                  <p className="text-3xl font-bold text-slate-900 mt-2">{kpis.totalHours.toLocaleString()}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-xs text-slate-500">Avg: {kpis.avgCompletionDays}d per WO</p>
                    <TrendIndicator value={kpis.hoursChange} suffix="%" />
                  </div>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Clock className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-600">Total WO Cost</p>
                  <p className="text-3xl font-bold text-slate-900 mt-2">${kpis.totalCost.toLocaleString()}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-xs text-slate-500">{kpis.activeProjects} projects</p>
                    <TrendIndicator value={kpis.costChange} suffix="%" />
                  </div>
                </div>
                <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* New KPI card for Total Labor Costs */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-600">Total Labor Cost</p>
                <p className="text-3xl font-bold text-slate-900 mt-2">${totalLaborCosts.totalCost.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-xs text-slate-500">
                    {totalLaborCosts.regularHours.toFixed(1)}h regular · {totalLaborCosts.overtimeHours.toFixed(1)}h OT
                  </p>
                  {/* Add trend indicator for labor costs if prev period labor costs are calculated */}
                  {/* <TrendIndicator value={totalLaborCostsChange} suffix="%" /> */}
                </div>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Briefcase className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>


        <Tabs defaultValue="overtime" className="space-y-4">
          <TabsList className="grid w-full grid-cols-9">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="teams">Teams</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="projects">Projects</TabsTrigger>
            <TabsTrigger value="labor-costs">Labor Costs</TabsTrigger>
            <TabsTrigger value="overtime" className="text-amber-700 font-semibold">Overtime</TabsTrigger>
            <TabsTrigger value="assets">Assets</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="custom">Custom</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Status Distribution</CardTitle>
                </CardHeader>
                <CardContent>
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

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Category Distribution (Work Orders)</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={categoryDistribution}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" fill={COLORS[0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Team Efficiency Radar</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <RadarChart data={efficiencyMetrics}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="team" />
                      <PolarRadiusAxis angle={90} domain={[0, 100]} />
                      <Radar name="Efficiency" dataKey="efficiency" stroke={COLORS[0]} fill={COLORS[0]} fillOpacity={0.6} />
                      <Radar name="On-Time %" dataKey="onTime" stroke={COLORS[4]} fill={COLORS[4]} fillOpacity={0.6} />
                      <Tooltip />
                      <Legend />
                    </RadarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Resource Utilization</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-slate-600">Active Teams</span>
                        <span className="font-semibold">{kpis.activeTeams} / {teams.length}</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2">
                        <div
                          className="bg-indigo-600 h-2 rounded-full transition-all"
                          style={{ width: `${(kpis.activeTeams / teams.length) * 100}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-slate-600">Active Users</span>
                        <span className="font-semibold">{kpis.activeUsers} / {users.length}</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all"
                          style={{ width: `${(kpis.activeUsers / users.length) * 100}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-slate-600">Active Projects</span>
                        <span className="font-semibold">{kpis.activeProjects} / {projects.length}</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2">
                        <div
                          className="bg-green-600 h-2 rounded-full transition-all"
                          style={{ width: `${(kpis.activeProjects / projects.length) * 100}%` }}
                        />
                      </div>
                    </div>

                    <div className="pt-4 border-t">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-slate-600 mb-1">Avg Completion Time</p>
                          <p className="text-2xl font-bold text-slate-900">{kpis.avgCompletionDays}d</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-600 mb-1">Total Delay Hours</p>
                          <p className="text-2xl font-bold text-red-600">{kpis.totalDelayHours}h</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="teams" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Team Performance Comparison</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <ComposedChart data={teamPerformance} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis yAxisId="left" label={{ value: 'Work Orders', angle: -90, position: 'insideLeft' }} />
                    <YAxis yAxisId="right" orientation="right" label={{ value: 'On-Time %', angle: 90, position: 'insideRight' }} />
                    <Tooltip />
                    <Legend />
                    <Bar yAxisId="left" dataKey="total" fill={COLORS[0]} name="Total WOs" />
                    <Bar yAxisId="left" dataKey="closed" fill={COLORS[4]} name="Closed" />
                    <Line yAxisId="right" type="monotone" dataKey="onTimeRate" stroke={COLORS[2]} strokeWidth={2} name="On-Time %" />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Detailed Team Statistics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="text-left p-3 text-sm font-semibold text-slate-700">Team</th>
                        <th className="text-right p-3 text-sm font-semibold text-slate-700">Total</th>
                        <th className="text-right p-3 text-sm font-semibold text-slate-700">Closed</th>
                        <th className="text-right p-3 text-sm font-semibold text-slate-700">Ongoing</th>
                        <th className="text-right p-3 text-sm font-semibold text-slate-700">Completion %</th>
                        <th className="text-right p-3 text-sm font-semibold text-slate-700">On-Time %</th>
                        <th className="text-right p-3 text-sm font-semibold text-slate-700">Avg h/WO</th>
                        <th className="text-right p-3 text-sm font-semibold text-slate-700">Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teamPerformance.map((team, idx) => (
                        <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="p-3 text-sm font-medium">{team.name}</td>
                          <td className="p-3 text-sm text-right">{team.total}</td>
                          <td className="p-3 text-sm text-right">{team.closed}</td>
                          <td className="p-3 text-sm text-right">{team.ongoing}</td>
                          <td className="p-3 text-sm text-right">
                            <Badge variant={parseFloat(team.completionRate) > 80 ? 'default' : 'secondary'}>
                              {team.completionRate}%
                            </Badge>
                          </td>
                          <td className="p-3 text-sm text-right">
                            <Badge variant={parseFloat(team.onTimeRate) > 80 ? 'default' : parseFloat(team.onTimeRate) > 60 ? 'secondary' : 'destructive'}>
                              {team.onTimeRate}%
                            </Badge>
                          </td>
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
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Top 20 User Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={500}>
                  <BarChart data={userPerformance} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={120} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="total" fill={COLORS[1]} name="Total WOs" />
                    <Bar dataKey="closed" fill={COLORS[4]} name="Closed" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">User Statistics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="text-left p-3 text-sm font-semibold text-slate-700">User</th>
                        <th className="text-right p-3 text-sm font-semibold text-slate-700">Total WOs</th>
                        <th className="text-right p-3 text-sm font-semibold text-slate-700">Closed</th>
                        <th className="text-right p-3 text-sm font-semibold text-slate-700">Completion %</th>
                        <th className="text-right p-3 text-sm font-semibold text-slate-700">On-Time %</th>
                        <th className="text-right p-3 text-sm font-semibold text-slate-700">Hours</th>
                        <th className="text-right p-3 text-sm font-semibold text-slate-700">WO Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {userPerformance.map((user, idx) => (
                        <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="p-3 text-sm font-medium">{user.name}</td>
                          <td className="p-3 text-sm text-right">{user.total}</td>
                          <td className="p-3 text-sm text-right">{user.closed}</td>
                          <td className="p-3 text-sm text-right">
                            <Badge variant={parseFloat(user.completionRate) > 80 ? 'default' : 'secondary'}>
                              {user.completionRate}%
                            </Badge>
                          </td>
                          <td className="p-3 text-sm text-right">
                            <Badge variant={parseFloat(user.onTimeRate) > 80 ? 'default' : parseFloat(user.onTimeRate) > 60 ? 'secondary' : 'destructive'}>
                              {user.onTimeRate}%
                            </Badge>
                          </td>
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
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Top 15 Projects by Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={500}>
                  <BarChart data={projectMetrics} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={180} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="total" fill={COLORS[1]} name="Total WOs" />
                    <Bar dataKey="closed" fill={COLORS[4]} name="Closed" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Project Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="text-left p-3 text-sm font-semibold text-slate-700">Project</th>
                        <th className="text-left p-3 text-sm font-semibold text-slate-700">Customer</th>
                        <th className="text-right p-3 text-sm font-semibold text-slate-700">Total WOs</th>
                        <th className="text-right p-3 text-sm font-semibold text-slate-700">Closed WOs</th>
                        <th className="text-right p-3 text-sm font-semibold text-slate-700">Avg Duration</th>
                        <th className="text-right p-3 text-sm font-semibold text-slate-700">WO Hours</th>
                        <th className="text-right p-3 text-sm font-semibold text-slate-700">WO Cost</th>
                      </tr>
                    </thead>
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

          {/* New Labor Costs Tab Content */}
          <TabsContent value="labor-costs" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Labor Costs by Project (Top 15)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={500}>
                  <BarChart data={laborCostsByProject} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" dataKey="totalCost" />
                    <YAxis dataKey="name" type="category" width={180} />
                    <Tooltip formatter={(value) => `$${value.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`} />
                    <Legend />
                    <Bar dataKey="totalCost" fill={COLORS[0]} name="Total Labor Cost" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Detailed Labor Costs by Project</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="text-left p-3 text-sm font-semibold text-slate-700">Project</th>
                        <th className="text-left p-3 text-sm font-semibold text-slate-700">Customer</th>
                        <th className="text-right p-3 text-sm font-semibold text-slate-700">Reg. Hours</th>
                        <th className="text-right p-3 text-sm font-semibold text-slate-700">OT Hours</th>
                        <th className="text-right p-3 text-sm font-semibold text-slate-700">Reg. Cost</th>
                        <th className="text-right p-3 text-sm font-semibold text-slate-700">OT Cost</th>
                        <th className="text-right p-3 text-sm font-semibold text-slate-700">Total Cost</th>
                      </tr>
                    </thead>
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

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Labor Costs by Category</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={laborCostsByCategory} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis formatter={(value) => `$${value.toLocaleString()}`} />
                    <Tooltip formatter={(value) => `$${value.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`} />
                    <Legend />
                    <Bar dataKey="totalCost" fill={COLORS[1]} name="Total Labor Cost" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Detailed Labor Costs by Category</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="text-left p-3 text-sm font-semibold text-slate-700">Category</th>
                        <th className="text-right p-3 text-sm font-semibold text-slate-700">Reg. Hours</th>
                        <th className="text-right p-3 text-sm font-semibold text-slate-700">OT Hours</th>
                        <th className="text-right p-3 text-sm font-semibold text-slate-700">Reg. Cost</th>
                        <th className="text-right p-3 text-sm font-semibold text-slate-700">OT Cost</th>
                        <th className="text-right p-3 text-sm font-semibold text-slate-700">Total Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {laborCostsByCategory.map((cat, idx) => (
                        <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="p-3 text-sm font-medium">{cat.name}</td>
                          <td className="p-3 text-sm text-right">{cat.regularHours.toFixed(1)}h</td>
                          <td className="p-3 text-sm text-right">{cat.overtimeHours.toFixed(1)}h</td>
                          <td className="p-3 text-sm text-right">${cat.regularCost.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                          <td className="p-3 text-sm text-right">${cat.overtimeCost.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                          <td className="p-3 text-sm text-right font-semibold">${cat.totalCost.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Labor Costs by Customer</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={laborCostsByCustomer} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis formatter={(value) => `$${value.toLocaleString()}`} />
                    <Tooltip formatter={(value) => `$${value.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`} />
                    <Legend />
                    <Bar dataKey="totalCost" fill={COLORS[2]} name="Total Labor Cost" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Detailed Labor Costs by Customer</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="text-left p-3 text-sm font-semibold text-slate-700">Customer</th>
                        <th className="text-right p-3 text-sm font-semibold text-slate-700">Projects</th>
                        <th className="text-right p-3 text-sm font-semibold text-slate-700">Reg. Hours</th>
                        <th className="text-right p-3 text-sm font-semibold text-slate-700">OT Hours</th>
                        <th className="text-right p-3 text-sm font-semibold text-slate-700">Reg. Cost</th>
                        <th className="text-right p-3 text-sm font-semibold text-slate-700">OT Cost</th>
                        <th className="text-right p-3 text-sm font-semibold text-slate-700">Total Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {laborCostsByCustomer.map((cust, idx) => (
                        <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="p-3 text-sm font-medium">{cust.name}</td>
                          <td className="p-3 text-sm text-right">{cust.projectCount}</td>
                          <td className="p-3 text-sm text-right">{cust.regularHours.toFixed(1)}h</td>
                          <td className="p-3 text-sm text-right">{cust.overtimeHours.toFixed(1)}h</td>
                          <td className="p-3 text-sm text-right">${cust.regularCost.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                          <td className="p-3 text-sm text-right">${cust.overtimeCost.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                          <td className="p-3 text-sm text-right font-semibold">${cust.totalCost.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Assets Tab Content */}
          <TabsContent value="assets" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-600">Total Assets</p>
                      <p className="text-3xl font-bold text-slate-900 mt-2">{assetMetrics.totalAssets}</p>
                    </div>
                    <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                      <Package className="w-6 h-6 text-indigo-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-600">Total Purchase Cost</p>
                    <p className="text-3xl font-bold text-slate-900 mt-2">
                      ${assetMetrics.totalPurchaseCost.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-600">Current Value</p>
                    <p className="text-3xl font-bold text-green-900 mt-2">
                      ${assetMetrics.totalCurrentValue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-600">Total Depreciation</p>
                    <p className="text-3xl font-bold text-red-900 mt-2">
                      ${assetMetrics.totalDepreciation.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardContent className="pt-6">
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-600">Total Salvage Value</p>
                  <p className="text-3xl font-bold text-amber-900 mt-2">
                    ${assetMetrics.totalSalvageValue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Asset Value by Category</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={assetMetrics.byCategory} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis formatter={(value) => `$${value.toLocaleString()}`} />
                    <Tooltip formatter={(value) => `$${value.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`} />
                    <Legend />
                    <Bar dataKey="purchaseCost" fill={COLORS[0]} name="Purchase Cost" />
                    <Bar dataKey="currentValue" fill={COLORS[4]} name="Current Value" />
                    <Bar dataKey="depreciation" fill={COLORS[6]} name="Depreciation" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Detailed Asset Metrics by Category</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="text-left p-3 text-sm font-semibold text-slate-700">Category</th>
                        <th className="text-right p-3 text-sm font-semibold text-slate-700">Count</th>
                        <th className="text-right p-3 text-sm font-semibold text-slate-700">Purchase Cost</th>
                        <th className="text-right p-3 text-sm font-semibold text-slate-700">Current Value</th>
                        <th className="text-right p-3 text-sm font-semibold text-slate-700">Depreciation</th>
                        <th className="text-right p-3 text-sm font-semibold text-slate-700">Salvage Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assetMetrics.byCategory.map((cat, idx) => (
                        <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="p-3 text-sm font-medium">{cat.name}</td>
                          <td className="p-3 text-sm text-right">{cat.count}</td>
                          <td className="p-3 text-sm text-right">${cat.purchaseCost.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                          <td className="p-3 text-sm text-right text-green-700 font-semibold">${cat.currentValue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                          <td className="p-3 text-sm text-right text-red-700">${cat.depreciation.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                          <td className="p-3 text-sm text-right">${cat.salvageValue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Assets by Status</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={assetMetrics.byStatus}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, count }) => `${name}: ${count}`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {assetMetrics.byStatus.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Asset Count and Value by Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="text-left p-3 text-sm font-semibold text-slate-700">Status</th>
                        <th className="text-right p-3 text-sm font-semibold text-slate-700">Count</th>
                        <th className="text-right p-3 text-sm font-semibold text-slate-700">Purchase Cost</th>
                        <th className="text-right p-3 text-sm font-semibold text-slate-700">Current Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assetMetrics.byStatus.map((stat, idx) => (
                        <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="p-3 text-sm font-medium">{stat.name}</td>
                          <td className="p-3 text-sm text-right">{stat.count}</td>
                          <td className="p-3 text-sm text-right">${stat.purchaseCost.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                          <td className="p-3 text-sm text-right font-semibold">${stat.currentValue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="timeline" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Work Orders Over Time</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <AreaChart data={timelineData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Area type="monotone" dataKey="total" stackId="1" stroke={COLORS[0]} fill={COLORS[0]} name="Total" />
                    <Area type="monotone" dataKey="ongoing" stackId="1" stroke={COLORS[5]} fill={COLORS[5]} name="Ongoing" />
                    <Area type="monotone" dataKey="closed" stackId="1" stroke={COLORS[4]} fill={COLORS[4]} name="Closed" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Hours & Activity Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={timelineData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Legend />
                    <Bar yAxisId="left" dataKey="total" fill={COLORS[0]} name="Work Orders" />
                    <Line yAxisId="right" type="monotone" dataKey="hours" stroke={COLORS[3]} strokeWidth={2} name="Hours" />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

        <TabsContent value="overtime" className="space-y-4">
          <OvertimeReport timesheets={timesheets} users={users} />
        </TabsContent>

        <TabsContent value="custom" className="space-y-4">
          {/* Explorador personalizado de informes */}
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-4">
            {/* Componente dedicado */}
            <CustomReportExplorer />
          </div>
        </TabsContent>
        </Tabs>
        </div>

        <ReportsSettingsPanel 
        isOpen={showSettings} 
        onClose={() => setShowSettings(false)} 
        />
        </div>
        );
        }