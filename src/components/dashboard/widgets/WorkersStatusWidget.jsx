import React, { useState, useEffect } from 'react';
import { useData } from '@/components/DataProvider';
import { LeaveRequest } from '@/entities/all';
import { Users, AlertCircle, Briefcase, MapPin } from 'lucide-react';
import { format } from 'date-fns';

export default function WorkersStatusWidget({ size = 'sm' }) {
  const { users = [] } = useData();
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadLeaves = async () => {
      try {
        const approvedLeaves = await LeaveRequest.filter({ status: 'approved' });
        setLeaves(approvedLeaves || []);
      } catch (e) {
        console.error('Failed to load leaves:', e);
      } finally {
        setLoading(false);
      }
    };
    loadLeaves();
  }, []);

  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');

  // Categorize workers
  const officeWorkers = users.filter(u => !u.archived && u.work_location_type === 'office');
  const fieldWorkers = users.filter(u => !u.archived && u.work_location_type === 'field');
  const onLeaveToday = users.filter(u => {
    if (u.archived) return false;
    return leaves.some(leave =>
      leave.employee_id === u.id &&
      todayStr >= leave.start_date &&
      todayStr <= leave.end_date
    );
  });

  const officeCount = officeWorkers.length;
  const fieldCount = fieldWorkers.length;
  const leaveCount = onLeaveToday.length;
  const totalAvailable = officeCount + fieldCount;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-slate-400 text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <Users className="w-5 h-5 text-indigo-600" />
        <h3 className="font-semibold text-slate-900">Workers Status</h3>
      </div>

      <div className="space-y-3 flex-1">
        {/* Office Workers */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3 border border-blue-200">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-slate-700">Office</span>
            </div>
            <span className="text-lg font-bold text-blue-700">{officeCount}</span>
          </div>
          {officeWorkers.length > 0 && (
            <div className="text-xs text-slate-600 mt-1">
              {officeWorkers.map(u => u.nickname || u.first_name).join(', ')}
            </div>
          )}
        </div>

        {/* Field Workers */}
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-3 border border-green-200">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-slate-700">Field</span>
            </div>
            <span className="text-lg font-bold text-green-700">{fieldCount}</span>
          </div>
          {fieldWorkers.length > 0 && (
            <div className="text-xs text-slate-600 mt-1">
              {fieldWorkers.map(u => u.nickname || u.first_name).join(', ')}
            </div>
          )}
        </div>

        {/* On Leave */}
        {leaveCount > 0 && (
          <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg p-3 border border-amber-200">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <span className="text-sm font-medium text-slate-700">On Leave Today</span>
              </div>
              <span className="text-lg font-bold text-amber-700">{leaveCount}</span>
            </div>
            <div className="text-xs text-slate-600 mt-1">
              {onLeaveToday.map(u => u.nickname || u.first_name).join(', ')}
            </div>
          </div>
        )}

        {/* Total Available */}
        <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-lg p-3 border border-indigo-200 mt-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">Total Available</span>
            <span className="text-xl font-bold text-indigo-700">{totalAvailable}</span>
          </div>
        </div>
      </div>
    </div>
  );
}