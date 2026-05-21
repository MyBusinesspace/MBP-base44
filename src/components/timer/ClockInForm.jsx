import React, { useState } from 'react';
import { useData } from '../DataProvider';
import { Button } from '@/components/ui/button';
import { Play, Clock, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import StickFigureAnimation from '../StickFigureAnimation';
import WorkOrderSelectionDialog from '../time-tracker/WorkOrderSelectionDialog';

export default function ClockInForm({ onClockIn, activeEntry = null, allWorkOrders, projects, users, teams, customers, assets, categories, shiftTypes, onWorkOrderCreated }) {
  const { currentUser } = useData();
  const [newEntry, setNewEntry] = useState({
    employee_id: currentUser?.id || '',
    project_id: '',
    work_order_id: '',
    task_id: '',
    task: '',
  });
  const [isClockingIn, setIsClockingIn] = useState(false);
  const [showWorkOrderSelection, setShowWorkOrderSelection] = useState(false);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);

  const handleSubmit = async () => {
    if (activeEntry) {
      alert("❌ Ya hay una sesión de trabajo activa. Termínala antes de comenzar una nueva.");
      return;
    }

    if (!newEntry.work_order_id || !newEntry.task_id) {
      alert("❌ Por favor selecciona un orden de trabajo y una tarea.");
      return;
    }

    setIsClockingIn(true);
    try {
      const entryWithCurrentUser = {
        ...newEntry,
        employee_id: currentUser.id
      };
      
      await onClockIn(entryWithCurrentUser);
      
      // Reset form after successful clock in
      setNewEntry({
        employee_id: currentUser.id,
        project_id: '',
        work_order_id: '',
        task_id: '',
        task: '',
      });
      setSelectedWorkOrder(null);
      setSelectedTask(null);
    } catch (error) {
      console.error("Clock in failed:", error);
      alert("❌ Error al hacer clock in. Por favor intenta de nuevo.");
    } finally {
      setIsClockingIn(false);
    }
  };

  const canSubmit = newEntry.work_order_id && newEntry.task_id && !activeEntry && !isClockingIn;

  const handleSelectWorkOrder = (wo, task) => {
    setSelectedWorkOrder(wo);
    setSelectedTask(task);
    setNewEntry(prev => ({
      ...prev,
      project_id: wo.project_id,
      work_order_id: wo.id,
      task_id: task.id,
      task: task.name,
    }));
    setShowWorkOrderSelection(false);
  };

  const getProjectName = (projectId) => {
    return projects?.find(p => p.id === projectId)?.name || 'Unknown Project';
  };

  if (activeEntry) {
    return (
      <Card className="bg-gradient-to-br from-orange-50 to-yellow-50 border-2 border-orange-200">
        <CardContent className="p-6">
          <div className="flex items-center justify-center gap-3 text-orange-700">
            <AlertTriangle className="w-6 h-6" />
            <span className="font-medium">
              Ya hay una sesión de trabajo activa. Complétala antes de comenzar una nueva.
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="bg-gradient-to-br from-green-50 to-blue-50 border-2 border-green-200 shadow-lg">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <div className="flex items-center gap-3">
              <Clock className="w-6 h-6 text-green-600" />
              <span>Start Your Work Day</span>
              <StickFigureAnimation 
                size={40}
                isActive={isClockingIn}
                animationType="walking"
                color="#16a34a"
              />
            </div>
          </CardTitle>
          <p className="text-sm text-gray-600">Select your work order and task to begin tracking time</p>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Work Order & Task</label>
                <Button
                  variant="outline"
                  className="w-full h-11 justify-start text-left font-normal"
                  onClick={() => setShowWorkOrderSelection(true)}
                >
                  {selectedWorkOrder && selectedTask
                    ? `WO: ${selectedWorkOrder.work_order_number || selectedWorkOrder.title} / ${selectedTask.name}`
                    : "Select Work Order and Task"}
                </Button>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Project</label>
                <div className="w-full h-11 px-3 py-2 border border-gray-300 rounded-md bg-gray-50 flex items-center text-sm text-gray-600">
                  {selectedWorkOrder ? getProjectName(selectedWorkOrder.project_id) : 'Select work order first'}
                </div>
              </div>
            </div>
            
            <Button 
              onClick={handleSubmit} 
              size="lg" 
              disabled={!canSubmit}
              className={`h-11 px-6 shadow-lg hover:shadow-xl transition-all duration-200 ${
                canSubmit 
                  ? 'bg-green-600 hover:bg-green-700 text-white font-semibold'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {isClockingIn ? (
                <>
                  <Clock className="w-5 h-5 mr-2 animate-spin" />
                  Clocking In...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5 mr-2" />
                  Clock In
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {showWorkOrderSelection && (
        <WorkOrderSelectionDialog
          isOpen={showWorkOrderSelection}
          onClose={() => setShowWorkOrderSelection(false)}
          workOrders={allWorkOrders || []}
          onSelectWorkOrder={handleSelectWorkOrder}
          onSelectTask={handleSelectWorkOrder}
          activeWorkOrderId={selectedWorkOrder?.id}
          activeTaskId={selectedTask?.id}
          currentUser={currentUser}
          onWorkOrderCreated={onWorkOrderCreated}
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