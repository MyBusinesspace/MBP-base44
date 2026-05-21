import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronUp, X, Plus, Pencil, Check, UserPlus } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function FloatingTaskWidget() {
  const [isMinimized, setIsMinimized] = useState(false);
  const [position, setPosition] = useState('bottom-right');
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const widgetRef = useRef(null);
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [assigningTaskId, setAssigningTaskId] = useState(null);

  useEffect(() => {
    const savedPosition = localStorage.getItem('taskWidgetPosition');
    const savedMinimized = localStorage.getItem('taskWidgetMinimized');
    if (savedPosition) setPosition(savedPosition);
    if (savedMinimized) setIsMinimized(JSON.parse(savedMinimized));
  }, []);

  useEffect(() => {
    localStorage.setItem('taskWidgetPosition', position);
    localStorage.setItem('taskWidgetMinimized', JSON.stringify(isMinimized));
  }, [position, isMinimized]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [allTasks, allUsers] = await Promise.all([
          base44.entities.QuickTask.list(),
          base44.entities.User.list()
        ]);
        const pending = allTasks.filter(t => t.status !== 'completed' && t.status !== 'done' && t.status !== 'closed' && !t.archived).slice(0, 10);
        setTasks(pending);
        setUsers(allUsers);
      } catch (e) {
        console.error('Error loading tasks:', e);
      }
      setLoading(false);
    };
    loadData();

    const unsubscribe = base44.entities.QuickTask.subscribe(() => {
      loadData();
    });
    return unsubscribe;
  }, []);

  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !widgetRef.current) return;
    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;
    setOffset({ x: offset.x + deltaX, y: offset.y + deltaY });
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => setIsDragging(false);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, offset, dragStart]);

  const handleCreateTask = async () => {
    if (!newTaskTitle.trim()) return;
    try {
      await base44.entities.QuickTask.create({ title: newTaskTitle.trim(), status: 'open' });
      setNewTaskTitle('');
      setIsCreating(false);
    } catch (e) {
      console.error('Error creating task:', e);
    }
  };

  const handleDeleteTask = async (taskId) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
    await base44.entities.QuickTask.delete(taskId);
  };

  const handleStartEdit = (task) => {
    setEditingTaskId(task.id);
    setEditingTitle(task.title);
    setAssigningTaskId(null);
  };

  const handleSaveEdit = async (taskId) => {
    if (!editingTitle.trim()) return;
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, title: editingTitle.trim() } : t));
    setEditingTaskId(null);
    await base44.entities.QuickTask.update(taskId, { title: editingTitle.trim() });
  };

  const handleToggleAssign = async (task, userId) => {
    const current = task.assigned_to_user_ids || [];
    const updated = current.includes(userId)
      ? current.filter(id => id !== userId)
      : [...current, userId];
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, assigned_to_user_ids: updated } : t));
    await base44.entities.QuickTask.update(task.id, { assigned_to_user_ids: updated });
  };

  const positionClasses = {
    'bottom-right': 'bottom-6 right-6',
    'bottom-left': 'bottom-6 left-6',
    'top-right': 'top-6 right-6',
    'top-left': 'top-6 left-6'
  };

  const togglePosition = () => {
    const positions = ['bottom-right', 'bottom-left', 'top-left', 'top-right'];
    const currentIdx = positions.indexOf(position);
    setPosition(positions[(currentIdx + 1) % positions.length]);
  };

  const getUserInitials = (user) => {
    if (!user) return '?';
    return (user.full_name || user.email || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div
      ref={widgetRef}
      className={`fixed ${positionClasses[position]} z-40 transition-all duration-200 pointer-events-none`}
      style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
    >
      <div className={`pointer-events-auto ${isMinimized ? 'w-auto' : 'w-80'}`}>
      <div className="bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden w-80">
        {/* Header */}
        <div
          onMouseDown={handleMouseDown}
          className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-4 py-3 flex items-center justify-between cursor-grab active:cursor-grabbing"
        >
          <div className="flex items-center gap-2">
            {!isMinimized && <span className="text-sm font-semibold">To do List</span>}
            {tasks.length > 0 && (
              <span className="bg-white text-blue-600 text-xs font-bold px-2 py-0.5 rounded-full">
                {tasks.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={togglePosition} className="hover:bg-blue-700 p-1 rounded text-xs" title="Move corner">⊕</button>
            <button onClick={() => setIsMinimized(!isMinimized)} className="hover:bg-blue-700 p-1 rounded">
              {isMinimized ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
          </div>
        </div>

        {/* Content */}
        {!isMinimized && (
          <div className="max-h-[420px] overflow-y-auto">
            {/* Create Task Form */}
            {isCreating && (
              <div className="p-3 border-b bg-blue-50 space-y-2">
                <Input
                  placeholder="New task..."
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateTask();
                    if (e.key === 'Escape') { setIsCreating(false); setNewTaskTitle(''); }
                  }}
                  autoFocus
                  className="text-xs h-8"
                />
                <div className="flex gap-1">
                  <Button size="sm" className="h-7 text-xs" onClick={handleCreateTask}>Create</Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setIsCreating(false); setNewTaskTitle(''); }}>Cancel</Button>
                </div>
              </div>
            )}

            {loading ? (
              <div className="p-4 text-center text-gray-500 text-sm">Loading...</div>
            ) : tasks.length === 0 ? (
              <div className="p-4 text-center text-gray-400 text-sm">No pending tasks</div>
            ) : (
              <div className="divide-y">
                {tasks.map((task) => {
                  const isEditing = editingTaskId === task.id;
                  const isAssigning = assigningTaskId === task.id;
                  const assignedUsers = (task.assigned_to_user_ids || []).map(id => users.find(u => u.id === id)).filter(Boolean);

                  return (
                    <div key={task.id} className="p-3 hover:bg-gray-50 transition-colors group">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          {isEditing ? (
                            <div className="flex gap-1 items-center">
                              <Input
                                value={editingTitle}
                                onChange={e => setEditingTitle(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') handleSaveEdit(task.id);
                                  if (e.key === 'Escape') setEditingTaskId(null);
                                }}
                                autoFocus
                                className="text-xs h-7 flex-1"
                              />
                              <button onClick={() => handleSaveEdit(task.id)} className="text-green-600 hover:text-green-700 flex-shrink-0">
                                <Check size={14} />
                              </button>
                              <button onClick={() => setEditingTaskId(null)} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
                                <X size={14} />
                              </button>
                            </div>
                          ) : (
                            <p className="text-sm font-medium text-gray-800 line-clamp-2">{task.title}</p>
                          )}
                          <p className="text-xs text-gray-400 mt-0.5">
                            From: {new Date(task.created_date).toLocaleDateString('en-GB', { year: '2-digit', month: '2-digit', day: '2-digit' })}
                          </p>
                          {/* Assigned users avatars */}
                          {assignedUsers.length > 0 && (
                            <div className="flex items-center gap-0.5 mt-1">
                              {assignedUsers.slice(0, 4).map(u => (
                                <div key={u.id} title={u.full_name || u.email} className="w-5 h-5 rounded-full bg-blue-500 text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0">
                                  {getUserInitials(u)}
                                </div>
                              ))}
                              {assignedUsers.length > 4 && <span className="text-[9px] text-gray-400">+{assignedUsers.length - 4}</span>}
                            </div>
                          )}
                        </div>

                        {/* Action buttons */}
                        {!isEditing && (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                            <button onClick={() => { handleStartEdit(task); }} className="text-gray-400 hover:text-blue-500" title="Edit">
                              <Pencil size={13} />
                            </button>
                            <button
                              onClick={() => setAssigningTaskId(isAssigning ? null : task.id)}
                              className={`${isAssigning ? 'text-blue-500' : 'text-gray-400 hover:text-blue-500'}`}
                              title="Assign"
                            >
                              <UserPlus size={13} />
                            </button>
                            <button onClick={() => handleDeleteTask(task.id)} className="text-gray-400 hover:text-red-500" title="Delete">
                              <X size={13} />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Assign dropdown */}
                      {isAssigning && (
                        <div className="mt-2 bg-white border border-gray-200 rounded-md shadow-md max-h-40 overflow-y-auto">
                          {users.filter(u => !u.archived).slice(0, 20).map(u => {
                            const isAssigned = (task.assigned_to_user_ids || []).includes(u.id);
                            return (
                              <button
                                key={u.id}
                                onClick={() => handleToggleAssign(task, u.id)}
                                className={`w-full flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 text-left transition-colors ${isAssigned ? 'bg-blue-50' : ''}`}
                              >
                                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0 ${isAssigned ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'}`}>
                                  {getUserInitials(u)}
                                </div>
                                <span className="text-xs text-gray-700 truncate">{u.full_name || u.email}</span>
                                {isAssigned && <Check size={11} className="text-blue-500 ml-auto flex-shrink-0" />}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* New Task Button */}
            {!isCreating && (
              <div className="p-2 border-t bg-gray-50">
                <Button size="sm" variant="outline" className="w-full h-8 text-xs gap-1" onClick={() => setIsCreating(true)}>
                  <Plus size={14} />
                  New task
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}