import React, { useState, useMemo, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import UnifiedToolbar from './UnifiedToolbar';
import WorkOrderPDFDialog from './WorkOrderPDFDialog';
import QuickWorkOrderCreator from './QuickWorkOrderCreator';
import {
  Trash2,
  Loader2,
  RefreshCw,
  ArchiveX,
  FileDown,
  ChevronRight,
  ChevronDown,
  Eye,
  Pencil
} from 'lucide-react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addDays, addWeeks, addMonths, isSameDay, isWithinInterval, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import Avatar from '../Avatar';
import TeamAvatar from '../shared/TeamAvatar';
import InlineInput from '../InlineInput';
import InlineEditWOCell from './InlineEditWOCell';

export default function WorkOrderListView({
        entries = [],
        projects = [],
        users = [],
        teams = [],
        customers = [],
        assets = [],
        categories = [],
        shiftTypes = [],
        projectCategories = [],
        isRefreshing = false,
        onRefresh,
        onEditWorkOrder,
        onBulkDelete,
        onBulkArchive,
        isReadOnly = false,
        selectedEntries,
        onToggleSelection,
        onViewModeChange,
        viewMode = 'list',
        reportsMap,
        parentViewMode = 'week', // ✅ NUEVO: recibir el modo de vista del calendario principal
        parentCurrentDate = new Date(), // ✅ NUEVO: fecha para vista de día
        parentCurrentWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 }), // ✅ NUEVO: inicio de semana
        parentCurrentMonth = new Date() // ✅ NUEVO: mes actual
      }) {
  const [sortBy, setSortBy] = useState('default');
  const [sortOrder, setSortOrder] = useState('asc');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewPeriod, setViewPeriod] = useState(parentViewMode);
  const [currentDate, setCurrentDate] = useState(parentCurrentDate);
  const [currentWeekStart, setCurrentWeekStart] = useState(parentCurrentWeekStart);
  const [currentMonth, setCurrentMonth] = useState(parentCurrentMonth);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [expandedWorkOrders, setExpandedWorkOrders] = useState(new Set());
  const [workingReportsData, setWorkingReportsData] = useState(new Map());
  const [loadingReports, setLoadingReports] = useState(new Set());
  const [pdfViewWorkOrder, setPdfViewWorkOrder] = useState(null);
  
  // ✅ NUEVOS FILTROS POR TABS
  const [filterRecurring, setFilterRecurring] = useState('all'); // 'all', 'recurring', 'standard'
  const [filterProjectCategory, setFilterProjectCategory] = useState('all'); // 'all' or category_id
  const [filterWOCategory, setFilterWOCategory] = useState('all'); // 'all' or category_id
  const [localOverrides, setLocalOverrides] = useState({}); // inline edit overrides

  const handleInlineSaved = (entryId, updateData) => {
    setLocalOverrides(prev => ({ ...prev, [entryId]: { ...(prev[entryId] || {}), ...updateData } }));
  };

  const getEntry = (entry) => localOverrides[entry.id] ? { ...entry, ...localOverrides[entry.id], tasks: localOverrides[entry.id].tasks || entry.tasks } : entry;
  
  // ✅ Sync with parent calendar view mode and dates
  useEffect(() => {
    setViewPeriod(parentViewMode);
  }, [parentViewMode]);
  
  useEffect(() => {
    if (viewPeriod === 'day') setCurrentDate(parentCurrentDate);
  }, [parentCurrentDate, viewPeriod]);
  
  useEffect(() => {
    if (viewPeriod === 'week') setCurrentWeekStart(parentCurrentWeekStart);
  }, [parentCurrentWeekStart, viewPeriod]);
  
  useEffect(() => {
    if (viewPeriod === 'month') setCurrentMonth(parentCurrentMonth);
  }, [parentCurrentMonth, viewPeriod]);

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  const handleSelectAll = () => {
    if (selectedEntries.size === tableEntries.length && tableEntries.length > 0) {
      tableEntries.forEach(entry => {
        if (selectedEntries.has(entry.id)) {
          onToggleSelection(entry.id);
        }
      });
    } else {
      tableEntries.forEach(entry => {
        if (!selectedEntries.has(entry.id)) {
          onToggleSelection(entry.id);
        }
      });
    }
  };

   const toggleStatus = async (ev, entry) => {
     if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation();
     const next = entry.status === 'open' ? 'closed' : 'open';
     await base44.entities.TimeEntry.update(entry.id, { status: next });
     if (typeof onRefresh === 'function') onRefresh();
   };

   const toggleWorkOrderExpansion = async (ev, workOrderId) => {
     if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation();
     
     const newExpanded = new Set(expandedWorkOrders);
     if (newExpanded.has(workOrderId)) {
       newExpanded.delete(workOrderId);
     } else {
       newExpanded.add(workOrderId);
       
       // Load working reports for this work order if not already loaded
       if (!workingReportsData.has(workOrderId) && !loadingReports.has(workOrderId)) {
         setLoadingReports(prev => new Set(prev).add(workOrderId));
         try {
           const reports = await base44.entities.WorkingReport.filter({ time_entry_id: workOrderId });
           const reportsArray = Array.isArray(reports) ? reports : [];
           setWorkingReportsData(prev => new Map(prev).set(workOrderId, reportsArray));
         } catch (error) {
           console.error('Error loading working reports:', error);
           setWorkingReportsData(prev => new Map(prev).set(workOrderId, []));
         } finally {
           setLoadingReports(prev => {
             const next = new Set(prev);
             next.delete(workOrderId);
             return next;
           });
         }
       }
     }
     setExpandedWorkOrders(newExpanded);
   };

   const handleViewPDF = async (ev, workOrder) => {
     if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation();
     setPdfViewWorkOrder(workOrder);
   };

   const handleNavigate = (direction) => {
    if (viewPeriod === 'day') {
      if (direction === 0) {
        setCurrentDate(new Date());
      } else {
        setCurrentDate(prev => addDays(prev, direction));
      }
    } else if (viewPeriod === 'week') {
      if (direction === 0) {
        setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
      } else {
        setCurrentWeekStart(prev => addWeeks(prev, direction));
      }
    } else if (viewPeriod === 'month') {
      if (direction === 0) {
        setCurrentMonth(new Date());
      } else {
        setCurrentMonth(prev => addMonths(prev, direction));
      }
    }
  };

  const getPeriodLabel = () => {
    if (viewPeriod === 'day') {
      return format(currentDate, 'MMMM d, yyyy - EEEE');
    } else if (viewPeriod === 'week') {
      const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });
      return `${format(currentWeekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;
    } else if (viewPeriod === 'month') {
      return format(currentMonth, 'MMMM yyyy');
    }
    return 'All Work Orders';
  };

  const filteredByPeriod = useMemo(() => {
    // Custom date range filter
    if (dateFrom || dateTo) {
      return entries.filter(entry => {
        if (!entry.planned_start_time) return false;
        try {
          const entryDate = entry.planned_start_time
            ? parseISO(entry.planned_start_time)
            : entry.start_time
            ? parseISO(entry.start_time)
            : entry.task_start_date
            ? parseISO(entry.task_start_date + 'T00:00:00')
            : null;
          const fromDate = dateFrom ? new Date(dateFrom) : null;
          const toDate = dateTo ? new Date(dateTo + 'T23:59:59') : null;
          
          if (fromDate && entryDate < fromDate) return false;
          if (toDate && entryDate > toDate) return false;
          return true;
        } catch (error) {
          return false;
        }
      });
    }

    if (viewPeriod === 'all') return entries;

    // ✅ CRITICAL: Match calendar exactly - ONLY filter by task.date, ignore WO planned times
    return entries.filter(entry => {
      // ✅ Work orders WITHOUT tasks are NOT shown in planner
      if (!entry.tasks || entry.tasks.length === 0) {
        return false;
      }
      
      // ✅ Check if WO has ANY task with date in period
      const hasTaskInPeriod = entry.tasks.some(task => {
        if (!task.date) return false;
        try {
          const taskDate = parseISO(task.date + 'T00:00:00');

          if (viewPeriod === 'day') {
            return isSameDay(taskDate, currentDate);
          } else if (viewPeriod === 'week') {
            const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });
            return isWithinInterval(taskDate, { start: currentWeekStart, end: weekEnd });
          } else if (viewPeriod === 'month') {
            const monthStart = startOfMonth(currentMonth);
            const monthEnd = endOfMonth(currentMonth);
            return isWithinInterval(taskDate, { start: monthStart, end: monthEnd });
          }
          return true;
        } catch (error) {
          return false;
        }
      });
      
      return hasTaskInPeriod;
    });
  }, [entries, viewPeriod, currentDate, currentWeekStart, currentMonth, dateFrom, dateTo]);

  // ✅ APLICAR TODOS LOS FILTROS
  const filteredByAdvancedFilters = useMemo(() => {
    let filtered = [...filteredByPeriod];
    
    // 1️⃣ Filtro de recurrencia
    if (filterRecurring === 'recurring') {
      filtered = filtered.filter(entry => {
        if (entry.is_repeating === true) return true;
        
        if (entry.activity_log && Array.isArray(entry.activity_log)) {
          const hasRecurringCreation = entry.activity_log.some(log => {
            return log.action === 'Created' && 
                   log.details && 
                   (log.details.includes('repeating from') ||
                    log.details.includes('(repeating)'));
          });
          if (hasRecurringCreation) return true;
        }
        return false;
      });
    } else if (filterRecurring === 'standard') {
      filtered = filtered.filter(entry => {
        if (entry.is_repeating === true) return false;
        
        if (entry.activity_log && Array.isArray(entry.activity_log)) {
          const hasRecurringCreation = entry.activity_log.some(log => {
            return log.action === 'Created' && 
                   log.details && 
                   (log.details.includes('repeating from') ||
                    log.details.includes('(repeating)'));
          });
          if (hasRecurringCreation) return false;
        }
        return true;
      });
    }
    
    // 2️⃣ Filtro de categoría de proyecto
    if (filterProjectCategory !== 'all') {
      filtered = filtered.filter(entry => {
        const project = projects.find(p => p.id === entry.project_id);
        if (!project || !project.category_ids || !Array.isArray(project.category_ids)) {
          return false;
        }
        return project.category_ids.includes(filterProjectCategory);
      });
    }
    
    // 3️⃣ Filtro de categoría de WO
    if (filterWOCategory !== 'all') {
      filtered = filtered.filter(entry => entry.work_order_category_id === filterWOCategory);
    }
    
    return filtered;
  }, [filteredByPeriod, filterRecurring, filterProjectCategory, filterWOCategory, projects]);

  // ✅ NO AGRUPAR - Cada task es una entrada independiente en la tabla
  const entriesWithSequence = useMemo(() => {
    const expandedEntries = [];
    
    filteredByAdvancedFilters.forEach(entry => {
      if (entry.tasks && entry.tasks.length > 0) {
        // ✅ Crear entrada por cada task (incluso sin fecha si viewPeriod='all')
        entry.tasks.forEach(task => {
          if (task.date || viewPeriod === 'all') {
            expandedEntries.push({
              ...entry,
              _taskId: task.id,
              _taskDate: task.date,
              _taskName: task.name,
              _taskInstructions: task.instructions,
              _taskStartTime: task.start_time,
              _taskEndTime: task.end_time,
              _taskStatus: task.status,
              planned_start_time: task.date 
                ? task.date + 'T' + (task.start_time || '00:00:00')
                : entry.planned_start_time
            });
          }
        });
      } else {
        expandedEntries.push(entry);
      }
    });

    // ✅ ORDENAR: Por fecha (descendente = más reciente arriba), team, y hora
    expandedEntries.sort((a, b) => {
      const dateA = a._taskDate || (a.planned_start_time ? a.planned_start_time.split('T')[0] : '0000-01-01');
      const dateB = b._taskDate || (b.planned_start_time ? b.planned_start_time.split('T')[0] : '0000-01-01');
      if (dateA !== dateB) return dateB.localeCompare(dateA); // descending

      const getTeamName = (entry) => {
        const teamId = entry.team_id || (entry.team_ids?.[0]);
        const team = teamId ? teams.find(t => t.id === teamId) : null;
        return team?.name || 'ZZZ_Unassigned';
      };
      
      const teamComparison = getTeamName(a).localeCompare(getTeamName(b));
      if (teamComparison !== 0) return teamComparison;

      const timeA = a.planned_start_time ? parseISO(a.planned_start_time).getTime() : 0;
      const timeB = b.planned_start_time ? parseISO(b.planned_start_time).getTime() : 0;
      return timeA - timeB;
    });

    // ✅ Calcular números secuenciales por día + team
    const ordersByDayTeam = {};
    expandedEntries.forEach(entry => {
      const entryDate = entry._taskDate || (entry.planned_start_time ? entry.planned_start_time.split('T')[0] : 'no-date');
      const teamId = entry.team_id || (entry.team_ids?.[0]);
      const team = teamId ? teams.find(t => t.id === teamId) : null;
      const teamName = team?.name || 'Unassigned';
      const key = `${entryDate}_${teamName}`;
      
      if (!ordersByDayTeam[key]) ordersByDayTeam[key] = [];
      ordersByDayTeam[key].push(entry);
    });

    Object.keys(ordersByDayTeam).forEach(key => {
      const groupOrders = ordersByDayTeam[key];
      groupOrders.forEach((entry, index) => {
        entry._displayNumber = `N${index + 1} of ${groupOrders.length}`;
        entry._originalNumber = entry.work_order_number;
      });
    });

    return expandedEntries;
  }, [filteredByAdvancedFilters, teams]);

  const filteredAndSortedEntries = useMemo(() => {
    let currentEntries = [...entriesWithSequence];

    // Filtrar por búsqueda
    if (searchQuery) {
      const query = searchQuery.toLowerCase().trim();
      currentEntries = currentEntries.filter(entry => {
        const woNumber = (formatWONumber(entry.work_order_number, entry.planned_start_time || entry.created_date) || '').toLowerCase();
        const title = (entry.title || '').toLowerCase();
        const workNotes = (entry.work_notes || '').toLowerCase();
        const status = (entry.status || '').toLowerCase();
        
        const project = projects.find(p => p.id === entry.project_id);
        const projectName = (project?.name || '').toLowerCase();
        
        const customer = project?.customer_id ? customers.find(c => c.id === project.customer_id) : null;
        const customerName = (customer?.name || '').toLowerCase();
        
        const searchText = [woNumber, title, workNotes, status, projectName, customerName].join(' ');
        return searchText.includes(query);
      });
    }

    // Aplicar ordenamiento solo si NO es 'default'
    if (sortBy !== 'default') {
      currentEntries.sort((a, b) => {
        let aVal, bVal;
        switch (sortBy) {
          case 'work_order_number': {
            const parseSerial = (str) => {
              const m = String(str || '').match(/^(\d{3,4})\/(\d{2})$/);
              if (!m) return -1;
              // Format: year * 10000 + number (e.g., 0103/26 → 260103)
              const year = parseInt(m[2], 10);
              const num = parseInt(m[1], 10);
              return year * 10000 + num;
            };
            const fa = formatWONumber(a.work_order_number, a.planned_start_time || a.created_date);
            const fb = formatWONumber(b.work_order_number, b.planned_start_time || b.created_date);
            aVal = parseSerial(fa);
            bVal = parseSerial(fb);
            return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
          }
          case 'project':
            const projectA = projects.find(p => p.id === a.project_id);
            const projectB = projects.find(p => p.id === b.project_id);
            aVal = projectA?.name?.toLowerCase() || '';
            bVal = projectB?.name?.toLowerCase() || '';
            break;
          case 'customer':
            const projA = projects.find(p => p.id === a.project_id);
            const projB = projects.find(p => p.id === b.project_id);
            const custA = projA?.customer_id ? customers.find(c => c.id === projA.customer_id) : null;
            const custB = projB?.customer_id ? customers.find(c => c.id === projB.customer_id) : null;
            aVal = custA?.name?.toLowerCase() || '';
            bVal = custB?.name?.toLowerCase() || '';
            break;
          case 'team':
            const teamIdA = a.team_id || (a.team_ids && a.team_ids.length > 0 ? a.team_ids[0] : null);
            const teamIdB = b.team_id || (b.team_ids && b.team_ids.length > 0 ? b.team_ids[0] : null);
            const teamA = teamIdA ? teams.find(t => t.id === teamIdA) : null;
            const teamB = teamIdB ? teams.find(t => t.id === teamIdB) : null;
            aVal = teamA?.name?.toLowerCase() || '';
            bVal = teamB?.name?.toLowerCase() || '';
            break;
          case 'user':
            const userIdA = a.employee_ids && a.employee_ids.length > 0 ? a.employee_ids[0] : null;
            const userIdB = b.employee_ids && b.employee_ids.length > 0 ? b.employee_ids[0] : null;
            const userA = userIdA ? users.find(u => u.id === userIdA) : null;
            const userB = userIdB ? users.find(u => u.id === userIdB) : null;
            const userNameA = userA ? (userA.nickname || `${userA.first_name || ''} ${userA.last_name || ''}`.trim()) : '';
            const userNameB = userB ? (userB.nickname || `${userB.first_name || ''} ${userB.last_name || ''}`.trim()) : '';
            aVal = userNameA.toLowerCase();
            bVal = userNameB.toLowerCase();
            break;
          case 'planned_start':
            aVal = a.planned_start_time ? parseISO(a.planned_start_time).getTime() : 0;
            bVal = b.planned_start_time ? parseISO(b.planned_start_time).getTime() : 0;
            return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
          case 'status':
            aVal = a.status || '';
            bVal = b.status || '';
            break;
          case 'wrn': {
            const wrnA = reportsMap?.get(a.id) || '';
            const wrnB = reportsMap?.get(b.id) || '';
            aVal = wrnA;
            bVal = wrnB;
            break;
          }
          case 'scheduled': {
            const taskDateA = a.tasks?.[0]?.date || a.planned_start_time || '';
            const taskDateB = b.tasks?.[0]?.date || b.planned_start_time || '';
            aVal = taskDateA;
            bVal = taskDateB;
            break;
          }
          case 'task': {
            const taskNameA = (a.tasks?.[0]?.name || a.title || '').toLowerCase();
            const taskNameB = (b.tasks?.[0]?.name || b.title || '').toLowerCase();
            aVal = taskNameA;
            bVal = taskNameB;
            break;
          }
          case 'equipment': {
            const equipCountA = a.equipment_ids?.length || 0;
            const equipCountB = b.equipment_ids?.length || 0;
            aVal = equipCountA;
            bVal = equipCountB;
            return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
          }
          case 'files': {
            const filesA = a.file_urls?.length || 0;
            const filesB = b.file_urls?.length || 0;
            aVal = filesA;
            bVal = filesB;
            return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
          }
          default:
            return 0;
        }

        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        }
        return 0;
      });
    }

    return currentEntries;
  }, [entriesWithSequence, sortBy, sortOrder, projects, searchQuery, customers, teams, users]);

  const handleExport = async (formatType) => {
    if (filteredAndSortedEntries.length === 0) {
      toast.error('No work orders to export');
      return;
    }

    if (formatType === 'pdf') {
      setIsExportingPDF(true);
      try {
        let startDate, endDate;
        let workOrderIds = null;

        // Si hay work orders seleccionados, exportar solo esos
        if (selectedEntries && selectedEntries.size > 0) {
          workOrderIds = Array.from(selectedEntries);
          toast.info(`Generating PDF with ${workOrderIds.length} selected work orders...`);
        } else {
          // Si no hay selección, exportar por período
          if (viewPeriod === 'day') {
            startDate = format(currentDate, 'yyyy-MM-dd');
            endDate = format(currentDate, 'yyyy-MM-dd');
          } else if (viewPeriod === 'week') {
            startDate = format(currentWeekStart, 'yyyy-MM-dd');
            endDate = format(endOfWeek(currentWeekStart, { weekStartsOn: 1 }), 'yyyy-MM-dd');
          } else if (viewPeriod === 'month') {
            startDate = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
            endDate = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
          } else if (viewPeriod === 'all') {
            startDate = undefined; 
            endDate = undefined;
          } else {
            toast.error('Select a valid period first');
            setIsExportingPDF(false);
            return;
          }
        }

        // Construir la URL con los IDs de work orders
        const params = new URLSearchParams();
        if (workOrderIds && workOrderIds.length > 0) {
          params.set('workOrderIds', workOrderIds.join(','));
        } else if (startDate && endDate) {
          params.set('startDate', startDate);
          params.set('endDate', endDate);
        }
        
        // Abrir en nueva ventana
        const url = '/WorkOrdersMultiplePDFView?' + params.toString();
        window.open(url, '_blank');
        
        toast.success('Opening PDF viewer...');
        setIsExportingPDF(false);
      } catch (error) {
        console.error('Export error:', error);
        toast.error('Failed to export PDF');
        setIsExportingPDF(false);
      }
    } else if (formatType === 'excel') {
      setIsExportingExcel(true);
      try {
        toast.info('Excel export coming soon');
      } catch (error) {
        console.error('Export Excel error:', error);
        toast.error('Failed to export Excel');
      } finally {
        setIsExportingExcel(false);
      }
    }
  };

  const SortButton = ({ column, children }) => (
    <button
      onClick={() => handleSort(column)}
      className="flex items-center gap-1 hover:text-indigo-600 transition-colors cursor-pointer font-semibold"
    >
      {children}
      {sortBy === column && (
        <span className="text-xs">
          {sortOrder === 'asc' ? '↑' : '↓'}
        </span>
      )}
    </button>
  );

  const formatWONumber = (val, refISO) => {
  if (!val) return '';
  const s = String(val).trim();
  if (/^\d{3,4}\/\d{2}$/.test(s)) return s;
  let m = s.match(/^WO-(\d{4})-(\d{1,4})$/i) || s.match(/^WR-(\d{4})-(\d{1,4})$/i);
  if (m) return `${String(m[2]).padStart(4,'0')}/${String(m[1]).slice(-2)}`;
  m = s.match(/^(\d{1,4})$/);
  if (m) {
    const yy = (() => { try { return new Date(refISO || new Date()).getFullYear().toString().slice(-2); } catch { return new Date().getFullYear().toString().slice(-2); } })();
    return `${String(m[1]).padStart(4,'0')}/${yy}`;
  }
  return '';
};
const tableEntries = filteredAndSortedEntries;

// Auto-fix disabled to improve performance; use the renumber button when needed.

  return (
    <div className="space-y-3">
      <style>{`
        body { overflow-x: auto !important; }
      `}</style>
      
      <UnifiedToolbar
        viewMode={viewMode}
        onViewModeChange={onViewModeChange}
        currentDateLabel={getPeriodLabel()}
        onNavigatePrev={() => handleNavigate(-1)}
        onNavigateNext={() => handleNavigate(1)}
        onNavigateToday={() => handleNavigate(0)}
        todayLabel="Today"
        isMultiSelectMode={selectedEntries.size > 0}
        onToggleMultiSelect={() => {
          if (selectedEntries.size > 0) {
            tableEntries.forEach(entry => {
              if (selectedEntries.has(entry.id)) {
                onToggleSelection(entry.id);
              }
            });
          }
        }}
        viewPeriod={viewPeriod}
        onViewPeriodChange={setViewPeriod}
      />

      {/* Quick Work Order Creator */}
      <QuickWorkOrderCreator
        projects={projects}
        teams={teams}
        users={users}
        categories={categories}
        shiftTypes={shiftTypes}
        assets={assets}
        customers={customers}
        allEntries={entries}
        onCreated={() => {
          if (typeof onRefresh === 'function') {
            onRefresh();
          }
        }}
      />

      {/* Actions bar */}
      <div className="flex items-center justify-between bg-indigo-50 p-3 rounded-lg border border-indigo-200">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-indigo-900">
            {(() => {
              // ✅ Count unique work orders by work_order_number (not by id)
              const uniqueWorkOrders = new Set(
                filteredByAdvancedFilters.map(e => e.work_order_number).filter(Boolean)
              ).size;
              const totalTasks = tableEntries.length;
              const completedTasks = tableEntries.filter(e => e._taskStatus === 'completed').length;
              const pendingTasks = tableEntries.filter(e => e._taskStatus === 'pending' || !e._taskStatus).length;
              return `Total of ${uniqueWorkOrders} Unique Work Orders containing ${totalTasks} Tasks - ${completedTasks} completed / ${pendingTasks} pending`;
            })()}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport('pdf')}
            disabled={isExportingPDF}
            className="h-9 text-sm gap-1.5"
          >
            {isExportingPDF ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileDown className="w-4 h-4" />
            )}
            PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport('excel')}
            disabled={isExportingExcel}
            className="h-9 text-sm gap-1.5"
          >
            {isExportingExcel ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileDown className="w-4 h-4" />
            )}
            Excel
          </Button>

          {selectedEntries.size > 0 && !isReadOnly && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (onBulkArchive && typeof onBulkArchive === 'function') {
                    onBulkArchive();
                  }
                }}
                className="h-9 text-sm gap-1.5"
              >
                <ArchiveX className="w-4 h-4" />
                Close
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (onBulkDelete && typeof onBulkDelete === 'function') {
                    onBulkDelete();
                  }
                }}
                className="h-9 text-sm gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </Button>
            </>
          )}

          <Button variant="ghost" size="icon" onClick={onRefresh} disabled={isRefreshing} className="h-9 w-9">
            {isRefreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-slate-200 relative overflow-x-auto">
        <table className="w-full min-w-[1300px] table-fixed">
            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-20 shadow-sm">
              <tr>
                <th className="w-8 p-2 bg-slate-50">
                  <Checkbox
                    checked={selectedEntries.size === tableEntries.length && tableEntries.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                </th>
                <th className="text-left p-2 text-xs font-semibold text-slate-700 w-24 bg-slate-50">
                  <SortButton column="work_order_number">
                    <span className="flex items-center gap-1.5">
                      WO #
                      <span className="flex flex-col leading-none text-[10px] text-slate-400">
                        <span>▲</span>
                        <span>▼</span>
                      </span>
                    </span>
                  </SortButton>
                </th>
                <th className="text-left p-2 text-xs font-semibold text-slate-700 w-16 bg-slate-50">
                  <SortButton column="planned_start">Time</SortButton>
                </th>
                <th className="text-left p-2 text-xs font-semibold text-slate-700 w-20 bg-slate-50">
                  <SortButton column="scheduled">Scheduled</SortButton>
                </th>
                <th className="text-left p-2 text-xs font-semibold text-slate-700 w-[18%] bg-slate-50">
                  <SortButton column="task">Task</SortButton>
                </th>
                <th className="text-left p-2 text-xs font-semibold text-slate-700 w-[16%] bg-slate-50">
                  <SortButton column="project">Project / Client / Contact</SortButton>
                </th>
                <th className="text-left p-2 text-xs font-semibold text-slate-700 w-[14%] bg-slate-50">
                  <SortButton column="equipment">Equipment</SortButton>
                </th>
                <th className="text-left p-2 text-xs font-semibold text-slate-700 w-[10%] bg-slate-50">
                  <SortButton column="team">Team</SortButton>
                </th>
                <th className="text-left p-2 text-xs font-semibold text-slate-700 w-[10%] bg-slate-50">
                  <SortButton column="user">Assigned</SortButton>
                </th>
                <th className="text-left p-2 text-xs font-semibold text-slate-700 w-24 bg-slate-50">
                  <SortButton column="status">Task Status</SortButton>
                </th>
                <th className="text-left p-2 text-xs font-semibold text-slate-700 w-12 bg-slate-50">
                  <SortButton column="files">Files</SortButton>
                </th>
                <th className="text-center p-2 text-xs font-semibold text-slate-700 w-16 bg-slate-50">
                  PDF
                </th>
                <th className="text-center p-2 text-xs font-semibold text-slate-700 w-16 bg-slate-50">
                  Signed
                </th>
              </tr>
            </thead>
            <tbody>
              {tableEntries.length === 0 ? (
                <tr>
                  <td colSpan={13} className="text-center py-8 text-slate-500 text-sm">
                    {searchQuery ? 'No work orders found matching your search' : 'No work orders found for this period'}
                  </td>
                </tr>
              ) : (
                tableEntries.map((entry, index) => {
                  const project = projects.find(p => p.id === entry.project_id);
                  const customer = project?.customer_id ? customers.find(c => c.id === project.customer_id) : null;
                  
                  // ✅ Get task date from expanded entry
                  const taskDate = entry._taskDate 
                    ? format(parseISO(entry._taskDate + 'T00:00:00'), 'dd/MM/yy') 
                    : entry.planned_start_time 
                      ? format(parseISO(entry.planned_start_time), 'dd/MM/yy') 
                      : '-';
                  
                  // ✅ Check if this is a new day compared to previous entry
                  const prevEntry = index > 0 ? tableEntries[index - 1] : null;
                  const prevTaskDate = prevEntry?._taskDate || (prevEntry?.planned_start_time ? prevEntry.planned_start_time.split('T')[0] : null);
                  const currentTaskDate = entry._taskDate || (entry.planned_start_time ? entry.planned_start_time.split('T')[0] : null);
                  const isNewDay = prevTaskDate !== currentTaskDate;
                  
                  // ✅ Determine background color by grouping days
                  const dayGroups = {};
                  let groupIndex = 0;
                  tableEntries.forEach((e, i) => {
                    const eDate = e._taskDate || (e.planned_start_time ? e.planned_start_time.split('T')[0] : 'no-date');
                    if (!dayGroups[eDate]) {
                      dayGroups[eDate] = groupIndex++;
                    }
                  });
                  const currentDayGroup = dayGroups[currentTaskDate || 'no-date'];
                  const bgColor = currentDayGroup % 2 === 0 ? 'bg-white' : 'bg-slate-50/70';
                  
                  // ✅ Extract team_ids from tasks (source of truth)
                  const teamIdsFromTasks = new Set();
                  if (entry.tasks && entry.tasks.length > 0) {
                    entry.tasks.forEach(task => {
                      (task.team_ids || []).forEach(tid => teamIdsFromTasks.add(tid));
                    });
                  }
                  
                  // Fallback to WO-level team_ids if no tasks
                  const teamIdsToShow = teamIdsFromTasks.size > 0 
                    ? Array.from(teamIdsFromTasks) 
                    : (entry.team_ids || []);
                  
                  const assignedTeams = teams
                    .filter(t => teamIdsToShow.includes(t.id))
                    .sort((a, b) => (a.sort_order ?? 9999) - (b.sort_order ?? 9999));
                  
                  // ✅ Combine employee_ids from both WO-level and tasks
                  const employeeIdsToShow = new Set();
                  (entry.employee_ids || []).forEach(uid => employeeIdsToShow.add(uid));
                  if (entry.tasks && entry.tasks.length > 0) {
                    entry.tasks.forEach(task => {
                      (task.employee_ids || []).forEach(uid => employeeIdsToShow.add(uid));
                    });
                  }
                  
                  const assignedUsers = users.filter(u => employeeIdsToShow.has(u.id));

                  const startTime = entry.planned_start_time ? format(parseISO(entry.planned_start_time), 'HH:mm') : '';
                  const dateStr = entry.planned_start_time ? format(parseISO(entry.planned_start_time), 'dd/MM') : '';

                  const isSelected = selectedEntries instanceof Set && selectedEntries.has(entry.id);
                                  const fileUrls = entry.file_urls || [];
                                  const hasFiles = fileUrls.length > 0;
                                  const isExpanded = expandedWorkOrders.has(entry.id);
                                  const workingReports = workingReportsData.get(entry.id) || [];
                                  const isLoadingReports = loadingReports.has(entry.id);
                                  const hasTasks = entry.tasks && entry.tasks.length > 0;
                                  const hasReports = workingReports.length > 0;

                                  if (isSelected) {
                                    console.log(`🔵 [SELECTION] WO ${entry.work_order_number} - selected=${isSelected}, selectedSize=${selectedEntries.size}`);
                                  }

                                  return (
                                  <tbody key={`${entry.id}_${entry._taskId || index}`} className="contents">
                                  {/* Main Work Order Row */}
                                  <tr
                                  className={cn(
                                  "cursor-pointer transition-colors",
                                  bgColor,
                                  "hover:brightness-95",
                                  isNewDay ? "border-t-4 border-t-indigo-300" : "border-t border-t-slate-100",
                                  "border-b border-b-slate-200"
                                  )}
                                  onClick={() => onEditWorkOrder(entry)}
                                  >
                        <td className="px-2 py-1" onClick={(e) => e.stopPropagation()}>
                         <Checkbox
                           checked={isSelected}
                           onCheckedChange={(checked) => {
                             onToggleSelection(entry.id);
                           }}
                         />
                        </td>
                        <td className="px-2 py-1">
                         <div className="space-y-0.5">
                           <span className={cn("font-mono text-xs font-medium block", entry.archived ? "text-slate-500 line-through" : "text-slate-900")}>
                             {formatWONumber(entry.work_order_number, entry.planned_start_time || entry.created_date) || ''}
                           </span>
                           <span className="text-[10px] text-slate-500 block">
                             {entry._displayNumber || '-'}
                           </span>
                         </div>
                        </td>
                        <td className="px-2 py-1 text-xs text-slate-600">
                         <div className="text-[9px] text-slate-400 uppercase tracking-wide">Time In</div>
                         <div className="font-semibold text-xs text-indigo-700">{startTime}</div>
                         <div className="text-[9px] text-slate-400 uppercase tracking-wide">Time Out</div>
                         <div className="font-semibold text-xs text-slate-600">
                           {entry.planned_end_time ? format(parseISO(entry.planned_end_time), 'HH:mm') : '-'}
                         </div>
                        </td>
                        <td className="px-2 py-1 text-xs text-slate-600" onClick={(e) => e.stopPropagation()}>
                         <div className="text-[9px] text-slate-500 uppercase tracking-wide">
                           {entry._taskDate ? format(parseISO(entry._taskDate + 'T00:00:00'), 'EEEE') : '-'}
                         </div>
                         <div className="font-medium text-xs text-slate-700">{taskDate}</div>
                        </td>
                        <td className="px-2 py-1" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
                         <div className="space-y-0.5">
                           <div className="font-medium text-xs text-slate-900 leading-tight">
                             {entry._taskId ? (
                               <InlineEditWOCell
                                 entry={getEntry(entry)}
                                 field="name"
                                 taskId={entry._taskId}
                                 tasks={getEntry(entry).tasks}
                                 displayValue={entry._taskName || '-'}
                                 onSaved={(u) => handleInlineSaved(entry.id, u)}
                               />
                             ) : (
                               <InlineEditWOCell
                                 entry={getEntry(entry)}
                                 field="title"
                                 displayValue={entry.title || '-'}
                                 onSaved={(u) => handleInlineSaved(entry.id, u)}
                               />
                             )}
                           </div>
                           <div className="text-[10px] text-slate-500 leading-snug">
                             {entry._taskId ? (
                               <InlineEditWOCell
                                 entry={getEntry(entry)}
                                 field="instructions"
                                 taskId={entry._taskId}
                                 tasks={getEntry(entry).tasks}
                                 displayValue={entry._taskInstructions || '-'}
                                 onSaved={(u) => handleInlineSaved(entry.id, u)}
                               />
                             ) : (
                               <InlineEditWOCell
                                 entry={getEntry(entry)}
                                 field="work_notes"
                                 displayValue={entry.work_notes || '-'}
                                 onSaved={(u) => handleInlineSaved(entry.id, u)}
                               />
                             )}
                           </div>
                         </div>
                        </td>
                        <td className="px-2 py-1">
                         <div className="space-y-0.5 text-xs">
                           <div className="font-medium text-slate-900 truncate">
                             {project?.name || '-'}
                           </div>
                           <div className="text-[10px] text-slate-600 truncate">
                             {customer?.name || '-'}
                           </div>
                           {project && (project.contact_persons?.[0] || project.contact_person) && (
                             <div className="text-[10px] text-slate-500 truncate">
                               {project.contact_persons?.[0] || project.contact_person}
                             </div>
                           )}
                         </div>
                        </td>
                        <td className="px-2 py-1">
                          {entry.equipment_ids && entry.equipment_ids.length > 0 ? (
                            <div className="text-xs text-slate-600 space-y-0.5">
                              {entry.equipment_ids.slice(0, 2).map(equipId => {
                                const equip = assets.find(a => a.id === equipId);
                                return equip ? (
                                  <div key={equipId} className="truncate text-[10px]">{equip.name}</div>
                                ) : null;
                              })}
                              {entry.equipment_ids.length > 2 && (
                                <span className="text-[9px] text-slate-400">+{entry.equipment_ids.length - 2}</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-2 py-1">
                          {assignedTeams.length > 0 ? (
                            <div className="flex items-center gap-1">
                              {assignedTeams.slice(0, 1).map(team => (
                                <TeamAvatar key={team.id} team={team} size="sm" />
                              ))}
                              {assignedTeams.length > 1 && (
                                <span className="text-xs text-slate-500">+{assignedTeams.length - 1}</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-2 py-1">
                          {assignedUsers.length > 0 ? (
                            <div className="flex items-center gap-1">
                              {assignedUsers.slice(0, 2).map(user => (
                                <Avatar key={user.id} user={user} size="sm" />
                              ))}
                              {assignedUsers.length > 2 && (
                                <span className="text-xs text-slate-500">+{assignedUsers.length - 2}</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-2 py-1" onClick={(e) => e.stopPropagation()}>
                          {(() => {
                            if (!entry._taskId) return <span className="text-[10px] text-slate-400">-</span>;

                            const currentStatus = entry._taskStatus || 'pending';
                            const isCompleted = currentStatus === 'completed';
                            
                            return (
                              <div className="flex items-center gap-2">
                                <span className={cn(
                                  "text-[10px] font-medium",
                                  !isCompleted ? "text-blue-700" : "text-slate-400"
                                )}>
                                  Pending
                                </span>
                                <Switch
                                  checked={isCompleted}
                                  onCheckedChange={async (checked) => {
                                    const newStatus = checked ? 'completed' : 'pending';
                                    const updatedTasks = entry.tasks.map(t => 
                                      t.id === entry._taskId ? { ...t, status: newStatus } : t
                                    );
                                    
                                    try {
                                      await base44.entities.TimeEntry.update(entry.id, { tasks: updatedTasks });
                                      if (typeof onRefresh === 'function') onRefresh();
                                    } catch (error) {
                                      toast.error('Failed to update status');
                                    }
                                  }}
                                  className="data-[state=checked]:bg-green-600"
                                />
                                <span className={cn(
                                  "text-[10px] font-medium",
                                  isCompleted ? "text-green-700" : "text-slate-400"
                                )}>
                                  Completed
                                </span>
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-2 py-1" onClick={(e) => e.stopPropagation()}>
                          {hasFiles ? (
                            <Badge variant="secondary" className="text-[10px] px-1">
                              {fileUrls.length}
                            </Badge>
                          ) : (
                            <span className="text-[10px] text-slate-300">-</span>
                          )}
                        </td>
                        <td className="px-2 py-1 text-center" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => handleViewPDF(e, entry)}
                            className="h-6 px-2 text-[10px] gap-1 hover:bg-indigo-50"
                          >
                            <Eye className="w-3 h-3" />
                          </Button>
                        </td>
                        <td className="px-2 py-1 text-center" onClick={(e) => e.stopPropagation()}>
                          {entry.client_signature_url ? (
                            <Badge variant="default" className="text-[10px] bg-green-600">
                              ✓
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] text-slate-400">
                              -
                            </Badge>
                          )}
                        </td>
                      </tr>

                      {/* Expanded: Tasks */}
                      {isExpanded && hasTasks && entry.tasks.map((task, taskIdx) => {
                              // Find working reports for this task if there's a clock-in
                              const taskReports = workingReports.filter(report => {
                                // Match reports by checking if they were created around the same time as the task
                                // or if they share the same work order
                                return true; // For now, show all reports under each task
                              });
                              const hasTaskReports = taskReports.length > 0;

                              return (
                                <>
                                  {/* Task Row */}
                                  <tr key={`task-${entry.id}-${taskIdx}`} className={cn(bgColor, "border-b border-slate-100")}>
                                    <td className="p-3 pl-6" colSpan={1}></td>
                                    <td className="p-3 text-xs font-semibold text-slate-900" colSpan={2}>
                                      {task.name || 'Unnamed Task'}
                                    </td>
                                    <td className="p-3 text-xs text-slate-600" colSpan={4}>
                                      {task.instructions || '-'}
                                    </td>
                                    <td className="p-2" colSpan={2} onClick={(e) => e.stopPropagation()}>
                                      <button
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          const newStatus = task.status === 'completed' ? 'pending' : 'completed';
                                          const updatedTasks = entry.tasks.map(t => 
                                            t.id === task.id ? { ...t, status: newStatus } : t
                                          );
                                          await base44.entities.TimeEntry.update(entry.id, { tasks: updatedTasks });
                                          toast.success(`Task status changed to ${newStatus}`);
                                          if (typeof onRefresh === 'function') onRefresh();
                                        }}
                                        className="inline-block"
                                      >
                                        <Badge 
                                          variant={task.status === 'completed' ? 'default' : 'secondary'}
                                          className="text-[10px] cursor-pointer hover:opacity-80"
                                        >
                                          {task.status || 'pending'}
                                        </Badge>
                                      </button>
                                    </td>
                                  </tr>

                                  {/* Working Reports under this task */}
                                  {isLoadingReports ? (
                                    <tr className={cn(bgColor, "border-b border-slate-100 opacity-70")}>
                                      <td className="p-2 pl-16 text-xs text-slate-600" colSpan={10}>
                                        <div className="flex items-center gap-2">
                                          <Loader2 className="w-3 h-3 animate-spin" />
                                          Loading working reports...
                                        </div>
                                      </td>
                                    </tr>
                                  ) : hasTaskReports ? (
                                    taskReports.map((report, reportIdx) => (
                                      <tr key={`report-${entry.id}-${taskIdx}-${reportIdx}`} className={cn(bgColor, "border-b border-slate-100 border-l-4 border-l-green-500")}>
                                        <td className="p-2 pl-16" colSpan={1}>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={(e) => handleViewPDF(e, entry)}
                                            className="h-6 px-2 text-[10px] gap-1"
                                          >
                                            <Eye className="w-3 h-3" />
                                          </Button>
                                        </td>
                                        <td className="p-2">
                                          <div className="space-y-0.5">
                                            <div className="text-[9px] text-green-600 uppercase tracking-wide font-semibold">Clock In/Out</div>
                                            <span className="font-mono text-xs font-semibold text-green-700">
                                              WR: {report.report_number || '-'}
                                            </span>
                                          </div>
                                        </td>
                                        <td className="p-2" colSpan={2}>
                                          <div className="space-y-0.5">
                                            <div className="text-[9px] text-slate-400 uppercase">In</div>
                                            <div className="text-xs font-semibold text-green-700">
                                              {report.start_time ? format(parseISO(report.start_time), 'dd/MM HH:mm') : '-'}
                                            </div>
                                          </div>
                                        </td>
                                        <td className="p-2" colSpan={2}>
                                          <div className="space-y-0.5">
                                            <div className="text-[9px] text-slate-400 uppercase">Out</div>
                                            <div className="text-xs font-semibold text-green-700">
                                              {report.end_time ? format(parseISO(report.end_time), 'dd/MM HH:mm') : '-'}
                                            </div>
                                          </div>
                                        </td>
                                        <td className="p-2" colSpan={2}>
                                          <div className="space-y-0.5">
                                            <div className="text-[9px] text-slate-400 uppercase">Duration</div>
                                            <div className="text-xs font-semibold text-slate-700">
                                              {report.duration_minutes ? `${Math.floor(report.duration_minutes / 60)}h ${report.duration_minutes % 60}m` : '-'}
                                            </div>
                                          </div>
                                        </td>
                                        <td className="p-2" colSpan={3}>
                                          <Badge 
                                            variant={report.status === 'completed' ? 'default' : 'secondary'}
                                            className="text-[10px] bg-green-600"
                                          >
                                            {report.status || 'draft'}
                                          </Badge>
                                        </td>
                                      </tr>
                                    ))
                                    ) : null}
                                    </>
                                    );
                                    })}

                                    {isExpanded && !hasTasks && (
                                    <tr className={cn(bgColor, "border-b border-slate-100 opacity-60")}>
                                    <td className="p-2 pl-12 text-xs text-slate-500 italic" colSpan={10}>
                                    No tasks defined
                                    </td>
                                    </tr>
                                    )}
                                  </tbody>
                                  );})
                                  )}
            </tbody>
          </table>
      </div>

      {/* PDF View Dialog */}
      {pdfViewWorkOrder && (
        <WorkOrderPDFDialog
          workOrder={pdfViewWorkOrder}
          project={projects.find(p => p.id === pdfViewWorkOrder.project_id)}
          customer={customers.find(c => c.id === projects.find(p => p.id === pdfViewWorkOrder.project_id)?.customer_id)}
          branch={null}
          assignedUsers={users.filter(u => (pdfViewWorkOrder.employee_ids || []).includes(u.id))}
          assignedTeams={teams.filter(t => (pdfViewWorkOrder.team_ids || []).includes(t.id))}
          assignedAssets={assets.filter(a => (pdfViewWorkOrder.equipment_ids || []).includes(a.id))}
          woCategory={categories.find(c => c.id === pdfViewWorkOrder.work_order_category_id)}
          shiftType={shiftTypes.find(s => s.id === pdfViewWorkOrder.shift_type_id)}
          onClose={() => setPdfViewWorkOrder(null)}
          onUpdate={() => {}}
        />
      )}
    </div>
  );
}