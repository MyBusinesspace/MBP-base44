import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useData } from "../components/DataProvider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit3, Check, X, StopCircle } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import WidgetChrome from "../components/dashboard/WidgetChrome";
import ClientsWidget from "../components/dashboard/widgets/ClientsWidget";
import ProjectsWidget from "../components/dashboard/widgets/ProjectsWidget";
import TodayOrdersWidget from "../components/dashboard/widgets/TodayOrdersWidget";
import ActiveWorkersWidget from "../components/dashboard/widgets/ActiveWorkersWidget";
import LateWorkersWidget from "../components/dashboard/widgets/LateWorkersWidget";
import LeavesWidget from "../components/dashboard/widgets/LeavesWidget";
import { AppSettings, TimeEntry } from "@/entities/all";
import { createPageUrl } from "@/utils";
import WeekOrdersWidget from "../components/dashboard/widgets/WeekOrdersWidget";
import ActiveMapWidget from "../components/dashboard/widgets/ActiveMapWidget";
import FavoriteContactsWidget from "../components/dashboard/widgets/FavoriteContactsWidget";
import ChatCompactWidget from "../components/dashboard/widgets/ChatCompactWidget";
import TeamPerformanceWidget from "../components/dashboard/widgets/TeamPerformanceWidget";
import ProjectActivityWidget from "../components/dashboard/widgets/ProjectActivityWidget";
import WorkOrdersStatsWidget from "../components/dashboard/widgets/WorkOrdersStatsWidget";
import CalendarThisWeekWidget from "../components/dashboard/widgets/CalendarThisWeekWidget";
import CalendarNextWeekWidget from "../components/dashboard/widgets/CalendarNextWeekWidget";
import PendingTasksWidget from "../components/dashboard/widgets/PendingTasksWidget";
import WorkersStatusWidget from "../components/dashboard/widgets/WorkersStatusWidget";
import WeekTasksAndEventsWidget from "../components/dashboard/widgets/WeekTasksAndEventsWidget";
import ClockInForm from "../components/timer/ClockInForm";
import ClockOutDialog from "../components/timer/ClockOutDialog";
import ActiveSessionTimer from "../components/timer/ActiveSessionTimer";
import { toast } from "sonner";

const WIDGET_REGISTRY = {
  clients: { title: "Clients", component: ClientsWidget, page: "clients" },
  projects: { title: "Projects", component: ProjectsWidget, page: "projects" },
  today_orders: { title: "Today's Work Orders", component: TodayOrdersWidget, page: "work-orders" },
  active_workers: { title: "Active Workers", component: ActiveWorkersWidget, page: "time-tracker" },
  late_workers: { title: "Late Workers Today", component: LateWorkersWidget, page: "time-tracker" },
  leaves: { title: "Leaves & Absences", component: LeavesWidget, page: "leave-absences" },
  week_planner: { title: "This Week - Planner", component: WeekOrdersWidget, page: "work-orders" },
  active_map: { title: "Active Map", component: ActiveMapWidget, page: "time-tracker" },
  favorite_contacts: { title: "Favorite Contacts", component: FavoriteContactsWidget, page: "contacts" },
  chat_compact: { title: "Chat", component: ChatCompactWidget, page: "chat" },
  team_performance: { title: "Team Performance", component: TeamPerformanceWidget, page: "analytics" },
  project_activity: { title: "Project Activity", component: ProjectActivityWidget, page: "analytics" },
  wo_stats: { title: "Work Orders Stats", component: WorkOrdersStatsWidget, page: "analytics" },
  calendar_this_week: { title: "This Week Events", component: CalendarThisWeekWidget, page: "calendar" },
  calendar_next_week: { title: "Next Week Events", component: CalendarNextWeekWidget, page: "calendar" },
  pending_tasks: { title: "Pending Tasks", component: PendingTasksWidget, page: "quick-tasks" },
  workers_status: { title: "Workers Status", component: WorkersStatusWidget, page: null },
  week_tasks_events: { title: "This Week Tasks & Events", component: WeekTasksAndEventsWidget, page: null },
};

const DEFAULT_LAYOUT = [
  { id: "w_clients", type: "clients", size: "sm", hidden: false },
  { id: "w_projects", type: "projects", size: "sm", hidden: false },
  { id: "w_workers_status", type: "workers_status", size: "sm", hidden: false },
  { id: "w_today_orders", type: "today_orders", size: "lg", hidden: false },
  { id: "w_active_workers", type: "active_workers", size: "sm", hidden: false },
  { id: "w_late_workers", type: "late_workers", size: "sm", hidden: false },
  { id: "w_leaves", type: "leaves", size: "sm", hidden: false },
  { id: "w_team_perf", type: "team_performance", size: "lg", hidden: false },
  { id: "w_proj_activity", type: "project_activity", size: "lg", hidden: false },
  { id: "w_wo_stats", type: "wo_stats", size: "lg", hidden: false },
];

const SETTINGS_KEY = "dashboard_layout_v2";

export default function Dashboard() {
  const { currentCompany, projects, users, teams, customers, assets, workOrderCategories, shiftTypes, currentUser } = useData();
  const [editing, setEditing] = useState(false);
  const [layout, setLayout] = useState(DEFAULT_LAYOUT);
  const [saving, setSaving] = useState(false);
  const [allWorkOrders, setAllWorkOrders] = useState([]);
  const [activeTimeEntry, setActiveTimeEntry] = useState(null);
  const [showClockOutDialog, setShowClockOutDialog] = useState(false);

  const loadLayout = useCallback(async () => {
    try {
      const rows = await AppSettings.filter({ setting_key: SETTINGS_KEY });
      if (Array.isArray(rows) && rows.length > 0 && rows[0].setting_value) {
        const parsed = JSON.parse(rows[0].setting_value);
        if (Array.isArray(parsed) && parsed.length > 0) setLayout(parsed);
      }
    } catch (_) {
      // ignore; keep default
    }
  }, []);

  const saveLayout = useCallback(async (nextLayout) => {
    setSaving(true);
    try {
      const rows = await AppSettings.filter({ setting_key: SETTINGS_KEY });
      const payload = { setting_key: SETTINGS_KEY, setting_value: JSON.stringify(nextLayout) };
      if (Array.isArray(rows) && rows.length > 0) {
        await AppSettings.update(rows[0].id, payload);
      } else {
        await AppSettings.create(payload);
      }
    } finally {
      setSaving(false);
    }
  }, []);

  useEffect(() => { loadLayout(); }, [loadLayout]);

  const loadActiveTimeEntry = useCallback(async () => {
    try {
      if (currentCompany && currentUser?.id) {
        const active = await TimeEntry.filter({
          employee_id: currentUser.id,
          is_active: true,
        });
        setActiveTimeEntry(active.length > 0 ? active[0] : null);
      }
    } catch (e) {
      console.error("Error loading active time entry:", e);
      setActiveTimeEntry(null);
    }
  }, [currentCompany, currentUser?.id]);

  const loadWorkOrders = useCallback(async () => {
    try {
      if (currentCompany) {
        const wos = await TimeEntry.filter({
          branch_id: currentCompany.id,
          status: { $ne: "closed" },
        }, '-updated_date', 1000);
        setAllWorkOrders(wos);
      }
    } catch (e) {
      console.error("Error loading work orders:", e);
      setAllWorkOrders([]);
    }
  }, [currentCompany]);

  useEffect(() => {
    loadActiveTimeEntry();
    loadWorkOrders();

    const unsubscribe = TimeEntry.subscribe((event) => {
      if (event.type === 'create' || event.type === 'update' || event.type === 'delete') {
        loadWorkOrders();
        if (event.data?.employee_id === currentUser?.id) {
          loadActiveTimeEntry();
        }
      }
    });

    return () => unsubscribe();
  }, [loadActiveTimeEntry, loadWorkOrders, currentUser?.id]);

  const handleClockIn = async (entryData) => {
    try {
      const newTimeEntry = await TimeEntry.create({
        ...entryData,
        start_time: new Date().toISOString(),
        is_active: true,
        created_by: currentUser.email,
      });
      setActiveTimeEntry(newTimeEntry);
      loadWorkOrders();
      toast.success("Clocked in successfully!");
    } catch (error) {
      console.error("Failed to clock in:", error);
      toast.error("Failed to clock in.");
      throw error;
    }
  };

  const handleClockOut = async (status, newWorkOrder, newTask) => {
    if (!activeTimeEntry) return;

    try {
      const updateData = {
        end_time: new Date().toISOString(),
        is_active: false,
        task_status: status,
      };

      await TimeEntry.update(activeTimeEntry.id, updateData);

      // If a new work order/task was selected, immediately clock into it
      if (newWorkOrder && newTask) {
        await handleClockIn({
          project_id: newWorkOrder.project_id,
          work_order_id: newWorkOrder.id,
          task_id: newTask.id,
          task: newTask.name,
        });
        toast.success("Switched to new work order and clocked in!");
      } else {
        setActiveTimeEntry(null);
        toast.success("Clocked out successfully!");
      }
      setShowClockOutDialog(false);
      loadWorkOrders();
    } catch (error) {
      console.error("Failed to clock out:", error);
      toast.error("Failed to clock out.");
    }
  };

  const availableToAdd = useMemo(() => {
    // Include ALL widgets that exist in layout (even hidden ones) to avoid duplicates
    const used = new Set(layout.map((w) => w.type));
    return Object.entries(WIDGET_REGISTRY)
      .filter(([type]) => !used.has(type))
      .map(([type, meta]) => ({ type, title: meta.title }));
  }, [layout]);

  const hiddenWidgets = useMemo(() => {
    return layout
      .filter(w => w.hidden)
      .map(w => {
        const meta = WIDGET_REGISTRY[w.type];
        return { ...w, title: meta?.title || w.type };
      });
  }, [layout]);

  const onDragEnd = (result) => {
    if (!result.destination) return;
    const next = Array.from(layout);
    const [moved] = next.splice(result.source.index, 1);
    next.splice(result.destination.index, 0, moved);
    setLayout(next);
    saveLayout(next);
  };

  const toggleSize = (id) => {
    setLayout((prev) => {
      const widget = prev.find(w => w.id === id);
      if (!widget) return prev;
      
      // Cycle through sizes: sm -> tall -> wide -> sm
      let newSize;
      if (widget.size === 'sm') newSize = 'tall';
      else if (widget.size === 'tall') newSize = 'wide';
      else newSize = 'sm';
      
      const next = prev.map((w) => (w.id === id ? { ...w, size: newSize } : w));
      saveLayout(next);
      return next;
    });
  };

  const toggleHidden = (id) => {
    setLayout((prev) => {
      const next = prev.map((w) => (w.id === id ? { ...w, hidden: !w.hidden } : w));
      saveLayout(next);
      return next;
    });
  };

  const removeWidget = (id) => {
    setLayout((prev) => {
      const next = prev.filter((w) => w.id !== id);
      saveLayout(next);
      return next;
    });
  };

  const addWidget = (type) => {
    const id = `${type}_${Math.random().toString(36).slice(2, 7)}`;
    const newItem = { id, type, size: "sm", hidden: false };
    const next = [...layout, newItem];
    setLayout(next);
    saveLayout(next);
  };

  return (
    <div className="min-h-screen bg-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-1 h-6 bg-slate-900 rounded-sm"></div>
            <h1 className="text-xl font-bold text-slate-900">Business Overview</h1>
            {saving && <Badge variant="outline" className="text-xs">Saving...</Badge>}
          </div>
          <div className="flex items-center gap-2">
            {editing && (
              <div className="flex items-center gap-2 flex-wrap">
                {hiddenWidgets.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    {hiddenWidgets.map((w) => (
                      <Button key={w.id} variant="ghost" size="sm" className="text-xs h-8" onClick={() => toggleHidden(w.id)}>
                        <Plus className="w-3 h-3 mr-1" /> {w.title}
                      </Button>
                    ))}
                  </div>
                )}
                {availableToAdd.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    {availableToAdd.map((w) => (
                      <Button key={w.type} variant="ghost" size="sm" className="text-xs h-8" onClick={() => addWidget(w.type)}>
                        <Plus className="w-3 h-3 mr-1" /> {w.title}
                      </Button>
                    ))}
                  </div>
                )}
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="text-xs h-8"
                  onClick={() => {
                    setLayout(DEFAULT_LAYOUT);
                    saveLayout(DEFAULT_LAYOUT);
                  }}
                >
                  Reset
                </Button>
              </div>
            )}
            <Button variant="ghost" size="sm" className="text-xs h-8 gap-1" onClick={() => setEditing((v) => !v)}>
              {editing ? <><Check className="w-3 h-3" /> Done</> : <><Edit3 className="w-3 h-3" /> Edit homepage</>}
            </Button>
          </div>
        </div>

        {editing && (
          <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-xs text-slate-700">
              Add, remove, resize and reorder widgets. Drag widgets near screen edges for auto-scroll.
            </p>
          </div>
        )}

        {/* Clock In/Out Section */}
        {activeTimeEntry && (
          <div className="mb-6 space-y-4">
            <ActiveSessionTimer 
              entry={activeTimeEntry} 
              project={projects.find(p => p.id === activeTimeEntry?.project_id)}
              task={activeTimeEntry?.task_id ? activeTimeEntry.tasks?.find(t => t.id === activeTimeEntry.task_id) : null}
            />
            <div className="flex justify-center">
              <Button variant="destructive" onClick={() => setShowClockOutDialog(true)} className="px-6 py-3 font-semibold text-white shadow-lg transition-all duration-200 hover:scale-[1.02] hover:shadow-xl">
                <StopCircle className="w-5 h-5 mr-2" />
                Stop
              </Button>
            </div>
          </div>
        )}

        <ClockOutDialog
          isOpen={showClockOutDialog}
          onClose={() => setShowClockOutDialog(false)}
          onConfirm={handleClockOut}
          entry={activeTimeEntry}
          project={projects.find(p => p.id === activeTimeEntry?.project_id)}
          task={activeTimeEntry?.task_id ? activeTimeEntry.tasks?.find(t => t.id === activeTimeEntry.task_id) : null}
          allWorkOrders={allWorkOrders}
          projects={projects}
          users={users}
          teams={teams}
          customers={customers}
          assets={assets}
          categories={workOrderCategories}
          shiftTypes={shiftTypes}
          currentUser={currentUser}
        />

        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="dashboard" direction="vertical">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps} className="grid grid-cols-1 md:grid-cols-3 gap-5" style={{ gridAutoRows: '320px' }}>
                {layout.filter(item => !item.hidden).map((item, index) => {
                  const meta = WIDGET_REGISTRY[item.type];
                  if (!meta) return null;
                  const Comp = meta.component;

                  // 3 tamaños exactos: cuadrado (1x1), vertical (1x2), horizontal (2x1)
                  let gridClass = "col-span-1 row-span-1"; // sm: cuadrado 1L x 1H
                  if (item.size === "tall") gridClass = "col-span-1 row-span-2"; // tall: vertical 1L x 2H
                  if (item.size === "wide" || item.size === "lg") gridClass = "col-span-2 row-span-1"; // wide/lg: horizontal 2L x 1H

                  return (
                    <Draggable draggableId={item.id} index={index} key={item.id} isDragDisabled={!editing}>
                      {(drag, snapshot) => (
                        <div
                          ref={drag.innerRef}
                          {...drag.draggableProps}
                          className={`${gridClass} ${snapshot.isDragging ? 'opacity-80 scale-105 shadow-2xl z-50' : ''} transition-all duration-200`}
                          onDragOver={(e) => {
                            if (!editing) return;
                            const threshold = 100;
                            const scrollSpeed = 10;
                            
                            // Auto-scroll when dragging near edges
                            if (e.clientY < threshold) {
                              window.scrollBy({ top: -scrollSpeed, behavior: 'smooth' });
                            } else if (e.clientY > window.innerHeight - threshold) {
                              window.scrollBy({ top: scrollSpeed, behavior: 'smooth' });
                            }
                          }}
                        >
                          <WidgetChrome
                            title={meta.title}
                            editing={editing}
                            onRemove={() => removeWidget(item.id)}
                            onToggleHeight={() => toggleSize(item.id)}
                            onToggleHidden={() => toggleHidden(item.id)}
                            size={item.size}
                            hidden={item.hidden}
                            dragHandleProps={drag.dragHandleProps}
                            pageUrl={meta.page ? createPageUrl(meta.page) : undefined}
                            onPin={() => {}}
                          >
                            <Comp size={item.size} maxItems={6} editing={editing} />
                          </WidgetChrome>
                        </div>
                      )}
                    </Draggable>
                  );
                })}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </div>
    </div>
  );
}