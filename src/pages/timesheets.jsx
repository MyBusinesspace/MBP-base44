import React, { useEffect, useMemo, useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Avatar from "@/components/Avatar";
import {
  Search, ChevronDown, Loader2, RefreshCw,
  Settings, Plus, X, Check, FileText, ChevronLeft, ChevronRight, Download
} from "lucide-react";
import { format, parseISO, startOfDay, endOfDay } from "date-fns";
import { useData } from "@/components/DataProvider";
import WorkOrderDetailsDialog from "@/components/workorders/WorkOrderDetailsDialog";
import WorkOrderPDFDialog from "@/components/workorders/WorkOrderPDFDialog";
import TimesheetsSettingsPanel from "@/components/timesheets/TimesheetsSettingsPanel";
import { cn } from "@/lib/utils";

const formatDateDubai = (iso) => {
  if (!iso) return '-';
  try {
    return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dubai', day: '2-digit', month: '2-digit', year: '2-digit' }).format(new Date(iso));
  } catch { return '-'; }
};

const formatWONumber = (n, refISO) => {
  if (!n) return '';
  const s = String(n).trim();
  if (/^\d{3,4}\/\d{2}$/.test(s)) return s;
  const plain = s.match(/^(\d{1,4})$/);
  const yy = (() => {
    if (!refISO) return new Date().getFullYear().toString().slice(-2);
    try { return new Date(refISO).getFullYear().toString().slice(-2); } catch { return new Date().getFullYear().toString().slice(-2); }
  })();
  if (plain) return `${plain[1].padStart(4, '0')}/${yy}`;
  const m = s.match(/^WO-(\d+)\/(\d{2})$/i);
  if (m) return `${m[1].padStart(4, '0')}/${m[2]}`;
  return s;
};

export default function TasksPage() {
  const { currentCompany, currentUser, loadUsers, loadProjects, loadCustomers, loadWorkOrderCategories, loadShiftTypes, loadAssets, loadClientEquipments, teams: contextTeams } = useData();

  const [loading, setLoading] = useState(true);
  const [workOrders, setWorkOrders] = useState([]);
  const [workingReports, setWorkingReports] = useState([]);
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [projects, setProjects] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [shiftTypes, setShiftTypes] = useState([]);
  const [assets, setAssets] = useState([]);
  const [clientEquipments, setClientEquipments] = useState([]);

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('open');
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const categoryDropdownRef = useRef(null);
  const [sortBy, setSortBy] = useState('open_date');
  const [sortOrder, setSortOrder] = useState('desc');

  const [selectedRows, setSelectedRows] = useState([]);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  const [selectedEntry, setSelectedEntry] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showPDFDialog, setShowPDFDialog] = useState(null);
  const [pdfAutoPrint, setPdfAutoPrint] = useState(false);
  const [weekTimesheets, setWeekTimesheets] = useState([]);

  const safeUsers = Array.isArray(users) ? users : [];
  const safeProjects = Array.isArray(projects) ? projects : [];
  const safeCustomers = Array.isArray(customers) ? customers : [];
  const safeCategories = Array.isArray(categories) ? categories : [];
  const safeAssets = Array.isArray(assets) ? assets : [];
  const safeClientEquipments = Array.isArray(clientEquipments) ? clientEquipments : [];
  const safeTeams = Array.isArray(teams) ? teams : [];

  useEffect(() => { setTeams(contextTeams || []); }, [contextTeams]);

  useEffect(() => {
    if (!categoryDropdownOpen) return;
    const handler = (e) => { if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(e.target)) setCategoryDropdownOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [categoryDropdownOpen]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [usersData, projectsData, customersData, categoriesData, shiftTypesData, assetsData, clientEqData, entriesData, reportsData, timesheetsData] = await Promise.all([
        loadUsers(),
        loadProjects(),
        loadCustomers(),
        loadWorkOrderCategories(),
        loadShiftTypes(),
        loadAssets(),
        loadClientEquipments(),
        base44.entities.TimeEntry.list('-updated_date', 2000),
        base44.entities.WorkingReport.list('-updated_date', 2000),
        base44.entities.TimesheetEntry.list('-clock_in_time', 2000),
      ]);
      setUsers(usersData || []);
      setProjects(projectsData || []);
      setCustomers(customersData || []);
      setCategories(categoriesData || []);
      setShiftTypes(shiftTypesData || []);
      setAssets(assetsData || []);
      setClientEquipments(clientEqData || []);
      setWorkOrders(entriesData || []);
      setWorkingReports(reportsData || []);
      setWeekTimesheets(timesheetsData || []);
    } finally {
      setLoading(false);
    }
  };

  // Build map: woId::userId -> { clockIn, clockOut } from timesheets
  const woUserTimeMap = useMemo(() => {
    const map = new Map();
    (weekTimesheets || []).forEach(ts => {
      if (!ts.work_order_segments || !ts.employee_id) return;
      ts.work_order_segments.forEach(seg => {
        if (!seg.work_order_id) return;
        const key = `${seg.work_order_id}::${ts.employee_id}`;
        const existing = map.get(key);
        const segIn = seg.start_time || ts.clock_in_time;
        const segOut = seg.end_time || ts.clock_out_time;
        if (!existing) {
          map.set(key, { clockIn: segIn, clockOut: segOut });
        } else {
          if (segIn && (!existing.clockIn || segIn < existing.clockIn)) existing.clockIn = segIn;
          if (segOut && (!existing.clockOut || segOut > existing.clockOut)) existing.clockOut = segOut;
        }
      });
    });
    return map;
  }, [weekTimesheets]);

  const handleViewPDF = async (wo, autoPrint = false) => {
    setPdfAutoPrint(autoPrint);
    const project = safeProjects.find(p => p.id === wo.project_id);
    const customer = project ? safeCustomers.find(c => c.id === project.customer_id) : null;
    const assignedUserIds = new Set([...(wo.employee_ids || []), ...(wo.tasks || []).flatMap(t => t.employee_ids || [])]);
    const assignedUsers = safeUsers.filter(u => assignedUserIds.has(u.id));
    const woCategory = safeCategories.find(c => c.id === wo.work_order_category_id);
    let branchData = null;
    try {
      const branchId = wo.branch_id || project?.branch_id;
      if (branchId) { const arr = await base44.entities.Branch.filter({ id: branchId }, '-updated_date', 1); branchData = arr?.[0] || null; }
    } catch {}
    setShowPDFDialog({ workOrder: wo, project, customer, branch: branchData, assignedUsers, assignedTeams: [], assignedAssets: [...safeAssets, ...safeClientEquipments].filter(a => (wo.equipment_ids || []).includes(a.id)), woCategory, shiftType: shiftTypes?.find(s => s.id === wo.shift_type_id) || null });
  };

  useEffect(() => { loadAllData(); }, []);

  // Build flat list of tasks — one row per task (or one row per WO if no tasks)
  const taskRows = useMemo(() => {
    const rows = [];

    (workOrders || []).forEach(wo => {
      // Branch filter
      if (currentCompany?.id && wo.branch_id && wo.branch_id !== currentCompany.id) return;

      const project = safeProjects.find(p => p.id === wo.project_id);
      const customer = project ? safeCustomers.find(c => c.id === project.customer_id) : null;
      const category = safeCategories.find(c => c.id === wo.work_order_category_id);
      const woReports = (workingReports || []).filter(r => r.time_entry_id === wo.id);
      const wr = woReports[0] || null;
      const reportsCount = woReports.length;
      const openDate = wo.planned_start_time || wo.start_time || wo.created_date || null;
      const woNumber = formatWONumber(wo.work_order_number || wo.work_order_ref, openDate);

      const tasks = wo.tasks && wo.tasks.length > 0 ? wo.tasks : [null];

      tasks.forEach(task => {
        const taskStatus = task?.status || null; // 'pending' | 'completed' | null
        const taskDate = task?.date ? task.date : null;
        const taskName = task?.name || '';
        const taskDesc = task?.instructions || '';

        // Status filter: map task status to open/closed
        // open = pending or null; closed = completed
        if (statusFilter === 'open' && taskStatus === 'completed') return;
        if (statusFilter === 'closed' && taskStatus !== 'completed') return;

        // Category filter
        if (selectedCategories.length > 0 && !selectedCategories.includes(wo.work_order_category_id)) return;

        // Date filter
        if (dateFrom || dateTo) {
          const dateStr = taskDate || (wo.planned_start_time ? format(parseISO(wo.planned_start_time), 'yyyy-MM-dd') : null);
          if (!dateStr) return;
          const d = parseISO(`${dateStr}T00:00:00`);
          if (dateFrom && d < startOfDay(new Date(dateFrom))) return;
          if (dateTo && d > endOfDay(new Date(dateTo))) return;
        }

        // Search filter
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          if (!(
            taskName.toLowerCase().includes(q) ||
            taskDesc.toLowerCase().includes(q) ||
            wo.title?.toLowerCase().includes(q) ||
            customer?.name?.toLowerCase().includes(q) ||
            project?.name?.toLowerCase().includes(q) ||
            category?.name?.toLowerCase().includes(q) ||
            woNumber.toLowerCase().includes(q)
          )) return;
        }

        rows.push({
          key: `${wo.id}-${task?.id || 'notask'}`,
          wo,
          task,
          taskName,
          taskDesc,
          taskStatus,
          taskDate,
          project,
          customer,
          category,
          reportsCount,
          openDate,
          woNumber,
          reportNumber: wr?.report_number || null,
        });
      });
    });

    // Sort
    rows.sort((a, b) => {
      let av, bv;
      if (sortBy === 'task_title') {
        av = a.taskName; bv = b.taskName;
      } else if (sortBy === 'client') {
        av = a.customer?.name || ''; bv = b.customer?.name || '';
      } else if (sortBy === 'project') {
        av = a.project?.name || ''; bv = b.project?.name || '';
      } else if (sortBy === 'category') {
        av = a.category?.name || ''; bv = b.category?.name || '';
      } else if (sortBy === 'wo_title') {
        av = a.wo.title || ''; bv = b.wo.title || '';
      } else {
        // open_date default
        av = a.taskDate || a.openDate || '';
        bv = b.taskDate || b.openDate || '';
      }
      return sortOrder === 'asc' ? (av || '').localeCompare(bv || '') : (bv || '').localeCompare(av || '');
    });

    return rows;
  }, [workOrders, workingReports, statusFilter, selectedCategories, dateFrom, dateTo, searchQuery, sortBy, sortOrder, currentCompany?.id, safeProjects, safeCustomers, safeCategories]);

  // Counts: per unique WO.status
  const periodCounts = useMemo(() => {
    let pending = 0, completed = 0;
    (workOrders || []).forEach(wo => {
      if (currentCompany?.id && wo.branch_id && wo.branch_id !== currentCompany.id) return;
      const tasks = wo.tasks && wo.tasks.length > 0 ? wo.tasks : [null];
      tasks.forEach(task => {
        if (task?.status === 'completed') completed++;
        else pending++;
      });
    });
    return { open: pending, closed: completed };
  }, [workOrders, currentCompany?.id]);

  const toggleSelect = (key) => setSelectedRows(prev => prev.includes(key) ? prev.filter(x => x !== key) : [...prev, key]);
  const toggleAll = () => setSelectedRows(prev => prev.length === taskRows.length ? [] : taskRows.map(r => r.key));

  const handleBulkMarkCompleted = async () => {
    if (!selectedRows.length) return;
    setIsBulkProcessing(true);
    try {
      // Group updates by WO
      const woUpdates = {};
      taskRows.filter(r => selectedRows.includes(r.key)).forEach(r => {
        if (!woUpdates[r.wo.id]) woUpdates[r.wo.id] = { wo: r.wo, taskIds: [] };
        if (r.task?.id) woUpdates[r.wo.id].taskIds.push(r.task.id);
      });
      for (const [woId, { wo, taskIds }] of Object.entries(woUpdates)) {
        const updatedTasks = (wo.tasks || []).map(t =>
          taskIds.includes(t.id) ? { ...t, status: 'completed' } : t
        );
        await base44.entities.TimeEntry.update(woId, { tasks: updatedTasks });
      }
      await loadAllData();
      setSelectedRows([]);
    } finally { setIsBulkProcessing(false); }
  };

  const handleBulkDelete = async () => {
    if (!selectedRows.length) return;
    if (!window.confirm(`Delete ${selectedRows.length} task(s)?`)) return;
    setIsBulkProcessing(true);
    try {
      const woIds = [...new Set(taskRows.filter(r => selectedRows.includes(r.key)).map(r => r.wo.id))];
      for (const id of woIds) await base44.entities.TimeEntry.delete(id);
      await loadAllData();
      setSelectedRows([]);
    } finally { setIsBulkProcessing(false); }
  };

  const handleToggleTaskStatus = async (row) => {
    if (!row.task?.id) return;
    const newStatus = row.taskStatus === 'completed' ? 'pending' : 'completed';
    const updatedTasks = (row.wo.tasks || []).map(t =>
      t.id === row.task.id ? { ...t, status: newStatus } : t
    );
    await base44.entities.TimeEntry.update(row.wo.id, { tasks: updatedTasks });
    setWorkOrders(prev => prev.map(wo =>
      wo.id === row.wo.id ? { ...wo, tasks: updatedTasks } : wo
    ));
  };

  const handleSave = async (formData, options = {}) => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      if (isCreating) {
        const proj = projects.find(p => p.id === formData.project_id);
        const branch = formData.branch_id || proj?.branch_id || currentCompany?.id;
        await base44.entities.TimeEntry.create({ ...formData, branch_id: branch });
      } else {
        await base44.entities.TimeEntry.update(selectedEntry.id, formData);
      }
      await loadAllData();
      if (!options.keepOpen) { setIsDialogOpen(false); setSelectedEntry(null); }
    } finally { setIsSaving(false); }
  };

  const handleDelete = async (id) => {
    await base44.entities.TimeEntry.delete(id);
    setWorkOrders(prev => prev.filter(wo => wo.id !== id));
    setIsDialogOpen(false);
    setSelectedEntry(null);
  };

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
            <span className="text-lg">✅</span>
          </div>
          <h1 className="text-xl font-semibold text-slate-900">Tasks</h1>
        </div>
        <Button variant="ghost" size="sm" className="gap-2" onClick={() => setShowSettings(true)}>
          <Settings className="w-4 h-4" />
          Settings
        </Button>
      </div>

      {/* Status tabs */}
      <div className="bg-white border-b border-slate-200 px-6 py-3">
        <div className="flex items-center gap-2">
          {[
            { value: 'all', label: 'All' },
            { value: 'open', label: 'Open (Pending)' },
            { value: 'closed', label: 'Closed (Completed)' },
          ].map(s => (
            <button
              key={s.value}
              onClick={() => setStatusFilter(s.value)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2",
                statusFilter === s.value
                  ? s.value === 'all' ? "bg-slate-800 text-white" : s.value === 'open' ? "bg-green-600 text-white" : "bg-red-600 text-white"
                  : s.value === 'all' ? "bg-slate-100 text-slate-600 hover:bg-slate-200" : s.value === 'open' ? "bg-green-50 text-green-700 hover:bg-green-100" : "bg-red-50 text-red-700 hover:bg-red-100"
              )}
            >
              {s.label}
              {s.value !== 'all' && (
                <span className={cn("text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center",
                  statusFilter === s.value ? "bg-white/30 text-white" : s.value === 'open' ? "bg-green-200 text-green-800" : "bg-red-200 text-red-800"
                )}>
                  {s.value === 'open' ? periodCounts.open : periodCounts.closed}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk action bar */}
      {selectedRows.length > 0 && (
        <div className="bg-indigo-50 border-b border-indigo-200 px-6 py-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-indigo-900">{selectedRows.length} task(s) selected</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setSelectedRows([])} disabled={isBulkProcessing}>Cancel</Button>
            <Button variant="outline" size="sm" onClick={handleBulkMarkCompleted} disabled={isBulkProcessing} className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100">
              {isBulkProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Mark Completed
            </Button>
            <Button variant="outline" size="sm" disabled={isBulkProcessing} className="bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 gap-1"
              onClick={() => {
                const uniqueWOIds = [...new Set(taskRows.filter(r => selectedRows.includes(r.key)).map(r => r.wo.id))];
                if (uniqueWOIds.length === 0) return;
                const url = `/WorkOrdersMultiplePDFView?workOrderIds=${uniqueWOIds.join(',')}`;
                window.open(url, '_blank');
              }}>
              <Download className="w-4 h-4" /> Download Reports ({[...new Set(taskRows.filter(r => selectedRows.includes(r.key)).map(r => r.wo.id))].length})
            </Button>
            <Button variant="destructive" size="sm" onClick={handleBulkDelete} disabled={isBulkProcessing}>
              Delete
            </Button>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="bg-white border-b border-slate-200 px-6 py-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Category filter */}
          <div className="relative" ref={categoryDropdownRef}>
            <button
              type="button"
              onClick={() => setCategoryDropdownOpen(o => !o)}
              className="flex items-center gap-2 h-9 px-3 rounded-md border border-slate-200 bg-white text-sm min-w-[180px] hover:bg-slate-50"
            >
              <span className="flex-1 text-left truncate text-slate-700">
                {selectedCategories.length === 0 ? 'All Categories' : selectedCategories.length === 1 ? safeCategories.find(c => c.id === selectedCategories[0])?.name || '1 selected' : `${selectedCategories.length} categories`}
              </span>
              {selectedCategories.length > 0 && (
                <span onClick={(e) => { e.stopPropagation(); setSelectedCategories([]); }} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                  <X className="w-3 h-3" />
                </span>
              )}
              <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
            </button>
            {categoryDropdownOpen && (
              <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-slate-200 rounded-md shadow-lg min-w-[220px] max-h-72 overflow-y-auto">
                <div className="px-3 py-2 text-sm cursor-pointer hover:bg-slate-50 flex items-center gap-2 border-b" onClick={() => setSelectedCategories([])}>
                  <span className={cn("w-4 h-4 rounded border flex items-center justify-center flex-shrink-0", selectedCategories.length === 0 ? "bg-indigo-600 border-indigo-600" : "border-slate-300")}>
                    {selectedCategories.length === 0 && <span className="text-white text-[10px]">✓</span>}
                  </span>
                  All Categories
                </div>
                {safeCategories.map(cat => (
                  <div key={cat.id} className="px-3 py-2 text-sm cursor-pointer hover:bg-slate-50 flex items-center gap-2"
                    onClick={() => setSelectedCategories(prev => prev.includes(cat.id) ? prev.filter(id => id !== cat.id) : [...prev, cat.id])}>
                    <span className={cn("w-4 h-4 rounded border flex items-center justify-center flex-shrink-0", selectedCategories.includes(cat.id) ? "bg-indigo-600 border-indigo-600" : "border-slate-300")}>
                      {selectedCategories.includes(cat.id) && <span className="text-white text-[10px]">✓</span>}
                    </span>
                    {cat.name}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Date navigation */}
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="h-9 px-2" onClick={() => {
              const today = format(new Date(), 'yyyy-MM-dd');
              setDateFrom(today); setDateTo(today);
            }}>Today</Button>
            <Button variant="outline" size="icon" className="h-9 w-8" onClick={() => {
              const base = dateFrom ? new Date(dateFrom) : new Date();
              base.setDate(base.getDate() - 1);
              const d = format(base, 'yyyy-MM-dd');
              setDateFrom(d); setDateTo(d);
            }}><ChevronLeft className="w-4 h-4" /></Button>
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-9 w-36" />
            <span className="text-slate-400 text-xs">to</span>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-9 w-36" />
            <Button variant="outline" size="icon" className="h-9 w-8" onClick={() => {
              const base = dateTo ? new Date(dateTo) : new Date();
              base.setDate(base.getDate() + 1);
              const d = format(base, 'yyyy-MM-dd');
              setDateFrom(d); setDateTo(d);
            }}><ChevronRight className="w-4 h-4" /></Button>
            {(dateFrom || dateTo) && <Button variant="ghost" size="sm" className="h-9" onClick={() => { setDateFrom(''); setDateTo(''); }}>Clear</Button>}
          </div>

          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input placeholder="Search tasks..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9 h-9" />
          </div>

          {/* Sort */}
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="open_date">Open Date</SelectItem>
              <SelectItem value="task_title">Task Title</SelectItem>
              <SelectItem value="wo_title">WO Title</SelectItem>
              <SelectItem value="client">Client</SelectItem>
              <SelectItem value="project">Project</SelectItem>
              <SelectItem value="category">Category</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-9" onClick={() => setSortOrder(p => p === 'asc' ? 'desc' : 'asc')}>
            {sortOrder === 'asc' ? '↑' : '↓'}
          </Button>

          <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-500" onClick={loadAllData} disabled={loading} title="Refresh">
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </Button>

          <Button className="gap-2 bg-indigo-600 hover:bg-indigo-700 ml-auto" onClick={() => { setSelectedEntry(null); setIsCreating(true); setIsDialogOpen(true); }}>
            <Plus className="w-4 h-4" /> New Task
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
            <tr>
              <th className="px-2 py-1 w-10">
                <Checkbox checked={selectedRows.length === taskRows.length && taskRows.length > 0} onCheckedChange={toggleAll} />
              </th>
              <th className="text-left px-2 py-1 text-xs font-semibold text-slate-700 h-8">Task Title</th>
              <th className="text-left px-2 py-1 text-xs font-semibold text-slate-700 h-8 w-48">Task Description</th>
              <th className="text-left px-2 py-1 text-xs font-semibold text-slate-700 h-8">WO Title</th>
              <th className="text-left px-2 py-1 text-xs font-semibold text-slate-700 h-8">Client</th>
              <th className="text-left px-2 py-1 text-xs font-semibold text-slate-700 h-8">Project</th>
              <th className="text-left px-2 py-1 text-xs font-semibold text-slate-700 h-8">Category</th>
              <th className="text-left px-2 py-1 text-xs font-semibold text-slate-700 h-8">Users</th>
              <th className="text-left px-2 py-1 text-xs font-semibold text-slate-700 h-8">Task Time</th>
              <th className="text-left px-2 py-1 text-xs font-semibold text-slate-700 h-8 w-16">Reports</th>
              <th className="text-left px-2 py-1 text-xs font-semibold text-slate-700 h-8">Open Date</th>
              <th className="text-left px-2 py-1 text-xs font-semibold text-slate-700 h-8">WO #</th>
              <th className="text-center px-2 py-1 text-xs font-semibold text-slate-700 h-8 w-28">Status</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {loading ? (
              <tr><td colSpan="11" className="text-center py-12 text-slate-500"><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Loading…</td></tr>
            ) : taskRows.length === 0 ? (
              <tr><td colSpan="11" className="text-center py-12 text-slate-500">No tasks found</td></tr>
            ) : taskRows.map(row => {
              const isSelected = selectedRows.includes(row.key);
              const isCompleted = row.taskStatus === 'completed';

              return (
                <tr
                  key={row.key}
                  className={cn("border-b border-slate-100 hover:bg-slate-50 transition-colors h-9", isSelected && "bg-indigo-50")}
                >
                  <td className="px-2 py-1">
                    <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(row.key)} onClick={e => e.stopPropagation()} />
                  </td>
                  {/* Task Title */}
                  <td className="px-2 py-1">
                    <button
                      onClick={() => { setSelectedEntry(row.wo); setIsCreating(false); setIsDialogOpen(true); }}
                      className="text-xs font-medium text-slate-900 hover:text-indigo-600 hover:underline truncate block max-w-[180px] text-left"
                      title={row.taskName}
                    >
                      {row.taskName || <span className="text-slate-400 italic">—</span>}
                    </button>
                    {row.reportNumber && (
                      <span className="text-[10px] font-mono text-emerald-600 block">{row.reportNumber}</span>
                    )}
                  </td>
                  {/* Task Description */}
                  <td className="px-2 py-1 w-48">
                    <span className="text-[11px] text-slate-500 truncate block max-w-[170px]" title={row.taskDesc}>
                      {row.taskDesc || '-'}
                    </span>
                  </td>
                  {/* WO Title */}
                  <td className="px-2 py-1">
                    <span className="text-xs text-slate-700 truncate block max-w-[150px]">{row.wo.title || '-'}</span>
                    {row.woNumber && (
                      <span className="text-[10px] font-mono text-indigo-500 block">{row.woNumber}</span>
                    )}
                  </td>
                  {/* Client */}
                  <td className="px-2 py-1">
                    <span className="text-xs text-slate-700 truncate block max-w-[130px]">{row.customer?.name || '-'}</span>
                  </td>
                  {/* Project */}
                  <td className="px-2 py-1">
                    <span className="text-xs text-slate-700 truncate block max-w-[130px]">{row.project?.name || '-'}</span>
                  </td>
                  {/* Category */}
                  <td className="px-2 py-1">
                    {row.category
                      ? <Badge variant="outline" className="text-[10px]">{row.category.name}</Badge>
                      : <span className="text-xs text-slate-400">-</span>}
                  </td>
                  {/* Users with clock-in/out times */}
                  <td className="px-2 py-1">
                    {(() => {
                      const taskUserIds = row.task?.employee_ids || row.wo.employee_ids || [];
                      const taskUsers = safeUsers.filter(u => taskUserIds.includes(u.id) && !u.archived);
                      if (taskUsers.length === 0) return <span className="text-xs text-slate-400">-</span>;
                      return (
                        <div className="flex flex-row gap-1 flex-wrap">
                          {taskUsers.slice(0, 5).map(user => {
                            const timeKey = `${row.wo.id}::${user.id}`;
                            const times = woUserTimeMap.get(timeKey);
                            const clockIn = times?.clockIn ? format(parseISO(times.clockIn), 'HH:mm') : null;
                            const clockOut = times?.clockOut ? format(parseISO(times.clockOut), 'HH:mm') : null;
                            return (
                              <div key={user.id} className="flex flex-col items-center gap-0.5">
                                <Avatar user={user} size="xs" />
                                {clockIn && <span className="text-[7px] bg-blue-500 text-white px-1 rounded font-bold leading-tight">{clockIn}</span>}
                                {clockOut && <span className="text-[7px] bg-red-500 text-white px-1 rounded font-bold leading-tight">{clockOut}</span>}
                              </div>
                            );
                          })}
                          {taskUsers.length > 5 && <span className="text-[10px] text-slate-500 self-center">+{taskUsers.length - 5}</span>}
                        </div>
                      );
                    })()}
                  </td>
                  {/* Task planned time */}
                  <td className="px-2 py-1">
                    {(() => {
                      const start = row.task?.start_time;
                      const end = row.task?.end_time;
                      if (!start || !end) return <span className="text-xs text-slate-400">-</span>;
                      const [sh, sm] = start.split(':').map(Number);
                      const [eh, em] = end.split(':').map(Number);
                      const totalMins = (eh * 60 + em) - (sh * 60 + sm);
                      return (
                        <div className="flex flex-col gap-0">
                          <span className="text-[10px] text-slate-600">{start} → {end}</span>
                          {totalMins > 0 && (
                            <span className="text-[10px] font-bold text-indigo-600">
                              ({Math.floor(totalMins / 60)}h{totalMins % 60 > 0 ? `${totalMins % 60}m` : ''})
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                  {/* Reports — clickable PDF */}
                  <td className="px-2 py-1 w-20">
                    <button
                      onClick={() => handleViewPDF(row.wo)}
                      className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
                      title="View PDF Report"
                    >
                      <FileText className="w-3 h-3 flex-shrink-0" />
                      <span>{row.reportNumber || (row.reportsCount > 0 ? `${row.reportsCount}` : '—')}</span>
                    </button>
                  </td>
                  {/* Open Date */}
                  <td className="px-2 py-1">
                    <span className="text-xs text-slate-600">
                      {row.taskDate ? formatDateDubai(`${row.taskDate}T00:00:00`) : (row.openDate ? formatDateDubai(row.openDate) : '-')}
                    </span>
                  </td>
                  {/* WO # */}
                  <td className="px-2 py-1">
                    <span className="text-xs font-mono text-slate-600">{row.woNumber || '-'}</span>
                  </td>
                  {/* Status — task-level: Pending / Completed */}
                  <td className="px-2 py-1 text-center" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => handleToggleTaskStatus(row)}
                      title={`Mark as ${isCompleted ? 'Pending' : 'Completed'}`}
                      className={cn(
                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border cursor-pointer transition-colors",
                        isCompleted
                          ? "bg-green-100 text-green-700 border-green-300 hover:bg-green-200"
                          : "bg-amber-100 text-amber-700 border-amber-300 hover:bg-amber-200"
                      )}
                    >
                      {isCompleted ? <Check className="w-3 h-3" /> : null}
                      {isCompleted ? 'Completed' : 'Pending'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Edit Dialog */}
      <WorkOrderDetailsDialog
        isOpen={isDialogOpen}
        entry={selectedEntry}
        onClose={() => { setIsDialogOpen(false); setSelectedEntry(null); }}
        onSave={handleSave}
        onDelete={handleDelete}
        projects={safeProjects}
        users={safeUsers}
        teams={safeTeams}
        customers={safeCustomers}
        assets={safeAssets}
        clientEquipments={safeClientEquipments}
        categories={safeCategories}
        shiftTypes={[]}
        isCreating={isCreating}
        isSaving={isSaving}
        allEntries={workOrders}
      />

      {/* PDF Dialog */}
      {showPDFDialog && (
        <WorkOrderPDFDialog
          workOrder={showPDFDialog.workOrder}
          project={showPDFDialog.project}
          customer={showPDFDialog.customer}
          branch={showPDFDialog.branch}
          assignedUsers={showPDFDialog.assignedUsers}
          assignedTeams={showPDFDialog.assignedTeams}
          assignedAssets={showPDFDialog.assignedAssets}
          woCategory={showPDFDialog.woCategory}
          shiftType={showPDFDialog.shiftType}
          onClose={() => { setShowPDFDialog(null); setPdfAutoPrint(false); }}
          autoPrint={pdfAutoPrint}
        />
      )}

      {/* Settings */}
      {showSettings && <TimesheetsSettingsPanel isOpen={showSettings} onClose={() => setShowSettings(false)} onSaved={() => {}} />}
    </div>
  );
}