import React, { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

function EmployeeTimesheetRow({ employee, timesheets, todayWorkOrders, projects, customers, departments, isWorking, isAdmin, onApprove, onReject, onEditAndApprove, hoursSettings }) {
  const [expanded, setExpanded] = useState(false);
  const [editingTimesheetId, setEditingTimesheetId] = useState(null);
  const [editedClockIn, setEditedClockIn] = useState('');
  const [editedClockOut, setEditedClockOut] = useState('');
  const [currentTime, setCurrentTime] = useState(Date.now());

  // ... keep all existing helper functions from EmployeeTimesheetRow
  // This is a placeholder - the actual implementation will be moved from time-tracker page
  
  return (
    <tr className="hover:bg-slate-50">
      <td className="px-2 py-1.5">Employee row placeholder</td>
    </tr>
  );
}

export default function TimesheetTable({
  employees,
  todayTimesheets,
  todayWorkOrders,
  projects,
  customers,
  departments,
  isAdmin,
  onApprove,
  onReject,
  onEditAndApprove,
  hoursSettings
}) {
  const [sortColumn, setSortColumn] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const sortedEmployees = useMemo(() => {
    const employeesWithData = employees.map(emp => {
      const userTimesheets = todayTimesheets.filter(ts => ts.employee_id === emp.id);
      
      const calculateHours = (ts) => {
        let totalMinutes = ts.total_duration_minutes || 0;
        if (ts.is_active && ts.clock_in_time) {
          const clockIn = new Date(ts.clock_in_time).getTime();
          const now = Date.now();
          totalMinutes = Math.floor((now - clockIn) / 60000);
        }
        const totalHours = totalMinutes / 60;
        const regularHoursPerDay = hoursSettings.regular_hours_per_day || 8;
        const nonPayableOvertimeHours = hoursSettings.non_payable_overtime_hours || 0;
        
        let regularHours = Math.min(totalHours, regularHoursPerDay);
        let extraHours = Math.max(0, totalHours - regularHoursPerDay);
        let nonPayableOT = Math.min(extraHours, nonPayableOvertimeHours);
        let paidOT = Math.max(0, extraHours - nonPayableOvertimeHours);
        
        return { regular: regularHours, paidOT, nonPayableOT, totalMinutes };
      };
      
      const totals = userTimesheets.reduce((acc, ts) => {
        const hours = calculateHours(ts);
        return {
          regularHours: acc.regularHours + hours.regular,
          paidOT: acc.paidOT + hours.paidOT,
          totalMinutes: acc.totalMinutes + hours.totalMinutes,
          sessions: acc.sessions + 1
        };
      }, { regularHours: 0, paidOT: 0, totalMinutes: 0, sessions: 0 });
      
      const totalDistance = userTimesheets.reduce((sum, ts) => {
        if (!ts.live_tracking_points || ts.live_tracking_points.length < 2) return sum;
        let distance = 0;
        for (let i = 1; i < ts.live_tracking_points.length; i++) {
          const p1 = ts.live_tracking_points[i - 1];
          const p2 = ts.live_tracking_points[i];
          if (p1.lat && p1.lon && p2.lat && p2.lon) {
            const R = 6371;
            const dLat = (p2.lat - p1.lat) * Math.PI / 180;
            const dLon = (p2.lon - p1.lon) * Math.PI / 180;
            const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                      Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) *
                      Math.sin(dLon / 2) * Math.sin(dLon / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            distance += R * c;
          }
        }
        return sum + distance;
      }, 0);
      
      return {
        ...emp,
        timesheets: userTimesheets,
        isWorking: userTimesheets.some(ts => ts.is_active),
        ...totals,
        totalDistance
      };
    });

    return employeesWithData.sort((a, b) => {
      let valA, valB;
      
      switch (sortColumn) {
        case 'name':
          valA = (a.nickname || a.first_name || a.full_name || '').toLowerCase();
          valB = (b.nickname || b.first_name || b.full_name || '').toLowerCase();
          break;
        case 'regularHours':
          valA = a.regularHours || 0;
          valB = b.regularHours || 0;
          break;
        case 'overtime':
          valA = a.paidOT || 0;
          valB = b.paidOT || 0;
          break;
        case 'total':
          valA = a.totalMinutes || 0;
          valB = b.totalMinutes || 0;
          break;
        case 'distance':
          valA = a.totalDistance || 0;
          valB = b.totalDistance || 0;
          break;
        case 'sessions':
          valA = a.sessions || 0;
          valB = b.sessions || 0;
          break;
        default:
          return 0;
      }
      
      if (typeof valA === 'string') {
        return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortDirection === 'asc' ? valA - valB : valB - valA;
    });
  }, [employees, todayTimesheets, sortColumn, sortDirection, hoursSettings]);

  const SortableHeader = ({ column, children, className = '' }) => (
    <th
      className={cn("px-2 py-1 text-left text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 select-none", className)}
      onClick={() => handleSort(column)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortColumn === column && (
          sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
        )}
      </div>
    </th>
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="px-2 py-1 text-left text-xs font-semibold text-slate-700 w-8"></th>
            <SortableHeader column="name">Employee</SortableHeader>
            <th className="px-2 py-1 text-left text-xs font-semibold text-slate-700">Current Work</th>
            <SortableHeader column="regularHours">Reg. Hours</SortableHeader>
            <SortableHeader column="overtime">Overtime</SortableHeader>
            <SortableHeader column="total">Total</SortableHeader>
            <SortableHeader column="distance">Distance</SortableHeader>
            <SortableHeader column="sessions">Sessions</SortableHeader>
            <th className="px-2 py-1 text-left text-xs font-semibold text-slate-700">Approvals</th>
          </tr>
        </thead>
        <tbody>
          {sortedEmployees.map((employee) => (
            <EmployeeTimesheetRow
              key={employee.id}
              employee={employee}
              timesheets={employee.timesheets}
              todayWorkOrders={todayWorkOrders}
              projects={projects}
              customers={customers}
              departments={departments}
              isWorking={employee.isWorking}
              isAdmin={isAdmin}
              onApprove={onApprove}
              onReject={onReject}
              onEditAndApprove={onEditAndApprove}
              hoursSettings={hoursSettings}
            />
          ))}
        </tbody>
      </table>
      {sortedEmployees.length === 0 && (
        <div className="p-8 text-center text-slate-500">
          <p className="text-sm">No timesheets found</p>
        </div>
      )}
    </div>
  );
}