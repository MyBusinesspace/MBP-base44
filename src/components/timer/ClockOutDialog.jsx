import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, RotateCcw } from 'lucide-react';
import WorkOrderSelectionDialog from '../time-tracker/WorkOrderSelectionDialog';

const taskStatusOptions = {
  "on going": { label: "On Going", color: "bg-blue-100 text-blue-800" },
  "finished": { label: "Finished", color: "bg-green-100 text-green-800" },
  "cancelled": { label: "Cancelled", color: "bg-red-100 text-red-800" }
};

export default function ClockOutDialog({
  isOpen,
  onClose,
  onConfirm, // Now expects (status, newWorkOrder, newTask)
  entry,
  project,
  task,
  isLoading,
  allWorkOrders,
  projects,
  users,
  teams,
  customers,
  assets,
  categories,
  shiftTypes,
  currentUser
}) {
  const [selectedStatus, setSelectedStatus] = useState('');
  const [error, setError] = useState('');
  const [showWorkOrderSelection, setShowWorkOrderSelection] = useState(false);
  const [newSelectedWorkOrder, setNewSelectedWorkOrder] = useState(null);
  const [newSelectedTask, setNewSelectedTask] = useState(null);

  const handleConfirm = () => {
    if (!selectedStatus) {
      setError('Please select a task status before clocking out');
      return;
    }
    
    setError('');
    onConfirm(selectedStatus, newSelectedWorkOrder, newSelectedTask);
    setSelectedStatus('');
    setNewSelectedWorkOrder(null);
    setNewSelectedTask(null);
  };

  const handleClose = () => {
    setSelectedStatus('');
    setError('');
    setNewSelectedWorkOrder(null);
    setNewSelectedTask(null);
    setShowWorkOrderSelection(false);
    onClose();
  };

  const handleSelectWorkOrderForSwitch = (wo, selectedTask) => {
    setNewSelectedWorkOrder(wo);
    setNewSelectedTask(selectedTask);
    setShowWorkOrderSelection(false);
  };

  return (
    <>
      <Dialog open={isOpen && !showWorkOrderSelection} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Clock Out Options
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="font-medium text-slate-900 mb-1">Current Session:</p>
              <p className="font-bold text-lg text-slate-900">{project?.name || 'Unknown Project'}</p>
              <p className="text-sm text-slate-600">WO: {entry?.work_order_number || 'N/A'} / Task: {task?.name || entry?.task || 'Unknown Task'}</p>
              <p className="text-xs text-slate-500">Started: {entry?.start_time ? new Date(entry.start_time).toLocaleString() : 'N/A'}</p>
            </div>

            <div className="border-t pt-4">
              <label className="block text-sm font-medium mb-2">
                Task Status <span className="text-red-500">*</span>
              </label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className={error ? 'border-red-300' : ''}>
                  <SelectValue placeholder="Select task status..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(taskStatusOptions).map(([status, config]) => (
                    <SelectItem key={status} value={status}>
                      <div className="flex items-center gap-2">
                        <Badge className={`${config.color} font-medium text-xs`}>
                          {config.label}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {error && (
                <div className="flex items-center gap-2 mt-2 text-red-600 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setShowWorkOrderSelection(true)}
                disabled={isLoading}
                className="flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Switch Work Order
              </Button>
              {newSelectedWorkOrder && newSelectedTask && (
                <div className="text-xs text-center text-gray-600 bg-blue-50 p-2 rounded">
                  Switching to: <span className="font-semibold">{newSelectedWorkOrder.work_order_number || newSelectedWorkOrder.title}</span> / <span className="font-semibold">{newSelectedTask.name}</span>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2 border-t">
              <Button 
                variant="outline" 
                onClick={handleClose}
                disabled={isLoading}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleConfirm}
                disabled={isLoading}
                className="flex-1 bg-red-600 hover:bg-red-700"
              >
                {isLoading ? (newSelectedWorkOrder ? 'Switching...' : 'Clocking out...') : (newSelectedWorkOrder ? 'Switch & Clock Out' : 'Clock Out')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Work Order Selection Dialog for Switching */}
      {showWorkOrderSelection && (
        <WorkOrderSelectionDialog
          isOpen={showWorkOrderSelection}
          onClose={() => setShowWorkOrderSelection(false)}
          workOrders={allWorkOrders || []}
          onSelectWorkOrder={handleSelectWorkOrderForSwitch}
          onSelectTask={handleSelectWorkOrderForSwitch}
          activeWorkOrderId={entry?.work_order_id}
          activeTaskId={entry?.task_id}
          currentUser={currentUser}
          projects={projects || []}
          users={users || []}
          teams={teams || []}
          customers={customers || []}
          assets={assets || []}
          categories={categories || []}
          shiftTypes={shiftTypes || []}
        />
      )}
    </>
  );
}