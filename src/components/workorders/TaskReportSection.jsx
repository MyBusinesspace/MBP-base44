import React from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Upload, Eye, Trash2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import DynamicChecklist from './DynamicChecklist';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { parseISO, isFuture, startOfDay, isToday } from 'date-fns';

// A task is "future" (no report data allowed) if its date is today or later AND no clock-in has happened yet
const isTaskFuture = (task) => {
  if (!task.date) return false;
  try {
    const taskDay = startOfDay(parseISO(task.date + 'T00:00:00'));
    const today = startOfDay(new Date());
    // Task is future if its date is strictly after today
    return taskDay > today;
  } catch {
    return false;
  }
};

export default function TaskReportSection({ 
  formData, 
  setFormData, 
  isReadOnly, 
  createMode,
  isUploadingOtherFiles,
  setIsUploadingOtherFiles,
  clientSignatureUrl,
  safeUsers = []
}) {
  if (!formData.tasks || formData.tasks.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <p className="text-sm">No tasks created yet. Go to Order tab to add tasks.</p>
      </div>
    );
  }

  // Only show the first task — one task per work order
  const tasksToShow = formData.tasks.slice(0, 1);

  return (
    <div className="space-y-4">
      {tasksToShow.map((task, taskIndex) => {
        const taskUsers = (task.employee_ids || [])
          .map(id => safeUsers.find(u => u.id === id))
          .filter(Boolean);
        const futureTask = isTaskFuture(task);
        const blockReport = false; // Always show report fields, even for future tasks

        return (
          <div key={task.id} className="rounded-xl border border-indigo-400 bg-white shadow-sm">
            <div className="bg-indigo-50 px-4 py-3 border-b border-indigo-200 rounded-t-xl">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-indigo-900">
                    Task {taskIndex + 1}: {task.name || 'Unnamed Task'}
                    {task.ref && (
                      <span className="ml-2 text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-200 text-indigo-800">{task.ref}</span>
                    )}
                  </h3>
                  <p className="text-xs text-indigo-700 mt-0.5">
                    {task.date || ''} • {task.start_time || ''} - {task.end_time || ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    value={task.status || 'pending'}
                    onValueChange={(value) => {
                      const updatedTasks = [...formData.tasks];
                      updatedTasks[taskIndex] = { ...task, status: value };
                      setFormData({ ...formData, tasks: updatedTasks });
                    }}
                    disabled={(isReadOnly && !createMode) || blockReport}
                  >
                    <SelectTrigger className="h-7 w-32 text-xs border-0 bg-white">
                      <SelectValue>
                        {task.status === 'completed' ? '✅ Completed' : '🔄 Pending'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">🔄 Pending</SelectItem>
                      <SelectItem value="completed">✅ Completed</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-2">
                    {clientSignatureUrl ? (
                      <div className="flex items-center gap-2 bg-white px-2 py-1 rounded border border-green-200">
                        <span className="text-xs font-semibold text-green-600">✓ Signed</span>
                        <img
                          src={clientSignatureUrl}
                          alt="Signature"
                          className="h-6 object-contain"
                          crossOrigin="anonymous"
                        />
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 bg-white px-2 py-1 rounded">
                        <span className="text-xs font-semibold text-slate-400">Not signed</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {blockReport ? (
              <div className="p-6 text-center text-slate-400 text-sm bg-slate-50 rounded-b-xl">
                <p className="font-medium text-slate-500">📅 Future task — no report data yet</p>
                <p className="text-xs mt-1 text-slate-400">Time tracker data and report fields will be available on or after <strong>{task.date}</strong></p>
              </div>
            ) : (
            <div className="p-6 space-y-6">
              {/* Section label */}
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Task realized / Spare supplied
              </label>

              {/* Describe here your work */}
              <div>
                <label className="text-xs font-medium text-slate-700 mb-2 block">Describe here your work</label>
                <div className="border border-slate-200 rounded-lg p-3">
                  <DynamicChecklist
                    items={task.work_done_items || []}
                    onChange={(items) => {
                      const updatedTasks = [...formData.tasks];
                      updatedTasks[taskIndex] = { ...task, work_done_items: items };
                      setFormData({ ...formData, tasks: updatedTasks });
                    }}
                    placeholder="Describe work done..."
                    disabled={isReadOnly && !createMode}
                    taskUsers={taskUsers}
                  />
                </div>
              </div>

              {/* Spare parts installed */}
              <div>
                <label className="text-xs font-medium text-slate-700 mb-2 block">Spare parts installed</label>
                <div className="border border-slate-200 rounded-lg p-3">
                  <DynamicChecklist
                    items={task.spare_parts_items || []}
                    onChange={(items) => {
                      const updatedTasks = [...formData.tasks];
                      updatedTasks[taskIndex] = { ...task, spare_parts_items: items };
                      setFormData({ ...formData, tasks: updatedTasks });
                    }}
                    placeholder="List spare part..."
                    disabled={isReadOnly && !createMode}
                    taskUsers={taskUsers}
                  />
                </div>
              </div>

              {/* Section label */}
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block pt-2">
                Tasks Pending / Spare pending
              </label>

              {/* Work pending */}
              <div>
                <label className="text-xs font-medium text-slate-700 mb-2 block">Work pending</label>
                <div className="border border-slate-200 rounded-lg p-3">
                  <DynamicChecklist
                    items={task.work_pending_items || []}
                    onChange={(items) => {
                      const updatedTasks = [...formData.tasks];
                      updatedTasks[taskIndex] = { ...task, work_pending_items: items };
                      setFormData({ ...formData, tasks: updatedTasks });
                    }}
                    placeholder="List pending work..."
                    disabled={isReadOnly && !createMode}
                    taskUsers={taskUsers}
                  />
                </div>
              </div>

              {/* Spare parts pending */}
              <div>
                <label className="text-xs font-medium text-slate-700 mb-2 block">Spare parts pending</label>
                <div className="border border-slate-200 rounded-lg p-3">
                  <DynamicChecklist
                    items={task.spare_parts_pending_items || []}
                    onChange={(items) => {
                      const updatedTasks = [...formData.tasks];
                      updatedTasks[taskIndex] = { ...task, spare_parts_pending_items: items };
                      setFormData({ ...formData, tasks: updatedTasks });
                    }}
                    placeholder="List pending spare part..."
                    disabled={isReadOnly && !createMode}
                    taskUsers={taskUsers}
                  />
                </div>
              </div>

              {/* Other Photos / Documents for this Task */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-slate-700">
                    📷 Task Photos / Documents
                  </label>
                  {!isReadOnly && (
                    <div>
                      <input
                        type="file"
                        id={`file-upload-task-${taskIndex}`}
                        multiple
                        onChange={async (e) => {
                          const files = Array.from(e.target.files);
                          if (files.length === 0) return;
                          setIsUploadingOtherFiles(true);
                          try {
                            const uploadedUrls = [];
                            for (const file of files) {
                              const { file_url } = await base44.integrations.Core.UploadFile({ file });
                              uploadedUrls.push(file_url);
                            }
                            const updatedTasks = [...formData.tasks];
                            updatedTasks[taskIndex] = {
                              ...task,
                              other_file_urls: [...(task.other_file_urls || []), ...uploadedUrls]
                            };
                            setFormData({ ...formData, tasks: updatedTasks });
                            toast.success(`${files.length} file(s) uploaded`);
                          } catch (error) {
                            toast.error('Failed to upload files');
                          } finally {
                            setIsUploadingOtherFiles(false);
                            e.target.value = '';
                          }
                        }}
                        className="hidden"
                        accept="image/*,application/pdf"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => document.getElementById(`file-upload-task-${taskIndex}`).click()}
                        disabled={isUploadingOtherFiles}
                        className="text-xs h-7"
                      >
                        {isUploadingOtherFiles ? (
                          <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Uploading...</>
                        ) : (
                          <><Upload className="w-3 h-3 mr-1" />Upload</>
                        )}
                      </Button>
                    </div>
                  )}
                </div>

                {(!task.other_file_urls || task.other_file_urls.length === 0) ? (
                  <div className="text-center py-4 border border-slate-200 rounded-lg bg-slate-50">
                    <p className="text-xs text-slate-500">No files</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {task.other_file_urls.map((fileUrl, fileIndex) => {
                      const fileName = fileUrl.split('/').pop() || `File ${fileIndex + 1}`;
                      return (
                        <div key={fileIndex} className="relative border border-slate-200 rounded-lg p-2 bg-slate-50 hover:bg-slate-100 transition-colors group">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs truncate flex-1">{fileName}</span>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button variant="ghost" size="sm" onClick={() => window.open(fileUrl, '_blank')} className="h-6 w-6 p-0">
                                <Eye className="w-3 h-3" />
                              </Button>
                              {!isReadOnly && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    const updatedTasks = [...formData.tasks];
                                    updatedTasks[taskIndex] = {
                                      ...task,
                                      other_file_urls: (task.other_file_urls || []).filter((_, i) => i !== fileIndex)
                                    };
                                    setFormData({ ...formData, tasks: updatedTasks });
                                    toast.success('File removed');
                                  }}
                                  className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            )}
          </div>
        );
      })}
    </div>
  );
}