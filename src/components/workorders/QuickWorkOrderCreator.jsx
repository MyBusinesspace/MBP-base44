import React, { useState, useRef, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Plus, X, Save, Search, Check, FolderPlus, ClipboardList, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import Avatar from '../Avatar';
import TeamAvatar from '../shared/TeamAvatar';
import ProjectCombobox from './ProjectCombobox';
import WorkingOrderSelector from './WorkingOrderSelector';
import CategoryCombobox from './CategoryCombobox';
import TaskSelector from './TaskSelector';

export default function QuickWorkOrderCreator({
  projects: initialProjects = [],
  teams = [],
  users = [],
  categories = [],
  shiftTypes = [],
  assets = [],
  customers = [],
  allEntries = [],
  onCreated
}) {
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [projects, setProjects] = useState(initialProjects);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectCustomerId, setNewProjectCustomerId] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [isSavingProject, setIsSavingProject] = useState(false);

  const [showNewWorkOrderModal, setShowNewWorkOrderModal] = useState(false);
  const [newWorkOrderName, setNewWorkOrderName] = useState('');
  const [isSavingWorkOrder, setIsSavingWorkOrder] = useState(false);

  // Work Order fields
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [workOrderName, setWorkOrderName] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [selectedEquipment, setSelectedEquipment] = useState([]);
  const [createMode, setCreateMode] = useState(false);
  const [selectedWorkOrderEntry, setSelectedWorkOrderEntry] = useState(null);
  
  // Task fields
  const [taskName, setTaskName] = useState('');
  const [taskInstructions, setTaskInstructions] = useState('');
  const [taskDate, setTaskDate] = useState('');
  const [taskStartTime, setTaskStartTime] = useState('');
  const [taskEndTime, setTaskEndTime] = useState('');
  const [selectedShiftType, setSelectedShiftType] = useState(null);
  const [selectedTeams, setSelectedTeams] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  
  // Dropdown states
  const [showEquipmentDropdown, setShowEquipmentDropdown] = useState(false);
  const [showShiftTypeDropdown, setShowShiftTypeDropdown] = useState(false);
  const [showTeamDropdown, setShowTeamDropdown] = useState(false);
  
  // Search queries
  const [equipmentSearch, setEquipmentSearch] = useState('');
  const [teamSearch, setTeamSearch] = useState('');

  const equipmentRef = useRef(null);
  const shiftTypeRef = useRef(null);
  const teamRef = useRef(null);

  // Sync with parent projects and subscribe to new projects
  useEffect(() => {
    setProjects(initialProjects);
  }, [initialProjects]);

  useEffect(() => {
    const unsubscribe = base44.entities.Project.subscribe((event) => {
      if (event.type === 'create' && event.data) {
        setProjects(prev => [event.data, ...prev]);
      }
    });
    return unsubscribe;
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (equipmentRef.current && !equipmentRef.current.contains(event.target)) {
        setShowEquipmentDropdown(false);
      }
      if (shiftTypeRef.current && !shiftTypeRef.current.contains(event.target)) {
        setShowShiftTypeDropdown(false);
      }
      if (teamRef.current && !teamRef.current.contains(event.target)) {
        setShowTeamDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Set default date to today
  useEffect(() => {
    if (isCreating && !taskDate) {
      const today = new Date().toISOString().split('T')[0];
      setTaskDate(today);
    }
  }, [isCreating]);

  // Listen for custom event from WeekCalendarView button
  useEffect(() => {
    const handler = () => handleStartCreating();
    window.addEventListener('weekview:openQuickPlanner', handler);
    return () => window.removeEventListener('weekview:openQuickPlanner', handler);
  }, []);

  const handleSaveNewWorkOrder = () => {
    if (!newWorkOrderName.trim()) {
      toast.error('Please enter a work order name');
      return;
    }
    if (!selectedProjectId) {
      toast.error('Please select a project first');
      setShowNewWorkOrderModal(false);
      setNewWorkOrderName('');
      return;
    }
    setWorkOrderName(newWorkOrderName.trim());
    setCreateMode(true);
    setShowNewWorkOrderModal(false);
    setNewWorkOrderName('');
  };

  const handleSaveNewProject = async () => {
    if (!newProjectName.trim()) {
      toast.error('Please enter a project name');
      return;
    }
    setIsSavingProject(true);
    try {
      const created = await base44.entities.Project.create({
        name: newProjectName.trim(),
        customer_id: newProjectCustomerId || null,
        description: newProjectDescription.trim() || null,
        status: 'active'
      });
      setProjects(prev => [created, ...prev]);
      setSelectedProjectId(created.id);
      setShowNewProjectModal(false);
      setNewProjectName('');
      setNewProjectCustomerId('');
      setNewProjectDescription('');
      toast.success('Project created!');
    } catch (e) {
      toast.error('Failed to create project');
    } finally {
      setIsSavingProject(false);
    }
  };

  const handleStartCreating = () => {
    setIsCreating(true);
    setCreateMode(true);
    const today = new Date().toISOString().split('T')[0];
    setTaskDate(today);
  };

  const handleCancel = () => {
    setIsCreating(false);
    resetForm();
  };

  const resetForm = () => {
    setSelectedProjectId('');
    setWorkOrderName('');
    setSelectedCategoryId('');
    setSelectedEquipment([]);
    setSelectedShiftType(null);
    setTaskDate('');
    setTaskStartTime('');
    setTaskEndTime('');
    setTaskName('');
    setTaskInstructions('');
    setSelectedTeams([]);
    setEquipmentSearch('');
    setTeamSearch('');
    setCreateMode(true);
    setSelectedWorkOrderEntry(null);
  };

  const handleSave = async () => {
    // Validation
    if (!selectedProjectId) {
      toast.error('Please select a project');
      return;
    }
    if (!workOrderName.trim()) {
      toast.error('Please enter work order name');
      return;
    }
    if (!taskName.trim()) {
      toast.error('Please enter a task name');
      return;
    }
    if (!taskDate) {
      toast.error('Please select a date');
      return;
    }

    setIsSaving(true);

    try {
       // Create work order with task
       const selectedProject = projects.find(p => p.id === selectedProjectId);
       
       // Extract team IDs and get employee IDs from selected teams
       const teamIds = selectedTeams.map(t => t.id);
       const employeeIds = [];
       selectedTeams.forEach(team => {
         const teamUsers = users.filter(u => {
           const userTeamIds = u.team_ids || [];
           const hasTeamId = u.team_id === team.id;
           return userTeamIds.includes(team.id) || hasTeamId;
         });
         teamUsers.forEach(user => {
           if (!employeeIds.includes(user.id)) {
             employeeIds.push(user.id);
           }
         });
       });
       
       const workOrderData = {
         project_id: selectedProjectId,
         branch_id: selectedProject?.branch_id || null,
         work_order_category_id: selectedCategoryId || null,
         equipment_ids: selectedEquipment.map(e => e.id),
         title: workOrderName.trim(),
         work_notes: taskInstructions.trim(),
         planned_start_time: taskDate + 'T' + (taskStartTime || '00:00:00'),
         planned_end_time: taskEndTime ? taskDate + 'T' + taskEndTime : null,
         status: 'open',
         team_ids: teamIds,
         employee_ids: employeeIds,
         tasks: [
           {
             id: Date.now().toString(),
             name: taskName.trim(),
             instructions: taskInstructions.trim(),
             date: taskDate,
             start_time: taskStartTime || '00:00',
             end_time: taskEndTime || '',
             team_ids: teamIds,
             employee_ids: employeeIds,
             shift_type_id: selectedShiftType?.id || null,
             status: 'pending',
             work_done_items: [],
             spare_parts_items: [],
             work_pending_items: [],
             spare_parts_pending_items: [],
             other_file_urls: []
           }
         ]
       };

      console.log('🔍 Saving work order with teams:', { 
        team_ids: workOrderData.team_ids, 
        employee_ids: workOrderData.employee_ids,
        task_team_ids: workOrderData.tasks?.[0]?.team_ids,
        task_employee_ids: workOrderData.tasks?.[0]?.employee_ids
      });
      const created = await base44.entities.TimeEntry.create(workOrderData);
      
      toast.success('Work order created successfully');
      
      if (onCreated) {
        onCreated(created);
      }

      // Reset form
      setIsCreating(false);
      resetForm();
    } catch (error) {
      console.error('Error creating work order:', error);
      toast.error('Failed to create work order');
    } finally {
      setIsSaving(false);
    }
  };

  const openWorkOrders = useMemo(() => {
    const list = Array.isArray(allEntries) ? allEntries : [];
    const filtered = list.filter(e => {
      const s = (e.status || '').toLowerCase();
      const isOpen = s === 'open' || s === '';
      const notArchived = !e.archived;
      return isOpen && notArchived;
    });

    const groups = new Map();
    const norm = (s) => (s || '').trim().toLowerCase();

    filtered.forEach(e => {
      const key = `${e.project_id || ''}||${norm(e.title)}`;
      const created = e.created_date || e.updated_date || e.planned_start_time || null;
      if (!groups.has(key)) {
        groups.set(key, { first: e, earliest: created });
      } else {
        const g = groups.get(key);
        if (created && g.earliest && new Date(created) < new Date(g.earliest)) {
          g.earliest = created;
          g.first = e;
        }
        if (!g.earliest && created) {
          g.earliest = created;
        }
      }
    });

    return Array.from(groups.values()).map(g => ({ ...g.first, _earliest_created: g.earliest }));
  }, [allEntries, selectedProjectId]);

  const projectAssets = useMemo(() => {
    if (!selectedProjectId) return [];
    
    const selectedProject = projects.find(p => p.id === selectedProjectId);
    const companyAssets = assets.filter(a => a.project_id === selectedProjectId);
    
    let linkedEquipment = [];
    if (selectedProject && Array.isArray(selectedProject.client_equipment_ids)) {
      linkedEquipment = selectedProject.client_equipment_ids;
    }

    const combined = companyAssets;
    return combined;
  }, [assets, selectedProjectId, projects]);

  const filteredEquipment = projectAssets.filter(a =>
    !equipmentSearch || a.name.toLowerCase().includes(equipmentSearch.toLowerCase())
  );

  const filteredTeams = teams.filter(t =>
    !teamSearch || t.name.toLowerCase().includes(teamSearch.toLowerCase())
  );

  if (!isCreating) {
    return (
      <div style={{ background: 'rgba(0, 123, 128, 0.05)', borderBottom: '2px solid #007B80' }} className="p-3">
        <Button
          onClick={handleStartCreating}
          variant="outline"
          style={{ color: '#007B80', borderColor: '#007B80' }}
          className="w-full h-10 font-semibold gap-2 hover:bg-opacity-10"
        >
          <Plus className="w-5 h-5" />
          Quick Planning - Add Work Order
        </Button>
      </div>
    );
  }

  return (
    <>
    <div style={{ background: 'rgba(0, 123, 128, 0.03)', borderBottom: '4px solid #007B80' }}>
      <div className="p-4 space-y-3">
         <div className="flex items-center justify-between mb-2">
           <h3 className="text-sm font-bold" style={{ color: '#007B80' }}>Quick Planning - New Work Order</h3>
           <div className="flex gap-2">
             <Button
               onClick={handleSave}
               disabled={isSaving}
               size="sm"
               style={{ backgroundColor: '#007B80' }}
               className="hover:opacity-90 gap-2"
             >
              <Save className="w-4 h-4" />
              Save
            </Button>
            <Button
              onClick={handleCancel}
              disabled={isSaving}
              variant="ghost"
              size="sm"
              className="gap-2"
            >
              <X className="w-4 h-4" />
              Cancel
            </Button>
          </div>
        </div>

        {/* Work Order Details */}
        <div className="bg-white rounded-lg shadow-sm p-2" style={{ borderWidth: '2px', borderColor: '#007B80' }}>
          <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3 items-end">
            {/* 1. Working Orders — search by client/project/WO title */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <label className="text-[10px] font-medium text-slate-700 whitespace-nowrap">
                  Working Orders
                </label>
                <button
                  type="button"
                  onClick={() => setShowNewWorkOrderModal(true)}
                  className="flex items-center gap-0.5 text-[9px] font-semibold px-1.5 py-0.5 rounded border border-dashed hover:opacity-80 transition-opacity whitespace-nowrap flex-shrink-0"
                  style={{ color: '#007B80', borderColor: '#007B80', background: 'rgba(0,123,128,0.05)' }}
                  title="Quick create work order"
                >
                  <ClipboardList className="w-2.5 h-2.5" />
                  + Working Order
                </button>
              </div>
              <WorkingOrderSelector
                openWorkOrders={openWorkOrders}
                projects={projects}
                customers={customers}
                newTitle={workOrderName}
                onNewTitleChange={(val) => {
                  setWorkOrderName(val);
                  setCreateMode(true);
                  setSelectedWorkOrderEntry(null);
                }}
                onSelectWorkOrder={(existing) => {
                  setSelectedProjectId(existing.project_id || '');
                  setWorkOrderName(existing.title);
                  setSelectedCategoryId(existing.work_order_category_id || '');
                  setSelectedEquipment(
                    assets.filter(a => (existing.equipment_ids || []).includes(a.id))
                  );
                  setSelectedWorkOrderEntry(existing);
                  setCreateMode(false);
                }}
                onCreateNew={() => {
                  setCreateMode(true);
                  setWorkOrderName('');
                  setSelectedCategoryId('');
                  setSelectedEquipment([]);
                  setSelectedWorkOrderEntry(null);
                }}
              />
            </div>

            {/* 4. Equipment/Assets (with dropdown to select assigned ones) */}
            <div className="relative" ref={equipmentRef}>
              <label className="text-[10px] font-medium text-slate-700 block mb-1">
                Equipment / Assets
              </label>
              <button
                onClick={() => setShowEquipmentDropdown(!showEquipmentDropdown)}
                disabled={!selectedProjectId || projectAssets.length === 0}
                className="w-full h-8 px-2 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-between text-xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="truncate">
                  {selectedEquipment.length > 0 
                    ? `${selectedEquipment.length} selected` 
                    : projectAssets.length === 0 
                      ? 'No equipment' 
                      : 'Select...'}
                </span>
                <span className="text-slate-400">▼</span>
              </button>
              
              {showEquipmentDropdown && projectAssets.length > 0 && (
                <div className="absolute z-50 mt-1 w-64 bg-white border border-slate-200 rounded-lg shadow-xl max-h-64 overflow-y-auto left-0">
                  {projectAssets.map(asset => {
                    const isSelected = selectedEquipment.some(e => e.id === asset.id);
                    return (
                      <div
                        key={asset.id}
                        className={cn(
                          "flex items-center gap-2 p-2 hover:bg-slate-50 cursor-pointer",
                          isSelected && "bg-indigo-50"
                        )}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedEquipment(selectedEquipment.filter(e => e.id !== asset.id));
                          } else {
                            setSelectedEquipment([...selectedEquipment, asset]);
                          }
                        }}
                      >
                        <input 
                          type="checkbox" 
                          checked={isSelected} 
                          readOnly 
                          className="h-3 w-3 flex-shrink-0" 
                        />
                        <span className="text-xs truncate">{asset.name}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            
            {/* 5. Category */}
            <div>
              <label className="text-[10px] font-medium text-slate-700 block mb-1">
                Category <span className="text-red-500">*</span>
              </label>
              <CategoryCombobox
                categories={categories}
                selectedCategoryId={selectedCategoryId}
                onSelectCategory={(categoryId) => setSelectedCategoryId(categoryId)}
              />
            </div>
          </div>
        </div>

        {/* Task Details */}
        <div className="bg-white rounded-lg shadow-sm p-2" style={{ borderWidth: '2px', borderColor: '#007B80' }}>
          {/* Header removed */}
          <div className="grid grid-cols-12 gap-2 items-end">
            {/* Task Name */}
            <div className="col-span-2">
              <label className="text-[10px] font-medium text-slate-700 block mb-1">
                Task Name <span className="text-red-500">*</span>
              </label>
              {selectedWorkOrderEntry ? (
                <TaskSelector
                  tasks={(selectedWorkOrderEntry.tasks || []).filter(t => t.status !== 'completed')}
                  selectedTaskName={taskName}
                  onSelectTask={(selectedTask) => setTaskName(selectedTask.name)}
                  onNameChange={(newName) => setTaskName(newName)}
                  onCreateNew={() => setTaskName('')}
                />
              ) : (
                <Input
                  value={taskName}
                  onChange={(e) => setTaskName(e.target.value)}
                  placeholder="Enter task name..."
                  className="h-8 text-xs"
                />
              )}
            </div>

            {/* Instructions */}
            <div className="col-span-2">
              <label className="text-[10px] font-medium text-slate-700 block mb-1">
                Instructions
              </label>
              <Input
                value={taskInstructions}
                onChange={(e) => setTaskInstructions(e.target.value)}
                placeholder="Task instructions..."
                className="h-8 text-xs"
              />
            </div>

            {/* Date */}
             <div className="col-span-3">
               <label className="text-[10px] font-medium text-slate-700 block mb-1">
                 Date <span className="text-red-500">*</span>
               </label>
               <div className="flex gap-1 items-center">
                 <Input
                   type="date"
                   value={taskDate}
                   onChange={(e) => setTaskDate(e.target.value)}
                   className="h-8 text-xs flex-1"
                 />
                 <Button
                   type="button"
                   size="sm"
                   variant={taskDate === new Date().toISOString().split('T')[0] ? "default" : "outline"}
                   onClick={() => setTaskDate(new Date().toISOString().split('T')[0])}
                   className="h-8 px-2 text-[10px] font-semibold whitespace-nowrap"
                   style={taskDate === new Date().toISOString().split('T')[0] ? { backgroundColor: '#007B80', color: 'white', border: 'none' } : {}}
                 >
                   Today
                 </Button>
                 <Button
                   type="button"
                   size="sm"
                   variant={taskDate === new Date(Date.now() + 86400000).toISOString().split('T')[0] ? "default" : "outline"}
                   onClick={() => setTaskDate(new Date(Date.now() + 86400000).toISOString().split('T')[0])}
                   className="h-8 px-2 text-[10px] font-semibold whitespace-nowrap"
                   style={taskDate === new Date(Date.now() + 86400000).toISOString().split('T')[0] ? { backgroundColor: '#007B80', color: 'white', border: 'none' } : {}}
                 >
                   Tomorrow
                 </Button>
               </div>
             </div>

            {/* Shift */}
            <div className="col-span-1 relative" ref={shiftTypeRef}>
              <label className="text-[10px] font-medium text-slate-700 block mb-1">
                Shift
              </label>
              <button
                onClick={() => setShowShiftTypeDropdown(!showShiftTypeDropdown)}
                className={cn(
                  "w-full h-8 text-center px-1 rounded-md border text-[10px] font-semibold",
                  selectedShiftType
                    ? "bg-white border-slate-300 text-slate-700"
                    : "bg-slate-50 border-slate-200 text-slate-400"
                )}
              >
                {selectedShiftType?.name.substring(0, 3).toUpperCase() || '-'}
              </button>
              
              {showShiftTypeDropdown && (
                <div className="absolute z-50 mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-xl max-h-48 overflow-y-auto right-0">
                  <button
                    onClick={() => {
                      setSelectedShiftType(null);
                      setTaskStartTime('');
                      setTaskEndTime('');
                      setShowShiftTypeDropdown(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 text-xs text-slate-500"
                  >
                    No shift type
                  </button>
                  {shiftTypes.map(st => (
                    <button
                      key={st.id}
                      onClick={() => {
                        setSelectedShiftType(st);
                        if (st.start_time) setTaskStartTime(st.start_time);
                        if (st.end_time) setTaskEndTime(st.end_time);
                        setShowShiftTypeDropdown(false);
                      }}
                      className="w-full text-left px-3 py-2 text-xs hover:opacity-80"
                      style={{ background: 'rgba(0, 123, 128, 0.05)' }}
                    >
                      <div className="font-semibold">{st.name}</div>
                      {st.start_time && st.end_time && (
                        <div className="text-[10px] text-slate-500">{st.start_time} - {st.end_time}</div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Time In */}
            <div className="col-span-1">
              <label className="text-[10px] font-medium text-slate-700 block mb-1 truncate">
                In
              </label>
              <Input
                type="time"
                value={taskStartTime}
                onChange={(e) => setTaskStartTime(e.target.value)}
                className="h-8 text-[10px] px-1"
              />
            </div>

            {/* Time Out */}
            <div className="col-span-1">
              <label className="text-[10px] font-medium text-slate-700 block mb-1 truncate">
                Out
              </label>
              <Input
                type="time"
                value={taskEndTime}
                onChange={(e) => setTaskEndTime(e.target.value)}
                className="h-8 text-[10px] px-1"
              />
            </div>

            {/* Team */}
            <div className="col-span-2 relative" ref={teamRef}>
              <label className="text-[10px] font-medium text-slate-700 block mb-1">
                Team
              </label>
              <button
                onClick={() => setShowTeamDropdown(!showTeamDropdown)}
                className="w-full h-8 text-left px-2 rounded-md border text-xs bg-white border-slate-200 hover:bg-slate-50 flex items-center gap-1"
              >
                {selectedTeams.length > 0 ? (
                  <>
                    <TeamAvatar team={selectedTeams[0]} size="sm" />
                    {selectedTeams.length > 1 && (
                      <span className="text-[10px] text-slate-500">+{selectedTeams.length - 1}</span>
                    )}
                  </>
                ) : (
                  <span className="text-slate-400 text-[10px]">Select team...</span>
                )}
              </button>
              
              {showTeamDropdown && (
                <div className="absolute z-50 mt-1 w-72 bg-white border border-slate-200 rounded-lg shadow-xl max-h-80 overflow-hidden right-0">
                  <div className="p-2 border-b border-slate-100 sticky top-0 bg-white">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                      <Input
                        value={teamSearch}
                        onChange={(e) => setTeamSearch(e.target.value)}
                        placeholder="Search teams..."
                        className="pl-7 h-7 text-xs"
                      />
                    </div>
                  </div>
                  <div className="overflow-y-auto max-h-72">
                    {filteredTeams.map(team => {
                      const isSelected = selectedTeams.some(t => t.id === team.id);
                      const teamUsers = users.filter(u => {
                        const userTeamIds = u.team_ids || [];
                        const hasTeamId = u.team_id === team.id;
                        return userTeamIds.includes(team.id) || hasTeamId;
                      });
                      return (
                        <button
                          key={team.id}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedTeams(selectedTeams.filter(t => t.id !== team.id));
                            } else {
                              setSelectedTeams([...selectedTeams, team]);
                            }
                          }}
                          className="w-full text-left px-3 py-2 text-xs flex flex-col gap-1.5 hover:opacity-80"
                          style={{ background: isSelected ? 'rgba(0, 123, 128, 0.1)' : 'transparent' }}
                        >
                          <div className="flex items-center gap-2">
                            <div className={cn(
                              "w-3 h-3 rounded border flex items-center justify-center flex-shrink-0",
                              isSelected ? "border-slate-300" : "border-slate-300"
                            )}
                            style={{ background: isSelected ? '#007B80' : 'transparent', borderColor: isSelected ? '#007B80' : '#cbd5e1' }}>
                              {isSelected && <Check className="w-2 h-2 text-white" />}
                            </div>
                            <TeamAvatar team={team} size="sm" />
                            <span className="font-medium truncate">{team.name}</span>
                          </div>
                          {teamUsers.length > 0 && (
                            <div className="flex items-center gap-0.5 pl-5 mt-1">
                              {teamUsers.slice(0, 4).map(user => (
                                <div key={user.id} className="flex-shrink-0">
                                  <Avatar user={user} size="xs" />
                                </div>
                              ))}
                              {teamUsers.length > 4 && (
                                <span className="text-[8px] text-slate-400 ml-1">+{teamUsers.length - 4}</span>
                              )}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Status */}
            <div className="col-span-1">
              <label className="text-[10px] font-medium text-slate-700 block mb-1">
                Status
              </label>
              <div style={{ background: 'rgba(0, 123, 128, 0.1)', borderColor: '#007B80' }} className="h-8 px-2 rounded-md border flex items-center justify-center">
                <span style={{ color: '#007B80' }} className="text-[10px] font-semibold">Pending</span>
              </div>
            </div>
          </div>
        </div>

        {/* Pending Tasks for selected work order */}
        {!createMode && selectedWorkOrderEntry && (() => {
          const pendingTasks = (selectedWorkOrderEntry.tasks || []).filter(t => t.status !== 'completed');
          return (
            <div className="bg-white rounded-lg shadow-sm p-3" style={{ borderWidth: '2px', borderColor: '#007B80', borderStyle: 'dashed' }}>
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-3.5 h-3.5" style={{ color: '#007B80' }} />
                <span className="text-[11px] font-semibold" style={{ color: '#007B80' }}>
                  Pending Tasks on this Work Order
                </span>
                {pendingTasks.length > 0 && (
                  <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-semibold">
                    {pendingTasks.length}
                  </span>
                )}
              </div>
              {pendingTasks.length === 0 ? (
                <p className="text-[11px] text-slate-400 italic">No tasks on this working order pending.</p>
              ) : (
                <div className="space-y-1">
                  {pendingTasks.map((task, idx) => (
                    <div key={task.id || idx} className="flex items-center gap-2 py-1 px-2 bg-amber-50 rounded border border-amber-100">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                      <span className="text-xs text-slate-700 font-medium truncate">{task.name || 'Unnamed task'}</span>
                      {task.date && (
                        <span className="text-[10px] text-slate-400 ml-auto flex-shrink-0">{task.date}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>

    {/* Quick Create Work Order Modal */}
    {showNewWorkOrderModal && (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/40" onClick={() => setShowNewWorkOrderModal(false)} />
        <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-sm p-5 z-10">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: '#007B80' }}>
              <ClipboardList className="w-4 h-4" /> Quick Create Working Order
            </h3>
            <button onClick={() => setShowNewWorkOrderModal(false)} className="text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1">Work Order Name <span className="text-red-500">*</span></label>
              <Input
                value={newWorkOrderName}
                onChange={e => setNewWorkOrderName(e.target.value)}
                placeholder="Enter work order name..."
                className="h-9 text-sm"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && handleSaveNewWorkOrder()}
              />
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <Button
              onClick={handleSaveNewWorkOrder}
              className="flex-1 gap-2"
              style={{ backgroundColor: '#007B80' }}
            >
              <Save className="w-3.5 h-3.5" />
              Create Work Order
            </Button>
            <Button variant="outline" onClick={() => setShowNewWorkOrderModal(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    )}

    {/* Quick Create Project Modal */}
    
    {showNewProjectModal && (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/40" onClick={() => setShowNewProjectModal(false)} />
        <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-sm p-5 z-10">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: '#007B80' }}>
              <FolderPlus className="w-4 h-4" /> Quick Create Project
            </h3>
            <button onClick={() => setShowNewProjectModal(false)} className="text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1">Project Name <span className="text-red-500">*</span></label>
              <Input
                value={newProjectName}
                onChange={e => setNewProjectName(e.target.value)}
                placeholder="Enter project name..."
                className="h-9 text-sm"
                autoFocus
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1">Client</label>
              <select
                value={newProjectCustomerId}
                onChange={e => setNewProjectCustomerId(e.target.value)}
                className="w-full h-9 px-3 rounded-md border border-input text-sm bg-white"
              >
                <option value="">Select client...</option>
                {customers.filter(c => !c.archived).sort((a,b) => a.name.localeCompare(b.name)).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1">Description</label>
              <Input
                value={newProjectDescription}
                onChange={e => setNewProjectDescription(e.target.value)}
                placeholder="Brief description..."
                className="h-9 text-sm"
              />
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <Button
              onClick={handleSaveNewProject}
              disabled={isSavingProject}
              className="flex-1 gap-2"
              style={{ backgroundColor: '#007B80' }}
            >
              <Save className="w-3.5 h-3.5" />
              {isSavingProject ? 'Creating...' : 'Create Project'}
            </Button>
            <Button variant="outline" onClick={() => setShowNewProjectModal(false)} disabled={isSavingProject}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}