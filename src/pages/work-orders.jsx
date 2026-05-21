import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useData } from '@/components/DataProvider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Settings,
  CheckSquare,
  Loader2,
  AlertCircle,
  Trash2,
  ArchiveX,
  Users,
  Maximize2,
  Minimize2,
  ClipboardList,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import { format, startOfWeek, endOfWeek, addWeeks, addDays, isSameDay, parseISO, startOfMonth, endOfMonth, addMonths, addYears } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { TimeEntry, Team, User } from '@/entities/all';
import { createWorkOrderWithNumber } from '@/components/workorders/createWorkOrderWithNumber';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import Avatar from '@/components/Avatar';
import OverlapSheetPanel from '@/components/workorders/OverlapSheetPanel';
import WeekCalendarView from '@/components/workorders/WeekCalendarView';
import MonthCalendarView from '@/components/workorders/MonthCalendarView';
import DayCalendarView from '@/components/workorders/DayCalendarView';
import WorkOrderListView from '@/components/workorders/WorkOrderListView';
import WorkOrderDetailsDialog from '@/components/workorders/WorkOrderDetailsDialog';
import WorkOrderFiltersPanel from '@/components/workorders/WorkOrderFiltersPanel';
import MultipleWorkOrderPanel from '@/components/workorders/MultipleWorkOrderPanel';
import WorkOrderSettingsPanel from '@/components/workorders/WorkOrderSettingsPanel';
import TeamsManagementPanel from '@/components/workorders/TeamsManagementPanel';
import PlannerToolbar from '@/components/workorders/PlannerToolbar';
import UrgentOrderDialog from '@/components/workorders/UrgentOrderDialog';
import QuickWorkOrderCreator from '@/components/workorders/QuickWorkOrderCreator';
export default function WorkOrdersPage() {
  const {
    currentUser,
    currentCompany,
    loadProjects,
    loadUsers,
    loadCustomers,
    loadAssets,
    loadWorkOrderCategories,
    loadShiftTypes,
    loadClientEquipments,
    teams,
    refreshData,
  } = useData();

    // Estados
    const [entries, setEntries] = useState([]);
    const [projects, setProjects] = useState([]);
    const [users, setUsers] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [assets, setAssets] = useState([]);
    const [clientEquipments, setClientEquipments] = useState([]); // ✅ Added
    const [categories, setCategories] = useState([]);
    const [shiftTypes, setShiftTypes] = useState([]);
    const [projectCategories, setProjectCategories] = useState([]);
  const [reportsMap, setReportsMap] = useState(new Map());
    const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showMultiplePanel, setShowMultiplePanel] = useState(false);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [showOverlapPanel, setShowOverlapPanel] = useState(false);
  const [showTeamsManagement, setShowTeamsManagement] = useState(false);
  const [showUrgentDialog, setShowUrgentDialog] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [viewMode, setViewMode] = useState(() => {
    try {
      return localStorage.getItem('workOrdersViewMode') || 'week';
    } catch {
      return 'week';
    }
  });
  const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [currentDate, setCurrentDate] = useState(new Date());
  const [filters, setFilters] = useState({
    project_ids: [],
    team_ids: [],
    user_ids: [],
    category_ids: [],
    shift_type_ids: [],
    status: [],
    search: '',
    show_closed: false,
  });
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedEntries, setSelectedEntries] = useState(new Set());
  const [draggedWorkOrder, setDraggedWorkOrder] = useState(null);
  const [copiedWorkOrders, setCopiedWorkOrders] = useState(null);
  const [contextMenuDate, setContextMenuDate] = useState(null);
  const [viewBy, setViewBy] = useState(() => {
    try {
      return localStorage.getItem('workOrdersViewBy') || 'team';
    } catch {
      return 'team';
    }
  });
  const [listViewPeriod, setListViewPeriod] = useState('all');
  const [listCurrentDate, setListCurrentDate] = useState(new Date());
  const [listCurrentWeekStart, setListCurrentWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [listCurrentMonth, setListCurrentMonth] = useState(new Date());
  const [listCustomStartDate, setListCustomStartDate] = useState(null);
  const [listCustomEndDate, setListCustomEndDate] = useState(null);
  const [timeRange, setTimeRange] = useState('24h');
  const [selectedDayInWeek, setSelectedDayInWeek] = useState(new Date());
  const [hiddenOverlaps, setHiddenOverlaps] = useState(() => {
    try {
      const saved = localStorage.getItem('hiddenWorkOrderOverlaps');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isSavingWorkOrder, setIsSavingWorkOrder] = useState(false);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false); // ✅ NUEVO
  const [isPasting, setIsPasting] = useState(false); // ✅ NUEVO - loading state for paste
  const [isSolvingOverlaps, setIsSolvingOverlaps] = useState(false);
  const [approvedLeaves, setApprovedLeaves] = useState([]);

  const initialLoadDone = useRef(false);
  const lastLoadTimestamp = useRef(0);
  const isLoadingRef = useRef(false);
  const pendingUpdatesRef = useRef([]); // ✅ Queue for batch updates
  const updateTimerRef = useRef(null); // ✅ Timer for debouncing
  const isUpdatingRef = useRef(false); // ✅ Track if update is in progress
  const lastRefDataLoadRef = useRef(0); // ✅ Track last time we fetched reference data (projects, customers, etc.)

  useEffect(() => {
    try {
      localStorage.setItem('workOrdersViewMode', viewMode);
    } catch (error) {
      console.warn('Failed to save view mode:', error);
    }
  }, [viewMode]);

  useEffect(() => {
    try {
      localStorage.setItem('workOrdersViewBy', viewBy);
    } catch (error) {
      console.warn('Failed to save view by:', error);
    }
  }, [viewBy]);

  useEffect(() => {
    try {
      localStorage.setItem('hiddenWorkOrderOverlaps', JSON.stringify(hiddenOverlaps));
    } catch (error) {
      console.warn('Failed to save hidden overlaps:', error);
    }
  }, [hiddenOverlaps]);

  // ✅ OPTIMIZADO: Throttled loadData con cache de 30 segundos
  const loadData = useCallback(async (forceReloadUsers = false, skipThrottle = false, reloadRefData = false) => {
    const now = Date.now();
    const timeSinceLastLoad = now - lastLoadTimestamp.current;

    if (!forceReloadUsers && !skipThrottle && timeSinceLastLoad < 30000 && lastLoadTimestamp.current > 0) return;
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    setIsRefreshing(true);
    try {

      // Filter Work Orders by currentCompany if available
      // ✅ LOAD DATA STRATEGY: Load recent updates AND data for the current view range
      // This ensures we see old WOs scheduled for now, and new WOs recently updated
      
      let viewStart, viewEnd;
      if (viewMode === 'week') {
        const center = selectedDayInWeek || currentWeekStart;
        viewStart = addDays(center, -3);
        viewEnd = addDays(center, 3);
      } else if (viewMode === 'month') {
        viewStart = startOfMonth(currentMonth);
        viewEnd = endOfMonth(currentMonth);
      } else {
        viewStart = startOfWeek(new Date(), { weekStartsOn: 1 });
        viewEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
      }
      
      // ✅ Extended buffer: 6 months before and after to show all WOs
      const rangeStart = addMonths(viewStart, -6).toISOString();
      const rangeEnd = addMonths(viewEnd, 6).toISOString();
      
      // ✅ ULTRA OPTIMIZADO: Cargar solo lo necesario
      const entriesPromise = TimeEntry.list('-updated_date', 2000);
      const reportsPromise = base44.entities.WorkingReport.list('-updated_date', 2000).catch(()=>[]);
          
      const rangeEntriesPromise = (async () => {
        try {
          let res = await TimeEntry.list('-planned_start_time', 2000);
          const start = new Date(rangeStart);
          const end = new Date(rangeEnd);
          return (res || []).filter(e => {
            const d = e?.planned_start_time
              ? new Date(e.planned_start_time)
              : e?.start_time
              ? new Date(e.start_time)
              : e?.task_start_date
              ? new Date(`${e.task_start_date}T00:00:00`)
              : null;
            if (!d) return false;
            return d >= start && d <= end;
          });
        } catch {
          return [];
        }
      })();


      const shouldReloadRef = reloadRefData 
        || projects.length === 0 
        || users.length === 0 
        || customers.length === 0 
        || assets.length === 0 
        || categories.length === 0 
        || shiftTypes.length === 0 
        || (Date.now() - lastRefDataLoadRef.current > 10 * 60 * 1000);

      const projectsPromise = shouldReloadRef ? loadProjects() : Promise.resolve(projects);
      const usersPromise = (shouldReloadRef || forceReloadUsers) ? loadUsers(forceReloadUsers) : Promise.resolve(users);
      const customersPromise = shouldReloadRef ? loadCustomers() : Promise.resolve(customers);
      const assetsPromise = shouldReloadRef ? loadAssets() : Promise.resolve(assets);
      const clientEquipmentsPromise = (shouldReloadRef && loadClientEquipments) ? loadClientEquipments() : Promise.resolve(clientEquipments);
      const categoriesPromise = shouldReloadRef ? loadWorkOrderCategories() : Promise.resolve(categories);
      const shiftTypesPromise = shouldReloadRef ? loadShiftTypes() : Promise.resolve(shiftTypes);
      const projectCategoriesPromise = shouldReloadRef ? (async () => {
        try {
          const allEntities = await import('@/entities/all');
          if (allEntities.ProjectCategory) {
            return await allEntities.ProjectCategory.list('sort_order', 1000);
          }
          return [];
        } catch (e) {
          return [];
        }
      })() : Promise.resolve(projectCategories);

      const [recentEntriesRaw, rangeEntriesRaw, projectsData, usersData, customersData, assetsData, clientEquipmentsData, categoriesData, shiftTypesData, projectCategoriesData, workingReportsData] = await Promise.all([
        entriesPromise,
        rangeEntriesPromise,
        projectsPromise,
        usersPromise,
        customersPromise,
        assetsPromise,
        clientEquipmentsPromise,
        categoriesPromise,
        shiftTypesPromise,
        projectCategoriesPromise,
        reportsPromise
      ]);



      let ensuredProjects = Array.isArray(projectsData) ? projectsData : [];
      if (ensuredProjects.length === 0) {
        try { const cid = currentCompany?.id; ensuredProjects = Array.isArray(await (cid ? base44.entities.Project.filter({ branch_id: cid }, '-updated_date', 500) : base44.entities.Project.list('-updated_date', 500))) ? (cid ? await base44.entities.Project.filter({ branch_id: cid }, '-updated_date', 500) : await base44.entities.Project.list('-updated_date', 500)) : []; } catch {}
      }
      let ensuredAssets = Array.isArray(assetsData) ? assetsData : [];
      if (ensuredAssets.length === 0) {
        try { const cid = currentCompany?.id; const da = cid ? await base44.entities.Asset.filter({ branch_id: cid }, '-updated_date', 1000) : await base44.entities.Asset.list('-updated_date', 1000); ensuredAssets = Array.isArray(da) ? da : []; } catch {}
      }


      // ✅ MERGE & FILTER ENTRIES
      const mergedEntriesMap = new Map();
      
      // Helper to check if entry belongs to current company
      const belongsToCompany = (entry) => {
        if (!currentCompany?.id) return true; // Show all if no company selected
        if (entry.branch_id === currentCompany.id) return true; // Direct match

        // Check project branch (fallback for legacy data)
        const project = projectsData?.find(p => p.id === entry.project_id);
        if (project && project.branch_id === currentCompany.id) return true;

        // Check customer branch (entries created with customer_id only)
        if (entry.customer_id) {
          const customer = customersData?.find(c => c.id === entry.customer_id);
          if (customer && customer.branch_id === currentCompany.id) return true;
        }

        // Legacy/unknown entries without branch/project/customer: include them so Planner matches Orders
        if (!entry.branch_id && !entry.project_id && !entry.customer_id) return true;

        return false;
      };

      const recentEntries = (recentEntriesRaw || []);
      const rangeEntries = (rangeEntriesRaw || []);



      // Include only entries that have any scheduling, are active, or were created recently
      const hasScheduleOrRecent = (e) => {
        if (e?.planned_start_time || e?.start_time || e?.task_start_date) return true;
        if (e?.is_active) return true; // Currently clocked-in WO
        const sixtyDaysAgo = new Date();
        sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 180);
        return !!e?.created_date && new Date(e.created_date) >= sixtyDaysAgo;
      };

      recentEntries.forEach(e => { if (hasScheduleOrRecent(e)) mergedEntriesMap.set(e.id, e); });
      rangeEntries.forEach(e => {
        if (hasScheduleOrRecent(e)) {
          const existing = mergedEntriesMap.get(e.id);
          if (!existing || (e.updated_date && existing.updated_date && e.updated_date > existing.updated_date)) mergedEntriesMap.set(e.id, e);
        }
      });
      
      const mergedEntries = Array.from(mergedEntriesMap.values());


      // ✅ CRITICAL: Sync team_ids/employee_ids from tasks BEFORE filtering
      const normalizedEntries = mergedEntries.map(e => {
        const normalized = { ...e };
        if (normalized.tasks && normalized.tasks.length > 0) {
          const allTaskUserIds = new Set();
          const allTaskTeamIds = new Set();
          
          normalized.tasks.forEach(task => {
            (task.employee_ids || []).forEach(id => allTaskUserIds.add(id));
            (task.team_ids || []).forEach(id => allTaskTeamIds.add(id));
          });
          
          normalized.employee_ids = Array.from(allTaskUserIds);
          normalized.team_ids = Array.from(allTaskTeamIds);
        }
        return normalized;
      });

      // ✅ SIMPLIFIED: Show ALL entries that have tasks OR planned times within the view range
      const filteredForView = normalizedEntries.filter(e => {
        // ✅ Always show currently active (clocked-in) WOs
        if (e?.is_active) return true;

        // ✅ Check if work order has tasks within the view range
        if (e.tasks && e.tasks.length > 0) {
          const hasTaskInRange = e.tasks.some(task => {
            if (!task.date) return false;
            try {
              const taskDate = parseISO(task.date + 'T00:00:00');
              return taskDate >= new Date(rangeStart) && taskDate <= new Date(rangeEnd);
            } catch {
              return false;
            }
          });
          if (hasTaskInRange) return true;
        }
        
        // ✅ Check if WO planned_start_time is in range
        const inRange = (() => {
          const d = e?.planned_start_time
            ? new Date(e.planned_start_time)
            : e?.start_time
            ? new Date(e.start_time)
            : e?.task_start_date
            ? new Date(e.task_start_date + 'T00:00:00')
            : null;
          if (!d) return false;
          return d >= new Date(rangeStart) && d <= new Date(rangeEnd);
        })();
        
        return inRange;
      });

      // Normalize for Planner: if a WO lacks planned_start_time, derive it for display only
      const normalizedForView = filteredForView.map(e => {
        let enhancedEntry = { ...e };
        
        if (!enhancedEntry.planned_start_time) {
          // ✅ If WO has tasks, use the earliest task date as planned_start_time
          if (enhancedEntry.tasks && enhancedEntry.tasks.length > 0) {
            const tasksWithDates = enhancedEntry.tasks.filter(t => t.date).sort((a, b) => a.date.localeCompare(b.date));
            if (tasksWithDates.length > 0) {
              const firstTask = tasksWithDates[0];
              const startTime = firstTask.start_time || '07:00';
              const endTime = firstTask.end_time || '17:00';
              const start = new Date(firstTask.date + 'T' + startTime);
              const end = new Date(firstTask.date + 'T' + endTime);
              return { ...enhancedEntry, planned_start_time: start.toISOString(), planned_end_time: end.toISOString() };
            }
          }
          
          if (enhancedEntry.task_start_date) {
            const start = new Date(enhancedEntry.task_start_date + 'T07:00:00');
            const end = new Date(start);
            const durationH = enhancedEntry.duration_minutes ? Math.max(1, Math.ceil(enhancedEntry.duration_minutes / 60)) : 1;
            end.setHours(end.getHours() + durationH);
            return { ...enhancedEntry, planned_start_time: start.toISOString(), planned_end_time: enhancedEntry.planned_end_time || end.toISOString() };
          }
          if (enhancedEntry.start_time) {
            return { ...enhancedEntry, planned_start_time: enhancedEntry.start_time, planned_end_time: enhancedEntry.end_time || null };
          }
              if (!enhancedEntry.planned_start_time && !enhancedEntry.start_time && !enhancedEntry.task_start_date) {
            const today = new Date(); today.setHours(7, 0, 0, 0);
            const end = new Date(today); end.setHours(17, 0, 0, 0);
            return { ...enhancedEntry, planned_start_time: today.toISOString(), planned_end_time: end.toISOString() };
          }
        }
        return enhancedEntry;
      });


      setEntries(normalizedForView);

      // Build reports map with stronger fallbacks (by order id, time+users, time only, minute tolerance)
      try {
        const byOrderId = new Map();
        const byTimeUsers = new Map();
        const byTimeOnly = new Map();
        const toMinute = (iso) => {
          if (!iso) return null;
          const d = new Date(iso);
          return isNaN(d) ? null : d.toISOString().slice(0,16); // YYYY-MM-DDTHH:MM
        };
        const keyTU = (s,e,emps=[]) => {
          const a = toMinute(s), b = toMinute(e);
          if (!a || !b) return null;
          const em = (emps||[]).slice().sort().join('|');
          return `${a}-${b}#${em}`;
        };
        const keyT = (s,e) => {
          const a = toMinute(s), b = toMinute(e);
          return (a && b) ? `${a}-${b}` : null;
        };
        (workingReportsData || []).forEach(r => {
          // index by order id (latest wins)
          if (r?.time_entry_id) {
            const prev = byOrderId.get(r.time_entry_id);
            const prevTs = prev ? new Date(prev.updated_date || prev.end_time || 0).getTime() : -1;
            const currTs = new Date(r.updated_date || r.end_time || 0).getTime();
            if (!prev || currTs >= prevTs) byOrderId.set(r.time_entry_id, r);
          }
          // index by time window + users
          const kU = keyTU(r?.start_time, r?.end_time, r?.employee_ids);
          if (kU) {
            const prev = byTimeUsers.get(kU);
            const prevTs = prev ? new Date(prev.updated_date || prev.end_time || 0).getTime() : -1;
            const currTs = new Date(r.updated_date || r.end_time || 0).getTime();
            if (!prev || currTs >= prevTs) byTimeUsers.set(kU, r);
          }
          // index by time window only
          const kT = keyT(r?.start_time, r?.end_time);
          if (kT) {
            const arr = byTimeOnly.get(kT) || [];
            // keep unique by report_number, newest first
            const exists = arr.find(x => x.report_number === r.report_number);
            if (!exists) arr.push(r);
            arr.sort((a,b) => (new Date(b.updated_date||b.end_time||0)) - (new Date(a.updated_date||a.end_time||0)));
            byTimeOnly.set(kT, arr);
          }
        });
        // helper: try minute tolerance (+/- 1 minute) for time-only lookups
        const neighborKeys = (s,e) => {
          const base = [];
          const dS = new Date(s), dE = new Date(e);
          if (isNaN(dS) || isNaN(dE)) return base;
          const mins = [-1,0,1];
          mins.forEach(ms => mins.forEach(me => {
            const s2 = new Date(dS.getTime() + ms*60000);
            const e2 = new Date(dE.getTime() + me*60000);
            const k = keyT(s2.toISOString(), e2.toISOString());
            if (k) base.push(k);
          }));
          return Array.from(new Set(base));
        };
        const resolved = new Map();
        (normalizedForView || []).forEach(e => {
          let rep = byOrderId.get(e.id);
          if (!rep) {
            // try time + users from WO actual times
            const kU = keyTU(e?.start_time, e?.end_time, e?.employee_ids);
            if (kU) rep = byTimeUsers.get(kU);
          }
          if (!rep) {
            // try time-only with tolerance
            const keys = neighborKeys(e?.start_time, e?.end_time);
            for (const k of keys) {
              const arr = byTimeOnly.get(k);
              if (arr && arr.length) { rep = arr[0]; break; }
            }
          }
          if (rep?.report_number) resolved.set(e.id, rep.report_number);
        });
        setReportsMap(resolved);
      } catch (_) {}
      setProjects(ensuredProjects || projects);
      setUsers(usersData || users);
      setCustomers(customersData || customers);
      setAssets(ensuredAssets || assets);

      setClientEquipments(clientEquipmentsData || clientEquipments);
      setCategories(categoriesData || categories);
      // Ensure we always have ALL shift types (merge provider + DB)
      let ensuredShiftTypes = Array.isArray(shiftTypesData) ? shiftTypesData : [];
      try {
        const allShiftTypes = await base44.entities.ShiftType.list('sort_order', 1000);
        if (Array.isArray(allShiftTypes)) {
          const map = new Map();
          [...ensuredShiftTypes, ...allShiftTypes].forEach(s => { if (s?.id) map.set(s.id, s); });
          ensuredShiftTypes = Array.from(map.values());
        }
      } catch {}
      setShiftTypes(ensuredShiftTypes);
      setProjectCategories(projectCategoriesData || projectCategories);

      if (shouldReloadRef) {
        lastRefDataLoadRef.current = now;
      }
      lastLoadTimestamp.current = now;
    } catch (error) {
      
      toast.error('Failed to load work orders data');
    } finally {
      setIsRefreshing(false);
      isLoadingRef.current = false;
    }
  }, [currentCompany, loadProjects, loadUsers, loadCustomers, loadAssets, loadWorkOrderCategories, loadShiftTypes]);

  const loadAllData = useCallback(async () => {
    if (initialLoadDone.current) return;
    setIsLoading(true);
    try {
      await loadData(false, false, true);
      try { const ae = await import('@/entities/all'); if (ae.LeaveRequest) setApprovedLeaves((await ae.LeaveRequest.filter({ status: 'approved' })) || []); } catch {}
      initialLoadDone.current = true;
    } catch {} finally { setIsLoading(false); }
  }, [loadData]);

  const handleEditWorkOrder = useCallback((entry) => {
    const fresh = (entries || []).find(e => e.id === entry.id) || entry;
    setSelectedEntry(fresh);
    setShowEditDialog(true);
    loadData(true, true);
  }, [entries, loadData]);

  const handleSaveWorkOrder = useCallback(async (updatedEntry) => {
    if (isSavingWorkOrder) return;
    setIsSavingWorkOrder(true);
    try {
      if (!updatedEntry) { toast.error('Invalid work order data.'); return; }
      if (!updatedEntry.project_id) { toast.error('Please select a project for this work order.'); return; }

      // Enforce branch at creation time
      if (!updatedEntry.id) {
        const project = projects.find(p => p.id === updatedEntry.project_id);
        const resolvedBranch = updatedEntry.branch_id || project?.branch_id || currentCompany?.id;
        if (!resolvedBranch) {
          toast.error('Cannot create: missing Branch. Select a Project linked to a Branch or set a company.');
          return;
        }
        updatedEntry.branch_id = resolvedBranch;
      }

      if (!updatedEntry.planned_start_time && !updatedEntry.is_urgent) {
        toast.error('Please select a start date and time.');
        return;
      }

      if (updatedEntry.planned_start_time) {
        if (typeof updatedEntry.planned_start_time !== 'string') {
          toast.error('Invalid start time format.');
          return;
        }
        const testDate = parseISO(updatedEntry.planned_start_time);
        if (isNaN(testDate.getTime())) {
          toast.error('Invalid start time. Please select a valid date.');
          return;
        }
      }

      const userName = currentUser?.nickname || currentUser?.first_name || currentUser?.full_name || currentUser?.email || 'Unknown';

      if (updatedEntry.id) {
        

        const originalEntry = entries.find(e => e.id === updatedEntry.id);
        // New rule: block reschedule (date or time changes) if WO already clocked-in
        try {
          const rescheduleAttempt = (
            originalEntry?.planned_start_time !== updatedEntry.planned_start_time ||
            originalEntry?.planned_end_time !== updatedEntry.planned_end_time
          );
          const hasClockIn = !!(originalEntry?.start_time || originalEntry?.is_active);
          if (hasClockIn && rescheduleAttempt) {
            if (currentUser?.role !== 'admin') {
              toast.error('This work order has a clocked-in report and cannot be rescheduled.');
              return;
            }
            toast.warning('Clocked-in report detected. Admins can force reschedule.');
            const confirmForce = window.confirm('This work order has a clocked-in report. Force reschedule as admin?');
            if (!confirmForce) {
              toast.info('Reschedule cancelled');
              return;
            }
          }
        } catch (_) {
          // ignore guard errors
        }
        const wasNotRepeating = !originalEntry?.is_repeating; // ✅ CHANGED
        const isNowRepeating = updatedEntry.is_repeating && updatedEntry.recurrence_type && updatedEntry.recurrence_end_date; // ✅ CHANGED

        if (wasNotRepeating && isNowRepeating) {
          toast.info('Creating repeating work orders... This may take a moment.', { duration: 5000 });

          // Prepare base work order for backend
          const startDate = parseISO(updatedEntry.planned_start_time);

          // Calculate the first recurrence date (one period after start)
          let firstRecurrenceDate;
          if (updatedEntry.recurrence_type === 'daily') {
            firstRecurrenceDate = addDays(startDate, updatedEntry.recurrence_interval || 1);
          } else if (updatedEntry.recurrence_type === 'weekly') {
            firstRecurrenceDate = addWeeks(startDate, updatedEntry.recurrence_interval || 1);
          } else if (updatedEntry.recurrence_type === 'monthly') {
            firstRecurrenceDate = addMonths(startDate, updatedEntry.recurrence_interval || 1);
          } else if (updatedEntry.recurrence_type === 'yearly') {
            firstRecurrenceDate = addYears(startDate, updatedEntry.recurrence_interval || 1);
          } else {
            firstRecurrenceDate = addDays(startDate, 1);
          }

          // Prepare base WO without recurrence fields
          const {
            id,
            is_repeating,
            recurrence_type,
            recurrence_end_date,
            recurrence_interval,
            skip_weekends,
            created_date,
            updated_date,
            created_by,
            updated_by: oldUpdatedBy,
            activity_log: oldActivityLog,
            ...woData
          } = updatedEntry;

          const baseWorkOrder = {
            ...woData,
            planned_start_time: firstRecurrenceDate.toISOString(),
            planned_end_time: updatedEntry.planned_end_time
          };

          try {
            const result = await base44.functions.invoke('createRecurringWorkOrders', {
              baseWorkOrder,
              recurrence_type: updatedEntry.recurrence_type,
              recurrence_interval: updatedEntry.recurrence_interval || 1,
              recurrence_end_date: updatedEntry.recurrence_end_date,
              skip_weekends: updatedEntry.skip_weekends || false,
              branch_id: currentCompany?.id
            });

            if (result.data?.success) {
              toast.success(`Work order updated and ${result.data.total_created} additional instance(s) created!`, { duration: 5000 });
            } else {
              toast.warning('Work order updated but some recurring instances may have failed.');
            }
            lastLoadTimestamp.current = 0;
            await loadData(false, true, true);
          } catch (error) {
            toast.error(`Failed to create recurring work orders: ${error.message}`);
          }
        }

        const changes = [];

        if (originalEntry) {
          // Project changed
          if (originalEntry.project_id !== updatedEntry.project_id) {
            const oldProject = projects.find(p => p.id === originalEntry.project_id);
            const newProject = projects.find(p => p.id === updatedEntry.project_id);
            changes.push(`Project changed from "${oldProject?.name || 'Unknown'}" to "${newProject?.name || 'Unknown'}"`);
          }

          // Status changed
          if (originalEntry.status !== updatedEntry.status) {
            changes.push(`Status changed from "${originalEntry.status}" to "${updatedEntry.status}"`);
          }

          // Title changed
          if (originalEntry.title !== updatedEntry.title) {
            changes.push(`Title changed from "${originalEntry.title || 'Untitled'}" to "${updatedEntry.title || 'Untitled'}"`);
          }

          // Work notes changed
          if (originalEntry.work_notes !== updatedEntry.work_notes) {
            changes.push(`Work notes updated`);
          }

          // Teams changed
          const oldTeams = originalEntry.team_ids || [];
          const newTeams = updatedEntry.team_ids || [];
          if (JSON.stringify([...oldTeams].sort()) !== JSON.stringify([...newTeams].sort())) {
            const addedTeams = newTeams.filter(t => !oldTeams.includes(t));
            const removedTeams = oldTeams.filter(t => !newTeams.includes(t));
            if (addedTeams.length > 0) {
              const teamNames = addedTeams.map(id => teams.find(t => t.id === id)?.name || 'Unknown').join(', ');
              changes.push(`Teams added: ${teamNames}`);
            }
            if (removedTeams.length > 0) {
              const teamNames = removedTeams.map(id => teams.find(t => t.id === id)?.name || 'Unknown').join(', ');
              changes.push(`Teams removed: ${teamNames}`);
            }
          }

          // Users changed
          const oldUsers = originalEntry.employee_ids || [];
          const newUsers = updatedEntry.employee_ids || [];
          if (JSON.stringify([...oldUsers].sort()) !== JSON.stringify([...newUsers].sort())) {
            const addedUsers = newUsers.filter(u => !oldUsers.includes(u));
            const removedUsers = oldUsers.filter(u => !newUsers.includes(u));
            if (addedUsers.length > 0) {
              const user = addedUsers.map(id => {
                const user = users.find(u => u.id === id);
                return user ? (user.nickname || user.first_name || user.email) : 'Unknown';
              }).join(', ');
              changes.push(`Users added: ${user}`);
            }
            if (removedUsers.length > 0) {
              const user = removedUsers.map(id => {
                const user = users.find(u => u.id === id);
                return user ? (user.nickname || user.first_name || user.email) : 'Unknown';
              }).join(', ');
              changes.push(`Users removed: ${user}`);
            }
          }

          // Planned time changed
          if (originalEntry.planned_start_time !== updatedEntry.planned_start_time) {
            changes.push(`Start time changed to ${format(parseISO(updatedEntry.planned_start_time), 'dd/MM/yyyy HH:mm')}`);
          }

          if (originalEntry.planned_end_time !== updatedEntry.planned_end_time) {
            if (updatedEntry.planned_end_time) {
              changes.push(`End time changed to ${format(parseISO(updatedEntry.planned_end_time), 'dd/MM/yyyy HH:mm')}`);
            } else if (originalEntry.planned_end_time) {
              changes.push(`End time removed`);
            }
          }

          // ✅ Detectar activación/desactivación de recurrencia
          if (wasNotRepeating && isNowRepeating) { // ✅ CHANGED
            changes.push(`Made repeating (${updatedEntry.recurrence_type})`); // Changed text
          } else if (!wasNotRepeating && !isNowRepeating && originalEntry?.is_repeating) { // If it was repeating, but now isn't
             changes.push(`Repeating deactivated`); // Changed text
          }
        }

        // Crear entrada en activity_log
        const activity_log = [...(originalEntry?.activity_log || [])];

        activity_log.push({
          timestamp: new Date().toISOString(),
          action: 'Edited',
          user_email: currentUser?.email || 'unknown',
          user_name: userName,
          details: changes.length > 0 ? changes.join('. ') : `${updatedEntry.work_order_number || 'Work order'} updated.`
        });

        const updateData = {
          ...updatedEntry,
          is_repeating: updatedEntry.is_repeating, // Ensure this property is explicitly carried over
          updated_by: currentUser?.email || 'unknown',
          activity_log
        };

        await TimeEntry.update(updatedEntry.id, updateData);
      } else {
        // ✅ Pre-assign WO number synchronously (eliminates "pending" state in UI)
        const { created } = await createWorkOrderWithNumber({ updatedEntry, currentUser, currentCompany, projects });
        setEntries(prevEntries => [...prevEntries, created]);
        try { await base44.functions.invoke('syncWorkOrderTeams', { work_order_id: created.id }); } catch {}

        // Create recurrences for new WO if requested
        if (updatedEntry.is_repeating && updatedEntry.recurrence_type && updatedEntry.recurrence_end_date) {
          const startDate = parseISO(updatedEntry.planned_start_time);
          let firstRecurrenceDate;
          if (updatedEntry.recurrence_type === 'daily') {
            firstRecurrenceDate = addDays(startDate, updatedEntry.recurrence_interval || 1);
          } else if (updatedEntry.recurrence_type === 'weekly') {
            firstRecurrenceDate = addWeeks(startDate, updatedEntry.recurrence_interval || 1);
          } else if (updatedEntry.recurrence_type === 'monthly') {
            firstRecurrenceDate = addMonths(startDate, updatedEntry.recurrence_interval || 1);
          } else if (updatedEntry.recurrence_type === 'yearly') {
            firstRecurrenceDate = addYears(startDate, updatedEntry.recurrence_interval || 1);
          } else {
            firstRecurrenceDate = addDays(startDate, 1);
          }

          const { is_repeating, recurrence_type, recurrence_end_date, recurrence_interval, skip_weekends, ...woData } = updatedEntry;
          const baseWorkOrder = {
            ...woData,
            planned_start_time: firstRecurrenceDate.toISOString(),
            planned_end_time: updatedEntry.planned_end_time
          };

          try {
            const result = await base44.functions.invoke('createRecurringWorkOrders', {
              baseWorkOrder,
              recurrence_type,
              recurrence_interval: recurrence_interval || 1,
              recurrence_end_date,
              skip_weekends: skip_weekends || false,
              branch_id: currentCompany?.id
            });

            if (result.data?.success) {
              toast.success(`${result.data.total_created} additional instance(s) created`, { duration: 5000 });
            } else {
              toast.warning('Some recurring instances may have failed.');
            }
          } catch (e) {
            toast.error(`Failed to create recurring work orders: ${e.message}`);
          }
        }

        lastLoadTimestamp.current = 0;
        await loadData(false, true, true);

        // Toast removed per user request
      }

      if (updatedEntry.id) {
        setEntries(prevEntries => prevEntries.map(e => e.id === updatedEntry.id ? { ...e, ...updatedEntry } : e));
      }
      setShowEditDialog(false);
      setSelectedEntry(null);
      lastLoadTimestamp.current = 0;
      await loadData(false, true, true);
    } catch (error) {
      toast.error(`Failed to save work order: ${error.message}`);
    } finally {
      setIsSavingWorkOrder(false);
    }
  }, [currentUser, entries, projects, teams, users, isSavingWorkOrder]);

  const handleDeleteWorkOrder = useCallback(async (entryId) => {
    setEntries(prevEntries => prevEntries.filter(e => e.id !== entryId));
    setShowEditDialog(false);
    setSelectedEntry(null);
    try {
      await TimeEntry.delete(entryId);
      lastLoadTimestamp.current = 0;
      await loadData(false, true, true);
    } catch (error) {
      if (error.response?.status === 404 || error.message?.includes('not found')) {
        toast.info('Work order was already deleted');
      } else {
        toast.error(`Failed to delete: ${error.message || 'Unknown error'}`);
        lastLoadTimestamp.current = 0;
        loadData(false, true);
      }
    }
  }, [loadData, entries]);

  const handleCreateWorkOrder = useCallback((projectId = null, dateTime = null, initialStatus = 'open', teamId = null, userId = null) => {
    // ✅ Smart time allocation: set times based on existing WOs for the day
    let startTime, endTime;
    
    if (dateTime) {
      const targetDate = new Date(dateTime);
      targetDate.setHours(0, 0, 0, 0);
      
      // Find all WOs on the same day
      const dayWOs = entries.filter(e => {
        if (!e.planned_start_time) return false;
        const woDate = new Date(e.planned_start_time);
        woDate.setHours(0, 0, 0, 0);
        return woDate.getTime() === targetDate.getTime();
      }).sort((a, b) => {
        const timeA = a.planned_start_time ? new Date(a.planned_start_time).getTime() : 0;
        const timeB = b.planned_start_time ? new Date(b.planned_start_time).getTime() : 0;
        return timeA - timeB;
      });
      
      if (dayWOs.length === 0) {
        // First WO of the day: 7:00 - 17:00
        startTime = new Date(dateTime);
        startTime.setHours(7, 0, 0, 0);
        endTime = new Date(dateTime);
        endTime.setHours(17, 0, 0, 0);
      } else {
        // Not first WO: start at last WO's end time
        const lastWO = dayWOs[dayWOs.length - 1];
        if (lastWO.planned_end_time) {
          startTime = new Date(lastWO.planned_end_time);
          endTime = new Date(startTime);
          endTime.setHours(startTime.getHours() + 1, 0, 0, 0);
        } else {
          // Fallback if last WO has no end time
          startTime = new Date(dateTime);
          startTime.setHours(17, 0, 0, 0);
          endTime = new Date(dateTime);
          endTime.setHours(18, 0, 0, 0);
        }
      }
    } else {
      // No date provided, use defaults
      startTime = new Date();
      startTime.setHours(7, 0, 0, 0);
      endTime = new Date();
      endTime.setHours(17, 0, 0, 0);
    }
    
    // ✅ Pre-populate team_ids and employee_ids based on context (filter archived users)
    const preselectedTeamIds = teamId ? [teamId] : [];
    const preselectedEmployeeIds = userId 
      ? [userId] 
      : (teamId ? users.filter(u => u.team_id === teamId && !u.archived).map(u => u.id) : []);
    
    const newEntry = {
      project_id: projectId || null,
      planned_start_time: startTime.toISOString(),
      planned_end_time: endTime.toISOString(),
      status: initialStatus,
      employee_ids: preselectedEmployeeIds,
      team_ids: preselectedTeamIds,
    };
    setSelectedEntry(newEntry);
    setShowEditDialog(true);
  }, [entries, users]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedEntries.size === 0) { toast.info('No work orders selected'); return; }
    if (!confirm(`Delete ${selectedEntries.size} work order(s)? This cannot be undone.`)) return;
    if (isDeletingBulk) return;
    setIsDeletingBulk(true);
    try {
      const ids = Array.from(selectedEntries);
      toast.info(`Deleting ${ids.length} work orders...`, { duration: 10000 });
      let ok = 0, nf = 0, err = 0;
      for (const id of ids) {
        try { await TimeEntry.delete(id); ok++; await new Promise(r => setTimeout(r, 500)); }
        catch (e) { if (e.response?.status === 404 || e.message?.includes('not found')) nf++; else err++; }
      }
      const updated = await TimeEntry.list('-updated_date', 2000);
      setEntries(updated || []);
      setSelectedEntries(new Set()); setIsMultiSelectMode(false);
      if (ok > 0 && err === 0) toast.success(`${ok} work order(s) deleted.`);
      else if (ok > 0) toast.warning(`${ok} deleted, ${err} failed.`);
      else if (nf > 0) toast.info('All were already deleted.');
      else toast.error('Failed to delete.');
    } catch (e) { toast.error(`Failed: ${e.message}`); }
    finally { setIsDeletingBulk(false); }
  }, [selectedEntries, isDeletingBulk]);

  const handleBulkClose = useCallback(async () => {
    if (selectedEntries.size === 0 || isDeletingBulk) return;
    setIsDeletingBulk(true);
    const userName = currentUser?.nickname || currentUser?.first_name || currentUser?.email || 'Unknown';
    try {
      const ids = Array.from(selectedEntries);
      toast.info(`Closing ${ids.length} work orders...`, { duration: 10000 });
      let ok = 0, err = 0;
      for (const id of ids) {
        try {
          const orig = entries.find(e => e.id === id);
          const al = [...(orig?.activity_log || []), { timestamp: new Date().toISOString(), action: 'Edited', user_email: currentUser?.email || 'unknown', user_name: userName, details: 'Status changed to "closed"' }];
          await TimeEntry.update(id, { status: 'closed', closed_date: new Date().toISOString(), updated_by: currentUser?.email || 'unknown', activity_log: al });
          ok++;
          await new Promise(r => setTimeout(r, 400));
        } catch (e) { if (!(e.response?.status === 404)) err++; }
      }
      const updated = await TimeEntry.list('-updated_date', 300);
      setEntries(updated || []);
      setSelectedEntries(new Set()); setIsMultiSelectMode(false);
      toast.success(ok > 0 ? `${ok} work order(s) closed.` : 'No work orders closed.');
    } catch (e) { toast.error('Failed to close work orders'); }
    finally { setIsDeletingBulk(false); }
  }, [selectedEntries, currentUser, entries, isDeletingBulk]);

  const handleBulkArchive = useCallback(async () => {
    if (selectedEntries.size === 0 || isDeletingBulk) return;
    setIsDeletingBulk(true);
    const userName = currentUser?.nickname || currentUser?.first_name || currentUser?.email || 'Unknown';
    try {
      const ids = Array.from(selectedEntries);
      toast.info(`Archiving ${ids.length} work orders...`, { duration: 10000 });
      let ok = 0, err = 0;
      for (const id of ids) {
        try {
          const orig = entries.find(e => e.id === id);
          const al = [...(orig?.activity_log || []), { timestamp: new Date().toISOString(), action: 'Archived', user_email: currentUser?.email || 'unknown', user_name: userName, details: 'Work order archived.' }];
          await TimeEntry.update(id, { status: 'closed', updated_by: currentUser?.email || 'unknown', activity_log: al });
          ok++;
          await new Promise(r => setTimeout(r, 400));
        } catch (e) { if (!(e.response?.status === 404)) err++; }
      }
      const updated = await TimeEntry.list('-updated_date', 300);
      setEntries(updated || []);
      setSelectedEntries(new Set()); setIsMultiSelectMode(false);
      toast.success(ok > 0 ? `${ok} work order(s) archived.` : 'No work orders archived.');
    } catch (e) { toast.error('Failed to archive work orders'); }
    finally { setIsDeletingBulk(false); }
  }, [selectedEntries, currentUser, entries, isDeletingBulk]);

  const handleToggleSelection = useCallback((entryId) => {
    setSelectedEntries(prev => { const s = new Set(prev); s.has(entryId) ? s.delete(entryId) : s.add(entryId); return s; });
  }, []);

  // Sanitize WO for copy (imported from pasteUtils)
  const sanitizeWorkOrderForCopy = (wo) => ({ project_id: wo.project_id||null, work_order_number: wo.work_order_number, team_ids: Array.isArray(wo.team_ids)?wo.team_ids:(wo.team_id?[wo.team_id]:[]), employee_ids: Array.isArray(wo.employee_ids)?wo.employee_ids:(wo.employee_id?[wo.employee_id]:[]), work_order_category_id: wo.work_order_category_id||null, shift_type_id: wo.shift_type_id||null, title: wo.title||'', work_notes: '', equipment_ids: Array.isArray(wo.equipment_ids)?wo.equipment_ids:(wo.equipment_id?[wo.equipment_id]:[]), tasks: Array.isArray(wo.tasks)?wo.tasks.map(task=>({id:`task_${Date.now()}_${Math.random()}`,name:task.name,instructions:task.instructions||'',date:task.date,start_time:task.start_time,end_time:task.end_time,leader_id:task.leader_id||null,team_ids:Array.isArray(task.team_ids)?task.team_ids:[],employee_ids:Array.isArray(task.employee_ids)?task.employee_ids:[],shift_type_id:task.shift_type_id||null,status:'pending',work_done_items:[],spare_parts_items:[],work_pending_items:[],spare_parts_pending_items:[],other_file_urls:[]})):[], planned_start_time: wo.planned_start_time||null, planned_end_time: wo.planned_end_time||null, status:'open',client_signature_url:null,job_completion_status:null,client_feedback_comments:'',client_representative_name:'',client_representative_phone:'',file_urls:[] });

  const handleCopyWorkOrders = useCallback((workOrders, sourceDate) => {
    const sanitized = (workOrders || []).map(sanitizeWorkOrderForCopy);
    setCopiedWorkOrders({ workOrders: sanitized, sourceDate: sourceDate || new Date() });
    toast.success(`Copied ${sanitized.length} work order(s)`);
  }, []);

  const handlePasteWorkOrders = useCallback(async (targetDate) => {
    if (!copiedWorkOrders || isPasting) return;
    setIsPasting(true);
    const toastId = toast.loading(`Pasting ${copiedWorkOrders.workOrders.length} work order(s)...`, { duration: Infinity });
    try {
      const { pasteWorkOrders } = await import('@/components/workorders/utils/pasteUtils');
      const created = await pasteWorkOrders({ copiedWorkOrders, targetDate, entries, currentUser, currentCompany, setEntries });
      toast.dismiss(toastId);
      toast.success(`Pasted ${created.length} work order(s)`);
      lastLoadTimestamp.current = 0;
      await loadData(false, true, true);
    } catch (error) {
      toast.dismiss(toastId);
      toast.error('Failed to paste work orders');
      lastLoadTimestamp.current = 0;
      loadData(false, true);
    } finally {
      setIsPasting(false);
    }
  }, [copiedWorkOrders, loadData, currentUser, isPasting, entries, currentCompany]);

  const handleSaveMultipleWorkOrders = useCallback(async (workOrdersData) => {
    try {
      const { saveMultipleWorkOrders: _fn } = await import('@/components/workorders/handleSaveMultipleWorkOrders');
      await _fn({ workOrdersData, currentUser, currentCompany, loadData: async (...a) => { lastLoadTimestamp.current = 0; await loadData(...a); }, setShowMultiplePanel, toast });
    } catch (error) { toast.error('Failed to create work orders'); }
  }, [loadData, currentUser, currentCompany]);
  const handleDrop = useCallback(async (wo, eid, dt) => {
    if (!wo?.id || !dt || isUpdatingRef.current) return;
    isUpdatingRef.current = true;
    try {
      const s = dt instanceof Date ? dt : parseISO(dt);
      const o = parseISO(wo.planned_start_time);
      const endT = wo.planned_end_time ? new Date(s.getTime() + parseISO(wo.planned_end_time).getTime() - o.getTime()) : new Date(s.getTime() + 3600000);
      const dd = Math.round((new Date(s.toDateString()) - new Date(o.toDateString())) / 86400000);
      const shiftDate = (d) => d ? format(new Date(new Date(d + 'T00:00:00').getTime() + dd * 86400000), 'yyyy-MM-dd') : d;
      const tgt = eid && teams ? teams.find(t => t.id === eid) : null;
      const oldTids = new Set(wo.team_ids || []);
      const teamSwitch = tgt && eid !== '__unassigned__' && (!oldTids.has(eid) || oldTids.size !== 1);
      let nTeams = wo.team_ids ? [...wo.team_ids] : [];
      let nEmps = wo.employee_ids ? [...wo.employee_ids] : [];
      if (teamSwitch) {
        nTeams = [eid];
        const tu = (users || []).filter(u => u.team_id === eid && !u.archived);
        const ku = tu.filter(u => nEmps.includes(u.id));
        nEmps = ku.length > 0 ? ku.map(u => u.id) : tu.map(u => u.id);
      }
      const tasks = (wo.tasks || []).map(t => ({ ...t, date: shiftDate(t.date), ...(teamSwitch ? { team_ids: nTeams, employee_ids: nEmps } : {}), status: t.status }));
      const upd = { planned_start_time: s.toISOString(), planned_end_time: endT.toISOString(), tasks, team_ids: nTeams, employee_ids: nEmps, updated_by: currentUser?.email };
      setEntries(p => p.map(x => x.id === wo.id ? { ...x, ...upd } : x));
      setDraggedWorkOrder(null);
      await TimeEntry.update(wo.id, upd);
      toast.success(teamSwitch ? `Moved to team: ${tgt.name}` : 'Moved');
      setTimeout(() => { lastLoadTimestamp.current = 0; loadData(false, true); }, 500);
    } finally { setTimeout(() => { isUpdatingRef.current = false; }, 1000); }
  }, [currentUser, loadData, teams, users]);

  const handleOpenMultiplePanel = useCallback(async () => {
    // Open without forcing refetch to avoid rate limits; data is already in state
    setShowMultiplePanel(true);
  }, []);

  const handleWeekChange = useCallback((direction, customDate = null) => {
    if (customDate !== null && customDate !== undefined) {
      setCurrentWeekStart(customDate);
      setSelectedDayInWeek(customDate);
    } else if (direction === 0) {
      const today = new Date();
      setCurrentWeekStart(startOfWeek(today, { weekStartsOn: 1 }));
      setSelectedDayInWeek(today);
    } else if (direction !== null) {
      setCurrentWeekStart(prev => {
        const next = addWeeks(prev, direction);
        return next;
      });
      setSelectedDayInWeek(prev => addWeeks(prev, direction));
    }
  }, []);

  const handleMonthChange = useCallback((direction) => {
    if (direction === 0) {
      setCurrentMonth(new Date());
    } else {
      setCurrentMonth(prev => addMonths(prev, direction));
    }
  }, []);

  const handleDayChange = useCallback((direction) => {
    if (direction === 0) {
      setCurrentDate(new Date());
    } else {
      setCurrentDate(prev => addDays(prev, direction));
    }
  }, []);

  const handleDayInWeekChange = useCallback((direction) => {
    setSelectedDayInWeek(prev => addDays(prev, direction));
  }, []);

  const handlePrintDay = useCallback(() => {
    const targetDate = viewMode === 'day' ? currentDate : selectedDayInWeek;
    const dateStr = format(targetDate, 'yyyy-MM-dd');
    window.open(`/WorkOrdersSummaryPDFView?startDate=${dateStr}&endDate=${dateStr}&groupBy=team`, '_blank');
  }, [viewMode, currentDate, selectedDayInWeek]);

  const handleHideOverlaps = useCallback((overlapKeys) => {
    if (!overlapKeys || overlapKeys.length === 0) {
      toast.info('No overlaps selected');
      return;
    }
    setHiddenOverlaps(prev => [...prev, ...overlapKeys]);
    toast.success(`Hidden ${overlapKeys.length} overlap(s)`);
  }, []);

  const handleClearHiddenOverlaps = useCallback(() => {
    setHiddenOverlaps([]);
    toast.success('Cleared all hidden overlaps');
  }, []);

  const getCategoryColor = useCallback((categoryId) => {
    if (!categoryId) return 'bg-white border border-slate-300';
    const category = categories?.find(c => c.id === categoryId);
    if (!category) return 'bg-white border border-slate-300';
    const colorMap = {
      white: 'bg-white border border-slate-300',
      gray: 'bg-slate-100 border border-slate-300',
      red: 'bg-red-100 border border-red-300',
      yellow: 'bg-yellow-100 border border-yellow-300',
      green: 'bg-green-100 border border-green-300',
      blue: 'bg-blue-100 border border-blue-300',
      indigo: 'bg-indigo-100 border border-indigo-300',
      purple: 'bg-purple-100 border border-purple-300',
      pink: 'bg-pink-100 border border-pink-300',
      orange: 'bg-orange-100 border border-orange-300',
      teal: 'bg-teal-100 border border-teal-300',
    };
    return colorMap[category.color] || 'bg-white border border-slate-300';
  }, [categories]);

  const handleSaveTeamsChanges = async ({ teams: updatedTeams, users: updatedUsers }) => {
    try {
      for (const team of updatedTeams) {
        const orig = teams.find(t => t.id === team.id);
        if (orig) {
          const ch = {};
          if (orig.team_leader_id !== team.team_leader_id) ch.team_leader_id = team.team_leader_id;
          if (orig.worker_type !== team.worker_type) ch.worker_type = team.worker_type;
          if (Object.keys(ch).length > 0) await Team.update(team.id, ch);
        }
      }
      for (const user of updatedUsers) {
        const orig = users.find(u => u.id === user.id);
        if (orig) {
          const ch = {};
          if (orig.team_id !== user.team_id) ch.team_id = user.team_id;
          if (orig.is_team_leader !== user.is_team_leader) ch.is_team_leader = user.is_team_leader;
          if (Object.keys(ch).length > 0) await User.update(user.id, ch);
        }
      }
      await refreshData(['teams', 'users']);
      await loadData(true);
      setShowTeamsManagement(false);
      toast.success('Teams updated successfully');
    } catch (error) {
      toast.error('Failed to save team changes');
      throw error;
    }
  };

  const filteredEntries = useMemo(() => {
    if (!entries || !Array.isArray(entries)) return [];
    
    return entries.filter(entry => {
      if (filters.project_ids.length > 0 && !filters.project_ids.includes(entry.project_id)) return false;
      if (filters.team_ids.length > 0) {
        const allTeamIds = entry.team_id ? [...(entry.team_ids||[]), entry.team_id] : (entry.team_ids||[]);
        if (!allTeamIds.some(id => filters.team_ids.includes(id))) return false;
      }
      if (filters.user_ids.length > 0) {
        const allUserIds = entry.employee_id ? [...(entry.employee_ids||[]), entry.employee_id] : (entry.employee_ids||[]);
        if (!allUserIds.some(id => filters.user_ids.includes(id))) return false;
      }
      if (filters.category_ids.length > 0 && !filters.category_ids.includes(entry.work_order_category_id)) return false;
      if (filters.shift_type_ids.length > 0 && !filters.shift_type_ids.includes(entry.shift_type_id)) return false;
      if (filters.status.length > 0 && !filters.status.includes(entry.status)) return false;
      if (!filters.show_closed && entry.status === 'closed') return false;
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const project = projects?.find(p => p.id === entry.project_id);
        const customer = project ? customers?.find(c => c.id === project?.customer_id) : (entry.customer_id ? customers?.find(c => c.id === entry.customer_id) : null);
        const searchableText = [entry.work_order_number, entry.title, entry.work_notes, project?.name, customer?.name].filter(Boolean).join(' ').toLowerCase();
        if (!searchableText.includes(searchLower)) return false;
      }
      return true;
    });
  }, [entries, filters, projects, customers]);

  const workOrdersByUser = useMemo(() => {
    if (!filteredEntries || !Array.isArray(filteredEntries)) return [];
    return filteredEntries.filter(entry => {
      const employeeIds = entry.employee_ids || [];
      return employeeIds.length > 0 || !!entry.employee_id;
    });
  }, [filteredEntries]);

  const workOrdersByTeam = useMemo(() => {
    if (!filteredEntries || !Array.isArray(filteredEntries)) return [];
    return filteredEntries.filter(entry => {
      const teamIds = entry.team_ids || [];
      return teamIds.length > 0 || !!entry.team_id;
    });
  }, [filteredEntries]);

  // Normalize interval and robust same-day overlap helper
  const normalizeInterval = (entry) => {
    try {
      if (!entry?.planned_start_time) return null;
      const start = parseISO(entry.planned_start_time);
      if (!start || isNaN(start.getTime())) return null;
      let end = entry?.planned_end_time ? parseISO(entry.planned_end_time) : null;
      if (!end || isNaN(end.getTime()) || end <= start) {
        end = new Date(start);
        end.setHours(end.getHours() + 1);
      }
      return { start, end };
    } catch {
      return null;
    }
  };
  const overlapsSameDay = (i1, i2) => {
    if (!i1 || !i2) return false;
    if (!isSameDay(i1.start, i2.start)) return false;
    return i1.start < i2.end && i2.start < i1.end;
  };

  const overlappingUsersMap = useMemo(() => {
    const map = new Map();
    if (!workOrdersByUser || !Array.isArray(workOrdersByUser) || !users || !Array.isArray(users)) {
      return map;
    }
    const addHours = (date, hours) => {
      const newDate = new Date(date);
      newDate.setHours(newDate.getHours() + hours);
      return newDate;
    };
    
    // ✅ Create a Set of current WO IDs for validation
    const currentWOIds = new Set((entries || []).map(e => e.id));
    
    const userToWorkOrdersMap = new Map();
    workOrdersByUser.forEach(entry => {
      // ✅ Skip if WO doesn't exist in current entries
      if (!currentWOIds.has(entry.id)) return;
      
      const employeeIds = entry.employee_ids || [];
      
      employeeIds.forEach(userId => {
        if (!userToWorkOrdersMap.has(userId)) {
          userToWorkOrdersMap.set(userId, []);
        }
        userToWorkOrdersMap.get(userId).push(entry);
      });
    });
    
    userToWorkOrdersMap.forEach((userWorkOrders, userId) => {
      const user = users?.find(u => u.id === userId);
      if (!user) return;
      
      // Remove duplicates by ID
      const uniqueWorkOrders = Array.from(new Map(userWorkOrders.map(wo => [wo.id, wo])).values());
      
      const conflicts = [];
      for (let i = 0; i < uniqueWorkOrders.length; i++) {
        for (let j = i + 1; j < uniqueWorkOrders.length; j++) {
          const wo1 = uniqueWorkOrders[i];
          const wo2 = uniqueWorkOrders[j];
          
          // Skip if same ID (should not happen after deduplication, but safety check)
          if (wo1.id === wo2.id) continue;
          
          // ✅ Skip if either WO doesn't exist in current entries
          if (!currentWOIds.has(wo1.id) || !currentWOIds.has(wo2.id)) continue;
          
          if (!wo1.planned_start_time || !wo2.planned_start_time) continue;
          try {
            const i1 = normalizeInterval(wo1);
            const i2 = normalizeInterval(wo2);
            if (!overlapsSameDay(i1, i2)) continue;
            const overlapStart = new Date(Math.max(i1.start.getTime(), i2.start.getTime()));
            const overlapEnd = new Date(Math.min(i1.end.getTime(), i2.end.getTime()));
            const uniqueKey = `user-${userId}-${wo1.id}-${wo2.id}-${format(i1.start, 'yyyy-MM-dd')}`;
            if (!hiddenOverlaps.includes(uniqueKey)) {
              conflicts.push({
                date: format(i1.start, 'dd/MM/yyyy'),
                wo1,
                wo2,
                overlapStart: format(overlapStart, 'HH:mm'),
                overlapEnd: format(overlapEnd, 'HH:mm'),
                uniqueKey,
                type: 'user'
              });
            }
          } catch (error) {
            console.warn('Error processing overlap for work orders:', error);
            continue;
          }
        }
      }
      if (conflicts.length > 0) {
        map.set(userId, {
          user,
          conflicts
        });
      }
    });
    
    return map;
  }, [workOrdersByUser, users, hiddenOverlaps, entries]);

  const overlappingTeamsMap = useMemo(() => {
    const map = new Map();
    if (!filteredEntries || !Array.isArray(filteredEntries) || !teams || !Array.isArray(teams)) {
      return map;
    }
    const addHours = (date, hours) => {
      const newDate = new Date(date);
      newDate.setHours(newDate.getHours() + hours);
      return newDate;
    };
    
    // ✅ Create a Set of current WO IDs for validation
    const currentWOIds = new Set((entries || []).map(e => e.id));
    
    // Agrupar TODAS las work orders por team
    const teamToWorkOrdersMap = new Map();
    filteredEntries.forEach(entry => {
      // ✅ Skip if WO doesn't exist in current entries
      if (!currentWOIds.has(entry.id)) return;
      
      const teamIds = entry.team_ids || [];
      
      teamIds.forEach(teamId => {
        if (!teamToWorkOrdersMap.has(teamId)) {
          teamToWorkOrdersMap.set(teamId, []);
        }
        teamToWorkOrdersMap.get(teamId).push(entry);
      });
    });
    
    // Detectar overlaps para cada team
    teamToWorkOrdersMap.forEach((teamWorkOrders, teamId) => {
      const team = teams?.find(t => t.id === teamId);
      if (!team) return;
      const uniqueWorkOrders = Array.from(new Map(teamWorkOrders.map(wo => [wo.id, wo])).values());
      
      const conflicts = [];
      
      for (let i = 0; i < uniqueWorkOrders.length; i++) {
        for (let j = i + 1; j < uniqueWorkOrders.length; j++) {
          const wo1 = uniqueWorkOrders[i];
          const wo2 = uniqueWorkOrders[j];
          
          // Skip if same ID (should not happen after deduplication, but safety check)
          if (wo1.id === wo2.id) continue;
          
          // ✅ Skip if either WO doesn't exist in current entries
          if (!currentWOIds.has(wo1.id) || !currentWOIds.has(wo2.id)) continue;
          
          if (!wo1.planned_start_time || !wo2.planned_start_time) continue;
          
          try {
            const i1 = normalizeInterval(wo1);
            const i2 = normalizeInterval(wo2);
            const hasOverlap = overlapsSameDay(i1, i2);
            if (!hasOverlap) continue;
            const overlapStart = new Date(Math.max(i1.start.getTime(), i2.start.getTime()));
            const overlapEnd = new Date(Math.min(i1.end.getTime(), i2.end.getTime()));
            const uniqueKey = `team-${teamId}-${wo1.id}-${wo2.id}-${format(i1.start, 'yyyy-MM-dd')}`;
            if (!hiddenOverlaps.includes(uniqueKey)) {
              conflicts.push({
                date: format(i1.start, 'dd/MM/yyyy'),
                wo1,
                wo2,
                overlapStart: format(overlapStart, 'HH:mm'),
                overlapEnd: format(overlapEnd, 'HH:mm'),
                uniqueKey,
                type: 'team'
              });
            }
          } catch (error) {
            console.warn('Error processing team overlap:', error);
            continue;
          }
        }
      }
      
      if (conflicts.length > 0) {
        map.set(teamId, {
          team,
          conflicts
        });
      }
    });
    return map;
  }, [filteredEntries, teams, hiddenOverlaps, entries]);

  const visibleOverlaps = useMemo(() => {
    const overlaps = [];
    
    // Add ONLY user overlaps (teams overlaps are not shown)
    overlappingUsersMap.forEach((data, userId) => {
      data.conflicts.forEach(conflict => {
        overlaps.push({
          user: data.user,
          team: null,
          conflict,
          overlapType: 'user',
          uniqueKey: conflict.uniqueKey
        });
      });
    });
    

    
    return overlaps;
  }, [overlappingUsersMap]);

  const handleSolveOverlapsWithAI = useCallback(async () => {
    if (visibleOverlaps.length === 0) { toast.info('No overlaps to solve'); return; }
    setIsSolvingOverlaps(true);
    const toastId = toast.loading(`Processing ${visibleOverlaps.length} overlaps...`, { duration: Infinity });
    try {
      const overlapsByDate = new Map();
      visibleOverlaps.forEach(o => {
        const date = o.conflict?.date; if (!date) return;
        if (!overlapsByDate.has(date)) overlapsByDate.set(date, new Set());
        if (o.conflict?.wo1?.id) overlapsByDate.get(date).add(o.conflict.wo1.id);
        if (o.conflict?.wo2?.id) overlapsByDate.get(date).add(o.conflict.wo2.id);
      });
      let totalUpdated = 0;
      for (const [date, woIds] of overlapsByDate.entries()) {
        toast.loading(`Processing ${date}...`, { id: toastId });
        try {
          const result = await base44.functions.invoke('solveWorkOrderOverlaps', { overlapping_work_orders: entries.filter(e => woIds.has(e.id)), teams });
          if (result.data?.success) totalUpdated += result.data.updated_count || 0;
          await new Promise(r => setTimeout(r, 1000));
        } catch {}
      }
      toast.dismiss(toastId);
      if (totalUpdated > 0) { toast.success(`Resolved overlaps. Updated ${totalUpdated} work order(s).`, { duration: 6000 }); await loadData(false, true); }
      else toast.warning('No updates were made.');
    } catch (e) { toast.dismiss(toastId); toast.error('Failed to solve overlaps: ' + e.message); }
    finally { setIsSolvingOverlaps(false); }
  }, [visibleOverlaps, entries, teams, loadData]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(currentWeekStart, { weekStartsOn: 1 });
    return Array.from({ length: 7 }).map((_, i) => addDays(start, i));
  }, [currentWeekStart]);

  const weekOverlaps = useMemo(() => {
    const overlaps = [];

    overlappingUsersMap.forEach((data, userId) => {
      const conflictsArray = data.conflicts || [];
      conflictsArray.forEach(conflict => {
        const wo1Date = conflict.wo1?.planned_start_time ? parseISO(conflict.wo1.planned_start_time) : null;
        const wo2Date = conflict.wo2?.planned_start_time ? parseISO(conflict.wo2.planned_start_time) : null;

        const isInWeek = (wo1Date && weekDays.some(day => isSameDay(day, wo1Date))) ||
                        (wo2Date && weekDays.some(day => isSameDay(day, wo2Date)));

        if (isInWeek) {
          overlaps.push({
            userId,
            conflict,
            user: data.user
          });
        }
      });
    });

    return overlaps;
  }, [overlappingUsersMap, weekDays, users]);

  useEffect(() => {
    if (currentUser) {
      loadAllData();
    }
  }, [currentUser, loadAllData]);

  // ✅ Reload data when week/month changes (NOT on initial mount or viewMode change)
  const prevWeekRef = useRef(currentWeekStart);
  const prevMonthRef = useRef(currentMonth);
  
  useEffect(() => {
    // Only reload if the actual week/month changed (not initial mount)
    const weekChanged = prevWeekRef.current?.getTime() !== currentWeekStart?.getTime();
    const monthChanged = prevMonthRef.current?.getTime() !== currentMonth?.getTime();
    
    if (initialLoadDone.current && (weekChanged || monthChanged)) {
      prevWeekRef.current = currentWeekStart;
      prevMonthRef.current = currentMonth;
      loadData(false, true); // Force reload when navigating weeks/months
    }
  }, [currentWeekStart, currentMonth]);
  // ✅ REMOVED: loadData from dependencies to prevent unnecessary re-runs

  useEffect(() => {
    window.workOrdersToggleMultiSelect = () => {
      setIsMultiSelectMode(prev => {
        if (prev) {
          setSelectedEntries(new Set());
        }
        return !prev;
      });
    };

    return () => {
      delete window.workOrdersToggleMultiSelect;
    };
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="h-2 w-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
          <div className="h-2 w-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full overflow-auto bg-slate-50 relative">
      <style>{`
        body { overflow-x: auto !important; }
      `}</style>
      {!isExpanded && (
        <>
          {/* Title + Settings Bar */}
          <div className="sticky left-0 z-40 mx-3 md:mx-6 mt-3 mb-2">
            <Card className="p-2 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg ${currentCompany?.schedule_tab_icon_url ? '' : 'bg-orange-100'}`}>
                    {currentCompany?.schedule_tab_icon_url ? (
                      <img src={currentCompany.schedule_tab_icon_url} alt="Schedule" className="w-7 h-7 object-contain" />
                    ) : (
                      <ClipboardList className="w-4 h-4 text-orange-600" />
                    )}
                  </div>
                  <h1 className="text-lg font-bold text-slate-900">Planner</h1>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setShowSettingsPanel(true)} className="h-7 px-2 text-[11px]">
                    <Settings className="w-3 h-3 mr-1" />
                    Settings
                  </Button>
                </div>
              </div>
            </Card>
          </div>

          {/* Multi-select bar (only when active) */}
          {isMultiSelectMode && (
            <div className="sticky left-0 z-39 mx-3 md:mx-6 mt-2">
              <Card className="p-2 md:p-3 bg-indigo-50 border-indigo-200 shadow-sm">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 md:gap-3">
                    <CheckSquare className="w-4 h-4 md:w-5 md:h-5 text-indigo-600" />
                    <span className="text-sm md:text-base font-semibold text-indigo-900">{selectedEntries.size} work order(s) selected</span>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => { setIsMultiSelectMode(false); setSelectedEntries(new Set()); }}
                      disabled={isDeletingBulk}
                      className="text-xs flex-1 sm:flex-none"
                    >
                      Cancel
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleBulkClose} 
                      disabled={selectedEntries.size === 0 || isDeletingBulk}
                      className="text-xs flex-1 sm:flex-none bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
                    >
                      {isDeletingBulk ? (
                        <Loader2 className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2 animate-spin" />
                      ) : (
                        <CheckSquare className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                      )}
                      <span className="hidden sm:inline">Close</span>
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleBulkArchive} 
                      disabled={selectedEntries.size === 0 || isDeletingBulk}
                      className="text-xs flex-1 sm:flex-none"
                    >
                      {isDeletingBulk ? (
                        <Loader2 className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2 animate-spin" />
                      ) : (
                        <ArchiveX className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                      )}
                      <span className="hidden sm:inline">Archive</span>
                    </Button>
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      onClick={handleBulkDelete} 
                      disabled={selectedEntries.size === 0 || isDeletingBulk}
                      className="text-xs flex-1 sm:flex-none"
                    >
                      {isDeletingBulk ? (
                        <Loader2 className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2 animate-spin" />
                      ) : (
                        <Trash2 className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                      )}
                      <span className="hidden sm:inline">Delete</span>
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </>
      )}

      {viewMode !== 'list' && (
        <div
          className={cn(
            "fixed z-40 transition-all",
            isExpanded ? "top-4 right-4" : "top-[240px] right-4"
          )}
        >
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="shadow-lg bg-white/95 backdrop-blur-sm hover:bg-white border-2"
          >
            {isExpanded ? (
              <>
                <Minimize2 className="w-4 h-4 mr-2" />
                Exit Fullscreen
              </>
            ) : (
              <>
                <Maximize2 className="w-4 h-4 mr-2" />
                Expand View
              </>
            )}
          </Button>
        </div>
      )}

        <div className="px-6 py-3">
          <Tabs value={viewMode === '3days' ? 'week' : viewMode} onValueChange={(v) => setViewMode(v)}>
            <PlannerToolbar
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              currentDateLabel={viewMode === 'week' ? `${format(addDays(selectedDayInWeek, -3), 'MMM d')} - ${format(addDays(selectedDayInWeek, 3), 'MMM d, yyyy')}` : viewMode === '3days' ? `${format(addDays(selectedDayInWeek, -1), 'MMM d')} - ${format(addDays(selectedDayInWeek, 1), 'MMM d, yyyy')}` : viewMode === 'month' ? format(currentMonth, 'MMMM yyyy') : viewMode === 'day' ? format(currentDate, 'EEEE, MMM d, yyyy') : 'All Work Orders'}
              onNavigatePrev={() => { if (viewMode === 'week') handleWeekChange(-1); else if (viewMode === 'month') handleMonthChange(-1); else if (viewMode === 'day') handleDayChange(-1); else if (viewMode === '3days') handleDayInWeekChange(-1); }}
              onNavigateNext={() => { if (viewMode === 'week') handleWeekChange(1); else if (viewMode === 'month') handleMonthChange(1); else if (viewMode === 'day') handleDayChange(1); else if (viewMode === '3days') handleDayInWeekChange(1); }}
              onNavigateToday={() => { if (viewMode === 'week') handleWeekChange(0); else if (viewMode === 'month') handleMonthChange(0); else if (viewMode === 'day') handleDayChange(0); else if (viewMode === '3days') { setSelectedDayInWeek(new Date()); } }}
              todayLabel={viewMode === 'week' ? 'This Week' : viewMode === 'month' ? 'This Month' : viewMode === '3days' ? 'Today' : 'Today'}
              viewBy={viewBy}
              onViewByChange={setViewBy}
              searchQuery={filters.search}
              onSearchChange={(search) => setFilters(prev => ({ ...prev, search }))}
              onShowFilters={() => setShowFilters(true)}
              onShowTeams={() => setShowTeamsManagement(true)}
              onCreateWO={handleCreateWorkOrder}
              visibleOverlapsCount={visibleOverlaps.length}
              onShowOverlapPanel={() => setShowOverlapPanel(!showOverlapPanel)}
              timeRange={viewMode === 'day' ? timeRange : undefined}
              onTimeRangeChange={viewMode === 'day' ? setTimeRange : undefined}
              onPrintDay={handlePrintDay}
              onDayNavigatePrev={(viewMode === 'week' || viewMode === '3days') ? () => handleDayInWeekChange(-1) : undefined}
              onDayNavigateNext={(viewMode === 'week' || viewMode === '3days') ? () => handleDayInWeekChange(1) : undefined}
              selectedDayLabel={(viewMode === 'week' || viewMode === '3days') ? format(selectedDayInWeek, 'EEE, MMM d') : undefined}
            />

            <TabsContent value="week" className="mt-0">
            <QuickWorkOrderCreator
              projects={projects} teams={teams} users={users} categories={categories}
              shiftTypes={shiftTypes} assets={assets} customers={customers} allEntries={entries}
              onCreated={() => { lastLoadTimestamp.current = 0; loadData(false, true); }}
            />
            <WeekCalendarView
              currentWeekStart={currentWeekStart} onWeekChange={handleWeekChange}
              entries={filteredEntries} allEntries={entries} projects={projects}
              categories={categories} users={users} teams={teams} customers={customers}
              shiftTypes={shiftTypes} assets={assets} clientEquipments={clientEquipments}
              onEntryClick={handleEditWorkOrder} onCreateWO={handleCreateWorkOrder}
              getCategoryColor={getCategoryColor} isMultiSelectMode={isMultiSelectMode}
              selectedEntries={selectedEntries} onToggleSelection={handleToggleSelection}
              onDrop={handleDrop} draggedWorkOrder={draggedWorkOrder} onDragStart={setDraggedWorkOrder}
              isReadOnly={false} weekStartsOn={1}
              onCopyWorkOrders={handleCopyWorkOrders} onPasteWorkOrders={handlePasteWorkOrders}
              copiedWorkOrders={copiedWorkOrders} contextMenuDate={contextMenuDate}
              viewBy={viewBy} onViewByChange={setViewBy}
              workOrdersByUser={workOrdersByUser} workOrdersByTeam={workOrdersByTeam}
              overlappingUsersMap={overlappingUsersMap} showOverlapPanel={showOverlapPanel}
              onToggleOverlapPanel={setShowOverlapPanel}
              onDataChanged={() => { lastLoadTimestamp.current = 0; loadData(true, true); }}
              onHideOverlaps={handleHideOverlaps} onClearHiddenOverlaps={handleClearHiddenOverlaps}
              onShowFilters={() => setShowFilters(true)} onShowTeams={() => setShowTeamsManagement(true)}
              viewMode={viewMode} onViewModeChange={setViewMode} selectedDayInWeek={selectedDayInWeek}
            />
            <WorkOrderListView
              entries={filteredEntries} projects={projects} categories={categories} users={users}
              teams={teams} customers={customers} shiftTypes={shiftTypes} reportsMap={reportsMap}
              onEntryClick={handleEditWorkOrder} getCategoryColor={getCategoryColor}
              isMultiSelectMode={isMultiSelectMode} selectedEntries={selectedEntries}
              onToggleSelection={handleToggleSelection} isRefreshing={isRefreshing}
              onRefresh={loadData} onEditWorkOrder={handleEditWorkOrder}
              onBulkDelete={handleBulkDelete} onBulkArchive={handleBulkArchive}
              assets={assets} projectCategories={projectCategories} parentViewMode={viewMode}
              parentCurrentDate={currentDate} parentCurrentWeekStart={currentWeekStart}
              parentCurrentMonth={currentMonth}
            />
          </TabsContent>

          <TabsContent value="month" className="mt-0">
            <MonthCalendarView
              currentMonth={currentMonth}
              onMonthChange={handleMonthChange}
              entries={filteredEntries}
              projects={projects}
              categories={categories}
              users={users}
              teams={teams}
              customers={customers}
              shiftTypes={shiftTypes}
              assets={assets}
              clientEquipments={clientEquipments}
              onEntryClick={(entry) => {
                
                handleEditWorkOrder(entry);
              }}
              onCreateWO={handleCreateWorkOrder}
              getCategoryColor={getCategoryColor}
              isMultiSelectMode={isMultiSelectMode}
              selectedEntries={selectedEntries}
              onToggleSelection={handleToggleSelection}
              onDrop={handleDrop}
              draggedWorkOrder={draggedWorkOrder}
              onDragStart={setDraggedWorkOrder}
              isReadOnly={false}
              onCopyWorkOrders={handleCopyWorkOrders}
              onPasteWorkOrders={handlePasteWorkOrders}
              copiedWorkOrders={copiedWorkOrders}
              viewBy={viewBy}
              onViewByChange={setViewBy}
              onShowFilters={() => setShowFilters(true)}
              onShowTeams={() => setShowTeamsManagement(true)}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
            />
          </TabsContent>

          <TabsContent value="day" className="mt-0">
            <DayCalendarView
              currentDate={currentDate}
              onDateChange={handleDayChange}
              entries={filteredEntries}
              allEntries={entries} // ✅ Pass all entries for correct sequence counting
              projects={projects}
              categories={categories}
              users={users}
              teams={teams}
              customers={customers}
              shiftTypes={shiftTypes}
              assets={assets}
              clientEquipments={clientEquipments}
              onEntryClick={(entry) => {
                
                handleEditWorkOrder(entry);
              }}
              onCreateWO={handleCreateWorkOrder}
              getCategoryColor={getCategoryColor}
              isMultiSelectMode={isMultiSelectMode}
              selectedEntries={selectedEntries}
              onToggleSelection={handleToggleSelection}
              onDrop={handleDrop}
              draggedWorkOrder={draggedWorkOrder}
              onDragStart={(wo) => {
                
                setDraggedWorkOrder(wo);
              }}
              isReadOnly={false}
              onCopyWorkOrders={handleCopyWorkOrders}
              onPasteWorkOrders={handlePasteWorkOrders}
              copiedWorkOrders={copiedWorkOrders}
              viewBy={viewBy}
              onViewByChange={setViewBy}
              onDataChanged={() => { lastLoadTimestamp.current = 0; loadData(true, true); }}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              timeRange={timeRange}
              onTimeRangeChange={setTimeRange}
            />
          </TabsContent>

          {/* List view - only shown when viewMode is 'list' */}
          {viewMode === 'list' && <WorkOrderListView
              entries={filteredEntries}
              projects={projects}
              categories={categories}
              users={users}
              teams={teams}
              customers={customers}
              shiftTypes={shiftTypes}
              reportsMap={reportsMap}
              onEntryClick={(entry) => {

                handleEditWorkOrder(entry);
              }}
              getCategoryColor={getCategoryColor}
              isMultiSelectMode={isMultiSelectMode}
              selectedEntries={selectedEntries}
              onToggleSelection={handleToggleSelection}
              isRefreshing={isRefreshing}
              onRefresh={loadData}
              onEditWorkOrder={handleEditWorkOrder}
              onBulkDelete={handleBulkDelete}
              onBulkArchive={handleBulkArchive}
              assets={assets}
              projectCategories={projectCategories}
              parentViewMode={viewMode}
              parentCurrentDate={currentDate}
              parentCurrentWeekStart={currentWeekStart}
              parentCurrentMonth={currentMonth}
            />}
          </Tabs>

      </div>


      {showEditDialog && selectedEntry && (
        <WorkOrderDetailsDialog
          isOpen={showEditDialog}
          entry={selectedEntry}
          projects={projects}
          users={users}
          teams={teams}
          categories={categories}
          shiftTypes={shiftTypes}
          customers={customers}
          assets={assets}
          clientEquipments={clientEquipments}
          projectCategories={projectCategories}
          allEntries={entries}
          viewBy={viewBy}
          onSave={handleSaveWorkOrder}
          onDelete={handleDeleteWorkOrder}
          onClose={() => {
            
            setShowEditDialog(false);
            setSelectedEntry(null);
          }}
          isSaving={isSavingWorkOrder}
          onSelectExistingWorkOrder={(wo) => { setSelectedEntry({ ...wo, tasks: (wo.tasks || []).map(t => t.status === 'completed' ? t : { ...t, date: '', start_time: '', end_time: '', shift_type_id: '' }) }); }}
          onCreateNewWorkOrder={() => {
            setSelectedEntry({
              project_id: selectedEntry?.project_id || null,
              planned_start_time: new Date().toISOString(),
              planned_end_time: addDays(new Date(), 1).toISOString(),
              status: 'open',
              employee_ids: [],
              team_ids: [],
              equipment_ids: []
            });
          }}
        />
      )}

      <UrgentOrderDialog
        isOpen={showUrgentDialog}
        onClose={() => setShowUrgentDialog(false)}
        projects={projects}
        currentUser={currentUser}
        currentCompany={currentCompany}
        onCreated={async () => {
          await loadData(false, true);
          setShowUrgentDialog(false);
        }}
      />

      <WorkOrderFiltersPanel
        isOpen={showFilters}
        filters={filters}
        onFiltersChange={setFilters}
        projects={projects}
        teams={teams}
        users={users}
        categories={categories}
        shiftTypes={shiftTypes}
        onClose={() => setShowFilters(false)}
        isMultiSelectMode={isMultiSelectMode}
        onToggleMultiSelect={() => {
          setIsMultiSelectMode(!isMultiSelectMode);
          if (isMultiSelectMode) {
            setSelectedEntries(new Set());
          }
        }}
      />

      <MultipleWorkOrderPanel
        isOpen={showMultiplePanel}
        projects={projects}
        users={users}
        teams={teams}
        categories={categories}
        shiftTypes={shiftTypes}
        customers={customers}
        assets={assets}
        clientEquipments={clientEquipments}
        projectCategories={projectCategories}
        onSave={handleSaveMultipleWorkOrders}
        onClose={() => setShowMultiplePanel(false)}
        onRefreshData={async () => {

          try {
            const [projectsData, customersData] = await Promise.all([
              loadProjects(true),
              loadCustomers(true)
            ]);

            setProjects(projectsData || []);
            setCustomers(customersData || []);

            toast.success('Projects and customers refreshed');
          } catch (error) {
            console.error('❌ Failed to refresh:', error);
            toast.error('Failed to refresh data');
          }
        }}
        />

      <WorkOrderSettingsPanel
        isOpen={showSettingsPanel}
        categories={categories}
        shiftTypes={shiftTypes}
        onClose={() => setShowSettingsPanel(false)}
        onDataChanged={loadData}
      />

      {showTeamsManagement && (
        <TeamsManagementPanel
          isOpen={showTeamsManagement}
          onClose={() => setShowTeamsManagement(false)}
          teams={teams}
          users={users}
          onSave={handleSaveTeamsChanges}
        />
      )}

      {/* Overlap Panel */}
      <OverlapSheetPanel showOverlapPanel={showOverlapPanel} setShowOverlapPanel={setShowOverlapPanel} visibleOverlaps={visibleOverlaps} hiddenOverlaps={hiddenOverlaps} isSolvingOverlaps={isSolvingOverlaps} onSolveWithAI={handleSolveOverlapsWithAI} onClearHiddenOverlaps={handleClearHiddenOverlaps} onEditWorkOrder={handleEditWorkOrder} />

    </div>
  );
}