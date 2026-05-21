import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useData } from '@/components/DataProvider';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Search, Settings, Eye, ChevronDown, ChevronLeft, ChevronRight, Plus, CheckSquare, Trash2, Loader2, Edit3, X, RefreshCw, Check, GitMerge, FolderOpen
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import Avatar from '@/components/Avatar';
import { AlertTriangle } from 'lucide-react';
import { format, parseISO, startOfDay, endOfDay, addDays } from 'date-fns';
import { cn } from '@/lib/utils';
import WorkOrderPDFDialog from '@/components/workorders/WorkOrderPDFDialog';
import WorkOrderDetailsDialog from '@/components/workorders/WorkOrderDetailsDialog';
import OrdersSettingsPanel from '@/components/orders/OrdersSettingsPanel';
import OrdersDocumentMatrixTab from '@/components/workorders/OrdersDocumentMatrixTab';
import UrgentOrderDialog from '@/components/workorders/UrgentOrderDialog';
import MergeWorkOrdersDialog from '@/components/workorders/MergeWorkOrdersDialog';

export default function JobOrdersPage() {
  const { 
    loadUsers, 
    loadProjects, 
    loadCustomers, 
    loadAssets, 
    loadWorkOrderCategories, 
    loadShiftTypes, 
    loadClientEquipments,
    teams: contextTeams,
    currentUser,
    currentCompany
  } = useData();
  
  const [workOrders, setWorkOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [projects, setProjects] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [assets, setAssets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [shiftTypes, setShiftTypes] = useState([]);
  const [clientEquipments, setClientEquipments] = useState([]);
  const [workingReports, setWorkingReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [withEquipment, setWithEquipment] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const categoryDropdownRef = React.useRef(null);
  const [selectedRows, setSelectedRows] = useState([]);
  const [expandedRows, setExpandedRows] = useState([]);
  const [showPDFDialog, setShowPDFDialog] = useState(null);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showUrgentDialog, setShowUrgentDialog] = useState(false);
const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState('list');
  const [sortBy, setSortBy] = useState('created_date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [ordersOpenLabel, setOrdersOpenLabel] = useState('Open');
  const [ordersClosedLabel, setOrdersClosedLabel] = useState('Closed');
  const [forceReload, setForceReload] = useState(false);
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('open');
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [defaultTab, setDefaultTab] = useState('order');
  const [editingTitle, setEditingTitle] = useState(null); // { groupId, value, orderIds }
  const titleInputRef = React.useRef(null);
  const [editingCategory, setEditingCategory] = useState(null); // groupId being edited
  const categoryEditRef = useRef(null);

  // Close category inline editor on outside click
  useEffect(() => {
    if (!editingCategory) return;
    const handler = (e) => {
      if (categoryEditRef.current && !categoryEditRef.current.contains(e.target)) {
        setEditingCategory(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [editingCategory]);
  // Day navigation helpers
  const selectedDayMode = createdFrom && createdTo && createdFrom === createdTo;
  const shiftDay = (delta) => {
    const base = selectedDayMode ? new Date(`${createdFrom}T12:00:00`) : new Date();
    const next = addDays(base, delta);
    const iso = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dubai' }).format(next);
    setCreatedFrom(iso);
    setCreatedTo(iso);
  };
  const setToday = () => {
    const iso = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dubai' }).format(new Date());
    setCreatedFrom(iso);
    setCreatedTo(iso);
  };
  const dayLabel = selectedDayMode ? format(new Date(createdFrom), 'EEE dd/MM') : 'All dates';
  // groupBy removed - always grouped by job

  const safeUsers = Array.isArray(users) ? users : [];
  const safeTeams = Array.isArray(teams) ? teams : [];
  const safeProjects = Array.isArray(projects) ? projects : [];
  const safeCustomers = Array.isArray(customers) ? customers : [];
  const safeAssets = Array.isArray(assets) ? assets : [];
  const safeCategories = Array.isArray(categories) ? categories : [];
  const safeShiftTypes = Array.isArray(shiftTypes) ? shiftTypes : [];
  const safeClientEquipments = Array.isArray(clientEquipments) ? clientEquipments : [];
  
  const formatWONumber = (n) => {
    if (!n) return '';
    const s = String(n).trim();
    if (/^\d{3,4}\/\d{2}$/i.test(s)) return s; // already like 0019/26
    if (/^\d{5}\/\d{4}$/i.test(s)) return s;   // already like 00001/2026
    const m2 = s.match(/^WO-(\d{3,4})\/(\d{2})$/i); // WO-019/26
    if (m2) return `${m2[1]}/${m2[2]}`;
    const m3 = s.match(/^WR-(\d{4})-(\d{1,4})$/i); // WR-2026-0019
    if (m3) return `${m3[2].padStart(4,'0')}/${m3[1].slice(-2)}`;
    const m4 = s.match(/^WO-(\d{4})-(\d{1,4})$/i); // WO-2026-0019
    if (m4) return `${m4[2].padStart(4,'0')}/${m4[1].slice(-2)}`;
    return s; // return as-is for any other format
  };

  // Smart formatter: handles plain numbers and patterns like "N12" using the reference date for year
  const formatWONumberSmart = (n, refISO) => {
    if (!n) return '';
    const s = String(n).trim();
    // Already in new 5-digit format like 00001/2026 - return as-is
    if (/^\d{5}\/\d{4}$/.test(s)) return s;
    const plain = s.match(/^(\d{1,4})$/);
    const nMatch = s.match(/^N(\d{1,6})$/i);
    const yy = (() => {
      if (!refISO) return new Date().getFullYear().toString().slice(-2);
      try { return new Date(refISO).getFullYear().toString().slice(-2); } catch { return new Date().getFullYear().toString().slice(-2); }
    })();
    if (plain) {
      return `${plain[1].padStart(4,'0')}/${yy}`;
    }
    if (nMatch) {
      const num = nMatch[1];
      if (num.length <= 4) {
        return `${num.padStart(4,'0')}/${yy}`;
      }
    }
    return formatWONumber(s);
  };

  // Parse serials like 0018/26 -> 260018 for sorting; N12 -> 12 (fallback)
  const parseSerial = (s) => {
    if (!s) return -1;
    const m = String(s).trim().match(/^(\d{3,4})\/(\d{2})$/);
    if (m) return parseInt(m[2] + m[1], 10);
    const n = String(s).trim().match(/^N(\d{1,6})$/i);
    if (n) return parseInt(String(n[1]).padStart(4,'0'), 10);
    return -1;
  };

  // Format date in Asia/Dubai timezone for dd/MM/yy
  const formatDateInDubai = (iso) => {
    if (!iso) return '-';
    try {
      return new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Dubai',
        day: '2-digit',
        month: '2-digit',
        year: '2-digit'
      }).format(new Date(iso));
    } catch (e) {
      try { return format(parseISO(iso), 'dd/MM/yy'); } catch { return '-'; }
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Mantener equipos sincronizados con el DataProvider
  useEffect(() => {
    setTeams(contextTeams || []);
  }, [contextTeams]);

  // Close category dropdown on outside click
  useEffect(() => {
    if (!categoryDropdownOpen) return;
    const handler = (e) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(e.target)) {
        setCategoryDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [categoryDropdownOpen]);

  const loadAllData = async () => {
    try {
      setLoading(true);
      const [usersData, projectsData, customersData, assetsData, categoriesData, shiftTypesData, clientEquipmentsData, entriesData, workingReportsData] = await Promise.all([
        loadUsers(),
        loadProjects(true),
        loadCustomers(),
        loadAssets(),
        loadWorkOrderCategories(),
        loadShiftTypes(),
        loadClientEquipments(),
        base44.entities.TimeEntry.list('-updated_date', 2000),
        base44.entities.WorkingReport.list('-updated_date', 2000)
      ]);

      setUsers(usersData || []);
      setProjects(projectsData || []);
      setCustomers(customersData || []);
      setAssets(assetsData || []);
      setCategories(categoriesData || []);
      setShiftTypes(shiftTypesData || []);
      setClientEquipments(clientEquipmentsData || []);
      setTeams(contextTeams || []);
      setWorkOrders(entriesData || []);
      setWorkingReports(workingReportsData || []);

      // Disabled auto-fix to speed up page load. Use the "Asignar números WO" button when needed.

      // Disabled auto-renumber on load to avoid delays.

      // Removed auto-normalization of WO numbers to avoid unintended renumbering

      try {
        const [openSetting] = await base44.entities.AppSettings.filter({ setting_key: 'orders_column_open_label' });
        const [closedSetting] = await base44.entities.AppSettings.filter({ setting_key: 'orders_column_closed_label' });
        if (openSetting?.setting_value) setOrdersOpenLabel(openSetting.setting_value);
        if (closedSetting?.setting_value) setOrdersClosedLabel(closedSetting.setting_value);
      } catch (e) { /* ignore */ }

      // Disabled background backfill on load.

      console.log('✅ All data loaded:', {
        users: usersData?.length,
        projects: projectsData?.length,
        customers: customersData?.length,
        categories: categoriesData?.length
      });
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFixWONumbers = async () => {
    try {
      toast.info('Asignando números de WO...');
      try {
        await base44.functions.invoke('runRenumberWorkOrdersApply', {});
      } catch (err) {
        await base44.functions.invoke('backfillMissingWon', { dry_run: false, limit: 10000 });
      }
      const reloaded = await base44.entities.TimeEntry.list('-updated_date', 2000);
      setWorkOrders(reloaded || []);
      toast.success('Números de WO actualizados');
    } catch (e) {
      console.error('Fix WO numbers failed:', e);
      toast.error('No se pudieron actualizar los números');
    }
  };

  const loadWorkOrders = async () => {
    try {
      const entries = await base44.entities.TimeEntry.list('-updated_date');
      setWorkOrders(entries || []);
    } catch (error) {
      console.error('Error loading work orders:', error);
    }
  };

  const filteredWorkOrders = useMemo(() => {
    return workOrders.filter(wo => {
      // Status filter: by default show only "open"
      if (statusFilter === 'open' && wo.status !== 'open') return false;
      if (statusFilter === 'closed' && wo.status !== 'closed') return false;
      
      // With equipment filter
      if (withEquipment && (!wo.equipment_ids || wo.equipment_ids.length === 0)) {
        return false;
      }

      // Category filter (multi-select)
      if (selectedCategories.length > 0 && !selectedCategories.includes(wo.work_order_category_id)) {
        return false;
      }

      // Date range filter - check tasks dates if available, otherwise WO dates
      if (createdFrom || createdTo) {
        let dateMatches = false;
        
        // If WO has tasks, check if ANY task date falls within the range
        if (wo.tasks && wo.tasks.length > 0) {
          for (const task of wo.tasks) {
            if (task.date) {
              const taskDate = parseISO(`${task.date}T00:00:00`);
              const matchesFrom = !createdFrom || taskDate >= startOfDay(new Date(createdFrom));
              const matchesTo = !createdTo || taskDate <= endOfDay(new Date(createdTo));
              if (matchesFrom && matchesTo) {
                dateMatches = true;
                break;
              }
            }
          }
        } else {
          // Fallback to WO-level dates if no tasks
          const dateISO = wo.planned_start_time || wo.start_time || (wo.task_start_date ? `${wo.task_start_date}T00:00:00` : null);
          if (dateISO) {
            const date = parseISO(dateISO);
            const matchesFrom = !createdFrom || date >= startOfDay(new Date(createdFrom));
            const matchesTo = !createdTo || date <= endOfDay(new Date(createdTo));
            dateMatches = matchesFrom && matchesTo;
          }
        }
        
        if (!dateMatches) return false;
      }

      // Search filter - search across all visible columns
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const project = safeProjects.find(p => p.id === wo.project_id);
        let customer = null;
        if (project) customer = safeCustomers.find(c => c.id === project.customer_id) || null;
        if (!customer && wo.customer_id) customer = safeCustomers.find(c => c.id === wo.customer_id) || null;
        const category = safeCategories.find(c => c.id === wo.work_order_category_id);
        const allEquipment = [...safeAssets, ...safeClientEquipments];
        const equipmentNames = (wo.equipment_ids || []).map(id => allEquipment.find(a => a.id === id)?.name || '').join(' ');
        const taskText = (wo.tasks || []).map(t => `${t.name || ''} ${t.instructions || ''}`).join(' ');
        const woNum = wo.work_order_number ? formatWONumberSmart(wo.work_order_number, wo.start_time || wo.planned_start_time || wo.created_date) : '';

        const matchesSearch =
          wo.title?.toLowerCase().includes(query) ||
          project?.name?.toLowerCase().includes(query) ||
          customer?.name?.toLowerCase().includes(query) ||
          category?.name?.toLowerCase().includes(query) ||
          equipmentNames.toLowerCase().includes(query) ||
          taskText.toLowerCase().includes(query) ||
          woNum.toLowerCase().includes(query) ||
          wo.work_notes?.toLowerCase().includes(query);

        if (!matchesSearch) return false;
      }

      return true;
    });
  }, [workOrders, searchQuery, withEquipment, selectedCategories, createdFrom, createdTo, statusFilter, safeProjects, safeCustomers, safeCategories]);

  // Count open/closed groups (same grouping logic as groupedWorkOrders, ignoring statusFilter)
  const periodCounts = useMemo(() => {
    // Build a filtered list same as filteredWorkOrders but without the statusFilter
    const inPeriod = workOrders.filter(wo => {
      if (wo.archived) return false;
      if (withEquipment && (!wo.equipment_ids || wo.equipment_ids.length === 0)) return false;
      if (selectedCategories.length > 0 && !selectedCategories.includes(wo.work_order_category_id)) return false;
      if (createdFrom || createdTo) {
        let dateMatches = false;
        if (wo.tasks && wo.tasks.length > 0) {
          for (const task of wo.tasks) {
            if (task.date) {
              const taskDate = parseISO(`${task.date}T00:00:00`);
              const matchesFrom = !createdFrom || taskDate >= startOfDay(new Date(createdFrom));
              const matchesTo = !createdTo || taskDate <= endOfDay(new Date(createdTo));
              if (matchesFrom && matchesTo) { dateMatches = true; break; }
            }
          }
        } else {
          const dateISO = wo.planned_start_time || wo.start_time || null;
          if (dateISO) {
            const date = parseISO(dateISO);
            dateMatches = (!createdFrom || date >= startOfDay(new Date(createdFrom))) &&
                          (!createdTo || date <= endOfDay(new Date(createdTo)));
          }
        }
        if (!dateMatches) return false;
      }
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const project = safeProjects.find(p => p.id === wo.project_id);
        const customer = project ? safeCustomers.find(c => c.id === project.customer_id) : null;
        const category = safeCategories.find(c => c.id === wo.work_order_category_id);
        const allEquipment = [...safeAssets, ...safeClientEquipments];
        const equipmentNames = (wo.equipment_ids || []).map(id => allEquipment.find(a => a.id === id)?.name || '').join(' ');
        const taskText = (wo.tasks || []).map(t => `${t.name || ''} ${t.instructions || ''}`).join(' ');
        const woNum = wo.work_order_number ? formatWONumberSmart(wo.work_order_number, wo.start_time || wo.planned_start_time || wo.created_date) : '';
        if (!(
          wo.title?.toLowerCase().includes(query) ||
          project?.name?.toLowerCase().includes(query) ||
          customer?.name?.toLowerCase().includes(query) ||
          category?.name?.toLowerCase().includes(query) ||
          equipmentNames.toLowerCase().includes(query) ||
          taskText.toLowerCase().includes(query) ||
          woNum.toLowerCase().includes(query) ||
          wo.work_notes?.toLowerCase().includes(query)
        )) return false;
      }
      return true;
    });

    // Group by title (same as groupedWorkOrders) and count groups
    const groupMap = {};
    inPeriod.forEach(wo => {
      const key = (wo.title || wo.work_order_number || 'Untitled').trim().toLowerCase();
      if (!groupMap[key]) groupMap[key] = { hasOpen: false, hasClosed: false };
      if (wo.status === 'open') groupMap[key].hasOpen = true;
      else if (wo.status === 'closed') groupMap[key].hasClosed = true;
    });

    const groups = Object.values(groupMap);
    return {
      open: groups.filter(g => g.hasOpen).length,
      closed: groups.filter(g => !g.hasOpen && g.hasClosed).length,
    };
  }, [workOrders, withEquipment, selectedCategories, createdFrom, createdTo, searchQuery, safeProjects, safeCustomers]);

  const groupedWorkOrders = useMemo(() => {
    const groups = {};

    // Siempre agrupar por Job (título o número)
    filteredWorkOrders.forEach(wo => {
      const key = (wo.title || wo.work_order_number || 'Untitled').trim().toLowerCase();
      if (!groups[key]) groups[key] = [];
      groups[key].push(wo);
    });

    let grouped = Object.entries(groups).map(([title, orders]) => {
          const openDateObj = orders.reduce((min, o) => {
            const d = o.planned_start_time ? parseISO(o.planned_start_time) : null;
            if (!d) return min;
            return (!min || d < min) ? d : min;
          }, null);
          const fallback = orders.reduce((min, o) => {
            const d = o.created_date ? parseISO(o.created_date) : null;
            if (!d) return min;
            return (!min || d < min) ? d : min;
          }, null);
          const openDate = (openDateObj || fallback)?.toISOString() || null;
          return {
            title: orders[0]?.title || title,
            orders,
            firstOrder: orders[0],
            openDate
          };
        });

    grouped.sort((a, b) => {
      let aValue, bValue;

      switch (sortBy) {
        case 'title': {
          aValue = a.title || '';
          bValue = b.title || '';
          break;
        }
        case 'client': {
          const aProject = safeProjects.find(p => p.id === a.firstOrder.project_id);
          const bProject = safeProjects.find(p => p.id === b.firstOrder.project_id);
          const aCustomer = aProject ? safeCustomers.find(c => c.id === aProject.customer_id) : null;
          const bCustomer = bProject ? safeCustomers.find(c => c.id === bProject.customer_id) : null;
          aValue = aCustomer?.name || '';
          bValue = bCustomer?.name || '';
          break;
        }
        case 'project': {
          const aProj = safeProjects.find(p => p.id === a.firstOrder.project_id);
          const bProj = safeProjects.find(p => p.id === b.firstOrder.project_id);
          aValue = aProj?.name || '';
          bValue = bProj?.name || '';
          break;
        }
        case 'category': {
          const aCat = safeCategories.find(c => c.id === a.firstOrder.work_order_category_id);
          const bCat = safeCategories.find(c => c.id === b.firstOrder.work_order_category_id);
          aValue = aCat?.name || '';
          bValue = bCat?.name || '';
          break;
        }
        case 'created_date': {
          // Sort by earliest scheduled date (open date)
          aValue = a.openDate || '';
          bValue = b.openDate || '';
          break;
        }
        case 'finish_date': {
          const aClosedOrders = a.orders.filter(o => o.status === 'closed');
          const bClosedOrders = b.orders.filter(o => o.status === 'closed');
          aValue = aClosedOrders.length > 0 
            ? aClosedOrders.reduce((latest, order) => {
                const orderDate = order.updated_date ? parseISO(order.updated_date) : null;
                if (!latest || (orderDate && orderDate > latest)) {
                  return orderDate;
                }
                return latest;
              }, null)?.toISOString() || ''
            : '';
          bValue = bClosedOrders.length > 0 
            ? bClosedOrders.reduce((latest, order) => {
                const orderDate = order.updated_date ? parseISO(order.updated_date) : null;
                if (!latest || (orderDate && orderDate > latest)) {
                  return orderDate;
                }
                return latest;
              }, null)?.toISOString() || ''
            : '';
          break;
        }
        case 'wo_number': {
          aValue = parseSerial(a.firstOrder.work_order_number);
          bValue = parseSerial(b.firstOrder.work_order_number);
          break;
        }
        case 'last_visit_date': {
          const getLastVisit = (grp) => {
            let last = null;
            grp.orders.forEach(o => {
              (o.tasks || []).forEach(t => {
                if (t.date && (!last || t.date > last)) last = t.date;
              });
            });
            return last || '';
          };
          aValue = getLastVisit(a);
          bValue = getLastVisit(b);
          break;
        }
        case 'wr_number': {
          const getMinWR = (grp) => {
            let min = Infinity;
            const ids = new Set(grp.orders.map(o=>o.id));
            (workingReports || []).forEach((wr) => {
              if (ids.has(wr.time_entry_id)) {
                const val = parseSerial(wr.report_number);
                if (val >= 0 && val < min) min = val;
              }
            });
            return isFinite(min) ? min : -1;
          };
          aValue = getMinWR(a);
          bValue = getMinWR(b);
          break;
        }
        default: {
          aValue = '';
          bValue = '';
        }
      }

      if (typeof aValue === 'string') {
        return sortOrder === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      
      return sortOrder === 'asc' ? (aValue < bValue ? -1 : 1) : (aValue > bValue ? -1 : 1);
    });

    return grouped;
  }, [filteredWorkOrders, sortBy, sortOrder, safeProjects, safeCustomers, safeCategories]);

  const handleViewPDF = async (wo) => {
    const project = safeProjects.find(p => p.id === wo.project_id);
    const customer = project ? safeCustomers.find(c => c.id === project.customer_id) : (wo.customer_id ? safeCustomers.find(c => c.id === wo.customer_id) : null);
    
    // ✅ Combine employee_ids from both WO-level and tasks
    const assignedUserIds = new Set();
    (wo.employee_ids || []).forEach(uid => assignedUserIds.add(uid));
    if (wo.employee_id) assignedUserIds.add(wo.employee_id);
    if (wo.tasks && wo.tasks.length > 0) {
      wo.tasks.forEach(task => {
        (task.employee_ids || []).forEach(uid => assignedUserIds.add(uid));
      });
    }
    
    const assignedUsers = safeUsers.filter(u => assignedUserIds.has(u.id));
    const assignedTeams = safeTeams.filter(t => (wo.team_ids || []).includes(t.id));
    const assignedAssets = [...safeAssets, ...safeClientEquipments].filter(a => (wo.equipment_ids || []).includes(a.id));
    const woCategory = safeCategories.find(c => c.id === wo.work_order_category_id);
    const shiftType = safeShiftTypes.find(s => s.id === wo.shift_type_id);

    let branchData = null;
    try {
      const branchId = wo.branch_id || project?.branch_id || null;
      if (branchId) {
        const arr = await base44.entities.Branch.filter({ id: branchId }, '-updated_date', 1);
        branchData = (arr && arr[0]) || null;
      }
    } catch (e) {
      console.warn('Failed to load branch for PDF', e);
    }

    setShowPDFDialog({
      workOrder: wo,
      project,
      customer,
      branch: branchData,
      assignedUsers,
      assignedTeams,
      assignedAssets,
      woCategory,
      shiftType
    });
  };

  const toggleRowSelection = (woId) => {
    setSelectedRows(prev => 
      prev.includes(woId) ? prev.filter(id => id !== woId) : [...prev, woId]
    );
  };

  const toggleAllRows = () => {
    if (selectedRows.length === groupedWorkOrders.length) {
      setSelectedRows([]);
    } else {
      setSelectedRows(groupedWorkOrders.map(g => `group-${g.title}`));
    }
  };

  const handleBulkClose = async () => {
    if (selectedRows.length === 0) {
      toast.info('No orders selected');
      return;
    }

    const confirmed = confirm(`Close ${selectedRows.length} job order(s) and all their reports?`);
    if (!confirmed) return;

    setIsBulkProcessing(true);
    try {
      const selectedGroups = groupedWorkOrders.filter(g => selectedRows.includes(`group-${g.title}`));
      const allOrderIds = selectedGroups.flatMap(g => g.orders.map(o => o.id));
      
      toast.info(`Closing ${allOrderIds.length} work order(s)...`);

      for (const id of allOrderIds) {
        await base44.entities.TimeEntry.update(id, {
          status: 'closed',
          closed_date: new Date().toISOString()
        });
      }

      await loadWorkOrders();
      setSelectedRows([]);
      toast.success(`Closed ${allOrderIds.length} work order(s)`);
    } catch (error) {
      console.error('Bulk close failed:', error);
      toast.error('Failed to close orders');
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedRows.length === 0) {
      toast.info('No orders selected');
      return;
    }

    const confirmed = confirm(`Delete ${selectedRows.length} job order(s) and all their reports? This cannot be undone.`);
    if (!confirmed) return;

    setIsBulkProcessing(true);
    try {
      const selectedGroups = groupedWorkOrders.filter(g => selectedRows.includes(`group-${g.title}`));
      const allOrderIds = selectedGroups.flatMap(g => g.orders.map(o => o.id));
      
      toast.info(`Deleting ${allOrderIds.length} work order(s)...`);

      for (const id of allOrderIds) {
        await base44.entities.TimeEntry.delete(id);
      }

      await loadWorkOrders();
      setSelectedRows([]);
      toast.success(`Deleted ${allOrderIds.length} work order(s)`);
    } catch (error) {
      console.error('Bulk delete failed:', error);
      toast.error('Failed to delete orders');
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const toggleRowExpansion = (woId) => {
    setExpandedRows(prev => 
      prev.includes(woId) ? prev.filter(id => id !== woId) : [...prev, woId]
    );
  };

  const handleCreateJobOrder = () => {
    setSelectedEntry(null);
    setIsCreating(true);
    setIsDialogOpen(true);
  };

  const handleEditJobOrder = (order) => {
    setSelectedEntry(order);
    setIsCreating(false);
    setIsDialogOpen(true);
  };

  const handleSaveJobOrder = async (formData, options = {}) => {
    if (isSaving) {
      console.log('⏳ [DEBUG] Already saving, ignoring request');
      return;
    }

    try {
      setIsSaving(true);
      console.log('💾 [DEBUG] SAVE STARTED - isCreating:', isCreating);
      console.log('💾 [DEBUG] selectedEntry:', selectedEntry?.id);
      console.log('💾 [DEBUG] formData keys:', Object.keys(formData));
      console.log('💾 [DEBUG] formData.title:', formData.title);
      console.log('💾 [DEBUG] formData.tasks.length:', formData.tasks?.length);
      
      if (isCreating) {
        const project = projects.find(p => p.id === formData.project_id);
        const resolvedBranch = formData.branch_id || project?.branch_id || currentCompany?.id;
        console.log('🆕 [DEBUG] Creating new - branch:', resolvedBranch);
        if (!resolvedBranch) {
          toast.error('Cannot create: missing Branch');
          return;
        }
        const result = await base44.entities.TimeEntry.create({ ...formData, branch_id: resolvedBranch });
        console.log('✅ [DEBUG] Created with ID:', result?.id);
        toast.success('Job order created successfully');
      } else {
        if (!selectedEntry?.id) {
          console.error('❌ [DEBUG] No entry ID');
          toast.error('No work order selected');
          return;
        }
        console.log('📝 [DEBUG] Updating ID:', selectedEntry.id);
        const result = await base44.entities.TimeEntry.update(selectedEntry.id, formData);
        console.log('✅ [DEBUG] Updated result:', result);
        toast.success('Job order updated successfully');
      }
      
      console.log('🔄 [DEBUG] Reloading data...');
      await loadAllData();
      console.log('✅ [DEBUG] Data reloaded');
      if (!options.keepOpen) {
        setIsDialogOpen(false);
        setSelectedEntry(null);
      }
    } catch (error) {
      console.error('❌ [DEBUG] SAVE ERROR:', error);
      console.error('❌ [DEBUG] Error message:', error.message);
      toast.error(error.message || 'Failed to save job order');
    } finally {
      setIsSaving(false);
      console.log('🏁 [DEBUG] SAVE FINISHED');
    }
  };

  const handleSaveCategoryInline = async (group, newCategoryId) => {
    const orderIds = group.orders.map(o => o.id);
    try {
      await Promise.all(orderIds.map(id =>
        base44.entities.TimeEntry.update(id, { work_order_category_id: newCategoryId || null })
      ));
      setWorkOrders(prev => prev.map(wo =>
        orderIds.includes(wo.id) ? { ...wo, work_order_category_id: newCategoryId || null } : wo
      ));
      toast.success('Category updated');
    } catch (e) {
      toast.error('Failed to update category');
    }
    setEditingCategory(null);
  };

  const handleSaveInlineTitle = async () => {
    if (!editingTitle) return;
    const newTitle = editingTitle.value.trim();
    if (!newTitle) { setEditingTitle(null); return; }
    try {
      await Promise.all(editingTitle.orderIds.map(id =>
        base44.entities.TimeEntry.update(id, { title: newTitle })
      ));
      setWorkOrders(prev => prev.map(wo =>
        editingTitle.orderIds.includes(wo.id) ? { ...wo, title: newTitle } : wo
      ));
    } catch (e) {
      toast.error('Failed to update title');
    }
    setEditingTitle(null);
  };

  const handleDeleteJobOrder = async (entryId) => {
    try {
      await base44.entities.TimeEntry.delete(entryId);
      // Actualización local (sin refrescar toda la página ni perder el scroll/filtros)
      setWorkOrders((prev) => prev.filter((wo) => wo.id !== entryId));
      setIsDialogOpen(false);
      setSelectedEntry(null);
    } catch (error) {
      console.error('Error deleting job order:', error);
      alert('Failed to delete job order');
    }
  };

    const toggleOrderStatus = async (order) => {
      const next = order.status === 'open' ? 'closed' : 'open';
      const update = { status: next };
      
      // If closing for the first time, set closed_date
      if (next === 'closed' && !order.closed_date) {
        update.closed_date = new Date().toISOString();
      }
      
      // If reopening, remove closed_date to recalculate
      if (next === 'open') {
        update.closed_date = null;
      }
      
      await base44.entities.TimeEntry.update(order.id, update);
      setWorkOrders(prev => prev.map(wo => wo.id === order.id ? { ...wo, ...update } : wo));
    };

     const renderCollapsedRows = (group) => {
    // Build one row per TASK (across all orders), sorted by task date
    const rows = [];
    const sortedOrders = [...group.orders].sort((a, b) => {
      const dateA = a.planned_start_time ? new Date(a.planned_start_time).getTime() : 0;
      const dateB = b.planned_start_time ? new Date(b.planned_start_time).getTime() : 0;
      return dateA - dateB;
    });

    for (const order of sortedOrders) {
      const wrForOrder = (workingReports || []).find(w => w.time_entry_id === order.id);
      const ref = order.start_time || order.planned_start_time || order.created_date;
      const finalNum = wrForOrder?.report_number
        ? formatWONumberSmart(wrForOrder.report_number, wrForOrder.created_date || ref)
        : '-';
      const equipmentIds = order.equipment_ids || [];
      const allEquipment = [...safeAssets, ...safeClientEquipments];
      const orderEquipment = allEquipment.filter(eq => equipmentIds.includes(eq.id));

      const tasksToRender = order.tasks && order.tasks.length > 0 ? order.tasks : [null];

      for (const task of tasksToRender) {
        const taskDate = task?.date
          ? task.date
          : (order.planned_start_time ? format(parseISO(order.planned_start_time), 'dd/MM/yy') : '-');

        const instruction = task?.instructions || task?.name || order.task || '-';

        const taskUserIds = new Set();
        if (task) {
          (task.employee_ids || []).forEach(uid => taskUserIds.add(uid));
        } else {
          (order.employee_ids || []).forEach(uid => taskUserIds.add(uid));
          if (order.employee_id) taskUserIds.add(order.employee_id);
        }
        const assignedUsers = safeUsers.filter(u => taskUserIds.has(u.id));

        const clockIn = order.start_time ? format(parseISO(order.start_time), 'MM/dd HH:mm') : '-';
        const clockOut = order.end_time ? format(parseISO(order.end_time), 'MM/dd HH:mm') : '-';
        const totalTime = order.duration_minutes ? `${Math.floor(order.duration_minutes / 60)}h ${order.duration_minutes % 60}m` : '-';

        const taskName = task?.name || '-';
        const taskStatus = task?.status || null;

        rows.push(
          <tr key={`${order.id}-${task?.id || 'notask'}`} className="border-b border-slate-100 hover:bg-slate-50 h-9">
            <td className="px-3 py-1.5">
              <span className="text-[11px] font-medium text-indigo-600">{finalNum}</span>
            </td>
            <td className="px-3 py-1.5">
              <span className="text-[11px] text-slate-600">{taskDate}</span>
            </td>
            <td className="px-3 py-1.5">
              {orderEquipment.length > 0 ? (
                <div className="flex items-center gap-1">
                  {orderEquipment.slice(0, 2).map(eq => (
                    <div key={eq.id} className="w-5 h-5 rounded-full bg-slate-800 border border-white flex items-center justify-center" title={eq.name}>
                      <span className="text-[8px] text-white font-bold">{eq.name?.substring(0, 2).toUpperCase() || 'EQ'}</span>
                    </div>
                  ))}
                  {orderEquipment.length > 2 && (
                    <span className="text-[10px] text-slate-500 ml-1">+{orderEquipment.length - 2}</span>
                  )}
                </div>
              ) : (
                <span className="text-[11px] text-slate-400">-</span>
              )}
            </td>
            <td className="px-3 py-1.5">
              <span className="text-[11px] font-medium text-slate-800 truncate block max-w-[150px]">{taskName}</span>
            </td>
            <td className="px-3 py-1.5">
              <span className="text-[11px] text-slate-700 truncate block max-w-[180px]">{instruction}</span>
            </td>
            <td className="px-3 py-1.5">
             {taskStatus ? (
               <div className="flex items-center gap-2">
                 <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${taskStatus === 'completed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                   {taskStatus === 'completed' ? 'Completed' : 'Pending'}
                 </span>
                 <button
                   onClick={async (e) => {
                     e.stopPropagation();
                     const newStatus = taskStatus === 'completed' ? 'pending' : 'completed';
                     const updatedTasks = order.tasks.map(t => 
                       t.id === task.id ? { ...t, status: newStatus } : t
                     );
                     try {
                       await base44.entities.TimeEntry.update(order.id, { tasks: updatedTasks });
                       setWorkOrders(prev => prev.map(wo =>
                         wo.id === order.id ? { ...wo, tasks: updatedTasks } : wo
                       ));
                       toast.success(`Task marked as ${newStatus}`);
                     } catch (error) {
                       toast.error('Failed to update task status');
                     }
                   }}
                   className="p-0.5 hover:bg-slate-200 rounded transition-colors"
                   title={`Mark as ${taskStatus === 'completed' ? 'pending' : 'completed'}`}
                 >
                   {taskStatus === 'completed' ? (
                     <X className="w-3.5 h-3.5 text-red-600" />
                   ) : (
                     <Check className="w-3.5 h-3.5 text-green-600" />
                   )}
                 </button>
               </div>
             ) : (
               <span className="text-[11px] text-slate-400">-</span>
             )}
            </td>
            <td className="px-3 py-1.5">
              <div className="flex items-center -space-x-2">
                {assignedUsers.length > 0 ? (
                  assignedUsers.slice(0, 4).map((user, idx) => (
                    <div key={user.id} className="relative" style={{ zIndex: assignedUsers.length - idx }}>
                      <Avatar user={user} size="xs" />
                    </div>
                  ))
                ) : (
                  <span className="text-[11px] text-slate-400">-</span>
                )}
                {assignedUsers.length > 4 && (
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-200 border-2 border-white text-[9px] font-medium text-slate-600">
                    +{assignedUsers.length - 4}
                  </div>
                )}
              </div>
            </td>
            <td className="px-3 py-1.5">
              <span className="text-[11px] text-slate-600">{clockIn}</span>
            </td>
            <td className="px-3 py-1.5">
              <span className="text-[11px] text-slate-600">{clockOut}</span>
            </td>
            <td className="px-3 py-1.5">
              <span className="text-[11px] font-medium text-slate-700">{totalTime}</span>
            </td>
            <td className="px-3 py-1.5 text-center">
              <div className="flex items-center justify-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => handleEditJobOrder(order)} className="h-6 px-2 text-[10px] text-slate-600 hover:text-slate-700 hover:bg-slate-100">Edit</Button>
                <Button variant="ghost" size="sm" onClick={() => handleViewPDF(order)} className="h-6 w-6 p-0 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50">
                   <Eye className="w-3 h-3" />
                 </Button>
                 <Button variant="ghost" size="sm" onClick={() => { setSelectedEntry(order); setIsCreating(false); setIsDialogOpen(true); setDefaultTab('documents'); }} className="h-6 w-6 p-0 text-green-600 hover:text-green-700 hover:bg-green-50" title="View Documents">
                   <FolderOpen className="w-3 h-3" />
                 </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (!task) {
                      // No task object — delete whole order
                      if (window.confirm('Delete this work order?')) {
                        await base44.entities.TimeEntry.delete(order.id);
                        setWorkOrders(prev => prev.filter(wo => wo.id !== order.id));
                      }
                    } else {
                      // Delete only this task from the order
                      if (!window.confirm('Delete this task?')) return;
                      const updatedTasks = (order.tasks || []).filter(t => t.id !== task.id);
                      await base44.entities.TimeEntry.update(order.id, { tasks: updatedTasks });
                      setWorkOrders(prev => prev.map(wo =>
                        wo.id === order.id ? { ...wo, tasks: updatedTasks } : wo
                      ));
                    }
                  }}
                  className="h-6 px-2 text-[10px] text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  Delete
                </Button>
              </div>
            </td>
          </tr>
        );
      }
    }
    return rows;
  };

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      {/* Top Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
            <span className="text-lg">📋</span>
          </div>
          <h1 className="text-xl font-semibold text-slate-900">Orders</h1>
        </div>
        <Button variant="ghost" size="sm" className="gap-2" onClick={() => setShowSettings(true)}>
          <Settings className="w-4 h-4" />
          Settings
        </Button>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-slate-200 px-6 py-2 flex gap-2">
        <Button variant={activeTab==='list' ? 'default' : 'outline'} size="sm" onClick={() => setActiveTab('list')}>List</Button>
        <Button variant={activeTab==='documents' ? 'default' : 'outline'} size="sm" onClick={() => setActiveTab('documents')}>Document Matrix</Button>
      </div>

      {activeTab === 'list' ? (
        <>
      {/* Status Tabs */}
      <div className="bg-white border-b border-slate-200 px-6 py-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setStatusFilter('all')}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-all",
              statusFilter === 'all' 
                ? "bg-slate-800 text-white shadow-sm" 
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            )}
          >
            All
          </button>
          <button
            onClick={() => setStatusFilter('open')}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2",
              statusFilter === 'open' 
                ? "bg-green-600 text-white shadow-sm" 
                : "bg-green-50 text-green-700 hover:bg-green-100"
            )}
          >
            Open
            <span className={cn("text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center",
              statusFilter === 'open' ? "bg-white/30 text-white" : "bg-green-200 text-green-800"
            )}>{periodCounts.open}</span>
          </button>
          <button
            onClick={() => setStatusFilter('closed')}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2",
              statusFilter === 'closed' 
                ? "bg-red-600 text-white shadow-sm" 
                : "bg-red-50 text-red-700 hover:bg-red-100"
            )}
          >
            Closed
            <span className={cn("text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center",
              statusFilter === 'closed' ? "bg-white/30 text-white" : "bg-red-200 text-red-800"
            )}>{periodCounts.closed}</span>
          </button>
        </div>
      </div>

      {/* Multi-select bar */}
      {selectedRows.length > 0 && (
        <div className="bg-indigo-50 border-b border-indigo-200 px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckSquare className="w-5 h-5 text-indigo-600" />
              <span className="text-sm font-semibold text-indigo-900">
                {selectedRows.length} working order(s) selected ({groupedWorkOrders.filter(g => selectedRows.includes(`group-${g.title}`)).reduce((sum, g) => sum + g.orders.reduce((t, o) => t + (o.tasks?.length || 0), 0), 0)} tasks)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setSelectedRows([])}
                disabled={isBulkProcessing}
              >
                Cancel
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowMergeDialog(true)}
                disabled={isBulkProcessing || selectedRows.length < 2}
                className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200 gap-1"
              >
                <GitMerge className="w-4 h-4" />
                Merge
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleBulkClose}
                disabled={isBulkProcessing}
                className="bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
              >
                {isBulkProcessing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <CheckSquare className="w-4 h-4 mr-2" />
                )}
                Close
              </Button>
              <Button 
                variant="destructive" 
                size="sm" 
                onClick={handleBulkDelete}
                disabled={isBulkProcessing}
              >
                {isBulkProcessing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-2" />
                )}
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="bg-white border-b border-slate-200 px-6 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-3 flex-1 min-w-0">

            {/* Multi-select category filter */}
            <div className="relative" ref={categoryDropdownRef}>
              <button
                type="button"
                onClick={() => setCategoryDropdownOpen(o => !o)}
                className="flex items-center gap-2 h-9 px-3 rounded-md border border-slate-200 bg-white text-sm min-w-[192px] hover:bg-slate-50"
              >
                <span className="flex-1 text-left truncate text-slate-700">
                  {selectedCategories.length === 0
                    ? 'All Categories'
                    : selectedCategories.length === 1
                      ? safeCategories.find(c => c.id === selectedCategories[0])?.name || '1 selected'
                      : `${selectedCategories.length} categories`}
                </span>
                {selectedCategories.length > 0 && (
                  <span
                    onClick={(e) => { e.stopPropagation(); setSelectedCategories([]); }}
                    className="text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </span>
                )}
                <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
              </button>
              {categoryDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-slate-200 rounded-md shadow-lg min-w-[220px] max-h-72 overflow-y-auto">
                  <div
                    className="px-3 py-2 text-sm cursor-pointer hover:bg-slate-50 flex items-center gap-2 border-b border-slate-100"
                    onClick={() => setSelectedCategories([])}
                  >
                    <span className={cn("w-4 h-4 rounded border flex items-center justify-center flex-shrink-0", selectedCategories.length === 0 ? "bg-indigo-600 border-indigo-600" : "border-slate-300")}>
                      {selectedCategories.length === 0 && <span className="text-white text-[10px]">✓</span>}
                    </span>
                    All Categories
                  </div>
                  {safeCategories.map(cat => (
                    <div
                      key={cat.id}
                      className="px-3 py-2 text-sm cursor-pointer hover:bg-slate-50 flex items-center gap-2"
                      onClick={() => {
                        setSelectedCategories(prev =>
                          prev.includes(cat.id) ? prev.filter(id => id !== cat.id) : [...prev, cat.id]
                        );
                      }}
                    >
                      <span className={cn("w-4 h-4 rounded border flex items-center justify-center flex-shrink-0", selectedCategories.includes(cat.id) ? "bg-indigo-600 border-indigo-600" : "border-slate-300")}>
                        {selectedCategories.includes(cat.id) && <span className="text-white text-[10px]">✓</span>}
                      </span>
                      {cat.name}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0 whitespace-nowrap">
              <Input type="date" value={createdFrom} onChange={(e)=>setCreatedFrom(e.target.value)} className="h-9 w-36" />
              <span className="text-slate-400 text-xs">to</span>
              <Input type="date" value={createdTo} onChange={(e)=>setCreatedTo(e.target.value)} className="h-9 w-36" />
              {(createdFrom || createdTo) && (
                <Button variant="ghost" size="sm" className="h-9" onClick={()=>{ setCreatedFrom(''); setCreatedTo(''); }}>
                  Clear
                </Button>
              )}
            </div>

            {/* Day navigator (prev / next / today) */}
            <div className="flex items-center gap-1 ml-2">
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => shiftDay(-1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="min-w-[120px] text-xs text-slate-600 text-center">
                {dayLabel}
              </div>
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => shiftDay(1)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" className="h-9" onClick={setToday}>
                Today
              </Button>
            </div>
            
            <div className="flex items-center gap-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search job orders..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-64 h-9"
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-slate-500 hover:text-slate-700"
                onClick={loadAllData}
                disabled={loading}
                title="Refresh"
              >
                <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-40 h-9">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="title">Job Title</SelectItem>
                  <SelectItem value="client">Client</SelectItem>
                  <SelectItem value="project">Project</SelectItem>
                  <SelectItem value="category">Category</SelectItem>
                  <SelectItem value="created_date">{ordersOpenLabel}</SelectItem>
                  <SelectItem value="finish_date">{ordersClosedLabel}</SelectItem>
                  <SelectItem value="wo_number">WO N</SelectItem>
                  <SelectItem value="wr_number">WR N</SelectItem>
                  <SelectItem value="last_visit_date">Last Visit Scheduled</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" className="h-9" onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}>
                {sortOrder === 'asc' ? '↑' : '↓'}
              </Button>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={withEquipment}
                onChange={(e) => setWithEquipment(e.target.checked)}
                className="w-4 h-4 cursor-pointer"
              />
              <span className="text-sm text-slate-700">With Equipment</span>
            </label>
          </div>

          <div className="flex items-center gap-2 ml-auto">
           <Button
            variant="outline"
            size="sm"
            className="h-9 gap-2"
            onClick={handleFixWONumbers}
            disabled={loading}
          >
            Assign WO #
          </Button>

           <Button
            variant="outline"
            size="sm"
            className="h-9 gap-2"
            onClick={() => {
              const allGroupIds = groupedWorkOrders.map(g => `group-${g.title}`);
              const allExpanded = allGroupIds.every(id => expandedRows.includes(id));
              if (allExpanded) {
                setExpandedRows([]);
              } else {
                setExpandedRows(allGroupIds);
              }
            }}
          >
            {groupedWorkOrders.every(g => expandedRows.includes(`group-${g.title}`)) ? (
              <><ChevronDown className="w-4 h-4 rotate-180" /> Collapse All</>
            ) : (
              <><ChevronDown className="w-4 h-4" /> Expand All</>
            )}
          </Button>

            <Button 
              className="gap-2 bg-indigo-600 hover:bg-indigo-700"
              onClick={handleCreateJobOrder}
            >
              <Plus className="w-4 h-4" />
              Job Order
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setShowUrgentDialog(true)}
            >
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              Urgent Order
            </Button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
            <tr>
              <th className="px-2 py-1 w-10">
                <Checkbox
                  checked={selectedRows.length === groupedWorkOrders.length && groupedWorkOrders.length > 0}
                  onCheckedChange={toggleAllRows}
                />
              </th>
              <th 
                className="text-left px-2 py-1 text-xs font-semibold text-slate-700 h-8 cursor-pointer hover:bg-slate-100 w-24"
                onClick={() => { setSortBy('wo_number'); setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc'); }}
              >
                WO # {sortBy === 'wo_number' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th 
                className="text-left px-2 py-1 text-xs font-semibold text-slate-700 h-8 cursor-pointer hover:bg-slate-100 w-72 max-w-[300px]"
                onClick={() => { setSortBy('title'); setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc'); }}
              >
                Working Order {sortBy === 'title' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th className="text-left px-2 py-1 text-xs font-semibold text-slate-700 h-8 w-16">Tasks N</th>
              <th className="text-left px-2 py-1 text-xs font-semibold text-slate-700 h-8">Equipment</th>
              <th
                className="text-left px-2 py-1 text-xs font-semibold text-slate-700 h-8 cursor-pointer hover:bg-slate-100"
                onClick={() => { setSortBy('last_visit_date'); setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc'); }}
              >
                Last Visit Scheduled {sortBy === 'last_visit_date' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th 
                className="text-left px-2 py-1 text-xs font-semibold text-slate-700 h-8 cursor-pointer hover:bg-slate-100 w-40"
                onClick={() => { setSortBy('client'); setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc'); }}
              >
                Client {sortBy === 'client' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th 
                className="text-left px-2 py-1 text-xs font-semibold text-slate-700 h-8 cursor-pointer hover:bg-slate-100 w-36"
                onClick={() => { setSortBy('project'); setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc'); }}
              >
                Project {sortBy === 'project' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th 
                className="text-left px-2 py-1 text-xs font-semibold text-slate-700 h-8 cursor-pointer hover:bg-slate-100"
                onClick={() => { setSortBy('category'); setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc'); }}
              >
                Categories {sortBy === 'category' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th 
                className="text-left px-2 py-1 text-xs font-semibold text-slate-700 h-8 cursor-pointer hover:bg-slate-100"
                onClick={() => { setSortBy('created_date'); setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc'); }}
                >
                  Open Date {sortBy === 'created_date' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
              <th 
                className="text-left px-2 py-1 text-xs font-semibold text-slate-700 h-8 cursor-pointer hover:bg-slate-100"
                onClick={() => { setSortBy('finish_date'); setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc'); }}
                >
                  Close Date {sortBy === 'finish_date' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
              <th className="text-left px-2 py-1 text-xs font-semibold text-slate-700 h-8">Time Open</th>
              <th className="text-left px-2 py-1 text-xs font-semibold text-slate-700 h-8 w-28">Status</th>
              <th className="text-center px-2 py-1 text-xs font-semibold text-slate-700 h-8 w-16"></th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {loading ? (
              <tr>
                <td colSpan="11" className="text-center py-12 text-slate-500">
                  Loading...
                </td>
              </tr>
            ) : groupedWorkOrders.length === 0 ? (
              <tr>
                <td colSpan="11" className="text-center py-12 text-slate-500">
                  No job orders found
                </td>
              </tr>
            ) : (
              groupedWorkOrders.map((group) => {
                const wo = group.firstOrder;
                const project = safeProjects.find(p => p.id === wo.project_id);
                const customer = project ? safeCustomers.find(c => c.id === project.customer_id) : null;
                const category = safeCategories.find(c => c.id === wo.work_order_category_id);
                
                // Find the most recent closed order to get finish date
                const closedOrders = group.orders.filter(o => o.status === 'closed');
                const isClosed = closedOrders.length > 0;
                const finishDate = closedOrders.length > 0 
                  ? closedOrders.reduce((latest, order) => {
                      const orderDate = order.closed_date || order.updated_date;
                      const parsedDate = orderDate ? parseISO(orderDate) : null;
                      if (!latest || (parsedDate && parsedDate > latest)) {
                        return parsedDate;
                      }
                      return latest;
                    }, null)
                  : null;
                
                // Calculate time open (from openDate to finishDate or now)
                const timeOpenDays = (() => {
                  if (!group.openDate) return null;
                  const start = parseISO(group.openDate);
                  const end = finishDate || new Date();
                  const diffMs = end.getTime() - start.getTime();
                  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                  return days;
                })();
                
                const groupId = `group-${group.title}`;
                const isSelected = selectedRows.includes(groupId);
                const isExpanded = expandedRows.includes(groupId);



                return (
                    <React.Fragment key={groupId}>
                      <tr
                      className={cn(
                        "border-b border-slate-100 hover:bg-slate-50 transition-colors h-9",
                        isSelected && "bg-indigo-50"
                      )}
                    >
                      <td className="px-2 py-1">
                        <div className="flex items-center gap-1">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleRowSelection(groupId)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (editingTitle?.groupId === groupId) {
                                setEditingTitle(null);
                              } else {
                                setEditingTitle({ groupId, value: group.title, orderIds: group.orders.map(o => o.id) });
                                setTimeout(() => titleInputRef.current?.focus(), 50);
                              }
                            }}
                            className="h-6 w-6 p-0 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                            title="Edit title"
                          >
                            <Edit3 className="w-3 h-3" />
                          </Button>
                        </div>
                      </td>
                      <td className="px-2 py-1 w-24">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleEditJobOrder(wo); }}
                          className={cn("text-xs font-medium font-mono hover:underline cursor-pointer", wo?.archived ? "text-slate-400 line-through" : "text-indigo-600 hover:text-indigo-800")}
                        >
                          {wo?.work_order_number ? formatWONumberSmart(wo.work_order_number, wo.start_time || wo.planned_start_time || wo.created_date) : <span className="text-slate-400">—</span>}
                        </button>
                      </td>
                      <td className="px-2 py-1 w-72 max-w-[300px]" onClick={() => { if (!editingTitle) toggleRowSelection(groupId); }}>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleRowExpansion(groupId);
                            }}
                            className="hover:bg-slate-200 rounded p-1 transition-colors"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-slate-600" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-slate-400" />
                            )}
                          </button>
                          {editingTitle?.groupId === groupId ? (
                            <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                              <input
                                ref={titleInputRef}
                                value={editingTitle.value}
                                onChange={e => setEditingTitle(prev => ({ ...prev, value: e.target.value }))}
                                onKeyDown={e => { if (e.key === 'Enter') handleSaveInlineTitle(); if (e.key === 'Escape') setEditingTitle(null); }}
                                className="text-xs font-medium border border-indigo-300 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-56"
                              />
                              <Button size="sm" className="h-6 px-2 text-[10px] bg-indigo-600 hover:bg-indigo-700" onClick={handleSaveInlineTitle}>Save</Button>
                              <Button size="sm" variant="ghost" className="h-6 px-1 text-[10px]" onClick={() => setEditingTitle(null)}>✕</Button>
                            </div>
                          ) : (
                            <>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleEditJobOrder(wo); }}
                                className="text-xs font-medium text-slate-900 hover:text-indigo-600 hover:underline truncate block max-w-[200px] text-left"
                                title={group.title}
                              >
                                {group.title}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-1 w-16 text-center">
                        {(() => {
                          const taskCount = group.orders.reduce((sum, o) => sum + (o.tasks && o.tasks.length > 0 ? o.tasks.length : 1), 0);
                          return <span className="text-xs font-semibold text-slate-700">{taskCount}</span>;
                        })()}
                      </td>
                      <td className="px-2 py-1 max-w-[140px]">
                        {(() => {
                          const allEquipment = [...safeAssets, ...safeClientEquipments];
                          const eqIds = wo?.equipment_ids || [];
                          const eqItems = allEquipment.filter(a => eqIds.includes(a.id));
                          if (eqItems.length === 0) return <span className="text-xs text-slate-400">-</span>;
                          return (
                            <span className="text-xs text-slate-700 truncate block max-w-[140px]" title={eqItems.map(e => e.name).join(', ')}>
                              {eqItems[0].name}{eqItems.length > 1 ? ` +${eqItems.length - 1}` : ''}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-2 py-1">
                        <span className="text-xs text-slate-600">
                          {(() => {
                            let lastDate = null;
                            group.orders.forEach(o => {
                              if (o.tasks && o.tasks.length > 0) {
                                o.tasks.forEach(t => {
                                  if (t.date && (!lastDate || t.date > lastDate)) lastDate = t.date;
                                });
                              }
                            });
                            if (lastDate) return formatDateInDubai(`${lastDate}T00:00:00`);
                            return '-';
                          })()}
                        </span>
                      </td>
                      <td className="px-2 py-1 max-w-[160px]">
                        <span className="text-xs text-slate-700 truncate block max-w-[160px]" title={customer?.name}>
                          {customer?.name || '-'}
                        </span>
                      </td>
                      <td className="px-2 py-1 max-w-[140px]">
                        <span className="text-xs text-slate-700 truncate block max-w-[140px]" title={project?.name}>
                          {project?.name || '-'}
                        </span>
                      </td>
                      <td className="px-2 py-1" onClick={e => e.stopPropagation()}>
                        {editingCategory === groupId ? (
                          <div ref={categoryEditRef} className="relative z-50">
                            <select
                              autoFocus
                              value={wo.work_order_category_id || ''}
                              onChange={(e) => handleSaveCategoryInline(group, e.target.value)}
                              onBlur={() => setEditingCategory(null)}
                              className="text-[11px] rounded border border-indigo-300 bg-white px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer max-w-[160px]"
                            >
                              <option value="">— No category —</option>
                              {safeCategories.map(cat => (
                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                              ))}
                            </select>
                          </div>
                        ) : (
                          <button
                            onClick={() => setEditingCategory(groupId)}
                            className="group flex items-center gap-1 hover:opacity-80 transition-opacity"
                            title="Click to change category"
                          >
                            {category ? (
                              <Badge variant="outline" className="text-[10px] group-hover:border-indigo-400 group-hover:bg-indigo-50 cursor-pointer">
                                {category.name}
                              </Badge>
                            ) : (
                              <span className="text-xs text-slate-400 hover:text-indigo-500 cursor-pointer">+ category</span>
                            )}
                          </button>
                        )}
                      </td>
                      <td className="px-2 py-1">
                        {group.openDate && (
                          <span className="text-[11px] text-slate-600">{formatDateInDubai(group.openDate)}</span>
                        )}
                      </td>
                      <td className="px-2 py-1">
                        {finishDate && (
                          <span className="text-[11px] text-slate-600">{format(finishDate, 'dd/MM/yy')}</span>
                        )}
                      </td>
                      <td className="px-2 py-1">
                        <span className="text-[11px] font-bold text-slate-900">
                          {timeOpenDays !== null ? `${timeOpenDays}d` : '-'}
                        </span>
                      </td>
                      <td className="px-2 py-1" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={isClosed ? 'closed' : 'open'}
                          onChange={async (e) => {
                            const nextStatus = e.target.value;
                            const update = { status: nextStatus };
                            if (nextStatus === 'closed') update.closed_date = new Date().toISOString();
                            if (nextStatus === 'open') update.closed_date = null;
                            await Promise.all(group.orders.map(order =>
                              base44.entities.TimeEntry.update(order.id, update)
                            ));
                            await loadWorkOrders();
                          }}
                          className={cn(
                            "text-[11px] font-semibold rounded-md px-2 py-1 border cursor-pointer focus:outline-none",
                            isClosed
                              ? "bg-red-50 text-red-700 border-red-200"
                              : "bg-green-50 text-green-700 border-green-200"
                          )}
                        >
                          <option value="open">Open</option>
                          <option value="closed">Closed</option>
                        </select>
                      </td>
                    </tr>
{isExpanded ? (
                      <tr key={`${groupId}-exp`} className="bg-white">
                        <td colSpan="11" className="px-12 py-6">
                          <div className="border border-slate-200 rounded-lg overflow-hidden">
                            {/* Tasks */}
                            <div className="bg-slate-50 px-3 py-2 border-b border-slate-200">
                              <h4 className="text-xs font-semibold text-slate-700 flex items-center gap-2">
                                <span>📋</span>
                                Tasks ({group.orders.reduce((sum, o) => sum + (o.tasks && o.tasks.length > 0 ? o.tasks.length : 1), 0)})
                              </h4>
                            </div>
                            <table className="w-full">
                              <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                  <th className="text-left px-3 py-1.5 text-[10px] font-semibold text-slate-600 uppercase h-8">WR #</th>
                                  <th className="text-left px-3 py-1.5 text-[10px] font-semibold text-slate-600 uppercase h-8">Scheduled date</th>
                                  <th className="text-left px-3 py-1.5 text-[10px] font-semibold text-slate-600 uppercase h-8">Equipment</th>
                                  <th className="text-left px-3 py-1.5 text-[10px] font-semibold text-slate-600 uppercase h-8">Task Title</th>
                                  <th className="text-left px-3 py-1.5 text-[10px] font-semibold text-slate-600 uppercase h-8">Instruction</th>
                                  <th className="text-left px-3 py-1.5 text-[10px] font-semibold text-slate-600 uppercase h-8">Status</th>
                                  <th className="text-left px-3 py-1.5 text-[10px] font-semibold text-slate-600 uppercase h-8">Users</th>
                                  <th className="text-left px-3 py-1.5 text-[10px] font-semibold text-slate-600 uppercase h-8">Clock In</th>
                                  <th className="text-left px-3 py-1.5 text-[10px] font-semibold text-slate-600 uppercase h-8">Clock Out</th>
                                  <th className="text-left px-3 py-1.5 text-[10px] font-semibold text-slate-600 uppercase h-8">Total Hrs</th>
                                  <th className="text-center px-3 py-1.5 text-[10px] font-semibold text-slate-600 uppercase h-8 w-28">Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {renderCollapsedRows(group)}
                              </tbody>


                            </table>

                            {/* All Attached Documents from all orders */}
                            {(() => {
                              const allDocs = group.orders.flatMap(o => o.file_urls || []);
                              return allDocs.length > 0 && (
                                <>
                                  <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 mt-6">
                                    <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                      <span>📎</span>
                                      Other Attached Documents ({allDocs.length})
                                    </h4>
                                  </div>
                                  <table className="w-full">
                                    <thead className="bg-slate-50 border-b border-slate-200">
                                      <tr>
                                        <th className="text-left px-4 py-2 text-xs font-semibold text-slate-600">Document</th>
                                        <th className="text-left px-4 py-2 text-xs font-semibold text-slate-600">Type</th>
                                        <th className="text-center px-4 py-2 text-xs font-semibold text-slate-600">Actions</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {allDocs.map((fileUrl, index) => {
                                        const fileName = fileUrl.split('/').pop() || `Document ${index + 1}`;
                                        const fileExt = fileName.split('.').pop()?.toLowerCase() || '';

                                        return (
                                          <tr key={index} className="border-b border-slate-100 hover:bg-slate-50">
                                            <td className="px-4 py-3">
                                              <span className="text-sm text-slate-700">{fileName}</span>
                                            </td>
                                            <td className="px-4 py-3">
                                              <Badge variant="outline" className="text-xs">
                                                {fileExt === 'pdf' ? 'PDF' : fileExt === 'jpg' || fileExt === 'jpeg' || fileExt === 'png' ? 'Image' : 'Document'}
                                              </Badge>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => window.open(fileUrl, '_blank')}
                                                className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                                              >
                                                View
                                              </Button>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </>
                              );
                            })()}
                          </div>
                        </td>
                      </tr>
                    ) : null}
                    </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

        </>
       ) : (
         <div className="p-6">
          <OrdersDocumentMatrixTab entries={workOrders} categories={safeCategories} />
        </div>
      )}

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
          onClose={() => setShowPDFDialog(null)}
        />
      )}

      <OrdersSettingsPanel isOpen={showSettings} onClose={() => setShowSettings(false)} />
{/* Job Order Dialog */}
      <WorkOrderDetailsDialog
        isOpen={isDialogOpen}
        entry={selectedEntry}
        defaultTab={defaultTab}
        onClose={() => {
          setIsDialogOpen(false);
          setSelectedEntry(null);
          setDefaultTab('order');
        }}
        onSave={handleSaveJobOrder}
        onDelete={handleDeleteJobOrder}
        projects={safeProjects}
        users={safeUsers}
        teams={safeTeams}
        customers={safeCustomers}
        assets={safeAssets}
        clientEquipments={safeClientEquipments}
        categories={safeCategories}
        shiftTypes={safeShiftTypes}
        isCreating={isCreating}
        isSaving={isSaving}
        allEntries={workOrders}
        onSelectExistingWorkOrder={(wo) => {
          setIsCreating(false);
          setSelectedEntry(wo);
        }}
        onCreateNewWorkOrder={() => {
          setIsCreating(true);
          setSelectedEntry(null);
        }}
      />

      <UrgentOrderDialog
        isOpen={showUrgentDialog}
        onClose={() => setShowUrgentDialog(false)}
        projects={safeProjects}
        currentUser={currentUser}
        currentCompany={currentCompany}
        onCreated={async () => {
          await loadAllData();
          setShowUrgentDialog(false);
        }}
      />

      {showMergeDialog && (
        <MergeWorkOrdersDialog
          groups={groupedWorkOrders.filter(g => selectedRows.includes(`group-${g.title}`))}
          onClose={() => setShowMergeDialog(false)}
          onMerged={async () => {
            setSelectedRows([]);
            await loadAllData();
          }}
        />
      )}
    </div>
  );
}