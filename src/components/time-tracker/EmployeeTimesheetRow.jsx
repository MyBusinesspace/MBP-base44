import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Avatar from '../Avatar';
import { ChevronRight, Clock, Check, X, Edit3, LogOut } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

export default function EmployeeTimesheetRow({ employee, timesheets, todayWorkOrders, allWorkOrders, projects, customers, departments, isWorking, isAdmin, onApprove, onReject, onEditAndApprove, hoursSettings, onWorkOrderClick, isOnLeave, onForceClockOut }) {
  // Merge todayWorkOrders and allWorkOrders for lookups so we don't miss WOs not scheduled today
  const allWOs = allWorkOrders && allWorkOrders.length > 0 ? allWorkOrders : todayWorkOrders;
  const [expanded, setExpanded] = useState(false);
  const [editingTimesheetId, setEditingTimesheetId] = useState(null);
  const [editedClockIn, setEditedClockIn] = useState('');
  const [editedClockOut, setEditedClockOut] = useState('');
  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    if (!isWorking) return;
    const interval = setInterval(() => setCurrentTime(Date.now()), 60000);
    return () => clearInterval(interval);
  }, [isWorking]);

  const calculateHoursIfMissing = (timesheet) => {
    let totalMinutes = timesheet.total_duration_minutes || 0;
    if (timesheet.is_active && timesheet.clock_in_time) {
      const clockIn = new Date(timesheet.clock_in_time).getTime();
      totalMinutes = Math.floor((currentTime - clockIn) / 60000);
    }
    if (timesheet.regular_hours_calculated !== undefined && timesheet.regular_hours_calculated !== null && !timesheet.is_active) {
      return timesheet;
    }
    const totalHours = totalMinutes / 60;
    const regularHoursPerDay = hoursSettings.regular_hours_per_day || 8;
    const nonPayableOvertimeHours = hoursSettings.non_payable_overtime_hours || 0;
    let regularHours = 0, nonPayableOT = 0, paidOT = 0;
    if (totalHours <= regularHoursPerDay) {
      regularHours = totalHours;
    } else {
      regularHours = regularHoursPerDay;
      const extraHours = totalHours - regularHoursPerDay;
      if (extraHours <= nonPayableOvertimeHours) {
        nonPayableOT = extraHours;
      } else {
        nonPayableOT = nonPayableOvertimeHours;
        paidOT = extraHours - nonPayableOvertimeHours;
      }
    }
    return { ...timesheet, total_duration_minutes: totalMinutes, regular_hours_calculated: regularHours, overtime_hours_non_paid_calculated: nonPayableOT, overtime_hours_paid_calculated: paidOT };
  };

  const enrichedTimesheets = timesheets.map(ts => calculateHoursIfMissing(ts));
  const totalMinutes = enrichedTimesheets.reduce((sum, ts) => sum + (ts.total_duration_minutes || 0), 0);
  const totalRegularHours = enrichedTimesheets.reduce((sum, ts) => sum + (ts.regular_hours_calculated || 0), 0);
  const totalOvertimePaid = enrichedTimesheets.reduce((sum, ts) => sum + (ts.overtime_hours_paid_calculated || 0), 0);
  const totalOvertimeNonPaid = enrichedTimesheets.reduce((sum, ts) => sum + (ts.overtime_hours_non_paid_calculated || 0), 0);

  const totalDistance = enrichedTimesheets.reduce((sum, ts) => {
    if (!ts.live_tracking_points || ts.live_tracking_points.length < 2) return sum;
    let distance = 0;
    for (let i = 1; i < ts.live_tracking_points.length; i++) {
      const p1 = ts.live_tracking_points[i - 1];
      const p2 = ts.live_tracking_points[i];
      if (p1.lat && p1.lon && p2.lat && p2.lon) {
        const R = 6371;
        const dLat = (p2.lat - p1.lat) * Math.PI / 180;
        const dLon = (p2.lon - p1.lon) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
        distance += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      }
    }
    return sum + distance;
  }, 0);

  const getStatusBadge = (status) => {
    const badges = {
      active: { bg: 'bg-green-500', text: 'Active', icon: null },
      completed: { bg: 'bg-slate-500', text: 'Completed', icon: null },
      pending_approval: { bg: 'bg-yellow-500', text: 'Pending', icon: <Clock className="w-3 h-3" /> },
      approved: { bg: 'bg-green-600', text: 'Approved', icon: <Check className="w-3 h-3" /> },
      rejected: { bg: 'bg-red-600', text: 'Rejected', icon: <X className="w-3 h-3" /> }
    };
    const badge = badges[status] || badges.completed;
    return <Badge className={`${badge.bg} text-white text-[10px] py-0 px-2 flex items-center gap-1`}>{badge.icon}{badge.text}</Badge>;
  };

  const handleStartEdit = (timesheet) => {
    setEditingTimesheetId(timesheet.id);
    setEditedClockIn(format(parseISO(timesheet.clock_in_time), "yyyy-MM-dd'T'HH:mm"));
    setEditedClockOut(timesheet.clock_out_time ? format(parseISO(timesheet.clock_out_time), "yyyy-MM-dd'T'HH:mm") : '');
  };

  const handleCancelEdit = () => { setEditingTimesheetId(null); setEditedClockIn(''); setEditedClockOut(''); };
  const handleSaveEdit = (timesheet) => { onEditAndApprove(timesheet, editedClockIn, editedClockOut); handleCancelEdit(); };

  // Get active work info for the "Current Work" cell
  const activeTimesheet = timesheets.find(ts => ts.is_active);
  const activeSegment = activeTimesheet?.timesheet_type === 'field_work'
    ? (activeTimesheet?.work_order_segments || []).find(seg => !seg.end_time)
    : null;
  const activeWO = activeSegment ? allWOs.find(w => w.id === activeSegment.work_order_id) : null;
  const activeProject = activeWO ? projects.find(p => p.id === activeWO.project_id) : null;
  const activeCustomer = activeProject ? customers.find(c => c.id === activeProject.customer_id) : null;

  return (
    <>
      <tr className={cn("hover:bg-slate-50 cursor-pointer border-b border-slate-100", isWorking && "bg-green-50 hover:bg-green-100", isOnLeave && "bg-amber-50 hover:bg-amber-100")} onClick={() => setExpanded(!expanded)}>
        <td className="px-2 py-1.5"><ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? 'rotate-90' : ''}`} /></td>
        <td className="px-2 py-1.5">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Avatar user={employee} size="sm" />
              {isOnLeave && (
                <span className="absolute -top-1 -right-1 text-[10px]" title="On Leave">🏖️</span>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-medium text-slate-900 truncate">{employee?.nickname || employee?.first_name || 'Unknown'}</p>
                {isOnLeave && <Badge className="bg-amber-400 text-amber-900 text-[9px] py-0 px-1.5 font-semibold">ON LEAVE</Badge>}
              </div>
              <p className="text-xs text-slate-500 truncate">{employee?.job_role || '-'}</p>
            </div>
          </div>
        </td>
        <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
          {!activeTimesheet ? (
            <span className="text-xs text-slate-400">-</span>
          ) : activeTimesheet.timesheet_type === 'office_work' ? (
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <Badge className="bg-blue-500 text-white text-xs py-0 px-2">Office</Badge>
                <span className="text-xs text-slate-700">{departments.find(d => d.id === activeTimesheet.department_id)?.name || '-'}</span>
              </div>
            </div>
          ) : (
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <Badge className="bg-green-500 text-white text-xs py-0 px-2">Field</Badge>
                <button
                  onClick={(e) => { e.stopPropagation(); onWorkOrderClick && activeWO && onWorkOrderClick(activeWO); }}
                  className={cn("text-xs font-medium text-slate-900", activeWO && onWorkOrderClick ? "hover:text-blue-600 hover:underline cursor-pointer" : "")}
                >
                  {activeWO?.work_order_number || '-'}
                </button>
              </div>
              {activeProject && (
                <div className="text-[11px] text-slate-600 pl-1 truncate max-w-[220px]">📂 {activeProject.name}</div>
              )}
              {activeCustomer && (
                <div className="text-[11px] text-slate-500 pl-1 truncate max-w-[220px]">🏢 {activeCustomer.name}</div>
              )}
            </div>
          )}
        </td>
        <td className="px-2 py-1.5">
          <div className="text-sm">
            <div className="font-medium text-green-600">{totalRegularHours.toFixed(2)}h</div>
            {totalOvertimeNonPaid > 0 && <div className="text-[10px] text-orange-500">+{totalOvertimeNonPaid.toFixed(2)}h (unpaid)</div>}
          </div>
        </td>
        <td className="px-2 py-1.5">{totalOvertimePaid > 0 ? <div className="text-sm font-medium text-orange-600">{totalOvertimePaid.toFixed(2)}h</div> : <span className="text-xs text-slate-400">-</span>}</td>
        <td className="px-2 py-1.5"><div className="text-sm font-medium text-slate-900">{Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m</div></td>
        <td className="px-2 py-1.5">
          {totalDistance > 0 ? <div className="text-sm font-medium text-blue-600">{totalDistance.toFixed(1)} km</div> : <span className="text-xs text-slate-400">-</span>}
        </td>
        <td className="px-2 py-1.5"><Badge variant="outline" className="text-xs">{timesheets.length}</Badge></td>
        <td className="px-2 py-1.5">
          <div className="flex gap-1">
            {timesheets.filter(ts => ts.status === 'pending_approval').length > 0 && <Badge className="bg-yellow-500 text-white text-[10px]">{timesheets.filter(ts => ts.status === 'pending_approval').length} Pending</Badge>}
            {timesheets.filter(ts => ts.status === 'approved').length > 0 && <Badge className="bg-green-600 text-white text-[10px]">{timesheets.filter(ts => ts.status === 'approved').length} ✓</Badge>}
            {timesheets.filter(ts => ts.status === 'rejected').length > 0 && <Badge className="bg-red-600 text-white text-[10px]">{timesheets.filter(ts => ts.status === 'rejected').length} ✗</Badge>}
          </div>
        </td>
      </tr>

      {expanded && enrichedTimesheets.map(timesheet => {
        const segments = timesheet.work_order_segments || [];
        const needsApproval = timesheet.status === 'pending_approval';
        const isRejected = timesheet.status === 'rejected';
        const isApproved = timesheet.status === 'approved';
        const isEditing = editingTimesheetId === timesheet.id;

        return (
          <tr key={timesheet.id} className={`${needsApproval ? 'bg-yellow-50/50' : isRejected ? 'bg-red-50/50' : 'bg-slate-50/50'}`}>
            <td colSpan="9" className="px-2 py-2">
              <div className="ml-8 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm flex-1 flex-wrap">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${timesheet.is_active ? 'bg-green-500 animate-pulse' : 'bg-slate-400'}`}></div>
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <Input type="datetime-local" value={editedClockIn} onChange={(e) => setEditedClockIn(e.target.value)} className="h-7 text-xs w-40" onClick={(e) => e.stopPropagation()} />
                        <span className="text-slate-500">-</span>
                        <Input type="datetime-local" value={editedClockOut} onChange={(e) => setEditedClockOut(e.target.value)} className="h-7 text-xs w-40" onClick={(e) => e.stopPropagation()} />
                      </div>
                    ) : (
                      <>
                        <span className="font-medium">
                          {format(parseISO(timesheet.clock_in_time), 'HH:mm')}
                          {timesheet.clock_out_time && ` - ${format(parseISO(timesheet.clock_out_time), 'HH:mm')}`}
                        </span>
                        <span className="text-slate-500 text-xs">
                          ({timesheet.total_duration_minutes ? `${Math.floor(timesheet.total_duration_minutes / 60)}h ${timesheet.total_duration_minutes % 60}m` : 'In progress'})
                        </span>
                        {timesheet.total_duration_minutes > 0 && (
                          <span className="text-xs text-slate-600 ml-2">
                            [Reg: {timesheet.regular_hours_calculated?.toFixed(2) || 0}h
                            {timesheet.overtime_hours_non_paid_calculated > 0 && `, Unpaid OT: ${timesheet.overtime_hours_non_paid_calculated.toFixed(2)}h`}
                            {timesheet.overtime_hours_paid_calculated > 0 && `, Paid OT: ${timesheet.overtime_hours_paid_calculated.toFixed(2)}h`}]
                          </span>
                        )}
                      </>
                    )}
                    {timesheet.clock_in_address && !isEditing && <span className="text-xs text-slate-500 truncate max-w-xs">📍 {timesheet.clock_in_address}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    {!isEditing && getStatusBadge(timesheet.status)}
                    {isAdmin && timesheet.is_active && !isEditing && (
                      <Button size="sm" variant="outline" className="h-6 px-2 text-xs bg-red-50 hover:bg-red-100 border-red-400 text-red-700 font-semibold" onClick={(e) => { e.stopPropagation(); onForceClockOut && onForceClockOut(timesheet); }}>
                        <LogOut className="w-3 h-3 mr-1" />Force Clock Out
                      </Button>
                    )}
                    {isAdmin && needsApproval && !isEditing && (
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" className="h-6 px-2 text-xs bg-blue-50 hover:bg-blue-100 border-blue-300" onClick={(e) => { e.stopPropagation(); handleStartEdit(timesheet); }}><Edit3 className="w-3 h-3 mr-1" />Edit</Button>
                        <Button size="sm" variant="outline" className="h-6 px-2 text-xs bg-green-50 hover:bg-green-100 border-green-300" onClick={(e) => { e.stopPropagation(); onApprove(timesheet); }}><Check className="w-3 h-3 mr-1" />Approve</Button>
                        <Button size="sm" variant="outline" className="h-6 px-2 text-xs bg-red-50 hover:bg-red-100 border-red-300" onClick={(e) => { e.stopPropagation(); onReject(timesheet); }}><X className="w-3 h-3 mr-1" />Reject</Button>
                      </div>
                    )}
                    {isEditing && (
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={(e) => { e.stopPropagation(); handleCancelEdit(); }}>Cancel</Button>
                        <Button size="sm" className="h-6 px-2 text-xs bg-green-600 hover:bg-green-700" onClick={(e) => { e.stopPropagation(); handleSaveEdit(timesheet); }}><Check className="w-3 h-3 mr-1" />Save & Approve</Button>
                      </div>
                    )}
                  </div>
                </div>
                {timesheet.was_edited && timesheet.notes && (
                  <div className="ml-4 pl-3 border-l-2 border-yellow-400 text-xs bg-yellow-50 p-2 rounded">
                    <span className="font-semibold text-yellow-800">Employee note: </span>
                    <span className="text-yellow-700">{timesheet.notes}</span>
                  </div>
                )}
                {timesheet.approval_notes && (
                  <div className={`ml-4 pl-3 border-l-2 ${isApproved ? 'border-green-400 bg-green-50' : 'border-red-400 bg-red-50'} text-xs p-2 rounded`}>
                    <span className={`font-semibold ${isApproved ? 'text-green-800' : 'text-red-800'}`}>Admin note: </span>
                    <span className={isApproved ? 'text-green-700' : 'text-red-700'}>{timesheet.approval_notes}</span>
                  </div>
                )}
                {timesheet.timesheet_type === 'field_work' && segments.map((segment, idx) => {
                  const wo = allWOs.find(w => w.id === segment.work_order_id);
                  const project = wo ? projects.find(p => p.id === wo.project_id) : null;
                  const customer = project ? customers.find(c => c.id === project.customer_id) : null;
                  const isActiveSegment = !segment.end_time;
                  return (
                    <div key={idx} className={cn("ml-4 pl-3 border-l-2 text-xs py-1", isActiveSegment ? "border-green-500 bg-green-50" : "border-slate-300")}>
                      <div className="flex items-start gap-2 flex-wrap">
                        <Badge className={cn("text-[10px] font-bold", isActiveSegment ? "bg-green-600 text-white" : "bg-slate-500 text-white")}>
                          {isActiveSegment ? "ACTIVE NOW" : segment.end_time ? "COMPLETED" : "SEGMENT"}
                        </Badge>
                        <div className="flex-1 min-w-0">
                          <button
                            onClick={(e) => { e.stopPropagation(); onWorkOrderClick && wo && onWorkOrderClick(wo); }}
                            className={cn("font-semibold text-slate-900 text-left", wo && onWorkOrderClick ? "hover:text-blue-600 hover:underline cursor-pointer" : "cursor-default")}
                          >
                            {wo?.work_order_number || 'N/A'}
                            {wo?.title && <span className="font-normal text-slate-600"> - {wo.title}</span>}
                          </button>
                          {project && (

                            <div className="text-slate-600 text-[11px] mt-0.5">
                              📂 Project: <span className="font-medium">{project.name}</span>
                              {customer && <span className="text-slate-500"> ({customer.name})</span>}
                            </div>
                          )}
                          <div className="flex items-center gap-3 mt-1 text-slate-500">
                            <span className="font-medium text-slate-700">
                              {format(parseISO(segment.start_time), 'HH:mm')}
                              {segment.end_time && ` - ${format(parseISO(segment.end_time), 'HH:mm')}`}
                            </span>
                            {segment.duration_minutes > 0 && <span className="text-slate-600">({Math.floor(segment.duration_minutes / 60)}h {segment.duration_minutes % 60}m)</span>}
                          </div>
                          {wo?.start_address && <div className="text-[11px] text-slate-500 mt-0.5">📍 {wo.start_address}</div>}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {timesheet.timesheet_type === 'office_work' && (
                  <div className="ml-4 pl-3 border-l-2 border-blue-500 bg-blue-50 text-xs py-1">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-blue-600 text-white text-[10px] font-bold">OFFICE WORK</Badge>
                      {timesheet.department_id && <span className="text-blue-900 font-medium">{departments.find(d => d.id === timesheet.department_id)?.name || 'Department'}</span>}
                    </div>
                    {timesheet.clock_in_address && <div className="text-[11px] text-blue-600 mt-0.5">📍 {timesheet.clock_in_address}</div>}
                  </div>
                )}
              </div>
            </td>
          </tr>
        );
      })}
    </>
  );
}