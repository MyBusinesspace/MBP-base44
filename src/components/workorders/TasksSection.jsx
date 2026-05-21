import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { format, addDays } from 'date-fns';
import ShiftTypeCombobox from './ShiftTypeCombobox';
import TaskTeamAssignment from './TaskTeamAssignment';
import Avatar from '../Avatar';
import TaskSelector from './TaskSelector';
import { toast } from 'sonner';

export default function TasksSection({
  formData,
  setFormData,
  safeShiftTypes,
  safeTeams,
  safeUsers,
  isReadOnly,
  createMode,
  expandedTeams,
  setExpandedTeams,
  isUserAvailableForDate
}) {
  const [selectedTaskIndex, setSelectedTaskIndex] = useState(0);

  // Keep selected index in bounds
  useEffect(() => {
    const len = (formData.tasks || []).length;
    if (len === 0) {
      setSelectedTaskIndex(-1);
    } else if (selectedTaskIndex === -1 || selectedTaskIndex >= len) {
      setSelectedTaskIndex(0);
    }
  }, [formData.tasks]);

  const tasks = formData.tasks || [];
  const currentTask = selectedTaskIndex >= 0 && selectedTaskIndex < tasks.length ? tasks[selectedTaskIndex] : null;

  const handleAddTask = () => {
    const taskIndex = tasks.length + 1;
    const woNumber = formData.work_order_number || '';
    const taskRef = woNumber ? `${woNumber}-T${taskIndex}` : `T${taskIndex}`;
    const newTask = {
      id: `task_${Date.now()}`,
      ref: taskRef,
      name: '',
      instructions: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      start_time: '08:00',
      end_time: '17:00',
      shift_type_id: '',
      employee_ids: [],
      leader_id: '',
      team_ids: [],
      status: 'pending',
      is_signed: false,
      work_done_items: [],
      spare_parts_items: [],
      work_pending_items: [],
      spare_parts_pending_items: [],
      other_file_urls: []
    };
    const newTasks = [...tasks, newTask];
    setFormData(prev => ({ ...prev, tasks: newTasks }));
    setSelectedTaskIndex(newTasks.length - 1);
  };

  const handleDeleteTask = () => {
    if (!currentTask) return;
    if (window.confirm('Are you sure you want to delete this task?')) {
      const updatedTasks = tasks.filter(t => t.id !== currentTask.id);
      setFormData(prev => ({ ...prev, tasks: updatedTasks }));
      setSelectedTaskIndex(updatedTasks.length > 0 ? 0 : -1);
      toast.success('Task deleted');
    }
  };

  const handleTaskChange = (field, value) => {
    if (!currentTask) return;
    let updatedTask = { ...currentTask, [field]: value };
    // ✅ If date changes to a future date, clear all report data
    if (field === 'date' && value) {
      const newDate = new Date(value + 'T00:00:00');
      const today = new Date(); today.setHours(0, 0, 0, 0);
      if (newDate > today) {
        updatedTask = {
          ...updatedTask,
          status: 'pending',
          work_done_items: [],
          spare_parts_items: [],
          work_pending_items: [],
          spare_parts_pending_items: [],
          other_file_urls: [],
          is_signed: false,
        };
      }
    }
    const updatedTasks = [...tasks];
    updatedTasks[selectedTaskIndex] = updatedTask;
    setFormData(prev => ({ ...prev, tasks: updatedTasks }));
  };

  const total = tasks.length;
  const completed = tasks.filter(t => t.status === 'completed').length;
  const pending = total - completed;

  return (
    <div className="rounded-lg bg-white shadow-sm" style={{ borderWidth: '1px', borderColor: '#007B80' }}>
      <div className="p-3 space-y-2.5">

        {/* Header: counters + task selector dropdown + add/delete buttons */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-indigo-600 text-white text-xs font-bold">
              <span>{total}</span>
              <span>{total === 1 ? 'Task' : 'Tasks'}</span>
            </div>
            <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 text-green-700 border border-green-300 text-xs font-semibold">
              <span>{completed}</span>
              <span>Done</span>
            </div>
            <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-orange-100 text-orange-700 border border-orange-300 text-xs font-semibold">
              <span>{pending}</span>
              <span>Pending</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Task selector dropdown */}
            {tasks.length > 0 && (
              <Select
                value={selectedTaskIndex >= 0 ? String(selectedTaskIndex) : ''}
                onValueChange={(v) => setSelectedTaskIndex(parseInt(v))}
              >
                <SelectTrigger className="h-7 text-xs w-48">
                  <SelectValue placeholder="Select task..." />
                </SelectTrigger>
                <SelectContent>
                  {tasks.map((task, idx) => (
                    <SelectItem key={task.id || idx} value={String(idx)}>
                      Task {idx + 1}{task.name ? ` — ${task.name}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {!isReadOnly && (
              <>
                {tasks.length === 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddTask}
                  className="text-xs h-7 px-2"
                  type="button"
                >
                  + Add Task
                </Button>
                )}
                {currentTask && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDeleteTask}
                    className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                    type="button"
                    title="Delete this task"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {/* No tasks placeholder */}
        {tasks.length === 0 && (
          <div className="text-xs text-slate-500 p-3 bg-slate-50 rounded border border-slate-200 text-center">
            No tasks yet. Click "+ Add Task" to create one.
          </div>
        )}

        {/* Single Task Detail Panel */}
        {currentTask && (
          <div className="rounded-lg bg-white" style={{ borderWidth: '1px', borderColor: '#00A3AA' }}>

            {/* Task header bar */}
            <div className="flex items-center justify-between p-2.5 rounded-t-lg bg-slate-50">
              <div className="flex items-center gap-2 min-w-0">
                {currentTask.ref && (
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 border border-indigo-200 flex-shrink-0">
                    {currentTask.ref}
                  </span>
                )}
                <span className="text-xs font-semibold text-slate-800 truncate">
                  TASK {selectedTaskIndex + 1}{currentTask.name ? ` — ${currentTask.name}` : ''}
                </span>
                {currentTask.date && (
                  <span className="text-[10px] text-slate-500 flex-shrink-0">{currentTask.date}</span>
                )}
              </div>
              {/* Completed toggle */}
              <button
                type="button"
                onClick={() => handleTaskChange('status', currentTask.status === 'completed' ? 'pending' : 'completed')}
                className="flex items-center gap-1.5 cursor-pointer select-none"
                title={currentTask.status === 'completed' ? 'Mark as Pending' : 'Mark as Completed'}
              >
                <div className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${currentTask.status === 'completed' ? 'bg-green-500' : 'bg-slate-300'}`}>
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${currentTask.status === 'completed' ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </div>
                <span className={`text-xs font-medium ${currentTask.status === 'completed' ? 'text-green-700' : 'text-slate-500'}`}>
                  {currentTask.status === 'completed' ? 'Completed' : 'Pending'}
                </span>
              </button>
            </div>

            {/* Task form fields */}
            <div className="p-2.5 space-y-2">

              {/* Task Name */}
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">
                  Task Name <span className="text-red-500">*</span>
                </label>
                <TaskSelector
                  tasks={tasks.filter(t => t.id !== currentTask.id)}
                  selectedTaskName={currentTask.name || ''}
                  onSelectTask={(selectedTask) => {
                    handleTaskChange('name', selectedTask.name);
                  }}
                  onNameChange={(newName) => handleTaskChange('name', newName)}
                  disabled={isReadOnly && !createMode}
                />
              </div>

              {/* Instructions */}
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Instructions</label>
                <Textarea
                  value={currentTask.instructions || ''}
                  onChange={(e) => handleTaskChange('instructions', e.target.value)}
                  placeholder="Enter task instructions"
                  disabled={isReadOnly && !createMode}
                  className="text-xs min-h-[70px] resize-none"
                />
              </div>

              {/* Date + Shift */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">
                    Date <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-1">
                    <Input
                      type="date"
                      value={currentTask.date || ''}
                      onChange={(e) => handleTaskChange('date', e.target.value)}
                      disabled={isReadOnly && !createMode}
                      className="h-8 text-xs flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleTaskChange('date', format(addDays(new Date(), 1), 'yyyy-MM-dd'))}
                      disabled={isReadOnly && !createMode}
                      className="h-8 text-xs px-2"
                    >
                      Tom
                    </Button>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Choose shift time</label>
                  <ShiftTypeCombobox
                    shiftTypes={safeShiftTypes}
                    selectedShiftTypeId={currentTask.shift_type_id || ''}
                    onSelectShiftType={(shiftTypeId) => {
                      const shift = safeShiftTypes.find(s => s.id === shiftTypeId);
                      handleTaskChange('shift_type_id', shiftTypeId);
                      if (shift?.start_time) handleTaskChange('start_time', shift.start_time);
                      if (shift?.end_time) handleTaskChange('end_time', shift.end_time);
                    }}
                    disabled={isReadOnly && !createMode}
                  />
                </div>
              </div>

              {/* Start / End time */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">
                    Start Time <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="time"
                    value={currentTask.start_time || ''}
                    onChange={(e) => handleTaskChange('start_time', e.target.value)}
                    disabled={isReadOnly && !createMode}
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">
                    End Time <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="time"
                    value={currentTask.end_time || ''}
                    onChange={(e) => handleTaskChange('end_time', e.target.value)}
                    disabled={isReadOnly && !createMode}
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              {/* Assigned Workers */}
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Assigned Workers</label>
                <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 rounded-md border border-slate-200 min-h-[2rem]">
                  {(!currentTask.employee_ids || currentTask.employee_ids.length === 0) ? (
                    <span className="text-xs text-slate-400 flex items-center">No workers assigned</span>
                  ) : (
                    currentTask.employee_ids.map(employeeId => {
                      const worker = safeUsers.find(u => u.id === employeeId);
                      if (!worker) return null;
                      const workerName = worker.nickname || worker.first_name || worker.full_name?.split(' ')[0] || 'Unknown';
                      const isLeader = currentTask.leader_id === employeeId;
                      return (
                        <div key={employeeId} className={`flex items-center gap-1 px-2 py-1 rounded-full border ${isLeader ? 'bg-yellow-50 border-yellow-400' : 'bg-white border-slate-200'}`}>
                          <Avatar user={worker} size="xs" />
                          <span className="text-xs font-medium text-slate-700">{workerName}</span>
                          {isLeader && <span className="text-[10px] text-yellow-600 font-bold">★ LEADER</span>}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Task Leader */}
              {currentTask.employee_ids && currentTask.employee_ids.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block flex items-center gap-1">
                    <span className="text-yellow-500">★</span> Task Leader
                    {!currentTask.leader_id && (
                      <span className="text-[10px] text-orange-500 font-normal ml-1">(no leader assigned)</span>
                    )}
                  </label>
                  <Select
                    value={currentTask.leader_id || ''}
                    onValueChange={(value) => handleTaskChange('leader_id', value === '__none__' ? '' : value)}
                    disabled={isReadOnly && !createMode}
                  >
                    <SelectTrigger className={`h-8 text-xs ${!currentTask.leader_id ? 'border-orange-300 bg-orange-50' : 'border-yellow-300 bg-yellow-50'}`}>
                      <SelectValue placeholder="⚠ Select a task leader..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— No leader —</SelectItem>
                      {currentTask.employee_ids.map(eid => {
                        const worker = safeUsers.find(u => u.id === eid);
                        if (!worker) return null;
                        const name = worker.nickname || worker.first_name || worker.full_name?.split(' ')[0] || 'Unknown';
                        return (
                          <SelectItem key={eid} value={eid}>★ {name}</SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Team Assignment */}
              <div className="pt-2" style={{ borderTopWidth: '1px', borderTopColor: '#00A3AA' }}>
                <TaskTeamAssignment
                  teams={safeTeams}
                  users={safeUsers}
                  selectedTeamIds={currentTask.team_ids || []}
                  selectedEmployeeIds={currentTask.employee_ids || []}
                  onBothChange={({ teamIds: newTeamIds, employeeIds: newEmployeeIds }) => {
                    const findTeamLeader = (empIds, teamIds) => {
                      for (const tid of (teamIds || [])) {
                        const team = safeTeams.find(t => t.id === tid);
                        if (team?.team_leader_id && empIds.includes(team.team_leader_id)) return team.team_leader_id;
                      }
                      return null;
                    };
                    setFormData(prev => {
                      const prevTasks = prev.tasks || [];
                      const prevTask = prevTasks[selectedTaskIndex];
                      if (!prevTask) return prev;
                      let newLeaderId = prevTask.leader_id || '';
                      if (!newLeaderId && newEmployeeIds.length > 0) {
                        newLeaderId = findTeamLeader(newEmployeeIds, newTeamIds) || newEmployeeIds[0];
                      }
                      if (newLeaderId && !newEmployeeIds.includes(newLeaderId)) {
                        newLeaderId = findTeamLeader(newEmployeeIds, newTeamIds) || (newEmployeeIds.length > 0 ? newEmployeeIds[0] : '');
                      }
                      const updatedTasks = [...prevTasks];
                      updatedTasks[selectedTaskIndex] = { ...prevTask, team_ids: newTeamIds, employee_ids: newEmployeeIds, leader_id: newLeaderId };
                      const allEmpIds = new Set();
                      updatedTasks.forEach(t => (t.employee_ids || []).forEach(id => allEmpIds.add(id)));
                      return { ...prev, tasks: updatedTasks, employee_ids: Array.from(allEmpIds) };
                    });
                  }}
                  onTeamsChange={(newTeamIds) => {
                    setFormData(prev => {
                      const prevTasks = prev.tasks || [];
                      const prevTask = prevTasks[selectedTaskIndex];
                      if (!prevTask) return prev;
                      const updatedTasks = [...prevTasks];
                      updatedTasks[selectedTaskIndex] = { ...prevTask, team_ids: newTeamIds };
                      return { ...prev, tasks: updatedTasks };
                    });
                  }}
                  onEmployeesChange={(newEmployeeIds) => {
                    setFormData(prev => {
                      const prevTasks = prev.tasks || [];
                      const prevTask = prevTasks[selectedTaskIndex];
                      if (!prevTask) return prev;
                      const updatedTasks = [...prevTasks];
                      updatedTasks[selectedTaskIndex] = { ...prevTask, employee_ids: newEmployeeIds };
                      const allEmpIds = new Set();
                      updatedTasks.forEach(t => (t.employee_ids || []).forEach(id => allEmpIds.add(id)));
                      return { ...prev, tasks: updatedTasks, employee_ids: Array.from(allEmpIds) };
                    });
                  }}
                  onGlobalTeamChange={async (userId, newTeamId) => {
                    setFormData(prev => {
                      const updatedTasks = prev.tasks.map(t => {
                        if (t.status === 'completed') return t;
                        if ((t.employee_ids || []).includes(userId)) {
                          const newTeamIds = [...(t.team_ids || [])];
                          if (!newTeamIds.includes(newTeamId)) newTeamIds.push(newTeamId);
                          return { ...t, team_ids: newTeamIds };
                        }
                        return t;
                      });
                      return { ...prev, tasks: updatedTasks };
                    });
                  }}
                  disabled={isReadOnly && !createMode}
                  taskDate={currentTask.date}
                  isUserAvailableForDate={isUserAvailableForDate}
                />
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}