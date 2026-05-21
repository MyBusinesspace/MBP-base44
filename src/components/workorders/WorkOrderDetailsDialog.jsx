import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

import {
  Save,
  Trash2,
  Calendar as CalendarIcon,
  Clock,
  Users as UsersIcon,
  X,
  ChevronDown,
  ChevronUp,
  File,
  Eye,
  Upload,
  Loader2,
  MapPin
} from 'lucide-react';
import { format, parseISO, addDays, isSameDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import ProjectCombobox from './ProjectCombobox';
import WorkingOrderSelector from './WorkingOrderSelector';
import CategoryCombobox from './CategoryCombobox';
import ShiftTypeCombobox from './ShiftTypeCombobox';
import Avatar from '../Avatar';
import TeamAvatar from '../shared/TeamAvatar';
import DynamicChecklist from './DynamicChecklist';
import TeamUserReassignment from './TeamUserReassignment';
import OrderDocumentMatrixTab from './OrderDocumentMatrixTab';
import TaskReportSection from './TaskReportSection';
import { base44 } from '@/api/base44Client';
const LeaveRequest = base44.entities.LeaveRequest;
import WorkOrderPDFDialog from './WorkOrderPDFDialog';
import TaskTeamAssignment from './TaskTeamAssignment';
import ClientApprovalSection from './ClientApprovalSection';
import GeneralInfoSection from './GeneralInfoSection';
import TasksSection from './TasksSection';
import RepeatingInstructionsSection from './RepeatingInstructionsSection';
import TimeTrackerSection from './TimeTrackerSection';
import DocumentsTab from './DocumentsTab';

// Category color mapping for header background
const categoryColorMap = {
  white: '#ffffff',
  gray: '#6b7280',
  red: '#A2231D',
  yellow: '#ca8a04',
  green: '#16a34a',
  blue: '#2563eb',
  indigo: '#4f46e5',
  purple: '#9333ea',
  pink: '#db2777',
  orange: '#ea580c',
  teal: '#0d9488'
};
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default function WorkOrderDetailsDialog({
  isOpen = false,
  entry,
  onClose,
  onSave,
  onDelete,
  projects = [],
  users = [],
  teams = [],
  customers = [],
  assets = [],
  clientEquipments = [], // ✅ Added
  categories = [],
  shiftTypes = [],
  isReadOnly = false,
  isCreating = false,
  panelWidth = '40%',
  allEntries = [],
  isSaving = false,
  viewBy = 'team',
  onSelectExistingWorkOrder,
  onCreateNewWorkOrder,
  defaultTab = 'order'
}) {
  const safeProjects = Array.isArray(projects) ? projects : [];
  const safeUsers = Array.isArray(users) ? users : [];
  const safeTeams = Array.isArray(teams) ? teams : [];
  const safeCustomers = Array.isArray(customers) ? customers : [];
  const safeAssets = Array.isArray(assets) ? assets : [];
  const safeClientEquipments = Array.isArray(clientEquipments) ? clientEquipments : []; // ✅ Added
  const safeCategories = Array.isArray(categories) ? categories : [];
  const safeShiftTypes = Array.isArray(shiftTypes) ? shiftTypes : [];

  const [formData, setFormData] = useState({
    title: '',
    project_id: '',
    work_order_category_id: '',
    status: 'open',
    task_status: '',
    work_notes: '',
    estimated_duration_hours: 8,
    equipment_ids: [],
    is_repeating: false,
    recurrence_type: 'daily',
    recurrence_end_date: '',
    skip_weekends: false,
    moved_from_sunday: false,
    file_urls: [],
    file_urls_meta: [],
    other_file_urls: [],
    other_file_urls_meta: [],
    tasks: [],
    job_completion_status: '',
    client_feedback_comments: '',
    client_representative_name: '',
    client_representative_phone: ''
  });

  const [expandedTeams, setExpandedTeams] = useState({});

  // Format WO number into 0019/26 regardless of stored pattern
  const formatWONumber = (n) => {
    if (!n) return '';
    const s = String(n).trim();
    if (/^\d{3,4}\/\d{2}$/i.test(s)) return s;
    const m2 = s.match(/^WO-(\d{1,4})\/(\d{2})$/i);
    if (m2) return `${m2[1].padStart(4,'0')}/${m2[2]}`;
    const m3 = s.match(/^WR-(\d{4})-(\d{1,4})$/i);
    if (m3) return `${m3[2].padStart(4,'0')}/${m3[1].slice(-2)}`;
    const m4 = s.match(/^WO-(\d{4})-(\d{1,4})$/i);
    if (m4) return `${m4[2].padStart(4,'0')}/${m4[1].slice(-2)}`;
    // Handle formats like "WO-1/26" with low numbers
    const m5 = s.match(/^WO-(\d+)\/(\d{2})$/i);
    if (m5) return `${m5[1].padStart(4,'0')}/${m5[2]}`;
    return s; // Return as-is if no pattern matches
  };

  // Smart formatter: handles plain numbers and patterns like "N12" using the reference date for year
  const formatWONumberSmart = (n, refISO) => {
    if (!n) return '';
    const s = String(n).trim();
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
  // Entrada “viva” para reflejar start/end del time tracker al abrir
  const [liveEntry, setLiveEntry] = useState(entry);
  const [woTimesheets, setWoTimesheets] = useState([]);
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  const [isUploadingOtherFiles, setIsUploadingOtherFiles] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isSavingLocal, setIsSavingLocal] = useState(false);
  const [approvedLeaves, setApprovedLeaves] = useState([]);
  const [showTeamReassignment, setShowTeamReassignment] = useState(false);
  const [showPDFDialog, setShowPDFDialog] = useState(false);
  const [wrNumber, setWrNumber] = useState(null);
  const [woNumber, setWoNumber] = useState(() => entry?.work_order_number || entry?.work_order_ref || null);
  // Creation mode enabled locally when user picks "+ Create new Working Order"
  const [createMode, setCreateMode] = useState(false);
  
  const sheetContentRef = useRef(null);
  const detailsTabRef = useRef(null);
  const documentsTabRef = useRef(null);
  const activityTabRef = useRef(null);

  // Eliminado logging pesado para mejorar rendimiento al abrir el panel
  useEffect(() => {}, []);

  // Load approved leaves
  useEffect(() => {
    LeaveRequest.filter({ status: 'approved' }).then(setApprovedLeaves).catch(console.error);
  }, []);

  // ✅ Helper: Check if user is available for a specific date/time range
  const isUserAvailableForDate = useCallback((userId, startDate, endDate = null) => {
    const user = safeUsers.find(u => u.id === userId);
    if (!user) return false;
    
    // ✅ Check if user is archived
    if (user.archived) {
      // If archived_date exists, check if the WO date is after archive date
      if (user.archived_date) {
        const archivedDate = new Date(user.archived_date);
        archivedDate.setHours(0, 0, 0, 0);
        const woDate = new Date(startDate);
        woDate.setHours(0, 0, 0, 0);
        if (woDate >= archivedDate) {
          return false; // User was archived before or on this date
        }
      } else {
        // No archived_date, consider user unavailable
        return false;
      }
    }
    
    // ✅ Check if user is on approved leave
    // Allow assignment if WO date is AFTER the leave period ends
    if (!startDate) return true; // No date specified, consider available
    
    try {
      const woDateStr = format(new Date(startDate), 'yyyy-MM-dd');
      const onLeave = approvedLeaves.some(leave => {
        if (leave.employee_id !== userId) return false;
        // User is on leave only if WO date is within the leave period
        return woDateStr >= leave.start_date && woDateStr <= leave.end_date;
      });
      return !onLeave;
    } catch (error) {
      console.warn('Invalid date in isUserAvailableForDate:', startDate);
      return true; // If date is invalid, consider user available
    }
  }, [safeUsers, approvedLeaves]);

  // Helper to check if user is on leave for the selected date
  const isUserOnLeaveForDate = (userId) => {
    if (!formData.planned_start_time) return false;
    try {
      const dateStr = format(new Date(formData.planned_start_time), 'yyyy-MM-dd');
      return approvedLeaves.some(leave => {
        if (leave.employee_id !== userId) return false;
        return dateStr >= leave.start_date && dateStr <= leave.end_date;
      });
    } catch (error) {
      console.warn('Invalid date in isUserOnLeaveForDate:', formData.planned_start_time);
      return false;
    }
  };

  // ✅ Helper: Check if user is archived for the selected date
  const isUserArchivedForDate = (userId) => {
    if (!formData.planned_start_time) return false;
    const user = safeUsers.find(u => u.id === userId);
    if (!user || !user.archived) return false;
    
    if (user.archived_date) {
      const archivedDate = new Date(user.archived_date);
      archivedDate.setHours(0, 0, 0, 0);
      const woDate = new Date(formData.planned_start_time);
      woDate.setHours(0, 0, 0, 0);
      return woDate >= archivedDate;
    }
    
    return user.archived;
  };

  useEffect(() => { 
    setLiveEntry(entry); 
    // Pre-populate woNumber from entry immediately to avoid "(assigning...)" flash
    if (entry?.work_order_number || entry?.work_order_ref) {
      setWoNumber(entry.work_order_number || entry.work_order_ref);
    }
  }, [entry]);

  useEffect(() => {
    if (isOpen && entry?.id) {
      (async () => {
        try {
          const rows = await base44.entities.TimeEntry.filter({ id: entry.id });
          if (Array.isArray(rows) && rows[0]) setLiveEntry(rows[0]);
        } catch (e) {
          // ignore
        }
        // Load timesheets: those with segment for this WO + those clocked on the same task date (to detect overlaps)
        try {
          const ts = await base44.entities.TimesheetEntry.list('-clock_in_time', 200);
          const allTs = Array.isArray(ts) ? ts : [];
          const taskDatesSet = new Set((entry.tasks || []).filter(t => t.date).map(t => t.date));
          const filtered = allTs.filter(t => {
            if ((t.work_order_segments || []).some(seg => seg.work_order_id === entry.id)) return true;
            if (taskDatesSet.size > 0 && t.clock_in_time) {
              try {
                const tsDate = format(parseISO(t.clock_in_time), 'yyyy-MM-dd');
                return taskDatesSet.has(tsDate);
              } catch { return false; }
            }
            return false;
          });
          setWoTimesheets(filtered);
        } catch (e) {
          setWoTimesheets([]);
        }
      })();
    }
  }, [isOpen, entry?.id]);

  // Ensure WR exists with number for this order
  useEffect(() => {
    if (!entry?.id) { setWrNumber(null); return; }
    (async () => {
      try {
        let resolveBranchId = entry?.branch_id || null;
        if (!resolveBranchId) {
          try {
            const projLocal = (safeProjects || []).find(p => p.id === entry?.project_id);
            if (projLocal?.branch_id) {
              resolveBranchId = projLocal.branch_id;
            } else if (entry?.project_id) {
              const arrProj = await base44.entities.Project.filter({ id: entry.project_id }, '-updated_date', 1);
              if (Array.isArray(arrProj) && arrProj[0]?.branch_id) resolveBranchId = arrProj[0].branch_id;
            }
          } catch {}
        }
        const dateRef = entry?.start_time || entry?.planned_start_time || entry?.created_date || new Date().toISOString();
        let arr = await base44.entities.WorkingReport.filter({ time_entry_id: entry.id });
        arr = Array.isArray(arr) ? arr : [];
        // If no Clock In, do not create nor number WR; show existing only
        if (!entry?.start_time) {
          if (arr.length > 0) {
            const sorted = [...arr].sort((a,b) => {
              const ta = new Date(a.start_time || a.created_date || 0).getTime();
              const tb = new Date(b.start_time || b.created_date || 0).getTime();
              return tb - ta;
            });
            const latest = sorted[0];
            setWrNumber(latest?.report_number || null);
          } else {
            setWrNumber(null);
          }
          return;
        }
        if (arr.length === 0) {
          let code = null;
          if (resolveBranchId) {
            const res = await base44.functions.invoke('getNextWorkingReportNumber', { branch_id: resolveBranchId, date: dateRef });
            code = res?.data || null;
          }
          // Extract employee_ids and team_ids from all tasks
          const allEmployeeIds = new Set();
          const allTeamIds = new Set();
          (entry?.tasks || []).forEach(task => {
            (task.employee_ids || []).forEach(id => allEmployeeIds.add(id));
            (task.team_ids || []).forEach(id => allTeamIds.add(id));
          });

          await base44.entities.WorkingReport.create({
            time_entry_id: entry.id,
            branch_id: resolveBranchId,
            report_number: code,
            start_time: entry?.start_time || null,
            end_time: entry?.end_time || null,
            duration_minutes: entry?.duration_minutes || null,
            team_ids: Array.from(allTeamIds),
            employee_ids: Array.from(allEmployeeIds),
            status: 'draft'
          });
          setWrNumber(code);
        } else {
          const sorted = [...arr].sort((a,b) => {
            const ta = new Date(a.start_time || a.created_date || 0).getTime();
            const tb = new Date(b.start_time || b.created_date || 0).getTime();
            return tb - ta;
          });
          const latest = sorted[0];
          if (latest.report_number) setWrNumber(latest.report_number);
          else {
            let code = null;
            if (resolveBranchId) {
              const res = await base44.functions.invoke('getNextWorkingReportNumber', { branch_id: resolveBranchId, date: dateRef });
              code = res?.data || null;
            }
            await base44.entities.WorkingReport.update(latest.id, { report_number: code });
            setWrNumber(code);
          }
        }
      } catch { setWrNumber(null); }

      // Ensure a valid WO number exists; if invalid/missing, assign one now
      try {
        const rows = await base44.entities.TimeEntry.filter({ id: entry.id });
        const latestWO = rows?.[0] || entry;
        let current = latestWO?.work_order_number || null;
        const valid = /^\d{4}\/\d{2}$/.test(String(current || '').trim());
        
        console.log('🔍 [WO NUMBER CHECK]', {
          entryId: entry.id?.slice(0, 8),
          currentNumber: current,
          isValid: valid,
          entryBranchId: entry.branch_id,
          projectId: entry.project_id
        });
        
        if (!valid) {
          // Get branch_id from entry or project
          let branch = entry?.branch_id;
          if (!branch) {
            const project = safeProjects.find(p => p.id === entry.project_id);
            branch = project?.branch_id;
          }
          
          console.log('📝 [WO NUMBER] Attempting to assign number with branch:', branch);
          
          if (branch) {
            const dateRef = entry?.created_date || entry?.planned_start_time || entry?.start_time || new Date().toISOString();
            const res = await base44.functions.invoke('getNextWorkOrderNumberAtomic', { branch_id: branch, date: dateRef });
            const won = typeof res.data === 'string' ? res.data : (res.data?.work_order_number || res.data?.number || null);
            
            console.log('✅ [WO NUMBER] Got number from backend:', won);
            
            if (won && /^\d{4}\/\d{2}$/.test(String(won))) {
              await base44.entities.TimeEntry.update(entry.id, { work_order_number: won });
              current = won;
              console.log('✅ [WO NUMBER] Updated work order with number:', won);
            }
          } else {
            console.warn('⚠️ [WO NUMBER] No branch_id available - cannot assign number');
          }
        }
        setWoNumber(current || null);
      } catch (err) { 
        console.error('❌ [WO NUMBER] Error assigning number:', err);
        setWoNumber(null); 
      }
    })();
  }, [entry?.id, entry?.project_id, isOpen, safeProjects]);

  useEffect(() => {
    if (entry) {
      console.log('📂 [INIT] Entry loaded:', {
        id: entry.id,
        title: entry.title,
        tasksCount: entry.tasks?.length,
        tasksData: entry.tasks
      });
      
      const initialData = {
        ...entry,
        equipment_ids: entry.equipment_ids || [],
        file_urls: entry.file_urls || [],
        file_urls_meta: entry.file_urls_meta || [],
        other_file_urls: entry.other_file_urls || [],
        other_file_urls_meta: entry.other_file_urls_meta || [],
        estimated_duration_hours: entry.estimated_duration_hours || 8,
        is_repeating: entry.is_repeating || false,
        recurrence_type: entry.recurrence_type || 'daily',
        recurrence_end_date: entry.recurrence_end_date || '',
        skip_weekends: entry.skip_weekends || false,
        moved_from_sunday: entry.moved_from_sunday || false,
        tasks: (entry.tasks || []).map(task => ({
          ...task,
          date: task.date || '',
          employee_ids: task.employee_ids || [],
          team_ids: task.team_ids || [],
          work_done_items: task.work_done_items || [],
          spare_parts_items: task.spare_parts_items || [],
          work_pending_items: task.work_pending_items || [],
          spare_parts_pending_items: task.spare_parts_pending_items || [],
          other_file_urls: task.other_file_urls || []
        })),
        job_completion_status: entry.job_completion_status || '',
        client_feedback_comments: entry.client_feedback_comments || '',
        client_representative_name: entry.client_representative_name || '',
        client_representative_phone: entry.client_representative_phone || ''
      };
      
      setFormData(initialData);
      const pendingIds = (entry.tasks || []).filter(t => !t.status || t.status === 'pending').reduce((acc, task) => ({ ...acc, [task.id]: true }), {});
      setExpandedTeams(pendingIds);
    } else {
      const initialData = {
        title: '',
        project_id: '',
        work_order_category_id: '',
        status: 'open',
        task_status: '',
        work_notes: '',
        estimated_duration_hours: 8,
        equipment_ids: [],
        is_repeating: false,
        recurrence_type: 'daily',
        recurrence_end_date: '',
        skip_weekends: false,
        moved_from_sunday: false,
        file_urls: [],
        file_urls_meta: [],
        other_file_urls: [],
        other_file_urls_meta: [],
        tasks: [],
        job_completion_status: '',
        client_feedback_comments: '',
        client_representative_name: '',
        client_representative_phone: ''
      };
      setFormData(initialData);
      setExpandedTeams({});
    }
  }, [entry, isOpen]);

  const selectedProject = safeProjects.find(p => p.id === formData.project_id);
  const selectedCustomer = selectedProject ? safeCustomers.find(c => c.id === selectedProject.customer_id) : null;



  const openWorkOrders = React.useMemo(() => {
  const list = Array.isArray(allEntries) ? allEntries : [];
  const filtered = list.filter(e => {
    const s = (e.status || '').toLowerCase();
    const isOpen = s === 'open' || s === '';
    const matchProject = !formData.project_id || e.project_id === formData.project_id;
    const notArchived = !e.archived;
    return isOpen && matchProject && notArchived;
  });

    // Agrupar por (proyecto + título normalizado) y quedarse con la fecha de creación más antigua
    const groups = new Map();
    const norm = (s) => (s || '').trim().toLowerCase();

    filtered.forEach(e => {
      const key = `${e.project_id || ''}||${norm(e.title)}`;
      const created = e.created_date || e.updated_date || e.planned_start_time || null;
      if (!groups.has(key)) {
        groups.set(key, { first: e, earliest: created });
      } else {
        const g = groups.get(key);
        // Actualizar si encontramos una fecha más antigua
        if (created && g.earliest && new Date(created) < new Date(g.earliest)) {
          g.earliest = created;
          g.first = e; // conservar un id representativo
        }
        if (!g.earliest && created) {
          g.earliest = created;
        }
      }
    });

    // Devolver una lista deduplicada, conservando _earliest_created para mostrar
    return Array.from(groups.values()).map(g => ({ ...g.first, _earliest_created: g.earliest }));
  }, [allEntries, formData.project_id]);

  // ✅ Get first team from tasks for sequence calculation
  const getWorkOrderSequence = () => {
    if (!entry?.planned_start_time) {
      return null;
    }

    try {
      const entryDate = parseISO(entry.planned_start_time);
      
      // Extract first team from first task
      const firstTask = (entry.tasks || [])[0];
      const entryTeamId = firstTask && firstTask.team_ids && firstTask.team_ids.length > 0 
        ? firstTask.team_ids[0] 
        : null;

      if (!entryTeamId) return null;

      // Filter entries for same day and same team (from first task)
      const dayEntries = (allEntries || []).filter(e => {
        if (!e.planned_start_time) return false;
        
        const eDate = parseISO(e.planned_start_time);
        if (!isSameDay(eDate, entryDate)) return false;
        
        const eFirstTask = (e.tasks || [])[0];
        const eTeamId = eFirstTask && eFirstTask.team_ids && eFirstTask.team_ids.length > 0
          ? eFirstTask.team_ids[0]
          : null;
        return eTeamId === entryTeamId;
      });

      dayEntries.sort((a, b) => {
        const timeA = a.planned_start_time ? parseISO(a.planned_start_time).getTime() : 0;
        const timeB = b.planned_start_time ? parseISO(b.planned_start_time).getTime() : 0;
        return timeA - timeB;
      });

      const position = dayEntries.findIndex(e => e.id === entry.id) + 1;
      const total = dayEntries.length;

      return { position, total };
    } catch (error) {
      console.warn('Error calculating WO sequence:', error);
      return null;
    }
  };

  const woSequence = getWorkOrderSequence();

  const handleFileUpload = async (event, fileType = 'working_reports') => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    if (fileType === 'working_reports') {
      setIsUploadingFiles(true);
    } else {
      setIsUploadingOtherFiles(true);
    }

    try {
      const uploadedUrls = [];
      
      for (const file of files) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file }); 
        uploadedUrls.push(file_url);
      }

      if (fileType === 'working_reports') {
        setFormData(prev => ({
          ...prev,
          file_urls: [...(prev.file_urls || []), ...uploadedUrls]
        }));
      } else {
        setFormData(prev => ({
          ...prev,
          other_file_urls: [...(prev.other_file_urls || []), ...uploadedUrls]
        }));
      }

      toast.success(`${files.length} file(s) uploaded successfully`);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload files');
    } finally {
      if (fileType === 'working_reports') {
        setIsUploadingFiles(false);
      } else {
        setIsUploadingOtherFiles(false);
      }
      event.target.value = '';
    }
  };

  const handleRemoveFile = (indexToRemove, fileType = 'working_reports') => {
    if (fileType === 'working_reports') {
      setFormData(prev => ({
        ...prev,
        file_urls: (prev.file_urls || []).filter((_, index) => index !== indexToRemove)
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        other_file_urls: (prev.other_file_urls || []).filter((_, index) => index !== indexToRemove)
      }));
    }
    toast.success('File removed');
  };

  const resetFormKeepingProject = () => {
    setFormData({
      title: '',
      project_id: formData.project_id,
      work_order_category_id: formData.work_order_category_id,
      status: 'open',
      task_status: '',
      work_notes: '',
      estimated_duration_hours: 8,
      equipment_ids: [],
      is_repeating: false,
      recurrence_type: 'daily',
      recurrence_end_date: '',
      skip_weekends: false,
      moved_from_sunday: false,
      file_urls: [],
      tasks: [],
      job_completion_status: '',
      client_feedback_comments: '',
      client_representative_name: '',
      client_representative_phone: ''
    });
    setExpandedTeams({});
  };

  const handleSave = async (andAddAnother = false) => {
    if (isSaving || isSavingLocal) {
      console.log('⏳ [DIALOG SAVE] Already saving, ignoring click');
      return;
    }

    console.log('💾 [DIALOG SAVE] Starting save...');
    console.log('   isSaving:', isSaving);
    console.log('   isSavingLocal:', isSavingLocal);
    console.log('   entry?.id:', entry?.id);
    console.log('   formData.id:', formData.id);
    
    if (!formData.project_id) {
      console.log('❌ [VALIDATION] No project_id');
      toast.error('Please select a project');
      return;
    }
    console.log('✅ [VALIDATION] project_id OK:', formData.project_id);

    // Category is optional - only validate if not editing existing (in edit mode, keep existing category)
    if (!entry?.id && !formData.work_order_category_id) {
      console.log('⚠️ [VALIDATION] No work_order_category_id for new WO - optional in edit mode');
      // For new WOs, category should be set, but let's allow saving anyway
    }
    if (formData.work_order_category_id) {
      console.log('✅ [VALIDATION] work_order_category_id OK:', formData.work_order_category_id);
    }
    
    // If there are tasks, validate them - but allow saving without tasks
    if (formData.tasks && formData.tasks.length > 0) {
      console.log('✅ [VALIDATION] Validating tasks:', formData.tasks.length);
      for (const task of formData.tasks) {
        console.log('   🔍 Checking task:', task.name, { date: task.date, start: task.start_time, end: task.end_time, employees: task.employee_ids?.length });
        
        if (!task.name) {
          console.log('❌ [VALIDATION] Task missing name');
          toast.error('All tasks must have a name');
          return;
        }
        if (!task.date || !task.start_time || !task.end_time) {
          console.log('❌ [VALIDATION] Task missing times:', { date: task.date, start: task.start_time, end: task.end_time });
          toast.error(`Task "${task.name}" must have date, start time and end time`);
          return;
        }
        if (!task.employee_ids || task.employee_ids.length === 0) {
          console.log('❌ [VALIDATION] Task missing employees');
          toast.error(`Task "${task.name}" must have at least one worker assigned`);
          return;
        }
      }
      console.log('✅ [VALIDATION] All tasks OK');
    }
    
    console.log('✅ [DIALOG SAVE] Validation PASSED');
    
    // ✅ CRITICAL DEBUG: Log full formData before sync
    console.log('🔍 [PRE-SYNC] formData FULL:', {
      id: formData.id,
      title: formData.title,
      tasks: formData.tasks?.map(t => ({
        name: t.name,
        date: t.date,
        start: t.start_time,
        end: t.end_time,
        team_ids: t.team_ids,
        employee_ids: t.employee_ids
      }))
    });
    
    // ✅ CRITICAL: Sync WO-level team_ids and employee_ids from ALL tasks before saving
    const allTaskTeamIds = new Set();
    const allTaskEmployeeIds = new Set();
    
    formData.tasks.forEach(task => {
      (task.team_ids || []).forEach(tid => allTaskTeamIds.add(tid));
      (task.employee_ids || []).forEach(eid => allTaskEmployeeIds.add(eid));
    });
    
    // ✅ CRITICAL: Calculate planned_start_time and planned_end_time from tasks
    let calculatedStartTime = formData.planned_start_time;
    let calculatedEndTime = formData.planned_end_time;
    
    if (formData.tasks && formData.tasks.length > 0) {
      // Sort tasks by date and start_time to find earliest and latest
      const sortedTasks = [...formData.tasks].sort((a, b) => {
        const dateA = a.date ? `${a.date}T${a.start_time || '00:00'}:00` : null;
        const dateB = b.date ? `${b.date}T${b.start_time || '00:00'}:00` : null;
        if (!dateA) return 1;
        if (!dateB) return -1;
        return dateA.localeCompare(dateB);
      });
      
      const firstTask = sortedTasks[0];
      const lastTask = sortedTasks[sortedTasks.length - 1];
      
      if (firstTask.date && firstTask.start_time) {
        // ✅ FIX: Create proper local date without adding Z
        const localStart = new Date(`${firstTask.date}T${firstTask.start_time}:00`);
        calculatedStartTime = localStart.toISOString();
      }
      
      if (lastTask.date && lastTask.end_time) {
        // ✅ FIX: Create proper local date without adding Z
        const localEnd = new Date(`${lastTask.date}T${lastTask.end_time}:00`);
        calculatedEndTime = localEnd.toISOString();
      }
      
      console.log('✅ [CALCULATED TIMES]', {
        start: calculatedStartTime,
        end: calculatedEndTime,
        firstTaskDate: firstTask.date,
        lastTaskDate: lastTask.date
      });
    } else {
      console.log('⚠️ [NO TASKS] No tasks to calculate times from');
    }
    
    const syncedFormData = {
      ...formData,
      id: formData.id || entry?.id,
      team_ids: Array.from(allTaskTeamIds),
      employee_ids: Array.from(allTaskEmployeeIds),
      planned_start_time: calculatedStartTime,
      planned_end_time: calculatedEndTime
    };
    
    console.log('🚀 [DIALOG SAVE] FULL SYNCED DATA:', {
      id: syncedFormData.id,
      title: syncedFormData.title,
      project_id: syncedFormData.project_id,
      work_order_category_id: syncedFormData.work_order_category_id,
      planned_start_time: syncedFormData.planned_start_time,
      planned_end_time: syncedFormData.planned_end_time,
      team_ids: syncedFormData.team_ids,
      employee_ids: syncedFormData.employee_ids,
      tasks: syncedFormData.tasks?.map(t => ({
        name: t.name,
        date: t.date,
        start_time: t.start_time,
        end_time: t.end_time,
        team_ids: t.team_ids,
        employee_ids: t.employee_ids
      }))
    });
    console.log('✅ [DIALOG SAVE] Calling onSave callback...');
    
    try {
      setIsSavingLocal(true);
      console.log('🔄 [DIALOG SAVE] isSavingLocal set to true');
      
      if (!onSave || typeof onSave !== 'function') {
        throw new Error('onSave callback is not defined');
      }
      
      const result = await onSave(syncedFormData, { keepOpen: andAddAnother });
       console.log('✅ [DIALOG SAVE] onSave returned:', result);

       if (andAddAnother) {
         resetFormKeepingProject();
         toast.success('Work order created. Add the next one.');
       } else {
         toast.success(entry?.id ? 'Work order updated successfully' : 'Work order created successfully');
         console.log('🚀 [DIALOG SAVE] Closing dialog...');
         onClose();
         console.log('✅ [DIALOG SAVE] Dialog closed');
       }
    } catch (error) {
      console.error('❌ [DIALOG SAVE] Error:', error.message);
      toast.error(error.message || 'Failed to save');
    } finally {
      setIsSavingLocal(false);
      console.log('🔄 [DIALOG SAVE] isSavingLocal set to false');
    }
  };

  const handleDelete = () => {
    if (!onDelete || typeof onDelete !== 'function') {
      console.error('❌ onDelete is not a function:', onDelete);
      toast.error('Delete function not available');
      return;
    }

    if (!entry?.id) {
      console.error('❌ No work order ID to delete');
      toast.error('Cannot delete: Work order ID not found');
      return;
    }

    console.log('🗑️ [DELETE] User clicked delete for work order:', {
      id: entry.id,
      title: entry.title,
      work_order_number: entry.work_order_number
    });
    
    if (window.confirm(`Are you sure you want to delete this work order?\n\nOrder: ${entry.work_order_number || 'N/A'}\nTitle: ${entry.title || 'Untitled'}\n\nThis action cannot be undone.`)) {
      console.log('🗑️ [DELETE] User confirmed, deleting ONLY work order:', entry.id);
      onDelete(entry.id);
    } else {
      console.log('ℹ️ [DELETE] User cancelled deletion');
    }
  };

  const handleExportPDF = async () => {
    const { handleExportPDFClick } = await import('./WorkOrderPDFHandler');
    await handleExportPDFClick(entry, selectedProject, selectedCustomer, projectAssets, safeUsers, safeTeams, safeCategories, setShowPDFDialog, setIsGeneratingPDF, safeShiftTypes);
  };

  // Get header background color from category
  const getHeaderBackgroundColor = () => {
    if (formData.work_order_category_id) {
      const category = safeCategories.find(c => c.id === formData.work_order_category_id);
      if (category && category.color) {
        return categoryColorMap[category.color] || '#A2231D';
      }
    }
    return '#A2231D'; // Default dark red
  };



  const handleShiftTypeChange = (shiftTypeId) => {
    const selectedShift = safeShiftTypes.find(s => s.id === shiftTypeId);

    if (selectedShift && selectedShift.start_time && selectedShift.end_time) {
      const [startHours, startMinutes] = selectedShift.start_time.split(':').map(Number);
      const [endHours, endMinutes] = selectedShift.end_time.split(':').map(Number);

      let durationHours = endHours - startHours + (endMinutes - startMinutes) / 60;
      if (durationHours < 0) durationHours += 24;

      setFormData({
        ...formData,
        shift_type_id: shiftTypeId,
        estimated_duration_hours: durationHours
      });
    } else {
      setFormData({ ...formData, shift_type_id: shiftTypeId });
    }
  };

  const projectAssets = useMemo(() => {
    // Fallback: todos los equipos (compañía + cliente)
    const allCombined = [...safeAssets, ...safeClientEquipments].filter(Boolean);

    // Si no hay proyecto seleccionado, mostrar todos los equipos para que siempre se pueda asignar
    if (!formData.project_id) return allCombined;
    
    const selectedProject = safeProjects.find(p => p.id === formData.project_id);
    
    // 1) Activos de la compañía vinculados al proyecto
    const companyAssets = safeAssets.filter(a => a.project_id === formData.project_id);
    
    // 2) Equipos del cliente vinculados al proyecto
    const clientEquipmentsByProjectId = safeClientEquipments.filter(e => e.project_id === formData.project_id);
    
    // 3) Equipos del cliente vinculados vía project.client_equipment_ids
    let clientEquipmentsByLink = [];
    if (selectedProject && Array.isArray(selectedProject.client_equipment_ids) && selectedProject.client_equipment_ids.length > 0) {
      const linkedEquipmentIds = selectedProject.client_equipment_ids;
      clientEquipmentsByLink = safeClientEquipments.filter(e => {
        const isLinked = linkedEquipmentIds.includes(e.id);
        const notAlreadyIncluded = !clientEquipmentsByProjectId.some(ce => ce.id === e.id);
        return isLinked && notAlreadyIncluded;
      });
    }

    // Combinar y desduplicar por id
    const combined = [...companyAssets, ...clientEquipmentsByProjectId, ...clientEquipmentsByLink];
    const unique = combined.filter((item, index, self) => index === self.findIndex(t => t.id === item.id));

    // Si no hay nada vinculado, NO mostrar ningún equipo
    return unique.length > 0 ? unique : [];
  }, [safeAssets, safeClientEquipments, formData.project_id, safeProjects]);

  const handleEquipmentToggle = (equipmentId) => {
    const currentEquipment = formData.equipment_ids || [];
    const newEquipment = currentEquipment.includes(equipmentId)
      ? currentEquipment.filter(id => id !== equipmentId)
      : [...currentEquipment, equipmentId];
    setFormData({ ...formData, equipment_ids: newEquipment });
  };

  const handleTeamToggle = (teamId) => {
    const currentTeamIds = formData.team_ids || [];
    const currentEmployeeIds = formData.employee_ids || [];

    const isSelected = currentTeamIds.includes(teamId);
    // ✅ Filter archived users AND users on leave for this date
    const teamUsers = safeUsers
      .filter(u => u.team_id === teamId && isUserAvailableForDate(u.id, formData.planned_start_time))
      .map(u => u.id);

    if (isSelected) {
      // Remove team and all its users
      setFormData({
        ...formData,
        team_ids: currentTeamIds.filter(id => id !== teamId),
        employee_ids: currentEmployeeIds.filter(id => !teamUsers.includes(id))
      });
      setExpandedTeams(prev => ({ ...prev, [teamId]: false }));
    } else {
      // Add team and ONLY its users (remove duplicates from other teams first)
      const otherTeamsUserIds = safeUsers
        .filter(u => currentTeamIds.includes(u.team_id) && u.team_id !== teamId)
        .map(u => u.id);
      
      // Remove users that belong to other selected teams, then add this team's users
      const cleanedEmployeeIds = currentEmployeeIds.filter(id => !otherTeamsUserIds.includes(id));
      
      setFormData({
        ...formData,
        team_ids: [...currentTeamIds, teamId],
        employee_ids: [...new Set([...cleanedEmployeeIds, ...teamUsers])]
      });
      setExpandedTeams(prev => ({ ...prev, [teamId]: true }));
    }
  };

  const handleUserToggle = (userId) => {
    const currentEmployeeIds = formData.employee_ids || [];
    const currentTeamIds = formData.team_ids || [];
    
    const isAddingUser = !currentEmployeeIds.includes(userId);
    const newEmployeeIds = isAddingUser
      ? [...currentEmployeeIds, userId]
      : currentEmployeeIds.filter(id => id !== userId);

    let newTeamIds = [...currentTeamIds];
    const user = safeUsers.find(u => u.id === userId);
    
    if (user && user.team_id) {
      if (isAddingUser) {
        // User is being added
        if (!newTeamIds.includes(user.team_id)) {
          newTeamIds.push(user.team_id);
          console.log(`✅ [AUTO-ASSIGN] Added team ${user.team_id} for user ${userId}`);
          toast.info(`Team automatically assigned for ${user.nickname || user.first_name || 'user'}`);
        }
      } else {
        // User is being removed
        // ✅ Filter available users (not archived, not on leave)
        const otherUsersFromSameTeam = newEmployeeIds.filter(id => {
          const otherUser = safeUsers.find(u => u.id === id);
          if (!otherUser || otherUser.team_id !== user.team_id) return false;
          return isUserAvailableForDate(id, formData.planned_start_time);
        });
        
        if (otherUsersFromSameTeam.length === 0 && newTeamIds.includes(user.team_id)) {
          // No more users from that team are selected, remove the team
          newTeamIds = newTeamIds.filter(id => id !== user.team_id);
          console.log(`🗑️ [AUTO-REMOVE] Removed team ${user.team_id} - no more users from this team are selected.`);
        }
      }
    }

    setFormData({ 
      ...formData, 
      employee_ids: newEmployeeIds,
      team_ids: newTeamIds
    });
  };

  const toggleTeamExpansion = (teamId) => {
    setExpandedTeams(prev => ({ ...prev, [teamId]: !prev[teamId] }));
  };

  const handleRemoveTeam = (teamId) => {
    // ✅ Filter available users (not archived, not on leave)
    const teamUsers = safeUsers
      .filter(u => u.team_id === teamId && isUserAvailableForDate(u.id, formData.planned_start_time))
      .map(u => u.id);
    setFormData({
      ...formData,
      team_ids: (formData.team_ids || []).filter(id => id !== teamId),
      employee_ids: (formData.employee_ids || []).filter(id => !teamUsers.includes(id))
    });
    setExpandedTeams(prev => ({ ...prev, [teamId]: false }));
  };

  const selectedTeams = safeTeams.filter(t => (formData.team_ids || []).includes(t.id));

  return (
  <>
  <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent
        ref={sheetContentRef}
        side="right"
        className="w-full sm:max-w-[60vw] p-0 flex flex-col overflow-hidden"
        hideCloseButton
      >
        <SheetHeader className="px-6 py-3 border-b flex-shrink-0" style={{ backgroundColor: getHeaderBackgroundColor() }}>
          <div className="space-y-1.5">
            {/* Row 1: Title */}
            <div className="flex items-center justify-between">
            <SheetTitle className="text-lg font-bold text-white">
              Working Order Instructions
            </SheetTitle>
            <div className="flex items-center gap-2">
              {!isCreating && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportPDF}
                  disabled={isGeneratingPDF}
                  className="h-8 gap-1.5 text-xs bg-white/20 hover:bg-white/30 text-white border-white/30"
                >
                  {isGeneratingPDF ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Eye className="w-3 h-3" />
                  )}
                  View PDF
                </Button>
              )}
              <span className="text-xs text-white/80">Order status:</span>
              <Select
                value={formData.status || 'open'}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
                disabled={isReadOnly}
              >
                <SelectTrigger className={cn(
                  "h-8 w-28 text-xs border-0",
                  formData.status === 'open' ? "bg-green-500 text-white" : "bg-slate-400 text-white"
                )}>
                  <SelectValue>
                    {formData.status === 'open' ? 'Open' : 'Closed'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            </div>
            
            {/* Row 2: Report number + meta */}
            {!isCreating && (
              <div className="text-white/90 space-y-0.5">
                <div className="text-sm font-medium">
                  Working order N: {(() => {
                    const n = woNumber || entry?.work_order_number || entry?.work_order_ref;
                    if (n) return formatWONumberSmart(n, entry?.start_time || entry?.planned_start_time || entry?.created_date);
                    // If no number at all and we're still loading, show spinner
                    return <span className="opacity-60 italic text-xs text-white/50">9999/99</span>;
                  })()}
                </div>
                <div className="text-sm font-medium">
                  {`Working report N: ${wrNumber || '-'}`}
                </div>
                <div className="text-xs text-white/80">
                  {`Working Order: ${entry?.title || 'Untitled'}, created on ${
                    entry?.created_date ? format(new Date(entry.created_date), 'dd/MM/yy') : format(new Date(), 'dd/MM/yy')
                  }.`}
                </div>
                {formData.moved_from_sunday && (
                  <Badge variant="outline" className="bg-orange-500/30 text-orange-200 border-orange-400 text-[10px] h-5">
                    ⚠️ Moved from Sunday
                  </Badge>
                )}
              </div>
            )}

            {/* Row 3: Customer, Project, Category, Users */}
            {!isCreating && (
              <div className="text-xs text-white/80 space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Order (equipment) first */}
                  {formData.equipment_ids && formData.equipment_ids.length > 0 && (() => {
                    const id = formData.equipment_ids[0];
                    const eq = safeAssets.find(a => a.id === id) || safeClientEquipments.find(e => e.id === id);
                    return eq ? (
                      <span className="font-medium text-white">Order: {eq.name}</span>
                    ) : null;
                  })()}
                  {selectedProject && (
                    <>
                      <span className="text-white/50">•</span>
                      <span>{selectedProject.name}</span>
                    </>
                  )}
                  {selectedCustomer && (
                    <>
                      <span className="text-white/50">•</span>
                      <span className="font-medium text-white">{selectedCustomer.name}</span>
                    </>
                  )}
                  {formData.work_order_category_id && (() => {
                    const category = safeCategories.find(c => c.id === formData.work_order_category_id);
                    return category ? (
                      <>
                        <span className="text-white/50">•</span>
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5 bg-white/20 border-white/40 text-white">
                          {category.name}
                        </Badge>
                      </>
                    ) : null;
                  })()}
                </div>
                {formData.tasks && formData.tasks.length > 0 && (() => {
                  const allAssignedUserIds = new Set();
                  formData.tasks.forEach(task => {
                    (task.employee_ids || []).forEach(id => allAssignedUserIds.add(id));
                  });
                  if (allAssignedUserIds.size === 0) return null;
                  
                  return (
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="text-white/80">Workers assigned:</span>
                      <span className="text-white/90">
                        {Array.from(allAssignedUserIds)
                          .map(userId => {
                            const user = safeUsers.find(u => u.id === userId);
                            if (!user) return null;
                            return user.nickname || user.first_name || user.full_name?.split(' ')[0] || user.email;
                          })
                          .filter(Boolean)
                          .join(', ')
                        }
                      </span>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </SheetHeader>
        <Tabs defaultValue={defaultTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="bg-slate-100 rounded-none p-0 h-auto flex-shrink-0 px-4 shadow-md border-b-4 border-indigo-300">
            <TabsTrigger
              value="order"
              className="relative rounded-t-lg data-[state=active]:bg-white data-[state=active]:shadow-lg px-6 py-3 mx-1 data-[state=active]:border-t-4 data-[state=active]:border-indigo-600 data-[state=active]:-mb-[4px] transition-all font-semibold"
            >
              📋 Order
            </TabsTrigger>
            <TabsTrigger
              value="report"
              className="relative rounded-t-lg data-[state=active]:bg-white data-[state=active]:shadow-lg px-6 py-3 mx-1 data-[state=active]:border-t-4 data-[state=active]:border-blue-600 data-[state=active]:-mb-[4px] transition-all font-semibold"
            >
              📱 Reports
            </TabsTrigger>
            <TabsTrigger
              value="documents"
              className="relative rounded-t-lg data-[state=active]:bg-white data-[state=active]:shadow-lg px-6 py-3 mx-1 data-[state=active]:border-t-4 data-[state=active]:border-green-600 data-[state=active]:-mb-[4px] transition-all font-semibold"
            >
              📁 Documents
            </TabsTrigger>
            {!isCreating && (
              <TabsTrigger
                value="activity"
                className="relative rounded-t-lg data-[state=active]:bg-white data-[state=active]:shadow-lg px-6 py-3 mx-1 data-[state=active]:border-t-4 data-[state=active]:border-purple-600 data-[state=active]:-mb-[4px] transition-all font-semibold"
              >
                📝 Historial & Notes
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent 
            ref={detailsTabRef} 
            value="order" 
              className="p-6 space-y-6 mt-0 flex-1 overflow-y-auto"

          >

            <GeneralInfoSection
              formData={formData}
              setFormData={setFormData}
              safeProjects={safeProjects}
              safeCustomers={safeCustomers}
              safeAssets={safeAssets}
              safeClientEquipments={safeClientEquipments}
              safeCategories={safeCategories}
              openWorkOrders={openWorkOrders}
              isReadOnly={isReadOnly}
              createMode={createMode}
              setCreateMode={setCreateMode}
              onSelectExistingWorkOrder={onSelectExistingWorkOrder}
              onCreateNewWorkOrder={onCreateNewWorkOrder}
              projectAssets={projectAssets}
            />

            <TasksSection
              formData={formData}
              setFormData={setFormData}
              safeShiftTypes={safeShiftTypes}
              safeTeams={safeTeams}
              safeUsers={safeUsers}
              isReadOnly={isReadOnly}
              createMode={createMode}
              expandedTeams={expandedTeams}
              setExpandedTeams={setExpandedTeams}
              isUserAvailableForDate={isUserAvailableForDate}
            />

            <RepeatingInstructionsSection
              formData={formData}
              setFormData={setFormData}
              isReadOnly={isReadOnly || !!entry?.id}
              createMode={createMode}
            />





          </TabsContent>

          <TabsContent 
            ref={documentsTabRef} 
            value="report" 
            className="p-6 space-y-6 mt-0 flex-1 overflow-y-auto"
          >
            <TaskReportSection
              formData={formData}
              setFormData={setFormData}
              isReadOnly={isReadOnly}
              createMode={createMode}
              isUploadingOtherFiles={isUploadingOtherFiles}
              setIsUploadingOtherFiles={setIsUploadingOtherFiles}
              clientSignatureUrl={formData.client_signature_url}
              safeUsers={safeUsers}
            />

            <TimeTrackerSection
              formData={formData}
              entry={entry}
              woTimesheets={woTimesheets}
              safeUsers={safeUsers}
            />

            <ClientApprovalSection
              formData={formData}
              setFormData={setFormData}
              isReadOnly={isReadOnly}
              createMode={createMode}
            />
          </TabsContent>

          <TabsContent 
            value="documents" 
            className="p-0 mt-0 flex-1 overflow-y-auto"
          >
            <DocumentsTab
              formData={formData}
              setFormData={setFormData}
              isReadOnly={isReadOnly}
              handleRemoveFile={handleRemoveFile}
              entry={liveEntry || entry}
              handleExportPDF={handleExportPDF}
            />
          </TabsContent>

          <TabsContent 
            ref={activityTabRef} 
            value="activity" 
            className="p-6 mt-0 flex-1"
            style={{ 
              overflowY: 'scroll',
              maxHeight: '100%',
              height: '100%',
              display: 'block'
            }}
          >
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="text-xs font-semibold">Date</TableHead>
                    <TableHead className="text-xs font-semibold">User</TableHead>
                    <TableHead className="text-xs font-semibold">Action</TableHead>
                    <TableHead className="text-xs font-semibold">Detail</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(() => {
                    // Collect all activity entries from different sources
                    const allActivities = [];
                    
                    // 1. Activity log entries (most detailed)
                    if (entry?.activity_log && Array.isArray(entry.activity_log) && entry.activity_log.length > 0) {
                      entry.activity_log.forEach((log, idx) => {
                        let displayName = log.user_name;
                        
                        if (!displayName && log.user_email) {
                          const user = safeUsers.find(u => u.email === log.user_email);
                          if (user) {
                            displayName = user.nickname || user.first_name || user.full_name || user.email;
                          } else {
                            displayName = log.user_email;
                          }
                        }
                        
                        if (!displayName) {
                          displayName = 'System';
                        }

                        allActivities.push({
                          timestamp: log.timestamp,
                          user: displayName,
                          action: log.action,
                          details: log.details || `${entry.work_order_number || 'Work order'} ${log.action?.toLowerCase()}.`,
                          isLegacy: displayName === 'System'
                        });
                      });
                    }
                    
                    // 2. Created entry (if not already in activity_log)
                    if (entry?.created_date) {
                      const alreadyInLog = allActivities.some(a => a.action === 'Created');
                      if (!alreadyInLog) {
                        let creatorName = 'System';
                        let isLegacy = true;
                        let creatorEmail = entry.created_by;
                        
                        if (creatorEmail) {
                          const user = safeUsers.find(u => u.email === creatorEmail);
                          if (user) {
                            creatorName = user.nickname || user.first_name || user.full_name || user.email;
                            isLegacy = false;
                          } else {
                            creatorName = creatorEmail;
                            isLegacy = false;
                          }
                        }

                        allActivities.push({
                          timestamp: entry.created_date,
                          user: creatorName,
                          action: 'Created',
                          details: entry.work_order_number ? `Work order ${formatWONumberSmart(entry.work_order_number, entry.created_date)} created.` : 'Work order created.',
                          isLegacy
                        });
                      }
                    }
                    
                    // 3. Updated entry (if different from created)
                    if (entry?.updated_date && entry?.created_date && entry.updated_date !== entry.created_date) {
                      const alreadyInLog = allActivities.some(a => 
                        a.action === 'Edited' && a.timestamp === entry.updated_date
                      );
                      if (!alreadyInLog) {
                        let updaterName = 'System';
                        let isLegacy = true;
                        let updaterEmail = entry.updated_by;
                        
                        if (updaterEmail) {
                          const user = safeUsers.find(u => u.email === updaterEmail);
                          if (user) {
                            updaterName = user.nickname || user.first_name || user.full_name || user.email;
                            isLegacy = false;
                          } else {
                            updaterName = updaterEmail;
                            isLegacy = false;
                          }
                        }

                        allActivities.push({
                          timestamp: entry.updated_date,
                          user: updaterName,
                          action: 'Edited',
                          details: entry.work_order_number ? `Work order ${formatWONumberSmart(entry.work_order_number, entry.updated_date)} updated.` : 'Work order updated.',
                          isLegacy
                        });
                      }
                    }
                    
                    // Sort by timestamp (newest first)
                    allActivities.sort((a, b) => {
                      if (!a.timestamp) return 1;
                      if (!b.timestamp) return -1;
                      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
                    });
                    
                    if (allActivities.length === 0) {
                      return (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-12 text-slate-500">
                            <Clock className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                            <p className="text-sm">No activity recorded yet</p>
                          </TableCell>
                        </TableRow>
                      );
                    }
                    
                    return allActivities.map((activity, index) => (
                      <TableRow key={index} className="hover:bg-slate-50">
                        <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                          {activity.timestamp && format(parseISO(activity.timestamp), 'dd MMM yyyy HH:mm')}
                        </TableCell>
                        <TableCell className="text-xs font-medium text-slate-900">
                          <div className="flex items-center gap-1">
                            {activity.user}
                            {activity.isLegacy && (
                              <span className="text-[9px] text-slate-400 italic" title="Legacy work order - creator information not available">
                                (legacy)
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          <Badge variant="outline" className={cn(
                            "text-xs",
                            activity.action === 'Created' && "bg-green-50 text-green-700 border-green-200",
                            activity.action === 'Edited' && "bg-blue-50 text-blue-700 border-blue-200",
                            activity.action === 'Copied' && "bg-purple-50 text-purple-700 border-purple-200",
                            activity.action === 'Pasted' && "bg-purple-50 text-purple-700 border-purple-200",
                            activity.action === 'Dropped' && "bg-indigo-50 text-indigo-700 border-indigo-200",
                            activity.action === 'Archived' && "bg-slate-50 text-slate-700 border-slate-200"
                          )}>
                            {activity.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-slate-700">
                          {activity.details}
                        </TableCell>
                      </TableRow>
                    ));
                  })()}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>

        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between bg-white flex-shrink-0 sticky bottom-0 z-10 shadow-lg">
          {!isReadOnly && !isCreating && (
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isSaving}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          )}

          {(isReadOnly || isCreating) && <div />}

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isSaving}
            >
              {isReadOnly ? 'Close' : 'Cancel'}
            </Button>
            {!isReadOnly && (
              <>
                {isCreating && !entry?.id && (
                  <Button
                    variant="outline"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleSave(true);
                    }}
                    disabled={isSaving || isSavingLocal}
                    type="button"
                    className="gap-2 border-indigo-300 text-indigo-700 hover:bg-indigo-50"
                  >
                    {(isSaving || isSavingLocal) ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    Save & Add Another
                  </Button>
                )}
                <Button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleSave();
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700"
                  disabled={isSaving || isSavingLocal}
                  type="button"
                >
                  {(isSaving || isSavingLocal) ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      {entry?.id ? 'Save Changes' : 'Create'}
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Team Reassignment Dialog */}
        <TeamUserReassignment
          isOpen={showTeamReassignment}
          onClose={() => setShowTeamReassignment(false)}
          teams={safeTeams}
          users={safeUsers}
          onUserReassigned={(userId, newTeamId) => {
            // Refresh parent data if needed
            setShowTeamReassignment(false);
          }}
        />
        </SheetContent>
        </Sheet>

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
          onClose={() => setShowPDFDialog(false)}
        />
      )}
    </>
  );
}