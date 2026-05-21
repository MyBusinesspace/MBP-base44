import React, { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Clock, MapPin, Camera, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import Avatar from '../Avatar';

function PhotoThumb({ url, label }) {
  if (!url) return (
    <div className="flex flex-col items-center justify-center w-24 h-20 rounded-lg border border-dashed border-slate-300 bg-slate-50 text-slate-400 gap-1">
      <Camera className="w-4 h-4 opacity-40" />
      <span className="text-[9px]">No {label}</span>
    </div>
  );
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="block group">
      <div className="relative w-24 h-20 rounded-lg overflow-hidden border border-slate-200 hover:opacity-90 transition-opacity">
        <img src={url} alt={label} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex items-center justify-center transition-all">
          <ExternalLink className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        <div className="absolute bottom-0 left-0 right-0 bg-black/40 text-white text-[9px] text-center py-0.5">{label}</div>
      </div>
    </a>
  );
}

export default function TimeTrackerSection({ formData, entry, woTimesheets, safeUsers }) {
  const [showPhotos, setShowPhotos] = useState(false);
  // Use entry.tasks for date check (formData.tasks clears dates for pending tasks)
  const sourceTasks = (entry?.tasks || []).length > 0 ? entry.tasks : (formData.tasks || []);
  const today = new Date(); today.setHours(0,0,0,0);
  const hasPastOrTodayTask = sourceTasks.some(task => {
    if (!task.date) return false;
    try {
      const taskDay = new Date(task.date + 'T00:00:00');
      taskDay.setHours(0,0,0,0);
      return taskDay <= today;
    } catch { return false; }
  });

  if (!hasPastOrTodayTask) return null;

  const allEmployeeIds = new Set();
  const leaderIds = new Set();
  sourceTasks.forEach(t => {
    (t.employee_ids || []).forEach(id => allEmployeeIds.add(id));
    if (t.leader_id) leaderIds.add(t.leader_id);
  });

  // Group ALL timesheets per user — a user may have multiple sessions in a day
  const tsMapAll = {};
  woTimesheets.forEach(ts => {
    if (!tsMapAll[ts.employee_id]) tsMapAll[ts.employee_id] = [];
    tsMapAll[ts.employee_id].push(ts);
  });

  // Only show employees actually assigned to this WO's tasks
  const allIds = allEmployeeIds;

  const getClockData = (uid) => {
    const tsList = tsMapAll[uid] || [];
    if (tsList.length === 0) return { clockIn: null, clockOut: null, isActive: false, durationMin: null, address: null, onOtherWO: false };

    // First: look for a timesheet that has a segment for THIS work order
    for (const ts of tsList) {
      const segments = ts.work_order_segments || [];
      const seg = segments.find(s => s.work_order_id === entry?.id);
      if (seg) {
        const clockIn = seg.start_time || ts.clock_in_time;
        const clockOut = seg.end_time || ts.clock_out_time;
        const durationMin = seg.duration_minutes || (clockIn && clockOut ? Math.round((new Date(clockOut) - new Date(clockIn)) / 60000) : null);
        return { clockIn, clockOut, isActive: ts.is_active, durationMin, address: ts.clock_in_address, onOtherWO: false };
      }
    }

    // Second: look for a timesheet whose work_order_id matches directly (no segments)
    const directTs = tsList.find(ts => ts.work_order_id === entry?.id);
    if (directTs) {
      return {
        clockIn: directTs.clock_in_time,
        clockOut: directTs.clock_out_time,
        isActive: directTs.is_active,
        durationMin: directTs.total_duration_minutes || null,
        address: directTs.clock_in_address,
        onOtherWO: false
      };
    }

    // Third: all timesheets are for OTHER work orders — user is clocked on a different task
    const ts = tsList[0];
    const segments = ts.work_order_segments || [];
    if (segments.length > 0) {
      const bestSeg = segments.reduce((best, s) => {
        const dur = s.duration_minutes || (s.start_time && s.end_time ? Math.round((new Date(s.end_time) - new Date(s.start_time)) / 60000) : 0);
        const bestDur = best ? (best.duration_minutes || (best.start_time && best.end_time ? Math.round((new Date(best.end_time) - new Date(best.start_time)) / 60000) : 0)) : -1;
        return dur > bestDur ? s : best;
      }, null);
      const clockIn = bestSeg?.start_time || ts.clock_in_time;
      const clockOut = bestSeg?.end_time || ts.clock_out_time;
      const durationMin = bestSeg?.duration_minutes || (clockIn && clockOut ? Math.round((new Date(clockOut) - new Date(clockIn)) / 60000) : null);
      return { clockIn, clockOut, isActive: ts.is_active, durationMin, address: ts.clock_in_address, onOtherWO: true };
    }

    // No segments — general clock data, but for a different WO
    return {
      clockIn: ts.clock_in_time,
      clockOut: ts.clock_out_time,
      isActive: ts.is_active,
      durationMin: ts.total_duration_minutes || null,
      address: ts.clock_in_address,
      onOtherWO: !!ts.work_order_id && ts.work_order_id !== entry?.id
    };
  };

  // Task In/Out summary — use all assigned employees (including those on other tasks same day)
  let taskIn = null, taskOut = null, taskDuration = null;
  const hasLeader = leaderIds.size > 0;
  const leaderClocked = hasLeader && Array.from(leaderIds).some(uid => !!getClockData(uid).clockIn);
  const candidateIds = leaderClocked ? Array.from(leaderIds) : Array.from(allIds);
  let maxDuration = -1;
  candidateIds.forEach(uid => {
    const { clockIn, clockOut, durationMin, onOtherWO } = getClockData(uid);
    if (!clockIn || onOtherWO) return; // skip workers clocked on another task
    const dur = durationMin ?? (clockOut ? Math.round((new Date(clockOut) - new Date(clockIn)) / 60000) : 0);
    if (dur > maxDuration) {
      maxDuration = dur; taskIn = clockIn; taskOut = clockOut; taskDuration = dur;
    }
  });

  const taskDates = new Set(sourceTasks.filter(t => t.date).map(t => t.date));

  if (allIds.size === 0) {
    return (
      <div className="rounded-xl border border-red-400 bg-white shadow-sm mt-6">
        <div className="bg-red-50 px-4 py-3 border-b border-red-200 rounded-t-xl">
          <h3 className="text-sm font-semibold text-red-900 flex items-center gap-2">
            <Clock className="w-4 h-4" />4. Time Tracker Data
          </h3>
          <p className="text-xs text-red-700 mt-0.5">To be input from mobile app</p>
        </div>
        <div className="p-4 text-center py-6 text-slate-400 text-sm">No workers assigned yet</div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-red-400 bg-white shadow-sm mt-6">
      <div className="bg-red-50 px-4 py-3 border-b border-red-200 rounded-t-xl">
        <h3 className="text-sm font-semibold text-red-900 flex items-center gap-2">
          <Clock className="w-4 h-4" />4. Time Tracker Data
        </h3>
        <p className="text-xs text-red-700 mt-0.5">To be input from mobile app</p>
      </div>
      <div className="p-4 space-y-2">
        {/* Summary bar */}
        <div className="rounded-lg bg-slate-800 text-white p-3 mb-3">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Task In</span>
              <span className="text-base font-bold text-green-400">
                {taskIn ? format(parseISO(taskIn), 'dd/MM HH:mm') : '--:--'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Task Out</span>
              <span className="text-base font-bold text-red-400">
                {taskOut ? format(parseISO(taskOut), 'dd/MM HH:mm') : '--:--'}
              </span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {taskDuration > 0 && (
                <span className="text-sm font-bold text-white">
                  {Math.floor(taskDuration / 60)}h {taskDuration % 60}m
                </span>
              )}
              <span className="text-[10px] text-slate-400 italic">
                {leaderClocked ? '(leader time)' : hasLeader ? '(leader not clocked — longest worker)' : '(longest worker)'}
              </span>
            </div>
          </div>
        </div>

        {/* Per-member rows */}
        {Array.from(allIds).map((uid) => {
          const user = safeUsers.find(u => u.id === uid);
          const { clockIn, clockOut, isActive, durationMin, address, onOtherWO } = getClockData(uid);
          // Only mark as leader if they are the leader of the specific task they are assigned to
          const isLeader = sourceTasks.some(t => t.leader_id === uid && (t.employee_ids || []).includes(uid));

          // Date mismatch check — skip if clocked on a different date than any task date
          const clockInDate = clockIn ? format(parseISO(clockIn), 'yyyy-MM-dd') : null;
          const hasDateMismatch = clockInDate && taskDates.size > 0 && !taskDates.has(clockInDate);
          const todayDate = new Date(); todayDate.setHours(0,0,0,0);
          const clockInDay = clockInDate ? new Date(clockInDate + 'T00:00:00') : null;
          const isFutureClockIn = clockInDay && clockInDay > todayDate;
          if (hasDateMismatch || isFutureClockIn) return null;

          let ringColor = 'border-slate-300';
          let statusLabel = 'Not clocked';
          let statusColor = 'text-slate-400';

          if (onOtherWO) {
            ringColor = 'border-orange-400'; statusLabel = 'Clocked (other task)'; statusColor = 'text-orange-500';
          }
          if (!onOtherWO && isActive && clockIn && !clockOut) {
            ringColor = 'border-blue-500'; statusLabel = 'Working'; statusColor = 'text-blue-600';
          } else if (!onOtherWO && clockIn && clockOut) {
            ringColor = 'border-red-400'; statusLabel = 'Clocked Out'; statusColor = 'text-red-500';
          } else if (!onOtherWO && clockIn && !clockOut) {
            ringColor = 'border-green-500'; statusLabel = 'Clocked In'; statusColor = 'text-green-600';
          }

          return (
            <div key={uid} className="flex items-center gap-2 py-2 px-2 border-b border-slate-100 last:border-0">
              <div className={`rounded-full border-2 ${ringColor} flex-shrink-0`}>
                {user ? <Avatar user={user} size="xs" /> : (
                  <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] text-slate-500">?</div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-semibold text-slate-800 truncate">
                    {user ? (user.nickname || user.first_name || user.full_name || user.email) : uid}
                  </span>
                  {isLeader && (
                    <span className="text-[9px] font-semibold px-1 py-0.5 rounded bg-amber-100 text-amber-700">Leader</span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {!onOtherWO && clockIn && (
                    <span className="text-[11px] font-medium text-green-700">
                      ↓ {format(parseISO(clockIn), 'dd/MM HH:mm')}
                    </span>
                  )}
                  {!onOtherWO && clockOut && (
                    <span className="text-[11px] font-medium text-red-600">
                      ↑ {format(parseISO(clockOut), 'dd/MM HH:mm')}
                    </span>
                  )}
                  {!onOtherWO && address && (
                    <span className="text-[10px] text-slate-400 truncate flex items-center gap-0.5">
                      <MapPin className="w-2.5 h-2.5" />{address.split(',')[0]}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                {!onOtherWO && durationMin > 0 && (
                  <span className="text-xs font-bold text-slate-700">
                    {Math.floor(durationMin / 60)}h {durationMin % 60}m
                  </span>
                )}
                <span className={`text-[10px] font-medium ${statusColor}`}>{statusLabel}</span>
              </div>
            </div>
          );
        })}

        {/* Clock-in / Clock-out Photos */}
        {(() => {
          const photosData = Array.from(allIds).map(uid => {
            const user = safeUsers.find(u => u.id === uid);
            const tsList = (tsMapAll[uid] || []).filter(ts => {
              const clockInDate = ts.clock_in_time ? format(parseISO(ts.clock_in_time), 'yyyy-MM-dd') : null;
              return clockInDate && taskDates.has(clockInDate);
            });
            const hasPhoto = tsList.some(ts => ts.clock_in_photo_url || ts.clock_out_photo_url);
            if (!hasPhoto && tsList.length === 0) return null;
            return { uid, user, tsList };
          }).filter(Boolean);

          const anyPhotos = photosData.some(p => p.tsList.some(ts => ts.clock_in_photo_url || ts.clock_out_photo_url));

          return (
            <div className="mt-2 border-t border-slate-200 pt-2">
              <button
                onClick={() => setShowPhotos(p => !p)}
                className="flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-800 transition-colors w-full text-left"
              >
                <Camera className="w-3.5 h-3.5" />
                Clock-in / Clock-out Photos
                {!anyPhotos && <span className="text-[10px] text-slate-400 font-normal ml-1">(none yet)</span>}
                {showPhotos ? <ChevronUp className="w-3.5 h-3.5 ml-auto" /> : <ChevronDown className="w-3.5 h-3.5 ml-auto" />}
              </button>

              {showPhotos && (
                <div className="mt-3 space-y-4">
                  {photosData.length === 0 && (
                    <p className="text-xs text-slate-400 text-center py-2">No timesheet sessions found for this work order.</p>
                  )}
                  {photosData.map(({ uid, user, tsList }) => (
                    <div key={uid} className="space-y-2">
                      <div className="flex items-center gap-1.5">
                        {user ? <Avatar user={user} size="xs" /> : <div className="w-5 h-5 rounded-full bg-slate-200" />}
                        <span className="text-xs font-semibold text-slate-700">
                          {user ? (user.nickname || user.first_name || user.full_name || user.email) : uid}
                        </span>
                      </div>
                      {tsList.map((ts, idx) => (
                        <div key={ts.id || idx} className="flex items-start gap-3 pl-7">
                          {tsList.length > 1 && (
                            <span className="text-[9px] text-slate-400 w-16 flex-shrink-0 pt-1">
                              Session {idx + 1}<br />
                              {ts.clock_in_time ? format(parseISO(ts.clock_in_time), 'HH:mm') : '--'}
                            </span>
                          )}
                          <div className="flex gap-3">
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-[10px] text-green-700 font-semibold">Clock In</span>
                              <PhotoThumb url={ts.clock_in_photo_url} label="Clock In" />
                            </div>
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-[10px] text-red-600 font-semibold">Clock Out</span>
                              <PhotoThumb url={ts.clock_out_photo_url} label="Clock Out" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}

                  {/* Mobile API reference */}
                  <div className="mt-3 rounded-lg bg-slate-900 text-slate-100 p-3 text-[10px] font-mono leading-relaxed">
                    <p className="text-slate-400 mb-1 font-sans text-[11px] font-semibold not-italic">📱 Mobile API — Upload timesheet photo:</p>
                    <p className="text-green-400">POST /api/work-orders</p>
                    <p className="text-slate-300">  ?action=upload-timesheet-photo</p>
                    <p className="text-slate-300">  &id_timesheet=&#123;timesheet_id&#125;</p>
                    <p className="text-slate-300">  &type=clock_in <span className="text-slate-500">| clock_out | switch</span></p>
                    <p className="text-slate-400 mt-1">Body: multipart/form-data</p>
                    <p className="text-slate-300">  photo: &lt;image file&gt;</p>
                    <p className="text-slate-400 mt-1">Response: {"{ success, data: { photo_url, timesheet } }"}</p>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Total */}
        <div className="flex items-center justify-between pt-2 mt-1 border-t border-slate-200">
          <span className="text-xs font-semibold text-slate-600">Total Task Duration</span>
          <span className="text-sm font-bold text-slate-900">
            {taskDuration > 0 ? `${Math.floor(taskDuration / 60)}h ${taskDuration % 60}m` : '--'}
          </span>
        </div>
      </div>
    </div>
  );
}