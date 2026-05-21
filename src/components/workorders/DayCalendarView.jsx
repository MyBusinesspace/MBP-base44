import React, { useState, useMemo, useRef, useEffect } from 'react';
import { format, isSameDay, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronLeft, ChevronRight, Check, Play, CheckCircle2, Circle } from 'lucide-react';
import Avatar from '../Avatar';
import TeamAvatar from '../shared/TeamAvatar';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
const TimeEntry = base44.entities.TimeEntry;
const User = base44.entities.User;

const DEBUG = false;

export default function DayCalendarView({
  currentDate,
  onDateChange,
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
  isMultiSelectMode,
  selectedEntries,
  onToggleSelection,
  onDrop,
  draggedWorkOrder,
  onDragStart,
  isReadOnly,
  onCopyWorkOrders,
  onPasteWorkOrders,
  copiedWorkOrders,
  viewBy = 'project',
  onViewByChange,
  onDataChanged,
  allEntries, // ✅ Receive all entries
  viewMode = 'day',
  onViewModeChange,
  timeRange = '24h',
  onTimeRangeChange,
}) {
  // ✅ Local state for optimistic updates
  const [localEntries, setLocalEntries] = useState(entries);
  // ✅ Sync local state with parent entries
  useEffect(() => {
    setLocalEntries(entries);
  }, [entries]);

  const safeEntries = Array.isArray(localEntries) ? localEntries : [];
  const safeAllEntries = Array.isArray(allEntries) ? allEntries : safeEntries;
  const safeProjects = Array.isArray(projects) ? projects : [];
  const safeUsers = Array.isArray(users) ? users : [];
  const safeTeams = Array.isArray(teams) ? teams : [];
  const safeCustomers = Array.isArray(customers) ? customers : [];
  const safeAssets = Array.isArray(assets) ? assets : [];
  const safeClientEquipments = Array.isArray(clientEquipments) ? clientEquipments : [];

  const [searchQuery, setSearchQuery] = useState('');
  const [localViewBy, setLocalViewBy] = useState(viewBy);
  const [dragPreview, setDragPreview] = useState(null);

  // Day boundary markers (draggable red lines)
  const [dayStartHour, setDayStartHour] = useState(7);
  const [dayEndHour, setDayEndHour] = useState(17);
  const [draggingMarker, setDraggingMarker] = useState(null); // 'start' | 'end'
  const [draggedMember, setDraggedMember] = useState(null); // { userId, fromTeamId }
  const [memberDropTarget, setMemberDropTarget] = useState(null); // teamId being hovered
  const [dragOffset, setDragOffset] = useState(0);
  const [resizing, setResizing] = useState(null);
  const [justResized, setJustResized] = useState(false); // ✅ NUEVO: Flag para prevenir click después de resize

  const rowRefsMap = useRef({});
  const scrollContainerRef = useRef(null);
  const resizingRef = useRef(null); // ✅ Mantener referencia actualizada del state
  const dragPreviewRef = useRef(null);
  const dragRafRef = useRef(null);

  const START_HOUR = timeRange === '24h' ? 0 : 7;
  const END_HOUR = timeRange === '24h' ? 24 : 19;
  const TOTAL_HOURS = END_HOUR - START_HOUR;
  const QUARTERS_PER_HOUR = 4;
  const TOTAL_QUARTERS = TOTAL_HOURS * QUARTERS_PER_HOUR;

  const sortedEntries = useMemo(() => {
    if (!Array.isArray(safeEntries)) return [];

    return [...safeEntries].sort((a, b) => {
      const timeA = a.planned_start_time ? parseISO(a.planned_start_time).getTime() : 0;
      const timeB = b.planned_start_time ? parseISO(b.planned_start_time).getTime() : 0;

      if (timeA !== timeB) {
        return timeA - timeB;
      }

      const extractNumber = (str) => {
        if (!str) return 0;
        const match = String(str).match(/N(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
      };

      return extractNumber(a.work_order_number) - extractNumber(b.work_order_number);
    });
  }, [safeEntries]);

  const dayEntries = useMemo(() => {
    return sortedEntries.filter(entry => {
      if (!entry.planned_start_time) return false;
      try {
        const entryDate = parseISO(entry.planned_start_time);
        return isSameDay(entryDate, currentDate);
      } catch {
        return false;
      }
    });
  }, [sortedEntries, currentDate]);

  const filteredEntries = useMemo(() => {
    if (!searchQuery) return dayEntries;

    const query = searchQuery.toLowerCase();
    return dayEntries.filter(entry => {
      const matchesNumber = entry.work_order_number?.toLowerCase().includes(query);
      const matchesTitle = entry.title?.toLowerCase().includes(query);
      const matchesNotes = entry.work_notes?.toLowerCase().includes(query);
      const project = safeProjects.find(p => p.id === entry.project_id);
      const matchesProject = project?.name?.toLowerCase().includes(query);
      const customer = project?.customer_id ? safeCustomers.find(c => c.id === project.customer_id) : null;
      const matchesCustomer = customer?.name?.toLowerCase().includes(query);
      const uIds = [...(entry.employee_ids || [])];
      if (entry.employee_id && !uIds.includes(entry.employee_id)) uIds.push(entry.employee_id);

      const assignedUsers = safeUsers.filter(u => uIds.includes(u.id));
      const matchesUser = assignedUsers.some(user => {
        const userName = (user.nickname || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.full_name || user.email || '').toLowerCase();
        return userName.includes(query);
      });

      const tIds = [...(entry.team_ids || [])];
      if (entry.team_id && !tIds.includes(entry.team_id)) tIds.push(entry.team_id);

      const assignedTeams = safeTeams.filter(t => tIds.includes(t.id));
      const matchesTeam = assignedTeams.some(team => {
        return (team.name || '').toLowerCase().includes(query);
      });

      return matchesNumber || matchesTitle || matchesNotes || matchesProject || matchesCustomer || matchesUser || matchesTeam;
    });
  }, [dayEntries, searchQuery, safeProjects, safeCustomers, safeUsers, safeTeams]);

  const sortedEntities = useMemo(() => {
    if (localViewBy === 'project') {
      // ✅ Para projects: solo mostrar los que tienen entries
      const projectsWithEntries = {};
      dayEntries.forEach(entry => {
        if (entry.project_id && !projectsWithEntries[entry.project_id]) {
          const project = safeProjects.find(p => p.id === entry.project_id);
          if (project) projectsWithEntries[entry.project_id] = project;
        }
      });
      return Object.values(projectsWithEntries).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }

    if (localViewBy === 'user') {
      // ✅ CAMBIADO: Mostrar TODOS los usuarios no archivados
      return safeUsers
        .filter(u => !u.archived)
        .sort((a, b) => {
          const aName = a.nickname || a.first_name || a.email || '';
          const bName = b.nickname || b.first_name || b.email || '';
          return aName.localeCompare(bName);
        });
    }

    if (localViewBy === 'team') {
      // Only show teams with entries
      return safeTeams
        .filter(team => dayEntries.some(e => {
          const tIds = [...(e.team_ids || [])];
          if (e.team_id && !tIds.includes(e.team_id)) tIds.push(e.team_id);
          return tIds.includes(team.id);
        }))
        .sort((a, b) => {
          const sortOrderA = a.sort_order ?? 9999;
          const sortOrderB = b.sort_order ?? 9999;
          if (sortOrderA !== sortOrderB) return sortOrderA - sortOrderB;
          return (a.name || '').localeCompare(b.name || '');
        });
    }

    return [];
  }, [localViewBy, dayEntries, safeProjects, safeUsers, safeTeams]);

  const getBubblePosition = (entry) => {
    if (!entry.planned_start_time) return null;

    try {
      const start = new Date(entry.planned_start_time);
      const end = entry.planned_end_time ? new Date(entry.planned_end_time) : null;

      const startHour = start.getHours();
      const startMin = start.getMinutes();
      const endHour = end ? end.getHours() : startHour + 1;
      const endMin = end ? end.getMinutes() : 0;

      DEBUG && console.log(`🔵 getBubblePosition WO ${entry.work_order_number}:`, {
        realStart: `${startHour}:${startMin.toString().padStart(2, '0')}`,
        realEnd: `${endHour}:${endMin.toString().padStart(2, '0')}`,
        START_HOUR,
        END_HOUR
      });

      // Si termina antes del rango visible O empieza después, no mostrar
      if (endHour < START_HOUR || (endHour === START_HOUR && endMin === 0) || startHour >= END_HOUR) {
        DEBUG && console.log(`❌ WO ${entry.work_order_number} fuera de rango visible`);
        return null;
      }

      // Calcular minutos desde START_HOUR (clampear al rango visible)
      let startMinuteInRange = Math.max(0, (startHour - START_HOUR) * 60 + startMin);
      let endMinuteInRange = Math.min((END_HOUR - START_HOUR) * 60, (endHour - START_HOUR) * 60 + endMin);

      DEBUG && console.log(`   startMinuteInRange: ${startMinuteInRange}, endMinuteInRange: ${endMinuteInRange}`);

      // Convertir a quarters
      const startQuarter = Math.floor(startMinuteInRange / 15);
      const endQuarter = Math.round(endMinuteInRange / 15);

      const result = {
        start: startQuarter + 1,
        end: Math.max(endQuarter + 1, startQuarter + 2)
      };

      DEBUG && console.log(`   ✅ Grid position: start=${result.start}, end=${result.end} (span=${result.end - result.start} quarters)`);

      return result;
    } catch (error) {
      console.error('❌ Error en getBubblePosition:', error);
      return null;
    }
  };

  const getEntriesForEntity = (entityId) => {
    const entityEntries = filteredEntries.filter(e => {
      if (localViewBy === 'project') return e.project_id === entityId;
      if (localViewBy === 'user') {
        const uIds = [...(e.employee_ids || [])];
        if (e.employee_id && !uIds.includes(e.employee_id)) uIds.push(e.employee_id);
        if (uIds.includes(entityId)) return true;
        // ✅ If no users assigned, show in all user rows
        if (uIds.length === 0 && !e.employee_id) return true;
        return false;
      }
      if (localViewBy === 'team') {
        const tIds = [...(e.team_ids || [])];
        if (e.team_id && !tIds.includes(e.team_id)) tIds.push(e.team_id);
        return tIds.includes(entityId);
      }
      return false;
    });

    return entityEntries.sort((a, b) => {
      const timeA = a.planned_start_time ? new Date(a.planned_start_time).getTime() : 0;
      const timeB = b.planned_start_time ? new Date(b.planned_start_time).getTime() : 0;

      if (timeA !== timeB) {
        return timeA - timeB;
      }

      const extractNumber = (str) => {
        if (!str) return 0;
        const match = String(str).match(/N(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
      };

      return extractNumber(a.work_order_number) - extractNumber(b.work_order_number);
    });
  };

  const getEntityName = (entity) => {
    if (localViewBy === 'project') return entity.name;
    if (localViewBy === 'user') return entity.nickname || `${entity.first_name || ''} ${entity.last_name || ''}`.trim() || entity.full_name || entity.email;
    if (localViewBy === 'team') return entity.name;
    return '';
  };

  const getEntitySubInfo = (entity) => {
    if (localViewBy === 'project') {
      const customer = safeCustomers.find(c => c.id === entity.customer_id);
      return customer?.name;
    }
    return '';
  };



  // ✅ Memo: secuencia por entidad para el día actual para evitar recomputar por tarjeta
  const sequencesByEntity = useMemo(() => {
    const map = new Map();
    const sameDayEntries = safeAllEntries.filter(e => {
      const d = e.planned_start_time ? parseISO(e.planned_start_time) : null;
      return d && isSameDay(d, currentDate);
    });

    const push = (key, e) => {
      if (!key) return;
      const arr = map.get(key) || [];
      arr.push(e);
      map.set(key, arr);
    };

    sameDayEntries.forEach(e => {
      if (localViewBy === 'project') {
        push(e.project_id, e);
      } else if (localViewBy === 'user') {
        const uIds = [...(e.employee_ids || [])];
        if (e.employee_id && !uIds.includes(e.employee_id)) uIds.push(e.employee_id);
        // ✅ If no users assigned, add to all users
        if (uIds.length === 0) {
          safeUsers.forEach(u => { if (!u.archived) push(u.id, e); });
        } else {
          uIds.forEach(uid => push(uid, e));
        }
      } else if (localViewBy === 'team') {
        const tIds = [...(e.team_ids || [])];
        if (e.team_id && !tIds.includes(e.team_id)) tIds.push(e.team_id);
        tIds.forEach(tid => push(tid, e));
      }
    });

    const extractNumber = (str) => {
      if (!str) return 0;
      const match = String(str).match(/N(\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    };
    map.forEach(arr => arr.sort((a, b) => {
      const ta = a.planned_start_time ? parseISO(a.planned_start_time).getTime() : 0;
      const tb = b.planned_start_time ? parseISO(b.planned_start_time).getTime() : 0;
      if (ta !== tb) return ta - tb;
      return extractNumber(a.work_order_number) - extractNumber(b.work_order_number);
    }));

    return map;
  }, [safeAllEntries, currentDate, localViewBy]);

  const getWorkOrderSequence = (entry, _day, entityId) => {
    const arr = sequencesByEntity.get(entityId) || [];
    const position = arr.findIndex(e => e.id === entry.id) + 1;
    const total = arr.length;
    return { position, total };
  };

  const handleDragStart = (e, entry, entityId) => {
    if (isReadOnly || isMultiSelectMode || resizing) {
      e.preventDefault();
      return false;
    }
    
    const rowEl = rowRefsMap.current[entityId];
    
    if (rowEl && entry.planned_start_time) {
      try {
        const rect = rowEl.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const colWidth = rect.width / TOTAL_QUARTERS;
        const clickCol = Math.floor(clickX / colWidth);
        
        const start = new Date(entry.planned_start_time);
        const startHour = start.getHours();
        const startMin = start.getMinutes();
        const startCol = (startHour - START_HOUR) * QUARTERS_PER_HOUR + Math.floor(startMin / 15);
        
        const offset = clickCol - startCol;
        setDragOffset(offset);
      } catch (error) {
        setDragOffset(0);
      }
    }
    
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', entry.id);
    
    if (onDragStart) {
      onDragStart(entry);
    }
  };

  // ✅ MEJORADO: Aplicar offset en dragOver con throttle y actualización condicional
  const handleDragOver = (e, entityId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const rowEl = rowRefsMap.current[entityId];
    if (!rowEl) {
      // DEBUG && console.log('🟡 [DRAG OVER] No rowEl for:', entityId);
      return;
    }
    
    if (!draggedWorkOrder) {
      // DEBUG && console.log('🟡 [DRAG OVER] No draggedWorkOrder');
      return;
    }

    const rect = rowEl.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const colWidth = rect.width / TOTAL_QUARTERS;
    const mouseCol = Math.floor(x / colWidth);
    
    // ✅ Restar el offset para obtener la columna real de inicio
    const col = Math.max(0, mouseCol - dragOffset);

    let bubbleWidth = QUARTERS_PER_HOUR;
    if (draggedWorkOrder.planned_start_time && draggedWorkOrder.planned_end_time) {
      try {
        const start = new Date(draggedWorkOrder.planned_start_time);
        const end = new Date(draggedWorkOrder.planned_end_time);
        const durationMs = end - start;
        const durationHours = durationMs / (1000 * 60 * 60);
        bubbleWidth = Math.max(1, Math.round(durationHours * QUARTERS_PER_HOUR));
      } catch (err) {
        bubbleWidth = QUARTERS_PER_HOUR;
      }
    }

    setDragPreview({ entityId, col, width: bubbleWidth });
  };

  const handleDrop = (e, entityId) => {
    e.preventDefault();
    e.stopPropagation();

    setDragPreview(null);
    dragPreviewRef.current = null;
    if (dragRafRef.current) {
      cancelAnimationFrame(dragRafRef.current);
      dragRafRef.current = null;
    }

    if (!draggedWorkOrder || !onDrop) return;

    const rowEl = rowRefsMap.current[entityId];
    if (!rowEl) return;

    const rect = rowEl.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const colWidth = rect.width / TOTAL_QUARTERS;
    const mouseCol = Math.floor(x / colWidth);
    
    const col = Math.max(0, mouseCol - dragOffset);

    const quarterIndex = col;
    const hourOffset = Math.floor(quarterIndex / QUARTERS_PER_HOUR);
    const calculatedHour = START_HOUR + hourOffset;
    const calculatedMin = (quarterIndex % QUARTERS_PER_HOUR) * 15;

    const newStart = new Date(currentDate);
    newStart.setHours(calculatedHour, calculatedMin, 0, 0);

    onDrop(draggedWorkOrder, entityId, newStart);
    setDragOffset(0);
  };

  const handleResizeStart = (e, entry, edge, entityId) => {
    e.stopPropagation();
    e.preventDefault();

    if (isReadOnly || isMultiSelectMode) return;

    const rowEl = rowRefsMap.current[entityId];
    if (!rowEl || !entry.planned_start_time) return;

    const rect = rowEl.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const colWidth = rect.width / TOTAL_QUARTERS;
    const clickCol = Math.floor(clickX / colWidth);

    const start = new Date(entry.planned_start_time);
    const end = entry.planned_end_time ? new Date(entry.planned_end_time) : new Date(start.getTime() + 60*60*1000);

    const startHour = start.getHours();
    const startMin = start.getMinutes();
    const endHour = end.getHours();
    const endMin = end.getMinutes();

    DEBUG && console.log(`🟡 RESIZE START WO ${entry.work_order_number}:`, {
      edge,
      realTime: `${startHour}:${startMin.toString().padStart(2, '0')} - ${endHour}:${endMin.toString().padStart(2, '0')}`,
      clickCol,
      clickX,
      rectWidth: rect.width,
      colWidth,
      TOTAL_QUARTERS,
      calculatedColWidth: rect.width / TOTAL_QUARTERS
    });

    // Calcular quarters desde START_HOUR (clampear al rango visible)
    const startMinuteInRange = Math.max(0, (startHour - START_HOUR) * 60 + startMin);
    const endMinuteInRange = Math.min((END_HOUR - START_HOUR) * 60, (endHour - START_HOUR) * 60 + endMin);

    const startQuarter = Math.floor(startMinuteInRange / 15);
    const widthQuarters = Math.max(1, Math.round((endMinuteInRange - startMinuteInRange) / 15));

    DEBUG && console.log(`   Initial quarters: start=${startQuarter}, width=${widthQuarters}`);
    DEBUG && console.log(`   Minutes: startMin=${startMinuteInRange}, endMin=${endMinuteInRange}, duration=${endMinuteInRange - startMinuteInRange}min`);

    const resizeState = {
      entryId: entry.id,
      entityId,
      edge,
      initialCol: clickCol,
      initialStartQuarter: startQuarter,
      initialWidthQuarters: widthQuarters,
      newStartQuarter: startQuarter,
      newWidthQuarters: widthQuarters,
      originalStartHour: startHour,
      originalStartMin: startMin,
      originalEndHour: endHour,
      originalEndMin: endMin
    };

    setResizing(resizeState);
    resizingRef.current = resizeState;
  };

  const handleResizeMove = (e) => {
    if (!resizing) return;

    e.preventDefault();
    const rowEl = rowRefsMap.current[resizing.entityId];
    if (!rowEl) return;

    const rect = rowEl.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const colWidth = rect.width / TOTAL_QUARTERS;
    const currentCol = Math.floor(x / colWidth);

    const colDiff = currentCol - resizing.initialCol;

    let newStartQuarter = resizing.initialStartQuarter;
    let newWidthQuarters = resizing.initialWidthQuarters;

    if (resizing.edge === 'left') {
      newStartQuarter = Math.max(0, resizing.initialStartQuarter + colDiff);
      newWidthQuarters = Math.max(1, (resizing.initialStartQuarter + resizing.initialWidthQuarters) - newStartQuarter);
      DEBUG && console.log(`🟠 RESIZE MOVE (left):`, {
        mouseX: x,
        currentCol,
        colDiff,
        initialCol: resizing.initialCol,
        initialStart: resizing.initialStartQuarter,
        newStart: newStartQuarter,
        newWidth: newWidthQuarters,
        colWidth,
        rectWidth: rect.width
      });
    } else {
      newWidthQuarters = Math.max(1, resizing.initialWidthQuarters + colDiff);
      const currentEndQuarter = resizing.initialStartQuarter + newWidthQuarters;
      if (currentEndQuarter > TOTAL_QUARTERS) {
        newWidthQuarters = TOTAL_QUARTERS - resizing.initialStartQuarter;
      }
      DEBUG && console.log(`🟠 RESIZE MOVE (right):`, {
        mouseX: x,
        currentCol,
        colDiff,
        initialCol: resizing.initialCol,
        initialWidth: resizing.initialWidthQuarters,
        newWidth: newWidthQuarters,
        wouldEndAt: resizing.initialStartQuarter + newWidthQuarters,
        maxQuarters: TOTAL_QUARTERS,
        colWidth,
        rectWidth: rect.width
      });
    }

    setResizing(prev => {
      if (prev && prev.newStartQuarter === newStartQuarter && prev.newWidthQuarters === newWidthQuarters) return prev;
      const updated = { ...prev, newStartQuarter, newWidthQuarters };
      resizingRef.current = updated;
      return updated;
    });
  };

  const handleResizeEnd = async () => {
    const currentResizing = resizingRef.current;

    if (!currentResizing) {
      DEBUG && console.log('🔴 RESIZE END: No resizing state found');
      return;
    }

    const entry = filteredEntries.find(e => e.id === currentResizing.entryId);
    if (!entry || !entry.planned_start_time) {
      DEBUG && console.log('🔴 RESIZE END: Entry not found or no planned_start_time');
      setResizing(null);
      resizingRef.current = null;
      return;
    }

    const startQuarter = currentResizing.newStartQuarter ?? currentResizing.initialStartQuarter;
    const widthQuarters = currentResizing.newWidthQuarters ?? currentResizing.initialWidthQuarters;

    DEBUG && console.log(`🟢 RESIZE END WO ${entry.work_order_number}:`, {
      edge: currentResizing.edge,
      startQuarter,
      widthQuarters,
      initialStartQuarter: currentResizing.initialStartQuarter,
      initialWidthQuarters: currentResizing.initialWidthQuarters,
      originalTime: `${currentResizing.originalStartHour}:${currentResizing.originalStartMin.toString().padStart(2, '0')} - ${currentResizing.originalEndHour}:${currentResizing.originalEndMin.toString().padStart(2, '0')}`
    });

    if (startQuarter === currentResizing.initialStartQuarter && widthQuarters === currentResizing.initialWidthQuarters) {
      DEBUG && console.log('⚪ No changes detected, canceling resize');
      setResizing(null);
      resizingRef.current = null;
      return;
    }

    // Calcular delta de cambios
    const startDelta = startQuarter - currentResizing.initialStartQuarter;
    const widthDelta = widthQuarters - currentResizing.initialWidthQuarters;

    DEBUG && console.log(`   📊 Deltas: startDelta=${startDelta} quarters (${startDelta * 15}min), widthDelta=${widthDelta} quarters (${widthDelta * 15}min)`);

    // Aplicar cambios a las horas originales
    let newStartMinutes = currentResizing.originalStartHour * 60 + currentResizing.originalStartMin;
    let newEndMinutes = currentResizing.originalEndHour * 60 + currentResizing.originalEndMin;

    DEBUG && console.log(`   🕐 Original minutes: start=${newStartMinutes}min (${Math.floor(newStartMinutes/60)}:${(newStartMinutes%60).toString().padStart(2,'0')}), end=${newEndMinutes}min (${Math.floor(newEndMinutes/60)}:${(newEndMinutes%60).toString().padStart(2,'0')})`);

    if (currentResizing.edge === 'left') {
      newStartMinutes += startDelta * 15;
      DEBUG && console.log(`   ⬅️  Modified START by ${startDelta * 15}min → ${newStartMinutes}min (${Math.floor(newStartMinutes/60)}:${(newStartMinutes%60).toString().padStart(2,'0')})`);
    } else {
      newEndMinutes += widthDelta * 15;
      DEBUG && console.log(`   ➡️  Modified END by ${widthDelta * 15}min → ${newEndMinutes}min (${Math.floor(newEndMinutes/60)}:${(newEndMinutes%60).toString().padStart(2,'0')})`);
    }

    const newStart = new Date(currentDate);
    newStart.setHours(Math.floor(newStartMinutes / 60), newStartMinutes % 60, 0, 0);

    const newEnd = new Date(currentDate);
    newEnd.setHours(Math.floor(newEndMinutes / 60), newEndMinutes % 60, 0, 0);

    DEBUG && console.log(`   ✅ FINAL New times: ${newStart.getHours()}:${newStart.getMinutes().toString().padStart(2, '0')} - ${newEnd.getHours()}:${newEnd.getMinutes().toString().padStart(2, '0')}`);
    DEBUG && console.log(`   📤 Sending to onDrop...`);

    setJustResized(true);

    setResizing(null);
    resizingRef.current = null;

    if (onDrop) {
      const updatedEntry = {
        ...entry,
        planned_start_time: newStart.toISOString(),
        planned_end_time: newEnd.toISOString()
      };
      onDrop(updatedEntry, currentResizing.entityId, newStart);
    }

    setTimeout(() => {
      setJustResized(false);
    }, 150);
  };

  useEffect(() => {
    if (resizing) {
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
      return () => {
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  }, [resizing]);

  // Cleanup pending RAF on unmount
  useEffect(() => {
    return () => {
      if (dragRafRef.current) {
        cancelAnimationFrame(dragRafRef.current);
        dragRafRef.current = null;
      }
    };
  }, []);

  // Marker drag logic
  const handleMarkerMouseDown = (e, marker) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingMarker(marker);
  };

  useEffect(() => {
    if (!draggingMarker) return;
    const handleMouseMove = (e) => {
      const container = scrollContainerRef.current;
      if (!container) return;
      // Find the grid area (skip the 200px left panel)
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left - 200; // subtract sticky panel width
      const gridWidth = container.scrollWidth - 200;
      const fraction = Math.max(0, Math.min(1, x / gridWidth));
      const rawHour = START_HOUR + fraction * TOTAL_HOURS;
      const snappedHour = Math.round(rawHour);
      const clampedHour = Math.max(START_HOUR, Math.min(END_HOUR, snappedHour));
      if (draggingMarker === 'start') {
        setDayStartHour(Math.min(clampedHour, dayEndHour - 1));
      } else {
        setDayEndHour(Math.max(clampedHour, dayStartHour + 1));
      }
    };
    const handleMouseUp = () => setDraggingMarker(null);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingMarker, dayStartHour, dayEndHour, START_HOUR, END_HOUR, TOTAL_HOURS]);

  const hours = Array.from({ length: TOTAL_HOURS }, (_, i) => START_HOUR + i);

  return (
    <div className="flex flex-col space-y-4">
      <style>{`
        body { overflow-x: auto !important; }
      `}</style>

      {/* ✅ WO Counter + Day boundary editors */}
      <div className="flex items-center justify-between px-4 py-2 bg-indigo-50 rounded-lg border border-indigo-200">
        <span className="text-sm font-semibold text-indigo-900">
          Calendar View: {dayEntries.length} work orders
        </span>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500 border-2 border-red-700 flex-shrink-0" />
            <span className="text-xs text-slate-600 font-medium">Day start:</span>
            <input
              type="number"
              min={START_HOUR}
              max={dayEndHour - 1}
              value={dayStartHour}
              onChange={(e) => setDayStartHour(Math.max(START_HOUR, Math.min(dayEndHour - 1, parseInt(e.target.value) || START_HOUR)))}
              className="w-12 h-6 text-xs border border-red-300 rounded px-1 text-center font-bold text-red-700 bg-white"
            />
            <span className="text-xs text-slate-500">h</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500 border-2 border-red-700 flex-shrink-0" />
            <span className="text-xs text-slate-600 font-medium">Day end:</span>
            <input
              type="number"
              min={dayStartHour + 1}
              max={END_HOUR}
              value={dayEndHour}
              onChange={(e) => setDayEndHour(Math.max(dayStartHour + 1, Math.min(END_HOUR, parseInt(e.target.value) || END_HOUR)))}
              className="w-12 h-6 text-xs border border-red-300 rounded px-1 text-center font-bold text-red-700 bg-white"
            />
            <span className="text-xs text-slate-500">h</span>
          </div>
        </div>
        <span className="text-xs text-indigo-600">
          {format(currentDate, 'EEEE, MMMM d, yyyy')}
        </span>
      </div>

      <div className="flex flex-col bg-white rounded-lg relative">
      <div ref={scrollContainerRef} className="flex-1 relative overflow-x-auto">
        {/* Day boundary red lines */}
        {[
          { hour: dayStartHour, marker: 'start' },
          { hour: dayEndHour, marker: 'end' },
        ].map(({ hour, marker }) => {
          const fraction = (hour - START_HOUR) / TOTAL_HOURS;
          return (
            <div
              key={marker}
              className="absolute top-0 bottom-0 z-50 pointer-events-none"
              style={{
                left: `calc(200px + (100% - 200px) * ${fraction})`,
                width: '2px',
              }}
            >
              <div className="w-full h-full bg-red-500 opacity-70" />
              {/* Draggable handle */}
              <div
                className="absolute top-8 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-red-500 border-2 border-white shadow-lg cursor-ew-resize flex items-center justify-center pointer-events-auto z-50"
                style={{ userSelect: 'none' }}
                onMouseDown={(e) => handleMarkerMouseDown(e, marker)}
                title={`Drag to move ${marker === 'start' ? 'day start' : 'day end'}`}
              >
                <span className="text-[7px] text-white font-bold select-none">{hour}h</span>
              </div>
            </div>
          );
        })}
        <div
          className="flex border-b border-slate-300 bg-slate-100 sticky top-0 z-30"
          style={{ minWidth: '100%' }}
        >
          <div className="w-[200px] bg-slate-200 border-r border-slate-300 p-2 flex-shrink-0 sticky left-0 z-40">
            <div className="text-xs font-bold text-slate-700">
              {localViewBy === 'project' ? 'Projects' : localViewBy === 'user' ? 'Users' : 'Teams'}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${TOTAL_QUARTERS}, 1fr)`, flex: 1 }}>
            {hours.map((hour, i) => (
              <div
                key={hour}
                className="relative border-r-2 border-slate-400"
                style={{ gridColumn: `${i * QUARTERS_PER_HOUR + 1} / ${i * QUARTERS_PER_HOUR + QUARTERS_PER_HOUR + 1}` }}
              >
                <div className="absolute left-0 top-1 -translate-x-1/2 bg-slate-100 px-1 text-[10px] font-semibold text-slate-700">
                  {String(hour).padStart(2, '0')}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ minWidth: '100%' }}>
          {sortedEntities.map((entity) => {
            const entityName = getEntityName(entity);
            const entitySubInfo = getEntitySubInfo(entity);
            const entityEntries = getEntriesForEntity(entity.id);



            return (
              <div key={entity.id} className="flex border-b border-slate-200">
                {localViewBy === 'team' ? (
                  // Team view: full drag & drop sticky cell (same as WeekCalendarView)
                  <div
                    className={cn(
                      "w-[200px] border-r-[3px] border-slate-500 flex-shrink-0 sticky left-0 z-20 shadow-sm transition-colors self-stretch",
                      memberDropTarget === entity.id ? "bg-green-100 border-green-400" : "bg-slate-100"
                    )}
                    style={{ padding: 0, position: 'relative' }}
                    onDragOver={(e) => {
                      if (!draggedMember) return;
                      e.preventDefault();
                      e.stopPropagation();
                      e.dataTransfer.dropEffect = 'move';
                      setMemberDropTarget(entity.id);
                    }}
                    onDragEnter={(e) => {
                      if (!draggedMember) return;
                      e.preventDefault();
                      e.stopPropagation();
                      setMemberDropTarget(entity.id);
                    }}
                    onDragLeave={(e) => {
                      if (!e.currentTarget.contains(e.relatedTarget)) {
                        setMemberDropTarget(null);
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      let member = draggedMember;
                      if (!member) {
                        try {
                          const raw = e.dataTransfer.getData('application/member-drag');
                          if (raw) member = JSON.parse(raw);
                        } catch {}
                      }
                      setMemberDropTarget(null);
                      setDraggedMember(null);
                      if (member && member.fromTeamId !== entity.id) {
                        User.update(member.userId, { team_id: entity.id })
                          .then(() => {
                            toast.success('Member moved to team');
                            if (onDataChanged) { onDataChanged(); }
                          })
                          .catch(() => toast.error('Failed to move member'));
                      }
                    }}
                  >
                    {(() => {
                      const teamMembers = safeUsers.filter(u => u.team_id === entity.id && !u.archived);
                      return (
                        <div className="flex flex-col px-1 py-1 gap-0.5">
                          {/* Team name + avatar */}
                          <div className="flex items-center justify-between gap-1 px-0.5 pb-1 border-b border-slate-200 mb-0.5">
                            <div className="font-semibold text-xs truncate text-slate-800" title={entityName}>{entityName}</div>
                            <TeamAvatar team={entity} size="xs" />
                          </div>
                          {/* Draggable members — single list */}
                          {teamMembers.map(u => {
                            const name = u.nickname || u.first_name || u.email?.split('@')[0] || '?';
                            return (
                              <div
                                key={u.id}
                                draggable="true"
                                title={`${name} — drag to reassign`}
                                className="flex items-center gap-1 cursor-grab active:cursor-grabbing select-none px-0.5 py-0.5 rounded hover:bg-white/60"
                                style={{ userSelect: 'none', WebkitUserDrag: 'element' }}
                                onDragStart={(e) => {
                                  e.dataTransfer.effectAllowed = 'move';
                                  e.dataTransfer.setData('application/member-drag', JSON.stringify({ userId: u.id, fromTeamId: entity.id }));
                                  e.dataTransfer.setData('text/plain', u.id);
                                  const ghost = document.createElement('div');
                                  ghost.textContent = name;
                                  ghost.style.cssText = 'position:fixed;top:-100px;left:-100px;padding:2px 6px;background:#1e293b;color:#fff;font-size:11px;border-radius:4px;white-space:nowrap;';
                                  document.body.appendChild(ghost);
                                  e.dataTransfer.setDragImage(ghost, 0, 0);
                                  setTimeout(() => document.body.removeChild(ghost), 0);
                                  setDraggedMember({ userId: u.id, fromTeamId: entity.id });
                                }}
                                onDragEnd={() => { setDraggedMember(null); setMemberDropTarget(null); }}
                              >
                                <Avatar user={u} size="xs" />
                                <span className="text-[9px] text-slate-700 truncate leading-tight">{name}</span>
                              </div>
                            );
                          })}
                          {/* Drop hint */}
                          {memberDropTarget === entity.id && (
                            <div className="text-[9px] text-green-700 text-center font-medium py-0.5 bg-green-100 rounded border border-green-200 mt-1">
                              Drop to assign
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  // Project / User view: simple info cell
                  <div className="w-[200px] bg-slate-100 border-r border-slate-300 p-2 flex-shrink-0 sticky left-0 z-20 shadow-sm self-stretch">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="text-xs font-semibold text-slate-900 truncate">{entityName}</div>
                    </div>
                    {entitySubInfo && <div className="text-[10px] text-slate-600 truncate">{entitySubInfo}</div>}
                    {localViewBy === 'user' && <Avatar user={entity} size="xs" className="mt-1" />}
                  </div>
                )}

                {(() => {
                  // ✅ NUEVO: Organizar entries en filas (lanes) para evitar overlaps visuales
                  const organizeEntriesInLanes = (entries) => {
                    const lanes = [];
                    
                    // Ordenar por tiempo de inicio
                    const sortedEntries = [...entries].sort((a, b) => {
                      const timeA = a.planned_start_time ? new Date(a.planned_start_time).getTime() : 0;
                      const timeB = b.planned_start_time ? new Date(b.planned_start_time).getTime() : 0;
                      return timeA - timeB;
                    });
                    
                    sortedEntries.forEach(entry => {
                      const pos = getBubblePosition(entry);
                      if (!pos) return;
                      
                      // Encontrar la primera lane donde quepa sin overlap
                      let assignedLane = -1;
                      for (let i = 0; i < lanes.length; i++) {
                        const lane = lanes[i];
                        const lastEntry = lane[lane.length - 1];
                        const lastPos = getBubblePosition(lastEntry);
                        
                        // Si no hay overlap, usar esta lane
                        if (lastPos && pos.start >= lastPos.end) {
                          assignedLane = i;
                          break;
                        }
                      }
                      
                      // Si no encontramos lane, crear una nueva
                      if (assignedLane === -1) {
                        lanes.push([entry]);
                      } else {
                        lanes[assignedLane].push(entry);
                      }
                    });
                    
                    return lanes;
                  };
                  
                  const lanes = organizeEntriesInLanes(entityEntries);
                  const rowHeight = 130;
                  const totalHeight = Math.max(rowHeight, lanes.length * rowHeight);

                  return (
                    <div
                      ref={(el) => {
                        if (el) {
                          rowRefsMap.current[entity.id] = el;
                        }
                      }}
                      className="flex-1 bg-white relative"
                      style={{
                        display: 'grid',
                        gridTemplateColumns: `repeat(${TOTAL_QUARTERS}, 1fr)`,
                        gridTemplateRows: `repeat(${Math.max(1, lanes.length)}, ${rowHeight}px)`,
                        width: '100%',
                        height: `${totalHeight}px`,
                      }}
                      onDragOver={(e) => handleDragOver(e, entity.id)}
                      onDrop={(e) => handleDrop(e, entity.id)}
                      onDragLeave={() => setDragPreview(null)}
                    >
                      {/* Vertical grid lines every 15 min */}
                      {Array.from({ length: TOTAL_QUARTERS + 1 }).map((_, i) => (
                        <div
                          key={`gridline-${i}`}
                          className="absolute top-0 bottom-0 border-l border-slate-200"
                          style={{
                            left: `calc((100% / ${TOTAL_QUARTERS}) * ${i})`,
                            height: '100%',
                            pointerEvents: 'none'
                          }}
                        />
                      ))}

                      {dragPreview && dragPreview.entityId === entity.id && (
                        <div
                          className="absolute bg-blue-200/80 border-2 border-blue-600 rounded shadow-lg flex items-center justify-center"
                          style={{
                            gridColumnStart: Math.max(1, Math.min(dragPreview.col + 1, TOTAL_QUARTERS)),
                            gridColumnEnd: Math.max(2, Math.min(dragPreview.col + dragPreview.width + 1, TOTAL_QUARTERS + 1)),
                            height: '60px',
                            top: '10px',
                            zIndex: 5,
                            pointerEvents: 'none',
                            marginLeft: '2px',
                            marginRight: '2px',
                          }}
                        >
                          <div className="text-blue-700 font-bold text-xs">📍 DROP HERE</div>
                        </div>
                      )}

                      {entityEntries.length === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center text-[8px] text-slate-300 pointer-events-none">
                          No WOs
                        </div>
                      )}

                      {lanes.map((lane, laneIndex) => {
                        return lane.map((entry) => {
                          const pos = getBubblePosition(entry);
                          if (!pos) return null;

                          const isSelected = selectedEntries instanceof Set && selectedEntries.has(entry.id);
                          const uIds = [...(entry.employee_ids || [])];
                          if (entry.employee_id && !uIds.includes(entry.employee_id)) uIds.push(entry.employee_id);
                          const assignedUsers = safeUsers.filter(u => uIds.includes(u.id) && !u.archived);
                          const woSequence = getWorkOrderSequence(entry, currentDate, entity.id);

                          let displayPos = pos;
                          if (resizing && resizing.entryId === entry.id) {
                            const startQ = resizing.newStartQuarter ?? resizing.initialStartQuarter;
                            const widthQ = resizing.newWidthQuarters ?? resizing.initialWidthQuarters;
                            displayPos = {
                              start: startQ + 1,
                              end: Math.min(startQ + widthQ + 1, TOTAL_QUARTERS + 1)
                            };
                            DEBUG && console.log(`🔷 RESIZING DISPLAY UPDATE WO ${entry.work_order_number}:`, {
                              startQ,
                              widthQ,
                              displayPos,
                              originalPos: pos
                            });
                          }

                          (() => {
                            const renderStart = new Date(entry.planned_start_time);
                            const renderEnd = entry.planned_end_time ? new Date(entry.planned_end_time) : null;

                            // Calcular qué hora del día representa cada posición del grid
                            const startGridHour = START_HOUR + ((displayPos.start - 1) / QUARTERS_PER_HOUR);
                            const endGridHour = START_HOUR + ((displayPos.end - 1) / QUARTERS_PER_HOUR);

                            // Verificar si el display coincide con el tiempo real
                            const expectedStart = (renderStart.getHours() - START_HOUR) * QUARTERS_PER_HOUR + Math.floor(renderStart.getMinutes() / 15) + 1;
                            const expectedEnd = renderEnd ? (renderEnd.getHours() - START_HOUR) * QUARTERS_PER_HOUR + Math.round(renderEnd.getMinutes() / 15) + 1 : expectedStart + 4;

                            const mismatch = displayPos.start !== expectedStart || displayPos.end !== expectedEnd;

                            DEBUG && console.log(`🎨 RENDERING WO ${entry.work_order_number}:`, {
                              realTime: `${renderStart.getHours()}:${renderStart.getMinutes().toString().padStart(2, '0')} - ${renderEnd?.getHours()}:${renderEnd?.getMinutes().toString().padStart(2, '0')}`,
                              displayPos: `start=${displayPos.start}, end=${displayPos.end}, span=${displayPos.end - displayPos.start}`,
                              gridRepresents: `${startGridHour.toFixed(2)}h - ${endGridHour.toFixed(2)}h`,
                              expectedPos: `start=${expectedStart}, end=${expectedEnd}`,
                              MISMATCH: mismatch ? '❌ POSITIONS DO NOT MATCH!' : '✅ OK',
                              isResizing: resizing && resizing.entryId === entry.id,
                              laneIndex
                            });
                          })();

                          return (
                          <div
                            key={entry.id}
                            draggable={!isReadOnly && !isMultiSelectMode && !resizing}
                            onDragStart={(e) => handleDragStart(e, entry, entity.id)}
                            onDragEnd={() => {
                              setDragPreview(null);
                              if (onDragStart) onDragStart(null);
                            }}
                            onClick={(e) => {
                               // ✅ Don't click card if clicking the task button or checkbox
                               if (e.target.closest('button[title*="Mark as"]') || e.target.closest('[role="checkbox"]')) return;
                               e.stopPropagation();
                               if (resizing || justResized) return;
                               // ✅ Only toggle selection in multiselect mode if clicking the card directly (not checkbox)
                               if (isMultiSelectMode && onToggleSelection) {
                                 onToggleSelection(entry.id);
                               } else if (!isMultiSelectMode && onEntryClick) {
                                 onEntryClick(entry);
                               }
                             }}
                             className={cn(
                               "relative rounded text-[8px] flex flex-col px-1.5 py-0.5 border-2 select-none m-0.5",
                               !isReadOnly && !isMultiSelectMode && !resizing && "cursor-grab active:cursor-grabbing hover:shadow-lg",
                               (isReadOnly || isMultiSelectMode || resizing) ? "cursor-pointer" : "",
                               getCategoryColor(entry.work_order_category_id),
                               isSelected && "ring-2 ring-indigo-500",
                               entry.status === 'closed' && "opacity-60 line-through border-green-600",
                               entry.status === 'open' && "border-blue-500",
                               isMultiSelectMode && "pointer-events-auto"
                             )}
                             style={{
                               gridColumnStart: displayPos.start,
                               gridColumnEnd: displayPos.end,
                               gridRow: laneIndex + 1,
                               minHeight: '120px',
                               zIndex: resizing && resizing.entryId === entry.id ? 20 : 10,
                             }}
                           >


                         {!isReadOnly && !isMultiSelectMode && (
                          <>
                          <div
                            className="absolute left-0 top-0 bottom-0 w-3 cursor-ew-resize hover:bg-indigo-400/40 z-30 group"
                            onMouseDown={(e) => handleResizeStart(e, entry, 'left', entity.id)}
                            title="Drag to resize start time"
                          >
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-indigo-500/0 group-hover:bg-indigo-500/80 rounded-r transition-all" />
                          </div>
                          <div
                            className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize hover:bg-indigo-400/40 z-30 group"
                            onMouseDown={(e) => handleResizeStart(e, entry, 'right', entity.id)}
                            title="Drag to resize end time"
                          >
                            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-indigo-500/0 group-hover:bg-indigo-500/80 rounded-l transition-all" />
                          </div>
                          </>
                          )}

                          {isMultiSelectMode && (
                          <div className="absolute top-0 left-0 z-50 pointer-events-auto p-1">
                            <Checkbox 
                              checked={isSelected} 
                              onCheckedChange={() => onToggleSelection(entry.id)} 
                              className="mr-2 mb-1" 
                              onClick={(e) => e.stopPropagation()} 
                            />
                          </div>
                          )}





                          {/* Sequence + WO Number + Avatars */}
                          <div className="flex items-start justify-between mb-0.5">
                           <span className="font-bold text-slate-900 text-[8px]">
                             {woSequence && woSequence.position > 0 ? `${woSequence.position}/${woSequence.total}` : ''}
                           </span>
                           <div className="flex items-center gap-1 ml-1">
                             {assignedUsers.slice(0, 3).map(u => (
                               <Avatar key={u.id} user={u} size="xs" />
                             ))}
                             {assignedUsers.length > 3 && (
                               <span className="text-[8px] font-bold text-slate-600">+{assignedUsers.length - 3}</span>
                             )}
                             {entry.work_order_number && (
                               <span className="text-[10px] font-bold text-indigo-600">
                                 {(() => {
                                   const s = String(entry.work_order_number).trim();
                                   if (/^\d{4}\/\d{2}$/.test(s)) return s;
                                   return '-';
                                 })()}
                               </span>
                             )}
                           </div>
                          </div>

                          {/* Project + Client + Task + Time */}
                          {(() => {
                            const project = safeProjects.find(p => p.id === entry.project_id);
                            const customer = project ? safeCustomers.find(c => c.id === project.customer_id) : null;
                            const taskForDay = entry.tasks?.find(t => {
                              if (!t.date) return false;
                              try { return isSameDay(parseISO(t.date + 'T00:00:00'), currentDate); } catch { return false; }
                            });
                            return (
                              <div className="flex flex-col gap-0.5 pointer-events-none">
                                {project && (
                                  <div className="text-[9px] text-slate-700 truncate">
                                    <span className="font-bold text-slate-500">Project: </span>
                                    <span className="font-semibold">{project.name}</span>
                                  </div>
                                )}
                                {customer && (
                                  <div className="text-[9px] text-slate-600 truncate">
                                    <span className="font-bold text-slate-500">Client: </span>
                                    <span>{customer.name}</span>
                                  </div>
                                )}
                                {taskForDay?.name && (
                                  <div className="text-[9px] text-slate-700 truncate">
                                    <span className="font-bold text-slate-500">Task: </span>
                                    <span>{taskForDay.name}</span>
                                  </div>
                                )}
                                <div className="text-[9px] text-slate-600 font-medium mt-0.5">
                                  {entry.planned_start_time && entry.planned_end_time && (
                                    <span>{format(parseISO(entry.planned_start_time), 'HH:mm')} - {format(parseISO(entry.planned_end_time), 'HH:mm')}</span>
                                  )}
                                </div>
                              </div>
                            );
                          })()}
                            </div>
                          );
                        });
                      })}
                    </div>
                  );
                })()}
              </div>
            );
          })}

          {sortedEntities.length === 0 && (
            <div className="flex items-center justify-center py-12 text-slate-500">
              No work orders found
            </div>
          )}
        </div>
      </div>

      <div className="flex-shrink-0 border-t border-slate-200 bg-slate-50 p-3">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (scrollContainerRef.current) {
                scrollContainerRef.current.scrollLeft -= 200;
              }
            }}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>

          <div
            className="flex-1 h-4 bg-slate-200 rounded-full overflow-hidden cursor-grab active:cursor-grabbing relative"
            onMouseDown={(e) => {
              const scrollbar = e.currentTarget;
              const container = scrollContainerRef.current;
              if (!container) return;

              const startX = e.clientX;
              const scrollLeft = container.scrollLeft;
              const scrollWidth = container.scrollWidth;
              const maxScrollLeft = container.scrollWidth - container.clientWidth;
              const scrollbarTrackWidth = scrollbar.clientWidth;

              const handleMouseMove = (e) => {
                const dx = e.clientX - startX;
                const scrollProportion = dx / scrollbarTrackWidth;
                container.scrollLeft = Math.max(0, Math.min(scrollLeft + (scrollProportion * scrollWidth), maxScrollLeft));
              };

              const handleMouseUp = () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
              };

              document.addEventListener('mousemove', handleMouseMove);
              document.addEventListener('mouseup', handleMouseUp);
            }}
          >
            <div
              className="h-full bg-indigo-500 rounded-full transition-all"
              style={{
                width: scrollContainerRef.current
                  ? `${Math.max(10, (scrollContainerRef.current.clientWidth / scrollContainerRef.current.scrollWidth) * 100)}%`
                  : '100%',
                transform: scrollContainerRef.current
                  ? `translateX(${
                      (scrollContainerRef.current.scrollLeft / (scrollContainerRef.current.scrollWidth - scrollContainerRef.current.clientWidth)) *
                      (100 - (Math.max(10, (scrollContainerRef.current.clientWidth / scrollContainerRef.current.scrollWidth) * 100)))
                    }%)`
                  : 'translateX(0%)'
              }}
            />
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (scrollContainerRef.current) {
                scrollContainerRef.current.scrollLeft += 200;
              }
            }}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
      </div>
    </div>
  );
}