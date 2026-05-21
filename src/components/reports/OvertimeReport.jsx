import React, { useState, useMemo, useEffect, useRef } from 'react';
import { format, parseISO, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Download, CalendarIcon, Clock, AlertTriangle, TrendingUp, Search, X, ChevronDown, ChevronUp, Users } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { AppSettings, EmployeePayrollProfile } from '@/entities/all';
import TimesheetDrillDownDialog from './TimesheetDrillDownDialog';

// Find any active OvertimeRulePeriod for a given date string (yyyy-MM-dd)
function getActiveOvertimeRule(overtimeRules, dateStr) {
  if (!overtimeRules || !dateStr) return null;
  return overtimeRules.find(r => r.start_date <= dateStr && r.end_date >= dateStr) || null;
}

function fmtH(mins) {
  if (!mins || mins <= 0) return '-';
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function getInitials(user) {
  const name = user?.nickname || user?.full_name || user?.email || '?';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function UserAvatar({ user, size = 'md' }) {
  const cls = size === 'sm'
    ? "w-5 h-5 rounded-full flex-shrink-0"
    : "w-7 h-7 rounded-full border-2 border-white shadow-sm flex-shrink-0";
  if (user?.avatar_url) {
    return <img src={user.avatar_url} alt={user?.nickname || user?.full_name} className={cn(cls, "object-cover")} />;
  }
  return (
    <div className={cn(cls, "bg-indigo-600 text-white flex items-center justify-center", size === 'sm' ? "text-[9px] font-bold" : "text-xs font-bold")}>
      {getInitials(user)}
    </div>
  );
}

export default function OvertimeReport({ timesheets, users: usersProp }) {
  const [dateRange, setDateRange] = useState('month');
  const [startDate, setStartDate] = useState(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState(endOfMonth(new Date()));
  const [selectedUsers, setSelectedUsers] = useState(null); // null = all selected
  const [userSearch, setUserSearch] = useState('');
  const [fetchedUsers, setFetchedUsers] = useState([]);
  const [globalHoursSettings, setGlobalHoursSettings] = useState({ regular_hours_per_day: 8, non_payable_overtime_hours: 0 });
  const [overtimeRules, setOvertimeRules] = useState([]);
  const [payrollProfiles, setPayrollProfiles] = useState([]);
  const [workerPanelOpen, setWorkerPanelOpen] = useState(false);
  const panelRef = useRef(null);
  const [drillDown, setDrillDown] = useState(null); // { user, dayKey, sessions }

  useEffect(() => {
    base44.entities.User.list('full_name', 500).then(data => {
      if (Array.isArray(data) && data.length > 0) setFetchedUsers(data);
    }).catch(() => {});

    // Load global hours settings (same source as the timer)
    AppSettings.list('setting_key', 1000).then(settings => {
      const hoursMap = {};
      settings.forEach(s => {
        if (s.setting_key.startsWith('timesheet_hours_')) {
          const key = s.setting_key.replace('timesheet_hours_', '');
          const val = parseFloat(s.setting_value);
          if (!isNaN(val)) hoursMap[key] = val;
        }
      });
      setGlobalHoursSettings(prev => ({ ...prev, ...hoursMap }));
    }).catch(() => {});

    base44.entities.OvertimeRulePeriod.list('-start_date', 100).then(data => {
      if (Array.isArray(data)) setOvertimeRules(data);
    }).catch(() => {});

    EmployeePayrollProfile.list().then(data => {
      if (Array.isArray(data)) setPayrollProfiles(data);
    }).catch(() => {});
  }, []);

  // Merge fetched users with prop users
  const users = useMemo(() => {
    const fetched = fetchedUsers.length > 0 ? fetchedUsers : [];
    const prop = Array.isArray(usersProp) ? usersProp : [];
    const merged = [...fetched];
    prop.forEach(u => {
      if (u && u.id && !merged.find(m => m.id === u.id)) merged.push(u);
    });
    return merged.length > 0 ? merged : prop;
  }, [fetchedUsers, usersProp]);

  // Close panel when clicking outside
  useEffect(() => {
    if (!workerPanelOpen) return;
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setWorkerPanelOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [workerPanelOpen]);

  const toggleUser = (uid) => {
    setSelectedUsers(prev => {
      if (prev === null) {
        const allIds = new Set((users || []).map(u => u.id));
        allIds.delete(uid);
        return allIds.size === 0 ? null : allIds;
      }
      const next = new Set(prev);
      if (next.has(uid)) {
        next.delete(uid);
        if (next.size === 0) return null;
      } else {
        next.add(uid);
        if (next.size >= (users || []).length) return null;
      }
      return next;
    });
  };

  const handleDateRange = (val) => {
    setDateRange(val);
    const now = new Date();
    if (val === 'month') {
      setStartDate(startOfMonth(now));
      setEndDate(endOfMonth(now));
    } else if (val === 'week') {
      setStartDate(startOfWeek(now, { weekStartsOn: 1 }));
      setEndDate(endOfWeek(now, { weekStartsOn: 1 }));
    }
  };

  const periodTimesheets = useMemo(() => {
    return (timesheets || []).filter(ts => {
      if (!ts.clock_in_time) return false;
      try {
        const d = parseISO(ts.clock_in_time);
        return d >= startDate && d <= endDate;
      } catch { return false; }
    });
  }, [timesheets, startDate, endDate]);

  const days = useMemo(() => {
    return eachDayOfInterval({ start: startDate, end: endDate }).slice(0, 31);
  }, [startDate, endDate]);

  // Build OT data per user — aggregate per day first, then apply rules
  const otByUser = useMemo(() => {
    // Step 1: aggregate total worked minutes per user per day
    const dailyMinutes = {}; // { uid: { dayKey: totalMins } }

    periodTimesheets.forEach(ts => {
      const uid = ts.employee_id;
      if (!uid) return;
      let dayKey = '';
      try { dayKey = format(parseISO(ts.clock_in_time), 'yyyy-MM-dd'); } catch { return; }
      if (!dayKey) return;
      const mins = ts.total_duration_minutes || 0;
      if (mins <= 0) return;
      if (!dailyMinutes[uid]) dailyMinutes[uid] = {};
      dailyMinutes[uid][dayKey] = (dailyMinutes[uid][dayKey] || 0) + mins;
    });

    // Step 2: apply OT rules per user per day
    const byUser = {};

    Object.entries(dailyMinutes).forEach(([uid, userDays]) => {
      Object.entries(userDays).forEach(([dayKey, totalMins]) => {
        // Check if an OvertimeRulePeriod is active for this date
        const activeRule = getActiveOvertimeRule(overtimeRules, dayKey);

        const regularHoursPerDay = activeRule
          ? (activeRule.regular_hours_per_day ?? globalHoursSettings.regular_hours_per_day ?? 8)
          : (globalHoursSettings.regular_hours_per_day ?? 8);
        const nonPayableOvertimeHours = activeRule
          ? (activeRule.non_payable_overtime_hours ?? globalHoursSettings.non_payable_overtime_hours ?? 0)
          : (globalHoursSettings.non_payable_overtime_hours ?? 0);

        const totalHours = totalMins / 60;
        const extraHours = Math.max(0, totalHours - regularHoursPerDay);
        if (extraHours <= 0) return;

        const nonPayableOTHours = Math.min(extraHours, nonPayableOvertimeHours);
        const paidOTHours = Math.max(0, extraHours - nonPayableOvertimeHours);

        const paidOTMins = paidOTHours * 60;
        const unpaidOTMins = nonPayableOTHours * 60;
        const totalOTMins = extraHours * 60;

        if (!byUser[uid]) {
          byUser[uid] = { days: {}, totalPaidOTMins: 0, totalUnpaidOTMins: 0, totalOTMins: 0, daysWithOT: 0 };
        }

        byUser[uid].days[dayKey] = { paidMins: paidOTMins, unpaidMins: unpaidOTMins };
        byUser[uid].daysWithOT++;
        byUser[uid].totalPaidOTMins += paidOTMins;
        byUser[uid].totalUnpaidOTMins += unpaidOTMins;
        byUser[uid].totalOTMins += totalOTMins;
      });
    });

    return byUser;
  }, [periodTimesheets, globalHoursSettings, overtimeRules]);

  const isUserSelected = (uid) => selectedUsers === null || selectedUsers.has(uid);

  const handleCellClick = (user, dayKey) => {
    const userAllTimesheets = periodTimesheets.filter(ts => ts.employee_id === user.id);
    const sessions = userAllTimesheets.filter(ts => {
      try { return format(parseISO(ts.clock_in_time), 'yyyy-MM-dd') === dayKey; } catch { return false; }
    }).sort((a, b) => new Date(a.clock_in_time) - new Date(b.clock_in_time));
    setDrillDown({ user, dayKey, sessions, allTimesheets: userAllTimesheets });
  };

  // userData: ALL users (sorted by OT desc), filtered by selection
  const userData = useMemo(() => {
    const allUsers = users || [];
    return allUsers
      .filter(u => u && u.id && isUserSelected(u.id))
      .map(u => {
        const ot = otByUser[u.id] || { days: {}, totalPaidOTMins: 0, totalUnpaidOTMins: 0, totalOTMins: 0, daysWithOT: 0 };
        return { user: u, ...ot };
      })
      .sort((a, b) => b.totalOTMins - a.totalOTMins);
  }, [users, otByUser, selectedUsers]);

  const totals = useMemo(() => {
    return userData.reduce((acc, u) => {
      acc.totalOTMins += u.totalOTMins;
      acc.unpaidMins += u.totalUnpaidOTMins;
      if (u.totalOTMins > 0) acc.workers++;
      // cost = paid OT hours × overtime rate
      const profile = payrollProfiles.find(p => p.employee_id === u.user?.id);
      const overtimeRate = profile?.overtime_hourly_rate || (profile?.ordinary_hourly_rate ? profile.ordinary_hourly_rate * 1.5 : 0);
      acc.totalCost += (u.totalPaidOTMins / 60) * overtimeRate;
      return acc;
    }, { totalOTMins: 0, unpaidMins: 0, workers: 0, totalCost: 0 });
  }, [userData, payrollProfiles]);

  // Chips: ALL users filtered by search
  const chipUsers = useMemo(() => {
    return (users || []).filter(u => {
      const name = (u.nickname || u.full_name || u.email || '').toLowerCase();
      return !userSearch || name.includes(userSearch.toLowerCase());
    });
  }, [users, userSearch]);

  const selectedCount = selectedUsers === null ? (users || []).length : selectedUsers.size;

  const handleExportCSV = () => {
    try {
      let csv = `Overtime Report\nPeriod: ${format(startDate, 'dd/MM/yyyy')} - ${format(endDate, 'dd/MM/yyyy')}\n\n`;
      csv += `Worker,Job Role,Days w/ OT,Total Time,Unpaid OT,Total (AED)`;
      days.forEach(d => { csv += `,${format(d, 'dd/MM')}`; });
      csv += '\n';
      userData.forEach(u => {
        const name = u.user?.nickname || u.user?.full_name || u.user?.email || 'Unknown';
        const role = u.user?.job_role || '-';
        const profile = payrollProfiles.find(p => p.employee_id === u.user?.id);
        const overtimeRate = profile?.overtime_hourly_rate || (profile?.ordinary_hourly_rate ? profile.ordinary_hourly_rate * 1.5 : 0);
        const userCost = (u.totalPaidOTMins / 60) * overtimeRate;
        csv += `${name},${role},${u.daysWithOT},${fmtH(u.totalOTMins)},${fmtH(u.totalUnpaidOTMins)},${userCost > 0 ? `AED ${userCost.toFixed(0)}` : '-'}`;
        days.forEach(d => {
          const key = format(d, 'yyyy-MM-dd');
          const day = u.days[key];
          const total = day ? day.paidMins + day.unpaidMins : 0;
          csv += `,${total > 0 ? fmtH(total) : ''}`;
        });
        csv += '\n';
      });
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `overtime-report-${format(startDate, 'yyyy-MM-dd')}_${format(endDate, 'yyyy-MM-dd')}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Overtime report exported!');
    } catch (e) {
      toast.error('Export failed');
    }
  };

  return (
    <div className="space-y-4">
      {/* Header + Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap items-end gap-3">
            {/* Period */}
            <div>
              <Label className="text-xs text-slate-500 mb-1 block">Period</Label>
              <Select value={dateRange} onValueChange={handleDateRange}>
                <SelectTrigger className="w-36">
                  <SelectValue>
                    {dateRange === 'week' ? 'This Week' : dateRange === 'month' ? 'This Month' : dateRange === 'custom' ? 'Custom Range' : 'Select...'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {dateRange === 'custom' && (
              <>
                <div>
                  <Label className="text-xs text-slate-500 mb-1 block">From</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm">
                        <CalendarIcon className="w-3 h-3 mr-1" />
                        {format(startDate, 'dd/MM/yyyy')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar mode="single" selected={startDate} onSelect={d => d && setStartDate(d)} />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label className="text-xs text-slate-500 mb-1 block">To</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm">
                        <CalendarIcon className="w-3 h-3 mr-1" />
                        {format(endDate, 'dd/MM/yyyy')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar mode="single" selected={endDate} onSelect={d => d && setEndDate(d)} />
                    </PopoverContent>
                  </Popover>
                </div>
              </>
            )}

            {/* Workers — collapsible dropdown */}
            {(users || []).length > 0 && (
              <div className="relative" ref={panelRef}>
                <Label className="text-xs text-slate-500 mb-1 block">Workers</Label>
                <button
                  onClick={() => setWorkerPanelOpen(p => !p)}
                  className={cn(
                    "flex items-center gap-2 h-10 px-3 rounded-md border text-sm transition-colors",
                    workerPanelOpen
                      ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                      : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                  )}
                >
                  <Users className="w-4 h-4" />
                  <span>
                    {selectedUsers === null
                      ? `All workers (${(users || []).length})`
                      : `${selectedCount} of ${(users || []).length} workers`}
                  </span>
                  {workerPanelOpen ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
                </button>

                {/* Dropdown panel */}
                {workerPanelOpen && (
                  <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-slate-200 rounded-lg shadow-xl w-72">
                    {/* Search + actions */}
                    <div className="p-2 border-b border-slate-100">
                      <div className="relative mb-2">
                        <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                        <Input
                          value={userSearch}
                          onChange={e => setUserSearch(e.target.value)}
                          placeholder="Search workers..."
                          className="h-8 text-xs pl-6 pr-6"
                        />
                        {userSearch && (
                          <button onClick={() => setUserSearch('')} className="absolute right-1.5 top-1/2 -translate-y-1/2">
                            <X className="w-3 h-3 text-slate-400" />
                          </button>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setSelectedUsers(null)}
                          className="text-xs text-indigo-600 hover:underline"
                        >
                          Select all
                        </button>
                        <span className="text-slate-300">|</span>
                        <button
                          onClick={() => setSelectedUsers(new Set())}
                          className="text-xs text-slate-500 hover:underline"
                        >
                          Deselect all
                        </button>
                      </div>
                    </div>

                    {/* User list */}
                    <div className="max-h-60 overflow-y-auto p-1">
                      {chipUsers.map(u => {
                        const uid = u.id;
                        const name = u.nickname || u.full_name || u.email || 'Unknown';
                        const selected = isUserSelected(uid);
                        const hasOT = !!(otByUser[uid] && otByUser[uid].totalOTMins > 0);
                        return (
                          <button
                            key={uid}
                            onClick={() => toggleUser(uid)}
                            className={cn(
                              "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors text-left",
                              selected
                                ? "bg-indigo-50 text-indigo-800"
                                : "text-slate-400 hover:bg-slate-50"
                            )}
                          >
                            {/* Checkbox */}
                            <div className={cn(
                              "w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center",
                              selected ? "bg-indigo-600 border-indigo-600" : "border-slate-300"
                            )}>
                              {selected && <span className="text-white text-[9px] font-bold">✓</span>}
                            </div>
                            <UserAvatar user={u} size="sm" />
                            <span className="flex-1 truncate font-medium">{name}</span>
                            {hasOT && (
                              <span className="text-[9px] bg-amber-100 text-amber-700 px-1 rounded font-semibold">OT</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            <Button onClick={handleExportCSV} size="sm" className="ml-auto bg-indigo-600 hover:bg-indigo-700 self-end">
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* KPI Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Workers with OT</p>
                <p className="text-3xl font-bold text-slate-900 mt-1">{totals.workers}</p>
              </div>
              <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-indigo-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Total OT Hours</p>
                <p className="text-3xl font-bold text-amber-600 mt-1">{fmtH(totals.totalOTMins)}</p>
              </div>
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Total Unpaid OT</p>
                <p className="text-3xl font-bold text-red-600 mt-1">{fmtH(totals.unpaidMins)}</p>
              </div>
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Matrix Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-600" />
            Overtime Hours Matrix
            <span className="text-xs font-normal text-slate-500 ml-2">
              {format(startDate, 'dd MMM yyyy')} – {format(endDate, 'dd MMM yyyy')}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {userData.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              No workers selected.
            </div>
          ) : (
            <div className="overflow-x-auto" style={{ maxWidth: '100%' }}>
              <table className="text-xs border-collapse" style={{ minWidth: 'max-content', width: '100%' }}>
                <thead>
                  <tr className="bg-slate-800 text-white">
                    <th className="sticky left-0 z-10 bg-slate-800 text-left px-3 py-2 font-semibold" style={{ minWidth: 180 }}>Employee</th>
                    <th className="px-2 py-2 text-center font-semibold whitespace-nowrap" style={{ minWidth: 60 }}>Days w/ OT</th>
                    <th className="px-2 py-2 text-center font-semibold text-amber-300 whitespace-nowrap" style={{ minWidth: 72 }}>Total Time</th>
                    <th className="px-2 py-2 text-center font-semibold text-red-300 whitespace-nowrap" style={{ minWidth: 72 }}>Unpaid OT</th>
                    <th className="px-2 py-2 text-center font-semibold text-green-300 whitespace-nowrap" style={{ minWidth: 80 }}>Total (AED)</th>
                    <th className="px-2 py-2 w-px bg-slate-600"></th>
                    {days.map(d => (
                      <th key={d.toISOString()} className="px-1 py-2 text-center font-medium whitespace-nowrap" style={{ minWidth: 46 }}>
                        <div className="text-[10px] text-slate-400">{format(d, 'EEE')}</div>
                        <div>{format(d, 'dd')}</div>
                        <div className="text-[9px] text-slate-400">{format(d, 'MMM')}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {userData.map((u, idx) => {
                    const name = u.user?.nickname || u.user?.full_name || u.user?.email || 'Unknown';
                    const role = u.user?.job_role || '';
                    return (
                      <tr key={u.user?.id || idx} className={cn("border-b border-slate-100", idx % 2 === 0 ? "bg-white" : "bg-slate-50")}>
                        <td className={cn("sticky left-0 z-10 px-3 py-1.5 border-r border-slate-200", idx % 2 === 0 ? "bg-white" : "bg-slate-50")}>
                          <div className="flex items-center gap-2">
                            <UserAvatar user={u.user} />
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-800 truncate">{name}</div>
                              {role && <div className="text-[10px] text-slate-400 truncate">{role}</div>}
                            </div>
                          </div>
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          {u.daysWithOT > 0
                            ? <Badge variant="secondary" className="text-[10px] px-1.5">{u.daysWithOT}</Badge>
                            : <span className="text-slate-300">-</span>}
                        </td>
                        <td className="px-2 py-1.5 text-center font-semibold text-amber-700">{fmtH(u.totalOTMins)}</td>
                        <td className="px-2 py-1.5 text-center font-semibold text-red-600">{fmtH(u.totalUnpaidOTMins)}</td>
                        <td className="px-2 py-1.5 text-center font-bold text-green-700">
                          {(() => {
                            const profile = payrollProfiles.find(p => p.employee_id === u.user?.id);
                            const overtimeRate = profile?.overtime_hourly_rate || (profile?.ordinary_hourly_rate ? profile.ordinary_hourly_rate * 1.5 : 0);
                            const cost = (u.totalPaidOTMins / 60) * overtimeRate;
                            return cost > 0 ? `AED ${cost.toFixed(0)}` : '-';
                          })()}
                        </td>
                        <td className="px-0 py-0 bg-slate-200 w-px"></td>
                        {days.map(d => {
                          const key = format(d, 'yyyy-MM-dd');
                          const day = u.days[key];
                          const totalMins = day ? day.paidMins + day.unpaidMins : 0;
                          const isToday = isSameDay(d, new Date());

                          // Calculate cost for this day's paid OT only
                          const profile = payrollProfiles.find(p => p.employee_id === u.user?.id);
                          const overtimeRate = profile?.overtime_hourly_rate || (profile?.ordinary_hourly_rate ? profile.ordinary_hourly_rate * 1.5 : 0);
                          const dayCost = day?.paidMins > 0 ? (day.paidMins / 60) * overtimeRate : 0;

                          return (
                            <td
                              key={key}
                              onClick={() => handleCellClick(u.user, key)}
                              className={cn("px-1 py-1.5 text-center text-[11px] cursor-pointer hover:ring-2 hover:ring-indigo-400 hover:ring-inset rounded", isToday && "bg-indigo-50", totalMins > 0 && !isToday && "bg-amber-50")}
                              title={day ? `Total OT: ${fmtH(totalMins)} | Unpaid: ${fmtH(day.unpaidMins)} | Paid: ${fmtH(day.paidMins)} | Cost: AED ${dayCost.toFixed(2)} | OT Rate: AED ${overtimeRate.toFixed(2)}/hr (from Payroll Profile) — Click to inspect sessions` : 'Click to inspect sessions'}
                            >
                              {totalMins > 0 ? (
                                <div className="flex flex-col gap-0.5">
                                  <span className={cn("font-semibold", day?.unpaidMins > 0 ? "text-red-600" : "text-amber-700")}>
                                    {fmtH(totalMins)}
                                  </span>
                                  {dayCost > 0 && (
                                    <span className="text-slate-500 text-[9px]">AED {dayCost.toFixed(0)}</span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-200">·</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                  <tr className="bg-slate-800 text-white font-bold border-t-2 border-slate-400">
                    <td className="sticky left-0 z-10 bg-slate-800 px-3 py-2">TOTAL</td>
                    <td className="px-2 py-2 text-center">—</td>
                    <td className="px-2 py-2 text-center text-amber-300">{fmtH(totals.totalOTMins)}</td>
                    <td className="px-2 py-2 text-center text-red-300">{fmtH(totals.unpaidMins)}</td>
                    <td className="px-2 py-2 text-center text-green-300">{totals.totalCost > 0 ? `AED ${totals.totalCost.toFixed(0)}` : '-'}</td>
                    <td className="px-0 bg-slate-700 w-px"></td>
                    {days.map(d => {
                      const key = format(d, 'yyyy-MM-dd');
                      let dayTotal = 0;
                      userData.forEach(u => {
                        if (u.days[key]) dayTotal += u.days[key].paidMins + u.days[key].unpaidMins;
                      });
                      return (
                        <td key={key} className="px-1 py-2 text-center text-xs text-amber-200">
                          {dayTotal > 0 ? fmtH(dayTotal) : ''}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-slate-500 px-1">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-amber-100 border border-amber-300"></div>
          <span>OT (paid)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-red-100 border border-red-300"></div>
          <span>OT with unpaid portion (red numbers)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-indigo-100 border border-indigo-300"></div>
          <span>Today</span>
        </div>
        <span className="ml-2">Hover a cell for breakdown · AED cost = paid OT × overtime rate · Click any cell to inspect sessions</span>
      </div>

      {drillDown && (
        <TimesheetDrillDownDialog
          isOpen={!!drillDown}
          onClose={() => setDrillDown(null)}
          user={drillDown.user}
          dayKey={drillDown.dayKey}
          sessions={drillDown.sessions}
          allTimesheets={drillDown.allTimesheets || []}
          regularHoursPerDay={globalHoursSettings.regular_hours_per_day ?? 8}
          nonPayableOvertimeHours={globalHoursSettings.non_payable_overtime_hours ?? 0}
          onRefresh={() => setDrillDown(null)}
        />
      )}
    </div>
  );
}