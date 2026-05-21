import React, { useState, useMemo, useEffect } from 'react';
import { format, parseISO, addDays, isSameDay, isSunday } from 'date-fns';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Plus,
  Copy,
  AlertCircle,
  Search,
  EyeOff,
  MoreVertical,
  Download,
  Loader2,
  Check,
  File
} from 'lucide-react';
import WeekCalendarTaskBadge from './WeekCalendarTaskBadge';
import WeekCalendarUserAvatars from './WeekCalendarUserAvatars';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import Avatar from '../Avatar';
import TeamAvatar from '../shared/TeamAvatar';
import WeekOverlapPanel from './WeekOverlapPanel';
import TeamStickyCell from './TeamStickyCell';
import { base44 } from '@/api/base44Client';
const TimeEntry = base44.entities.TimeEntry;
const PublicHoliday = base44.entities.PublicHoliday;
const LeaveRequest = base44.entities.LeaveRequest;
const User = base44.entities.User;
const TimesheetEntry = base44.entities.TimesheetEntry;

export default function WeekCalendarView({
  currentWeekStart,
  onWeekChange,
  entries = [],
  projects = [],
  categories = [],
  users = [],
  teams = [],
  customers = [],
  shiftTypes = [],
  assets = [],
  clientEquipments = [],
  onEntryClick,
  onCreateWO,
  getCategoryColor,
  onCategoryChange,
  isMultiSelectMode,
  selectedEntries,
  onToggleSelection,
  onDrop,
  draggedWorkOrder,
  onDragStart,
  isReadOnly,
  weekStartsOn = 1,
  onCopyWorkOrders,
  onPasteWorkOrders,
  copiedWorkOrders,
  contextMenuDate,
  viewBy = 'project',
  onViewByChange,
  workOrdersByUser = [],
  workOrdersByTeam = [],
  overlappingUsersMap = new Map(),
  showOverlapPanel = false,
  onToggleOverlapPanel,
  onDataChanged,
  onHideOverlaps,
  onClearHiddenOverlaps,
  allEntries, // ✅ Receive all entries
  onShowFilters,
  onShowTeams,
  onViewModeChange,
  viewMode = 'week',
  selectedDayInWeek,
  onQuickPlan
}) {
  const safeEntries = Array.isArray(entries) ? entries : [];
  const safeAllEntries = Array.isArray(allEntries) ? allEntries : safeEntries;
  const safeProjects = Array.isArray(projects) ? projects : [];
  const safeCategories = Array.isArray(categories) ? categories : [];
  const safeUsers = Array.isArray(users) ? users : [];
  const safeTeams = Array.isArray(teams) ? teams : [];
  const safeCustomers = Array.isArray(customers) ? customers : [];
  const safeShiftTypes = Array.isArray(shiftTypes) ? shiftTypes : [];
  const safeAssets = Array.isArray(assets) ? assets : [];
  const safeClientEquipments = Array.isArray(clientEquipments) ? clientEquipments : [];

  const [selectedOverlapDetails, setSelectedOverlapDetails] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [rowSearchQuery, setRowSearchQuery] = useState('');
  const [draggedMember, setDraggedMember] = useState(null); // { userId, fromTeamId }
  const [memberDropTarget, setMemberDropTarget] = useState(null); // teamId being hovered

  // ✅ IMPORTAR useDebounce dinámicamente
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [debouncedRowSearchQuery, setDebouncedRowSearchQuery] = useState('');

  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedRowSearchQuery(rowSearchQuery), 300);
    return () => clearTimeout(timer);
  }, [rowSearchQuery]);
  const [selectedOverlaps, setSelectedOverlaps] = useState(new Set());
  const [togglingStatusId, setTogglingStatusId] = useState(null);
  const [localStatusMap, setLocalStatusMap] = useState({}); // ✅ Track local status changes
  const [publicHolidays, setPublicHolidays] = useState([]);
  const [approvedLeaves, setApprovedLeaves] = useState([]);
  const [weekTimesheets, setWeekTimesheets] = useState([]);
  // Local assignees map for optimistic updates (entry.id -> string[] userIds)
  const [localAssignedMap, setLocalAssignedMap] = useState(new Map());
  const [togglingAssignee, setTogglingAssignee] = useState(null);
  const [assigneeSearch, setAssigneeSearch] = useState('');
  const [showActivityLog, setShowActivityLog] = useState(null); // WO ID to show activity log
  // ✅ Track local task status changes (entryId -> { taskId -> status })
  const [localTaskStatusMap, setLocalTaskStatusMap] = useState({});

  // Load public holidays and approved leaves
  useEffect(() => {
    PublicHoliday.list().then(setPublicHolidays).catch(console.error);
    LeaveRequest.filter({ status: 'approved' }).then(setApprovedLeaves).catch(console.error);
  }, []);

  // ✅ Subscribe to TimeEntry changes to update task status in real-time
  useEffect(() => {
    const unsubscribe = TimeEntry.subscribe((event) => {
      if (event.type === 'update' && event.data) {
        // Update local task status map when tasks are updated
        const updatedEntry = event.data;
        if (updatedEntry.tasks && updatedEntry.tasks.length > 0) {
          setLocalTaskStatusMap(prev => {
            const next = { ...prev };
            const taskMap = {};
            updatedEntry.tasks.forEach(task => {
              if (task.id) {
                taskMap[task.id] = task.status;
              }
            });
            next[updatedEntry.id] = taskMap;
            return next;
          });
        }
        
        // Trigger data refresh
        if (onDataChanged) {
          onDataChanged();
        }
      }
    });

    return () => unsubscribe();
  }, [onDataChanged]);

  const weekStart = currentWeekStart;
  
  // ✅ Calculate week days based on selectedDayInWeek if provided
  const weekDays = useMemo(() => {
    if (viewMode === '3days' && selectedDayInWeek) {
      // 3 days view: yesterday, today, tomorrow centered on selectedDayInWeek
      return Array.from({ length: 3 }, (_, i) => addDays(selectedDayInWeek, i - 1));
    }
    if (selectedDayInWeek) {
      // Week view: center 7 days around selectedDayInWeek
      return Array.from({ length: 7 }, (_, i) => addDays(selectedDayInWeek, i - 3));
    }
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [weekStart, selectedDayInWeek, viewMode]);

  // Load timesheets for the current week to show per-worker clock-in/out
  useEffect(() => {
    if (!weekDays || weekDays.length === 0) return;
    const startStr = format(weekDays[0], "yyyy-MM-dd'T'00:00:00");
    const endStr = format(addDays(weekDays[weekDays.length - 1], 1), "yyyy-MM-dd'T'00:00:00");
    TimesheetEntry.list('-clock_in_time', 500)
      .then(all => {
        const filtered = all.filter(ts => {
          if (!ts.clock_in_time) return false;
          return ts.clock_in_time >= startStr && ts.clock_in_time < endStr;
        });
        setWeekTimesheets(filtered);
      })
      .catch(console.error);
  }, [weekDays]);

  const filteredEntries = useMemo(() => {
    if (!debouncedSearchQuery.trim()) return safeEntries;
    
    const query = debouncedSearchQuery.toLowerCase();
    return safeEntries.filter(entry => {
      const matchesNumber = entry.work_order_number?.toLowerCase().includes(query);
      const matchesTitle = entry.title?.toLowerCase().includes(query);
      const matchesNotes = entry.work_notes?.toLowerCase().includes(query);
      const project = safeProjects.find(p => p.id === entry.project_id);
      const matchesProject = project?.name?.toLowerCase().includes(query);
      const customer = project?.customer_id ? safeCustomers.find(c => c.id === project.customer_id) : null;
      const matchesCustomer = customer?.name?.toLowerCase().includes(query);
      const entryUserIds = entry.employee_ids || [];
      if (entry.employee_id && !entryUserIds.includes(entry.employee_id)) entryUserIds.push(entry.employee_id);
      
      const assignedUsers = safeUsers.filter(u => entryUserIds.includes(u.id));
      const matchesUser = assignedUsers.some(user => {
        const userName = (user.nickname || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.full_name || user.email || '').toLowerCase();
        return userName.includes(query);
      });

      const entryTeamIds = entry.team_ids || [];
      if (entry.team_id && !entryTeamIds.includes(entry.team_id)) entryTeamIds.push(entry.team_id);

      const assignedTeams = safeTeams.filter(t => entryTeamIds.includes(t.id));
      const matchesTeam = assignedTeams.some(team => {
        return (team.name || '').toLowerCase().includes(query);
      });
      
      return matchesNumber || matchesTitle || matchesNotes || matchesProject || matchesCustomer || matchesUser || matchesTeam;
    });
  }, [safeEntries, debouncedSearchQuery, safeProjects, safeCustomers, safeUsers, safeTeams]);

  const weekEntries = useMemo(() => {
    // Align filtering window with the 7 visible days (sliding week around selectedDayInWeek)
    const start = weekDays[0];
    const end = addDays(weekDays[weekDays.length - 1], 1); // half-open interval

    const entries = filteredEntries.filter(entry => {
      try {
        if (entry.tasks && entry.tasks.length > 0) {
          return entry.tasks.some(task => {
            if (!task.date) return false;
            const taskDate = parseISO(task.date + 'T00:00:00');
            return taskDate >= start && taskDate < end;
          });
        }
        // No tasks: fall back to planned_start_time
        const fallback = entry.planned_start_time || entry.start_time;
        if (!fallback) return false;
        const woDate = parseISO(fallback);
        return woDate >= start && woDate < end;
      } catch (error) {
        console.warn('Error parsing date in weekEntries:', error);
        return false;
      }
    });

    return entries;
  }, [filteredEntries, weekDays]);

  const projectsWithEntries = useMemo(() => {
    const projectMap = new Map();
    
    weekEntries.forEach(entry => {
      const projectId = entry.project_id;
      if (!projectId) return;
      
      if (!projectMap.has(projectId)) {
        const project = safeProjects.find(p => p.id === projectId);
        if (project) {
          projectMap.set(projectId, { ...project, entries: [] });
        }
      }
      
      projectMap.get(projectId)?.entries.push(entry);
    });
    
    // ✅ OPTIMIZADO: Limitar a 30 proyectos visibles (scroll virtual en futuro)
    return Array.from(projectMap.values())
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 30);
  }, [weekEntries, safeProjects]);

  const usersWithEntries = useMemo(() => {
    const userMap = new Map();
    
    safeUsers.forEach(user => {
      if (!user.archived) {
        userMap.set(user.id, { ...user, entries: [] });
      }
    });
    
    weekEntries.forEach(entry => {
      const employeeIds = [...(entry.employee_ids || [])];
      if (entry.employee_id && !employeeIds.includes(entry.employee_id)) {
        employeeIds.push(entry.employee_id);
      }
      // Fallback: if no explicit users, infer from team members
      if (employeeIds.length === 0 && (entry.team_ids?.length || entry.team_id)) {
        const teamIds = new Set([...(entry.team_ids || [])]);
        if (entry.team_id) teamIds.add(entry.team_id);
        safeUsers.forEach(u => { if (u.team_id && teamIds.has(u.team_id)) employeeIds.push(u.id); });
      }
      
      // ✅ If still no users, show in ALL users' rows
      if (employeeIds.length === 0) {
        safeUsers.forEach(u => {
          if (!u.archived && userMap.has(u.id)) {
            userMap.get(u.id).entries.push(entry);
          }
        });
      } else {
        employeeIds.forEach(userId => {
          if (userMap.has(userId)) {
            userMap.get(userId).entries.push(entry);
          }
        });
      }
    });
    
    return Array.from(userMap.values()).sort((a, b) => {
      const aName = a.nickname || a.first_name || a.email;
      const bName = b.nickname || b.first_name || b.email;
      return aName.localeCompare(bName);
    });
  }, [weekEntries, safeUsers, safeTeams]);

  const teamsWithEntries = useMemo(() => {
    const teamMap = new Map();

    // Seed with existing teams
    safeTeams.forEach(team => {
      teamMap.set(team.id, { ...team, entries: [] });
    });

    console.log('🔍 [TEAMS VIEW] Processing weekEntries for teams:', weekEntries.length);

    // Collect entries per team
    weekEntries.forEach(entry => {
      // Use task.team_ids directly (source of truth), fallback to worker's team_id if task.team_ids is empty
      const teamIds = new Set();
      (entry.tasks || []).forEach(task => {
        if (!task.date) return;
        try {
          const taskDate = parseISO(task.date + 'T00:00:00');
          if (weekDays.some(d => isSameDay(taskDate, d))) {
            if (task.team_ids && task.team_ids.length > 0) {
              // Use explicit team_ids on the task (preferred source of truth)
              task.team_ids.forEach(tid => teamIds.add(tid));
            } else {
              // Fallback: derive team from assigned workers' team_id
              const taskEmployeeIds = task.employee_ids || [];
              taskEmployeeIds.forEach(uid => {
                const u = safeUsers.find(u => u.id === uid);
                if (u?.team_id) teamIds.add(u.team_id);
              });
            }
          }
        } catch {}
      });
      // Fallback for WOs without tasks: use WO-level team_ids, then worker teams
      if (teamIds.size === 0 && (!entry.tasks || entry.tasks.length === 0)) {
        (entry.team_ids || []).forEach(tid => teamIds.add(tid));
        if (entry.team_id) teamIds.add(entry.team_id);
        // Also derive from employee_ids if still no teams
        if (teamIds.size === 0) {
          (entry.employee_ids || []).forEach(uid => {
            const u = safeUsers.find(u => u.id === uid);
            if (u?.team_id) teamIds.add(u.team_id);
          });
        }
      }
      // Last resort: derive from WO-level employee_ids ONLY when there are no tasks at all
      // (do NOT fall back to user.team_id when tasks exist but task.team_ids is empty —
      //  that would override explicit task assignments and place WOs in the wrong team row)
      if (teamIds.size === 0 && (!entry.tasks || entry.tasks.length === 0)) {
        (entry.employee_ids || []).forEach(uid => {
          const u = safeUsers.find(u => u.id === uid);
          if (u?.team_id) teamIds.add(u.team_id);
        });
      }
      
      const teamIdsArray = Array.from(teamIds);
      
      console.log(`🔍 [TEAMS VIEW] WO ${entry.id?.slice(0, 8)} - teams found:`, {
        taskTeamIds: entry.tasks?.flatMap(t => t.team_ids || []),
        woLevelTeamIds: entry.team_ids,
        finalTeamIds: teamIdsArray
      });

      if (teamIdsArray.length === 0) {
        // Unassigned bucket
        const UNASSIGNED_ID = '__unassigned__';
        if (!teamMap.has(UNASSIGNED_ID)) {
          teamMap.set(UNASSIGNED_ID, { id: UNASSIGNED_ID, name: 'Unassigned', sort_order: 99999, entries: [] });
        }
        teamMap.get(UNASSIGNED_ID).entries.push(entry);
      } else {
        teamIdsArray.forEach(teamId => {
          if (!teamId) return;
          if (teamMap.has(teamId)) {
            const bucket = teamMap.get(teamId);
            if (!bucket.entries.some(e => e.id === entry.id)) {
              bucket.entries.push(entry);
            }
          }
        });
      }
    });

    // Only show teams that have at least one entry in the current week
    const result = Array.from(teamMap.values()).filter(t => t.entries && t.entries.length > 0)
      .sort((a, b) => {
        // Unassigned always last
        if (a.id === '__unassigned__') return 1;
        if (b.id === '__unassigned__') return -1;
        
        const sortOrderA = a.sort_order ?? 9999;
        const sortOrderB = b.sort_order ?? 9999;
        if (sortOrderA !== sortOrderB) return sortOrderA - sortOrderB;
        return (a.name || '').localeCompare(b.name || '');
      });
    
    console.log('✅ [TEAMS VIEW] Teams with entries:', result.map(t => ({
      id: t.id,
      name: t.name,
      entriesCount: t.entries?.length || 0
    })));
    
    return result;
  }, [weekEntries, safeTeams, safeUsers]);

  const totalEntriesCount = useMemo(() => {
    return filteredEntries.length;
  }, [filteredEntries]);

  // ✅ MEJORADO: Sistema de tracks por CLIENTE (customer_id) para continuidad visual
  const getCustomerTracksForEntity = (entityId) => {
    if (viewBy !== 'team' && viewBy !== 'user') return null;
    
    const allEntriesWithTime = [];
    
    weekDays.forEach((day, dayIndex) => {
      const dayEntries = filteredEntries.filter(entry => {
        // ✅ CRITICAL: Filter by task.date ONLY, not WO-level dates
        if (!entry.tasks || entry.tasks.length === 0) return false;

        const hasTaskOnDay = entry.tasks.some(task => {
          if (!task.date) return false;
          const taskDate = parseISO(task.date + 'T00:00:00');
          return isSameDay(taskDate, day);
        });

        if (!hasTaskOnDay) return false;
        
        if (viewBy === 'team') {
          // Use task.team_ids, fallback to worker's team_id
          const taskTeamIds = new Set();
          (entry.tasks || []).forEach(task => {
            if (!task.date) return;
            try {
              if (isSameDay(parseISO(task.date + 'T00:00:00'), day)) {
                if (task.team_ids && task.team_ids.length > 0) {
                  task.team_ids.forEach(tid => taskTeamIds.add(tid));
                } else {
                  (task.employee_ids || []).forEach(uid => {
                    const u = safeUsers.find(u => u.id === uid);
                    if (u?.team_id) taskTeamIds.add(u.team_id);
                  });
                }
              }
            } catch {}
          });
          if (taskTeamIds.size === 0 && (entry.tasks || []).every(t => !t.team_ids || t.team_ids.length === 0)) {
            (entry.employee_ids || []).forEach(uid => {
              const u = safeUsers.find(u => u.id === uid);
              if (u?.team_id) taskTeamIds.add(u.team_id);
            });
          }
          if (entityId === '__unassigned__') return taskTeamIds.size === 0;
          return taskTeamIds.has(entityId);
        } else if (viewBy === 'user') {
          const uIds = entry.employee_ids || [];
          if (uIds.includes(entityId) || entry.employee_id === entityId) return true;
          // ✅ If no users assigned, show in all user rows
          if (uIds.length === 0 && !entry.employee_id) return true;
          return false;
        }
        return false;
      });
      
      dayEntries.forEach(entry => {
        if (entry.project_id && entry.tasks && entry.tasks.length > 0) {
          // ✅ Use task date/time, not WO planned_start_time
          const taskForDay = entry.tasks.find(t => {
            if (!t.date) return false;
            const taskDate = parseISO(t.date + 'T00:00:00');
            return isSameDay(taskDate, day);
          });
          
          if (taskForDay && taskForDay.start_time) {
            const project = safeProjects.find(p => p.id === entry.project_id);
            const customerId = project?.customer_id;
            
            if (customerId) {
              // Create timestamp from task date + start_time
              const [hours, minutes] = taskForDay.start_time.split(':').map(Number);
              const taskDateTime = parseISO(taskForDay.date + 'T00:00:00');
              taskDateTime.setHours(hours, minutes, 0, 0);
              
              allEntriesWithTime.push({
                customerId: customerId,
                projectId: entry.project_id,
                timestamp: taskDateTime.getTime(),
                woNumber: entry.work_order_number,
                dayIndex
              });
            }
          }
        }
      });
    });
    
    // Ordenar cronológicamente
    allEntriesWithTime.sort((a, b) => a.timestamp - b.timestamp);
    
    const trackMap = {};
    let currentTrack = 0;
    
    // ✅ MEJORADO: Asignar tracks por CLIENTE
    allEntriesWithTime.forEach(entry => {
      if (trackMap[entry.customerId] === undefined) {
        trackMap[entry.customerId] = currentTrack;
        currentTrack++;
      }
    });
    
    return trackMap;
  };

  // ✅ MEJORADO: Obtener entries organizados por secuencia (1/N, 2/N, etc.)
  const getEntriesForDayWithTracks = (day, entityId) => {
    const dayEntries = filteredEntries.filter(entry => {
      // Check if work order has any tasks for this specific day
      if (entry.tasks && entry.tasks.length > 0) {
        const hasTaskOnDay = entry.tasks.some(task => {
          if (!task.date) return false;
          const taskDate = parseISO(task.date + 'T00:00:00');
          return isSameDay(taskDate, day);
        });
        if (hasTaskOnDay) {
          // Now check if entity matches
          if (viewBy === 'project') {
            return entry.project_id === entityId;
          } else if (viewBy === 'user') {
            const uIds = entry.employee_ids || [];
            const direct = uIds.includes(entityId) || entry.employee_id === entityId;
            if (direct) return true;
            // ✅ If no users assigned, show in all user rows
            if (uIds.length === 0 && !entry.employee_id) return true;
            const user = safeUsers.find(u => u.id === entityId);
            if (!user?.team_id) return false;
            const tIds = entry.team_ids || [];
            if (entry.team_id && !tIds.includes(entry.team_id)) tIds.push(entry.team_id);
            return tIds.includes(user.team_id);
          } else if (viewBy === 'team') {
            // Use task.team_ids, fallback to worker's team_id
            const taskTeamIds = new Set();
            (entry.tasks || []).forEach(task => {
              if (!task.date) return;
              try {
                if (isSameDay(parseISO(task.date + 'T00:00:00'), day)) {
                  if (task.team_ids && task.team_ids.length > 0) {
                    task.team_ids.forEach(tid => taskTeamIds.add(tid));
                  } else {
                    (task.employee_ids || []).forEach(uid => {
                      const u = safeUsers.find(u => u.id === uid);
                      if (u?.team_id) taskTeamIds.add(u.team_id);
                    });
                  }
                }
              } catch {}
            });
            // Last resort: use ONLY the specific task's employee_ids for THIS day (not WO-level)
            // This prevents WOs from leaking into team rows based on other tasks' workers
            if (taskTeamIds.size === 0 && (entry.tasks || []).every(t => !t.team_ids || t.team_ids.length === 0)) {
              // Only derive from the task that is on this specific day
              (entry.tasks || []).forEach(task => {
                if (!task.date) return;
                try {
                  if (isSameDay(parseISO(task.date + 'T00:00:00'), day)) {
                    (task.employee_ids || []).forEach(uid => {
                      const u = safeUsers.find(u => u.id === uid);
                      if (u?.team_id) taskTeamIds.add(u.team_id);
                    });
                  }
                } catch {}
              });
            }
            if (entityId === '__unassigned__') return taskTeamIds.size === 0;
            return taskTeamIds.has(entityId);
          }
          return false;
        }
      }
      
      // No tasks matched on this day - for taskless WOs use planned_start_time
      if (!entry.tasks || entry.tasks.length === 0) {
        const fallback = entry.planned_start_time || entry.start_time;
        if (!fallback) return false;
        try {
          if (!isSameDay(parseISO(fallback), day)) return false;
          if (viewBy === 'project') return entry.project_id === entityId;
          if (viewBy === 'team') {
            const tIds = new Set([...(entry.team_ids || [])]);
            if (entry.team_id) tIds.add(entry.team_id);
            return tIds.has(entityId);
          }
          if (viewBy === 'user') {
            const uIds = entry.employee_ids || [];
            return uIds.includes(entityId) || entry.employee_id === entityId;
          }
        } catch { return false; }
      }
      return false;
    });

    // ✅ Deduplicate by entry ID (a WO may match multiple times via different tasks/teams)
    const seen = new Set();
    const uniqueDayEntries = dayEntries.filter(e => {
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    });

    // ✅ Sort by task start time (chronological order)
    return uniqueDayEntries.sort((a, b) => {
      const getTaskTimeForDay = (entry) => {
        if (!entry.tasks) return 0;
        const task = entry.tasks.find(t => {
          if (!t.date) return false;
          const taskDate = parseISO(t.date + 'T00:00:00');
          return isSameDay(taskDate, day);
        });
        if (!task || !task.start_time) return 0;
        const [hours, minutes] = task.start_time.split(':').map(Number);
        return hours * 60 + minutes;
      };
      
      const timeA = getTaskTimeForDay(a);
      const timeB = getTaskTimeForDay(b);
      if (timeA !== timeB) return timeA - timeB;

      const extractNumber = (str) => {
        if (!str) return 0;
        const match = String(str).match(/(\d+)$/);
        return match ? parseInt(match[1], 10) : 0;
      };
      return extractNumber(a.work_order_number) - extractNumber(b.work_order_number);
    });
  };

  const getWorkOrderSequence = (entry, day, entityId) => {
    // Use filteredEntries (same as rendered) to count sequence
    const dayEntries = filteredEntries.filter(e => {
      // Only include entries with tasks scheduled on this day
      if (!e.tasks || e.tasks.length === 0) return false;
      
      const hasTaskOnDay = e.tasks.some(task => {
        if (!task.date) return false;
        const taskDate = parseISO(task.date + 'T00:00:00');
        return isSameDay(taskDate, day);
      });
      
      if (!hasTaskOnDay) return false;
      
      // ✅ Check if entity matches (Project, Team, or User)
      if (viewBy === 'project') {
        return e.project_id === entityId;
      } else if (viewBy === 'user') {
        const uIds = e.employee_ids || [];
        if (e.employee_id && !uIds.includes(e.employee_id)) uIds.push(e.employee_id);
        if (uIds.includes(entityId)) return true;
        // ✅ If no users assigned, show in all user rows
        if (uIds.length === 0 && !e.employee_id) return true;
        const user = safeUsers.find(u => u.id === entityId);
        if (!user?.team_id) return false;
        const tIds = e.team_ids || [];
        if (e.team_id && !tIds.includes(e.team_id)) tIds.push(e.team_id);
        return tIds.includes(user.team_id);
      } else { // team
        // Use task.team_ids, fallback to worker's team_id
        const taskTeamIds = new Set();
        (e.tasks || []).forEach(task => {
          if (!task.date) return;
          try {
            if (isSameDay(parseISO(task.date + 'T00:00:00'), day)) {
              if (task.team_ids && task.team_ids.length > 0) {
                task.team_ids.forEach(tid => taskTeamIds.add(tid));
              } else {
                (task.employee_ids || []).forEach(uid => {
                  const u = safeUsers.find(u => u.id === uid);
                  if (u?.team_id) taskTeamIds.add(u.team_id);
                });
              }
            }
          } catch {}
        });
        if (taskTeamIds.size === 0 && (e.tasks || []).every(t => !t.team_ids || t.team_ids.length === 0)) {
          // Only derive from the task on this specific day, not all WO-level employees
          (e.tasks || []).forEach(task => {
            if (!task.date) return;
            try {
              if (isSameDay(parseISO(task.date + 'T00:00:00'), day)) {
                (task.employee_ids || []).forEach(uid => {
                  const u = safeUsers.find(u => u.id === uid);
                  if (u?.team_id) taskTeamIds.add(u.team_id);
                });
              }
            } catch {}
          });
        }
        if (entityId === '__unassigned__') return taskTeamIds.size === 0;
        return taskTeamIds.has(entityId);
      }
    });
    
    // ✅ ORDENAR POR HORA DE INICIO DE TASK (cronológico)
    const sortedEntries = dayEntries.sort((a, b) => {
      // Get task start time for this specific day
      const getTaskTimeForDay = (entry) => {
        if (!entry.tasks) return 0;
        const task = entry.tasks.find(t => {
          if (!t.date) return false;
          const taskDate = parseISO(t.date + 'T00:00:00');
          return isSameDay(taskDate, day);
        });
        if (!task || !task.start_time) return 0;
        const [hours, minutes] = task.start_time.split(':').map(Number);
        return hours * 60 + minutes; // Convert to minutes for comparison
      };
      
      const timeA = getTaskTimeForDay(a);
      const timeB = getTaskTimeForDay(b);
      
      if (timeA !== timeB) return timeA - timeB;

      // Si tienen la misma hora, ordenar por número de work order
      const extractNumber = (str) => {
                  if (!str) return 0;
                  const match = String(str).match(/(\d+)$/);
                  return match ? parseInt(match[1], 10) : 0;
                };
      
      return extractNumber(a.work_order_number) - extractNumber(b.work_order_number);
    });
    
    // Deduplicate by entry ID
    const seenIds = new Set();
    const dedupedEntries = sortedEntries.filter(e => {
      if (seenIds.has(e.id)) return false;
      seenIds.add(e.id);
      return true;
    });

    const position = dedupedEntries.findIndex(e => e.id === entry.id) + 1;
    const total = dedupedEntries.length;
    
    return { position, total };
  };

  // ✅ MEJORADO: Detectar link verificando que el CLIENTE coincide
  const getCustomerLinkInfo = (entry, currentDayIndex, entityId) => {
    if ((viewBy !== 'team' && viewBy !== 'user') || currentDayIndex >= 6) {
      return null;
    }
    
    const currentDay = weekDays[currentDayIndex];
    const nextDay = weekDays[currentDayIndex + 1];
    const nextDayEntries = getEntriesForDayWithTracks(nextDay, entityId);
    
    // ✅ NUEVO: Obtener el customer_id del entry actual
    const currentProject = safeProjects.find(p => p.id === entry.project_id);
    const currentCustomerId = currentProject?.customer_id;
    
    if (!currentCustomerId) return null;
    
    // ✅ MEJORADO: Buscar entry del MISMO CLIENTE en el día siguiente
    const matchingEntry = nextDayEntries.find(e => {
      const nextProject = safeProjects.find(p => p.id === e.project_id);
      return nextProject?.customer_id === currentCustomerId;
    });
    
    if (!matchingEntry) {
      return null;
    }
    
    const trackMap = getCustomerTracksForEntity(entityId);
    const currentTrack = trackMap[currentCustomerId] ?? 999;
    
    const matchingProject = safeProjects.find(p => p.id === matchingEntry.project_id);
    const matchingCustomerId = matchingProject?.customer_id;
    const nextTrack = matchingCustomerId ? (trackMap[matchingCustomerId] ?? 999) : 999;
    
    if (currentTrack !== nextTrack) {
      return null;
    }
    
    const targetIndex = nextDayEntries.indexOf(matchingEntry);
    
    return {
      hasLink: true,
      targetEntryIndex: targetIndex,
      targetTrack: nextTrack
    };
  };

  // Helper to check if a day is a public holiday
  const isPublicHoliday = (day) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    return publicHolidays.some(h => h.date === dateStr);
  };

  // Helper to get public holiday name
  const getPublicHolidayName = (day) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const holiday = publicHolidays.find(h => h.date === dateStr);
    return holiday?.name || null;
  };

  // Helper to check if user is on leave for a given day
  const isUserOnLeave = (userId, day) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    return approvedLeaves.some(leave => {
      if (leave.employee_id !== userId) return false;
      return dateStr >= leave.start_date && dateStr <= leave.end_date;
    });
  };

  // Get users on leave for a specific day
  const getUsersOnLeaveForDay = (day) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    return approvedLeaves
      .filter(leave => dateStr >= leave.start_date && dateStr <= leave.end_date)
      .map(leave => leave.employee_id);
  };

  const getDayStats = (day) => {
    const dayEntries = filteredEntries.filter(entry => {
      // ✅ CRITICAL: Only show entries with tasks scheduled on this day
      if (!entry.tasks || entry.tasks.length === 0) return false;
      
      const hasTaskOnDay = entry.tasks.some(task => {
        if (!task.date) return false;
        const taskDate = parseISO(task.date + 'T00:00:00');
        return isSameDay(taskDate, day);
      });
      
      return hasTaskOnDay;
    });
    
    // Get users on leave for this specific day
    const usersOnLeaveToday = getUsersOnLeaveForDay(day);
    
    // ✅ Count UNIQUE field workers with ACTIVE reports (is_active=true)
    const fieldWorkersWithActiveReports = new Set();
    dayEntries.forEach(entry => {
      // Only count workers from entries that have is_active = true
      if (!entry.is_active) return;

      const uIds = [...(entry.employee_ids || [])];
      if (entry.employee_id && !uIds.includes(entry.employee_id)) uIds.push(entry.employee_id);

      uIds.forEach(userId => {
        const user = safeUsers.find(u => u.id === userId);
        if (user && !user.archived) {
          const userTeam = safeTeams.find(t => t.id === user.team_id);
          // Only count as field worker if they have a team with worker_type === 'field'
          if (userTeam && userTeam.worker_type === 'field') {
            fieldWorkersWithActiveReports.add(userId);
          }
        }
      });
    });

    let totalHours = 0;
    dayEntries.forEach(entry => {
      if (entry.planned_start_time && entry.planned_end_time) {
        const start = parseISO(entry.planned_start_time);
        const end = parseISO(entry.planned_end_time);
        const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        totalHours += hours;
      }
    });

    // ✅ Calculate total available field workers (excluding those on leave)
    const totalAvailableFieldWorkers = new Set();
    safeUsers.forEach(u => {
      if (!u.archived) {
        const userTeam = safeTeams.find(t => t.id === u.team_id);
        // Only count as field worker if they have a team with worker_type === 'field'
        // Exclude users on leave for this day
        if (userTeam && userTeam.worker_type === 'field' && !usersOnLeaveToday.includes(u.id)) {
          totalAvailableFieldWorkers.add(u.id);
        }
      }
    });
    
    return {
      total: dayEntries.length,
      closed: dayEntries.filter(e => e.status === 'closed').length,
      open: dayEntries.filter(e => e.status === 'open').length,
      fieldWorkersActive: fieldWorkersWithActiveReports.size,
      totalFieldWorkers: totalAvailableFieldWorkers.size,
      totalHours: Math.round(totalHours * 10) / 10,
      estimatedCost: Math.round(totalHours * 25)
    };
  };

  const handleDragStart = (e, entry) => {
    if (isReadOnly) return;
    if (draggedMember) return; // Don't start WO drag if member is being dragged
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('workOrder', JSON.stringify(entry));
    if (onDragStart) {
      onDragStart(entry);
    }
  };

  const handleDragOver = (e) => {
    if (isReadOnly) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, day, entityId) => {
    if (isReadOnly) return;
    e.preventDefault();
    e.stopPropagation();
    
    if (!draggedWorkOrder || !day) {
      console.warn('⚠️ Missing draggedWorkOrder or day in WeekCalendarView handleDrop');
      return;
    }

    if (!(day instanceof Date) || isNaN(day.getTime())) {
      console.error('❌ Invalid day in WeekCalendarView handleDrop:', day);
      return;
    }

    // ✅ FIX: Preserve original time when dropping to a new day
    // Get the original start time hours/minutes from the dragged work order
    let targetDateTime = new Date(day);
    
    if (draggedWorkOrder.planned_start_time) {
      try {
        const originalStart = parseISO(draggedWorkOrder.planned_start_time);
        // Keep original hours and minutes, only change the date
        targetDateTime.setHours(
          originalStart.getHours(),
          originalStart.getMinutes(),
          originalStart.getSeconds(),
          originalStart.getMilliseconds()
        );
      } catch (error) {
        console.warn('⚠️ Could not parse original start time, using midnight');
      }
    }

    if (onDrop) {
      onDrop(draggedWorkOrder, entityId, targetDateTime);
      // ✅ DO NOT call onDataChanged() - let the parent handle updates
    }
  };

  const toggleAssignUser = async (e, entry, userId) => {
    e.preventDefault();
    e.stopPropagation();
    if (isReadOnly) return;
    const key = `${entry.id}:${userId}`;
    setTogglingAssignee(key);
    try {
      const current = localAssignedMap.get(entry.id) ?? ([...(entry.employee_ids || [])].concat(entry.employee_id ? [entry.employee_id] : []));
      const setIds = new Set(current);
      if (setIds.has(userId)) setIds.delete(userId); else setIds.add(userId);
      const newList = Array.from(setIds);
      // Recalculate team_ids: keep only teams that still have at least one user in newList
      const currentTeamIds = new Set([...(entry.team_ids || []), ...(entry.tasks || []).flatMap(t => t.team_ids || [])]);
      const newTeamIds = Array.from(currentTeamIds).filter(teamId =>
        newList.some(uid => safeUsers.find(u => u.id === uid)?.team_id === teamId)
      );
      // Remove team from each task's team_ids if no remaining user belongs to it
      const updatedTasks = (entry.tasks || []).map(task => ({
        ...task,
        team_ids: (task.team_ids || []).filter(teamId =>
          newList.some(uid => safeUsers.find(u => u.id === uid)?.team_id === teamId)
        )
      }));
      setLocalAssignedMap(prev => { const next = new Map(prev); next.set(entry.id, newList); return next; });
      await TimeEntry.update(entry.id, { employee_ids: newList, employee_id: newList.length === 1 ? newList[0] : null, team_ids: newTeamIds, tasks: updatedTasks });
      if (onDataChanged) onDataChanged();
    } catch (err) {
      toast.error('Could not update assignees');
      setLocalAssignedMap(prev => { const next = new Map(prev); next.delete(entry.id); return next; });
    } finally {
      setTogglingAssignee(null);
    }
  };

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
  }, [overlappingUsersMap, weekDays]);

  const handleHideSelectedOverlaps = async () => {
    if (selectedOverlaps.size === 0) {
      toast.error('No overlaps selected');
      return;
    }

    const overlapIds = Array.from(selectedOverlaps);
    await onHideOverlaps(overlapIds);
    setSelectedOverlaps(new Set());
    toast.success(`Hidden ${overlapIds.length} overlap(s)`);
  };

  // ✅ Toggle status between open and closed - link by work_order_number
  const handleToggleStatus = async (e, entry) => {
    e.preventDefault();
    e.stopPropagation();

    if (togglingStatusId) return;

    const newStatus = entry.status === 'closed' ? 'open' : 'closed';
    
    console.log('🟠 [TOGGLE STATUS] Starting:', {
      woId: entry.id?.slice(0, 8),
      woNumber: entry.work_order_number,
      currentStatus: entry.status,
      newStatus
    });

    // Group by work_order_number (link duplicates with same WO number)
    const woNumber = entry.work_order_number;
    const group = (safeAllEntries || []).filter(w => w.work_order_number === woNumber);

    console.log('🟠 [TOGGLE STATUS] WO Number group:', {
      woNumber,
      groupSize: group.length,
      groupWOs: group.map(w => ({ id: w.id?.slice(0, 8), status: w.status }))
    });

    const getTime = (wo) => {
      if (wo?.planned_start_time) return new Date(wo.planned_start_time).getTime();
      if (wo?.start_time) return new Date(wo.start_time).getTime();
      return 0;
    };

    const sorted = [...group].sort((a,b) => getTime(a) - getTime(b));
    const isLatest = sorted.length === 0 || sorted[sorted.length-1]?.id === entry.id;

    console.log('🟠 [TOGGLE STATUS] Sorted group:', {
      isLatest,
      sortedIds: sorted.map(w => w.id?.slice(0, 8))
    });

    // If trying to close an older one while a newer exists, block
    if (newStatus === 'closed' && !isLatest) {
      console.log('⚠️ [TOGGLE STATUS] BLOCKED - not the latest WO');
      toast.warning('No puedes cerrar una orden antigua si existe una más reciente programada');
      return;
    }

    setTogglingStatusId(entry.id);

    try {
      if (newStatus === 'closed') {
        // Close this and all previous in the chain
        const cutoffTime = getTime(entry);
        const toClose = sorted.filter(w => getTime(w) <= cutoffTime && w.status !== 'closed');

        console.log('🟠 [TOGGLE STATUS] Closing WOs:', toClose.map(w => ({ id: w.id?.slice(0, 8), woNumber: w.work_order_number })));

        // Optimistic UI
        setLocalStatusMap(prev => {
          const next = { ...prev };
          toClose.forEach(w => { next[w.id] = 'closed'; });
          return next;
        });

        await Promise.all(toClose.map(w => TimeEntry.update(w.id, { status: 'closed' })));
        console.log('✅ [TOGGLE STATUS] Closed successfully');
      } else {
        // Re-open single entry
        console.log('🟠 [TOGGLE STATUS] Re-opening WO:', entry.id?.slice(0, 8));
        setLocalStatusMap(prev => ({ ...prev, [entry.id]: 'open' }));
        await TimeEntry.update(entry.id, { status: 'open' });
        console.log('✅ [TOGGLE STATUS] Re-opened successfully');
      }
    } catch (error) {
      console.error('❌ [TOGGLE STATUS] Error:', error);
      toast.error('No se pudo actualizar el estado');
      // Revert local map for involved ids
      setLocalStatusMap(prev => {
        const next = { ...prev };
        if (newStatus === 'closed') {
          const cutoffTime = getTime(entry);
          const toClose = sorted.filter(w => getTime(w) <= cutoffTime);
          toClose.forEach(w => delete next[w.id]);
        } else {
          delete next[entry.id];
        }
        return next;
      });
    } finally {
      setTogglingStatusId(null);
    }
  };



  // Build map: workOrderId -> userId -> { clockIn, clockOut }
  const woUserTimeMap = useMemo(() => {
    const map = new Map(); // key: `${woId}::${userId}` -> { clockIn, clockOut }
    weekTimesheets.forEach(ts => {
      if (!ts.work_order_segments || !ts.employee_id) return;
      ts.work_order_segments.forEach(seg => {
        if (!seg.work_order_id) return;
        const key = `${seg.work_order_id}::${ts.employee_id}`;
        const existing = map.get(key);
        const segIn = seg.start_time || ts.clock_in_time;
        const segOut = seg.end_time || ts.clock_out_time;
        // Keep earliest in / latest out across segments
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

  const entities = viewBy === 'project' ? projectsWithEntries :
                  viewBy === 'user' ? usersWithEntries :
                  teamsWithEntries;

  const sortedEntities = useMemo(() => {
    if (!entities || entities.length === 0) return [];
    
    return [...entities].sort((a, b) => {
      if (viewBy === 'project') {
        return (a.name || '').localeCompare(b.name || '');
      } else if (viewBy === 'user') {
        const nameA = a.nickname || a.first_name || a.email || '';
        const nameB = b.nickname || b.first_name || b.email || '';
        return nameA.localeCompare(nameB);
      } else if (viewBy === 'team') {
        const sortOrderA = a.sort_order ?? 9999;
        const sortOrderB = b.sort_order ?? 9999;
        
        if (sortOrderA !== sortOrderB) {
          return sortOrderA - sortOrderB;
        }
        
        return (a.name || '').localeCompare(b.name || '');
      }
      return 0;
    });
  }, [entities, viewBy]);

  const visibleEntities = useMemo(() => {
    if (!debouncedRowSearchQuery) return sortedEntities;
    const lowerQuery = debouncedRowSearchQuery.toLowerCase();
    return sortedEntities.filter(entity => {
      let name = '';
      if (viewBy === 'project') name = entity.name;
      else if (viewBy === 'user') name = entity.nickname || entity.first_name || entity.email;
      else name = entity.name;
      return name?.toLowerCase().includes(lowerQuery);
    });
  }, [sortedEntities, debouncedRowSearchQuery, viewBy]);

  return (
    <div className="flex flex-col space-y-4 overflow-x-auto w-full">

      {/* Search bar */}
      <div className="flex items-center justify-end gap-4">
        <div className="relative w-56 flex-shrink-0">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <Input
            className="h-9 pl-7 text-xs bg-white"
            placeholder="Search work orders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 relative">
         <table className="w-full border-collapse table-fixed">
           <colgroup>
             <col style={{ width: '140px', minWidth: '140px', maxWidth: '140px' }} />
             {weekDays.map((_, i) => (
               <col key={i} style={{ width: `${Math.floor((100 - 14) / weekDays.length)}%`, minWidth: '120px' }} />
             ))}
           </colgroup>
          <thead>
            {/* ✅ STICKY: Fila de headers con días */}
            <tr className="sticky top-0 z-20 bg-slate-50 shadow-sm">
              {/* ✅ STICKY: Celda de esquina superior izquierda - altura igual a headers de días */}
              <th className="border-r-[3px] border-b-[3px] border-slate-500 bg-slate-100 sticky left-0 z-30 shadow-md align-top" style={{ width: '140px', minWidth: '140px', maxWidth: '140px' }}>
                <div className="flex flex-col">
                  {/* Match Row 1 height */}
                  <div className="px-1.5 h-7 flex items-center border-b border-slate-200">
                    <div className="relative w-full">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                      <Input
                        className="h-6 pl-7 text-xs w-full bg-white"
                        placeholder={`Search ${viewBy}...`}
                        value={rowSearchQuery}
                        onChange={(e) => setRowSearchQuery(e.target.value)}
                      />
                    </div>
                  </div>
                  {/* Match Row 2 height */}
                  <div className="h-5 border-b border-slate-200" />
                  {/* Match Row 3 height */}
                  <div className="h-5 border-b border-slate-200" />
                  {/* Match Row 4 height */}
                  <div className="h-6 border-b border-slate-200" />
                  {/* Match Row 5 height */}
                  <div className="h-5" />
                </div>
              </th>
              
              {/* ✅ STICKY: Headers de días - ALTURA FIJA UNIFORME */}
              {weekDays.map((day, dayIdx) => {
                const stats = getDayStats(day);
                const isToday = isSameDay(day, new Date());
                const isSundayDay = isSunday(day);
                const isHoliday = isPublicHoliday(day);
                const holidayName = getPublicHolidayName(day);
                const dayEntries = filteredEntries.filter(entry => {
                  const entryDate = entry.planned_start_time
        ? parseISO(entry.planned_start_time)
        : entry.start_time
        ? parseISO(entry.start_time)
        : entry.task_start_date
        ? parseISO(entry.task_start_date + 'T00:00:00')
        : null;
                  return entryDate && isSameDay(entryDate, day);
                });

                return (
                  <th
                    key={dayIdx}
                    className={cn(
                      "border-r border-b-[3px] border-slate-200 border-b-slate-500 bg-slate-50 p-0 align-top",
                      isToday && "bg-blue-50 border-l-2 border-r-2 border-t-2 border-l-blue-500 border-r-blue-500 border-t-blue-500",
                      isSundayDay && "bg-red-50/50",
                      isHoliday && "bg-purple-50/50"
                    )}
                  >
                    <div className="flex flex-col">
                      {/* Row 1: Day name + date + menu */}
                      <div className="flex items-center justify-between px-2 h-7 border-b border-slate-200">
                        <div className={cn(
                          "flex items-baseline gap-1", 
                          isToday && "text-blue-600",
                          isSundayDay && "text-red-600",
                          isHoliday && "text-purple-600"
                        )}>
                          <span className="text-xs font-semibold">{format(day, 'EEE')}</span>
                          <span className="text-sm font-bold">{format(day, 'd/M')}</span>
                          {isSundayDay && <span className="text-[9px] ml-1">🔴</span>}
                          {isHoliday && <span className="text-[9px] ml-1">🎉</span>}
                        </div>
                        
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-5 w-5">
                              <MoreVertical className="w-3.5 h-3.5 text-slate-500" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onCreateWO && onCreateWO(null, day, 'open', null, null)}>
                              <Plus className="w-4 h-4 mr-2" />
                              Create Working Report
                            </DropdownMenuItem>
                            {dayEntries.length > 0 && (
                              <DropdownMenuItem onClick={() => onCopyWorkOrders && onCopyWorkOrders(dayEntries, day)}>
                                <Copy className="w-4 h-4 mr-2" />
                                Copy {dayEntries.length} WO(s)
                              </DropdownMenuItem>
                            )}
                            {copiedWorkOrders && copiedWorkOrders.workOrders && copiedWorkOrders.workOrders.length > 0 && (
                              <DropdownMenuItem onClick={() => onPasteWorkOrders && onPasteWorkOrders(day)}>
                                <File className="w-4 h-4 mr-2" />
                                Paste {copiedWorkOrders.workOrders.length} WO(s)
                              </DropdownMenuItem>
                            )}
                            {dayEntries.length > 0 && (
                              <DropdownMenuItem onClick={() => {
                                const dateStr = format(day, 'yyyy-MM-dd');
                                window.location.href = `/WorkOrdersSummaryPDFView?startDate=${dateStr}&endDate=${dateStr}&groupBy=team`;
                              }}>
                                <Download className="w-4 h-4 mr-2" />
                                Export PDF
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {/* Row 2: Workers field count */}
                      <div className="px-2 h-5 flex items-center text-[10px] text-slate-600 border-b border-slate-200">
                        <span className="font-medium">Workers on field: {stats.fieldWorkersActive}/{stats.totalFieldWorkers}</span>
                      </div>

                      {/* Row 3: Hours + Cost */}
                      <div className="px-2 h-5 flex items-center justify-between text-[10px] border-b border-slate-200">
                        <span className="text-slate-600">{stats.totalHours}h</span>
                        <span className="text-slate-600 font-medium">${stats.estimatedCost}</span>
                      </div>

                      {/* Row 4: Status badges - altura fija */}
                      <div className="flex items-center gap-1 px-1.5 h-6 border-b border-slate-200">
                        {stats.open > 0 && (
                          <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 bg-blue-100 text-blue-700 font-medium whitespace-nowrap">
                            Open: {stats.open}
                          </Badge>
                        )}
                        {stats.closed > 0 && (
                          <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 bg-green-100 text-green-700 font-medium whitespace-nowrap">
                            Closed: {stats.closed}
                          </Badge>
                        )}
                        {stats.total === 0 && <span className="text-[9px] text-slate-400">—</span>}
                      </div>

                      {/* Row 5: Holiday name - altura fija */}
                      <div className={cn(
                        "px-1.5 h-5 flex items-center justify-center text-[8px] font-medium truncate",
                        isHoliday && holidayName ? "bg-purple-100 text-purple-700" : "text-transparent"
                      )}>
                        {isHoliday && holidayName ? `🎉 ${holidayName}` : '—'}
                      </div>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {/* ✅ Filas de entidades (Projects/Teams/Users con sus WOs) */}
            {visibleEntities.map((entity, entityIdx) => {
              return (
                <tr key={entity.id} className="border-b-[3px] border-slate-500 last:border-b-0">
                  <TeamStickyCell
                    entity={entity}
                    viewBy={viewBy}
                    safeUsers={safeUsers}
                    safeCustomers={safeCustomers}
                    draggedMember={draggedMember}
                    setDraggedMember={setDraggedMember}
                    memberDropTarget={memberDropTarget}
                    setMemberDropTarget={setMemberDropTarget}
                    onDataChanged={onDataChanged}
                    isReadOnly={isReadOnly}
                  />

                  {/* ✅ Celdas de días con work orders - REDUCIDAS UN 20% */}
                  {weekDays.map((day, dayIdx) => {
                    const dayEntries = getEntriesForDayWithTracks(day, entity.id);
                    const isToday = isSameDay(day, new Date());
                    const isSundayDay = isSunday(day);
                    const isHoliday = isPublicHoliday(day);
                    // Check if this user is on leave (only for user view)
                    const userOnLeave = viewBy === 'user' && isUserOnLeave(entity.id, day);

                    return (
                      <ContextMenu key={dayIdx}>
                        <ContextMenuTrigger asChild>
                          <td
                            className={cn(
                              "p-1.5 border-r border-slate-200 min-h-[80px] transition-colors hover:bg-slate-50 relative align-top z-0",
                              isToday && "bg-blue-50/30 border-l-2 border-r-2 border-l-blue-500 border-r-blue-500",
                              isToday && entityIdx === visibleEntities.length - 1 && "border-b-2 border-b-blue-500",
                              isSundayDay && "bg-red-50/30",
                              isHoliday && "bg-purple-50/30",
                              userOnLeave && "bg-amber-50/50"
                            )}
                            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'move'; }}
                            onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); }}
                            onDrop={(e) => handleDrop(e, day, entity.id)}
                          >
                            {/* Absence indicator for user view */}
                            {userOnLeave && dayEntries.length === 0 && (
                              <div className="text-[8px] text-amber-600 text-center py-1 bg-amber-100 rounded">
                                🏖️ On Leave
                              </div>
                            )}
                            {dayEntries.length === 0 && (
                              <div className="text-[8px] text-slate-300 text-center py-1.5">
                                No WOs
                              </div>
                            )}
                            {/* ✅ REDUCIDO: space-y-1 a space-y-0.5 para menor separación */}
                            <div className="space-y-0.5">
                              {dayEntries.map((entry, entryIndex) => {
                                const isSelected = selectedEntries instanceof Set && selectedEntries.has(entry.id);
                                const overrideIds = localAssignedMap.get(entry.id) || null;
                                const explicitUserIds = new Set(overrideIds ?? (entry.employee_ids || []));
                                if (!overrideIds && entry.employee_id && !explicitUserIds.has(entry.employee_id)) explicitUserIds.add(entry.employee_id);
                                const assignedUsers = safeUsers.filter(u => explicitUserIds.has(u.id) && !u.archived);
                                const woSequence = getWorkOrderSequence(entry, day, entity.id);
                                // ✅ Use local status if available, otherwise use entry status
                                const currentStatus = localStatusMap[entry.id] || entry.status;
                                
                                // ✅ Create entry with current status for toggle handler
                                const entryWithCurrentStatus = { ...entry, status: currentStatus };

                                return (
                                  <ContextMenu key={entry.id}>
                                    <ContextMenuTrigger asChild>
                                      <div className="relative">
                                        {(() => {
                                          const linkInfo = getCustomerLinkInfo(entry, dayIdx, entity.id);
                                          if (!linkInfo) return null;
                                          
                                          return (
                                            <div
                                              className="absolute top-1/2 -right-0.5 w-1 h-0.5 bg-blue-500 z-5"
                                              style={{
                                                transform: 'translateY(-50%)'
                                              }}
                                            />
                                          );
                                        })()}

                                        {/* ✅ REDUCIDO UN 20%: padding de p-1.5 a p-1, text más pequeño */}
                                        <div
                                         draggable={!isReadOnly && !isMultiSelectMode}
                                         onDragStart={(e) => {
                                           handleDragStart(e, entry);
                                           setTogglingStatusId('__dragging__');
                                         }}
                                         onDragEnd={(e) => {
                                           setTimeout(() => setTogglingStatusId(null), 100);
                                         }}
                                         onClick={(e) => {
                                           const target = e.target;
                                           const isInteractiveElement = 
                                             target.closest('button[title*="Remove from"]') || 
                                             target.closest('button[title="Add user"]') ||
                                             target.closest('button[title*="mark as"]') ||
                                             target.closest('[role="dialog"]') ||
                                             target.closest('[data-radix-popper-content-wrapper]') ||
                                             target.tagName === 'INPUT';

                                           if (isInteractiveElement) {
                                             e.stopPropagation();
                                             return;
                                           }

                                           e.stopPropagation();
                                           if (isMultiSelectMode && onToggleSelection) {
                                             onToggleSelection(entry.id);
                                           } else if (onEntryClick) {
                                             onEntryClick(entry);
                                           }
                                         }}
                                         onDoubleClick={(e) => {
                                           e.stopPropagation();
                                           if (onEntryClick) onEntryClick(entry);
                                         }}
                                         role="button"
                                         tabIndex={0}
                                         onKeyDown={(e) => {
                                           if (e.key === 'Enter' || e.key === ' ') {
                                             e.preventDefault();
                                             if (onEntryClick) onEntryClick(entry);
                                           }
                                         }}
                                         className={cn(
                                           viewMode === '3days' ? "p-2 pr-6 rounded text-[11px]" : "p-1.5 pr-5 rounded text-[9px]",
                                           "cursor-pointer border relative overflow-hidden",
                                           "hover:shadow-md hover:scale-[1.02] transition-all duration-150",
                                           getCategoryColor && getCategoryColor(entry.work_order_category_id),
                                           isSelected && "ring-2 ring-indigo-500",
                                           currentStatus === 'closed' && "opacity-60 border-2 border-green-600",
                                           currentStatus === 'open' && "border-2 border-blue-500"
                                         )}
                                        >


                                          {/* Vertical stack layout */}
                                          <div className="flex flex-col gap-0.5 w-full">

                                          {/* Task Status Badge */}
                                          {(() => {
                                            const taskForDay = entry.tasks?.find(t => {
                                              if (!t.date) return false;
                                              try { return isSameDay(parseISO(t.date + 'T00:00:00'), day); } catch { return false; }
                                            });
                                            if (!taskForDay) return null;
                                            const localTaskStatus = localTaskStatusMap[entry.id]?.[taskForDay.id];
                                            const currentTaskStatus = localTaskStatus || taskForDay.status;
                                            return (
                                              <WeekCalendarTaskBadge
                                                entry={entry}
                                                taskForDay={taskForDay}
                                                currentTaskStatus={currentTaskStatus}
                                                localTaskStatusMap={localTaskStatusMap}
                                                setLocalTaskStatusMap={setLocalTaskStatusMap}
                                                onDataChanged={onDataChanged}
                                              />
                                            );
                                          })()}

                                          {/* ROW 0: WO Number + S badge */}
                                          <div className={cn("flex items-center gap-1 flex-wrap", viewMode === '3days' ? "text-[11px]" : "text-[9px]")}>
                                            {woSequence && woSequence.position > 0 && (
                                              <span className="font-bold text-slate-700">
                                                <span className="text-slate-400 font-normal">Task order: </span>{woSequence.position}/{woSequence.total}
                                              </span>
                                            )}
                                            <span className="text-indigo-600 font-bold">
                                              <span className="text-slate-400 font-normal">WN: </span>
                                              {entry.work_order_number ? (() => {
                                                const s = String(entry.work_order_number).trim();
                                                if (/^\d{4}\/\d{2}$/.test(s)) return s;
                                                return entry.work_order_number;
                                              })() : <span className="text-slate-300 italic font-normal">9999/99</span>}
                                            </span>
                                            {entry.client_signature_url && (
                                              <span className={cn("font-bold bg-green-500 text-white px-1 py-0 rounded leading-tight", viewMode === '3days' ? "text-[10px]" : "text-[8px]")} title="Signed">S</span>
                                            )}
                                          </div>

                                          {/* ROWS 1+2: Avatars + times via component */}
                                          {(() => {
                                            const taskForThisDay = entry.tasks?.find(t => {
                                              if (!t.date) return false;
                                              try { return isSameDay(parseISO(t.date + 'T00:00:00'), day); } catch { return false; }
                                            });
                                            const teamIdsFromTask = new Set(taskForThisDay?.team_ids || []);
                                            const empIds = new Set([...(entry.employee_ids || []), ...(entry.employee_id ? [entry.employee_id] : [])]);
                                            const assignedTeams = safeTeams.filter(t => teamIdsFromTask.has(t.id) && safeUsers.some(u => u.team_id === t.id && empIds.has(u.id)));
                                            const currentEmployeeIds = taskForThisDay?.employee_ids || entry.employee_ids || [];
                                            const activeUsers = safeUsers.filter(u => currentEmployeeIds.includes(u.id) && !u.archived && !isUserOnLeave(u.id, day));
                                            return (
                                              <WeekCalendarUserAvatars
                                                entry={entry}
                                                day={day}
                                                activeUsers={activeUsers}
                                                assignedTeams={assignedTeams}
                                                safeUsers={safeUsers}
                                                explicitUserIds={explicitUserIds}
                                                isReadOnly={isReadOnly}
                                                viewMode={viewMode}
                                                viewBy={viewBy}
                                                entity={entity}
                                                assigneeSearch={assigneeSearch}
                                                setAssigneeSearch={setAssigneeSearch}
                                                toggleAssignUser={toggleAssignUser}
                                                woUserTimeMap={woUserTimeMap}
                                              />
                                            );
                                          })()}

                                          {/* ROWS 3-6: Client, Project, Order, Task */}
                                          {(() => {
                                            const project = safeProjects.find(p => p.id === entry.project_id);
                                            const customer = project ? safeCustomers.find(c => c.id === project.customer_id) : null;
                                            const taskForDay = entry.tasks?.find(t => {
                                              if (!t.date) return false;
                                              try { return isSameDay(parseISO(t.date + 'T00:00:00'), day); } catch { return false; }
                                            });
                                            const textSz = viewMode === '3days' ? "text-[11px]" : "text-[8px]";
                                            return (
                                              <div className="flex flex-col gap-0">
                                                {customer?.name && (
                                                  <div className={cn(textSz, "text-slate-600 leading-tight overflow-hidden")} style={{wordBreak:'break-word', overflowWrap:'break-word'}}>
                                                    <span className="font-bold text-slate-500">Client: </span>{customer.name}
                                                  </div>
                                                )}
                                                {project?.name && (
                                                  <div className={cn(textSz, "text-slate-600 leading-tight overflow-hidden")} style={{wordBreak:'break-word', overflowWrap:'break-word'}}>
                                                    <span className="font-bold text-slate-500">Project: </span>{project.name}
                                                  </div>
                                                )}
                                                <div className={cn(textSz, "text-slate-600 leading-tight font-bold overflow-hidden", currentStatus === 'closed' && "line-through text-slate-400")} style={{wordBreak:'break-word', overflowWrap:'break-word'}}>
                                                  <span className="font-bold text-slate-500">Order: </span>{entry.title || 'Untitled'}
                                                </div>
                                                {taskForDay?.name && (
                                                  <div className={cn(textSz, "leading-tight font-bold text-slate-900 overflow-hidden", currentStatus === 'closed' && "line-through text-slate-500")} style={{wordBreak:'break-word', overflowWrap:'break-word'}}>
                                                    <span className="font-bold text-slate-500">Task: </span>{taskForDay.name}
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          })()}

                                          {/* ROWS 6-7: Planned time + Real time */}
                                          {(() => {
                                            const taskForDay = entry.tasks?.find(t => {
                                              if (!t.date) return false;
                                              try { return isSameDay(parseISO(t.date + 'T00:00:00'), day); } catch { return false; }
                                            });
                                            const plannedStart = taskForDay?.start_time || null;
                                            const plannedEnd = taskForDay?.end_time || null;
                                            const taskDateStr = taskForDay?.date || null;
                                            const realInDate = entry.start_time ? format(parseISO(entry.start_time), 'yyyy-MM-dd') : null;
                                            const taskDateIsFutureOnly = taskForDay?.date
                                              ? parseISO(taskForDay.date + 'T00:00:00') > new Date() : true;
                                            const realIn = (entry.start_time && taskDateStr && realInDate === taskDateStr && !taskDateIsFutureOnly)
                                              ? format(parseISO(entry.start_time), 'HH:mm') : null;
                                            const realOut = (entry.end_time && realIn && !entry.is_active)
                                              ? format(parseISO(entry.end_time), 'HH:mm') : null;
                                            let totalMins = null;
                                            if (plannedStart && plannedEnd) {
                                              const [sh, sm] = plannedStart.split(':').map(Number);
                                              const [eh, em] = plannedEnd.split(':').map(Number);
                                              totalMins = (eh * 60 + em) - (sh * 60 + sm);
                                              if (totalMins < 0) totalMins = null;
                                            }
                                            const taskDateIsPastOrToday = taskForDay?.date
                                              ? parseISO(taskForDay.date + 'T00:00:00') <= new Date() : false;
                                            const hasReport = !!(taskForDay && taskDateIsPastOrToday && (
                                              (taskForDay.work_done_items || []).some(i => i.text && i.text.trim()) ||
                                              (taskForDay.spare_parts_items || []).some(i => i.text && i.text.trim()) ||
                                              (taskForDay.work_pending_items || []).some(i => i.text && i.text.trim()) ||
                                              (taskForDay.spare_parts_pending_items || []).some(i => i.text && i.text.trim())
                                            ));
                                            const timeSz = viewMode === '3days' ? "text-[10px]" : "text-[7px]";
                                            return (
                                              <div className="flex flex-col gap-0.5">
                                                {/* ROW 6: Planned time */}
                                                <div className={cn("text-slate-500 leading-tight", timeSz)}>
                                                  <span className="font-bold text-slate-600">Planned: </span>
                                                  {plannedStart && plannedEnd ? `${plannedStart} → ${plannedEnd}` : '—'}
                                                  {totalMins != null && (
                                                    <span className="ml-1 text-indigo-600 font-bold">
                                                      ({Math.floor(totalMins/60)}h{totalMins%60 > 0 ? `${totalMins%60}m` : ''})
                                                    </span>
                                                  )}
                                                </div>
                                                {/* ROW 7: Real time */}
                                                {(realIn || realOut) && (
                                                  <div className="flex items-center gap-1 flex-wrap">
                                                    <span className={cn("inline-flex items-center gap-1 bg-green-700 text-white rounded px-1 py-0 leading-tight font-bold", timeSz)}>
                                                      🕐 {realIn || '?'} → {realOut || '...'}
                                                      {realIn && realOut && (() => {
                                                        const [rsh, rsm] = realIn.split(':').map(Number);
                                                        const [reh, rem] = realOut.split(':').map(Number);
                                                        const realTotalMins = (reh * 60 + rem) - (rsh * 60 + rsm);
                                                        if (realTotalMins <= 0) return null;
                                                        return <span> ({Math.floor(realTotalMins/60)}h{realTotalMins%60 > 0 ? `${realTotalMins%60}m` : ''})</span>;
                                                      })()}
                                                    </span>
                                                    {hasReport && (
                                                      <span className={cn("font-bold bg-blue-500 text-white px-1 py-0 rounded leading-tight", timeSz)} title="Report filled">R</span>
                                                    )}
                                                  </div>
                                                )}
                                                {!realIn && !realOut && hasReport && (
                                                  <span className={cn("font-bold bg-blue-500 text-white px-1 py-0 rounded leading-tight", timeSz)} title="Report filled">R</span>
                                                )}
                                                {/* Equipment icons */}
                                                {(() => {
                                                  const equipmentIds = entry.equipment_ids || [];
                                                  if (equipmentIds.length === 0) return null;
                                                  const allEquipment = [...safeAssets, ...safeClientEquipments];
                                                  const entryEquipment = allEquipment.filter(eq => equipmentIds.includes(eq.id));
                                                  if (entryEquipment.length === 0) return null;
                                                  return (
                                                    <div className="flex flex-row items-center gap-0.5 flex-wrap">
                                                      {entryEquipment.slice(0, 6).map(eq => (
                                                        <div key={eq.id} className="w-3 h-3 rounded-full bg-slate-800 border border-white flex items-center justify-center" title={eq.name}>
                                                          <span className="text-[5px] text-white font-bold">{eq.name?.charAt(0) || 'E'}</span>
                                                        </div>
                                                      ))}
                                                      {entryEquipment.length > 6 && (
                                                        <div className="w-3 h-3 rounded-full bg-slate-800 border border-white flex items-center justify-center">
                                                          <span className="text-[5px] text-white font-bold">+{entryEquipment.length - 6}</span>
                                                        </div>
                                                      )}
                                                    </div>
                                                  );
                                                })()}
                                              </div>
                                            );
                                          })()}

                                          </div>{/* end vertical stack */}
                                        </div>
                                      </div>
                                    </ContextMenuTrigger>
                                    <ContextMenuContent>
                                      <ContextMenuItem onClick={() => onCopyWorkOrders && onCopyWorkOrders([entry], parseISO(entry.planned_start_time))}>
                                        <Copy className="w-4 h-4 mr-2" />
                                        Copy Work Order
                                      </ContextMenuItem>
                                      {copiedWorkOrders && copiedWorkOrders.workOrders && copiedWorkOrders.workOrders.length > 0 && (
                                        <ContextMenuItem onClick={() => onPasteWorkOrders && onPasteWorkOrders(day, entity.id)}>
                                          <File className="w-4 h-4 mr-2" />
                                          Paste Here
                                        </ContextMenuItem>
                                      )}
                                    </ContextMenuContent>
                                  </ContextMenu>
                                );
                              })}
                            </div>
                          </td>
                        </ContextMenuTrigger>
                        <ContextMenuContent>
                          <ContextMenuItem onClick={() => {
                            if (onCreateWO) {
                              if (viewBy === 'project') {
                                onCreateWO(entity.id, day, 'open', null, null);
                              } else if (viewBy === 'team') {
                                onCreateWO(null, day, 'open', entity.id, null);
                              } else if (viewBy === 'user') {
                                onCreateWO(null, day, 'open', null, entity.id);
                              }
                            }
                          }}>
                            <Plus className="w-4 h-4 mr-2" />
                            Create Working Report
                          </ContextMenuItem>
                          {copiedWorkOrders && copiedWorkOrders.workOrders && copiedWorkOrders.workOrders.length > 0 && (
                            <ContextMenuItem onClick={() => onPasteWorkOrders && onPasteWorkOrders(day, entity.id)}>
                              <File className="w-4 h-4 mr-2" />
                              Paste {copiedWorkOrders.workOrders.length} Work Order{copiedWorkOrders.workOrders.length !== 1 ? 's' : ''}
                            </ContextMenuItem>
                          )}
                        </ContextMenuContent>
                      </ContextMenu>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showOverlapPanel && weekOverlaps.length > 0 && (
        <WeekOverlapPanel
          showOverlapPanel={showOverlapPanel}
          onToggleOverlapPanel={onToggleOverlapPanel}
          weekOverlaps={weekOverlaps}
          onHideOverlaps={onHideOverlaps}
        />
      )}
      </div>
      );
      }