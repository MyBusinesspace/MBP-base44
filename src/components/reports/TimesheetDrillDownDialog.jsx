import React, { useState, useMemo, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Clock, MapPin, Camera, Edit, Save, X, AlertTriangle, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, parseISO, differenceInMinutes, addDays, subDays } from 'date-fns';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

function fmtTime(iso) {
  if (!iso) return '—';
  try { return format(parseISO(iso), 'HH:mm'); } catch { return '—'; }
}

function fmtDuration(mins) {
  if (!mins || mins <= 0) return '—';
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function getMapsUrl(coords) {
  if (!coords?.lat || !coords?.lon) return null;
  return `https://www.google.com/maps?q=${coords.lat},${coords.lon}`;
}

function PhotoThumb({ url, label, large }) {
  const cls = large ? "w-full h-32 rounded-xl" : "w-16 h-16 rounded-lg";
  if (!url) return (
    <div className={`${cls} bg-slate-100 flex flex-col items-center justify-center text-slate-400 gap-1 border border-slate-200 border-dashed`}>
      <Camera className="w-5 h-5 opacity-40" />
      <span className="text-[10px]">No photo</span>
    </div>
  );
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="block">
      <img src={url} alt={label} className={`${cls} object-cover border border-slate-200 hover:opacity-90 transition-opacity cursor-pointer`} />
    </a>
  );
}

function SessionRow({ session, onSaved, onLocalUpdate, onEditChange }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clockIn, setClockIn] = useState('');
  const [clockOut, setClockOut] = useState('');

  const startEdit = () => {
    const ci = session.clock_in_time ? format(parseISO(session.clock_in_time), "yyyy-MM-dd'T'HH:mm") : '';
    const co = session.clock_out_time ? format(parseISO(session.clock_out_time), "yyyy-MM-dd'T'HH:mm") : '';
    setClockIn(ci);
    setClockOut(co);
    setEditing(true);
    if (onEditChange) onEditChange(session.id, { clockIn: ci, clockOut: co });
  };

  const handleClockInChange = (val) => {
    setClockIn(val);
    if (onEditChange) onEditChange(session.id, { clockIn: val, clockOut });
  };

  const handleClockOutChange = (val) => {
    setClockOut(val);
    if (onEditChange) onEditChange(session.id, { clockIn, clockOut: val });
  };

  const cancelEdit = () => {
    setEditing(false);
    if (onEditChange) onEditChange(session.id, null); // clear live edit
  };

  const handleSave = async () => {
    if (!clockIn) { toast.error('Clock in time is required'); return; }
    const inDate = new Date(clockIn);
    const outDate = clockOut ? new Date(clockOut) : null;
    if (outDate && outDate <= inDate) {
      toast.error('Clock-out must be after clock-in');
      return;
    }
    setSaving(true);
    try {
      const updates = {
        clock_in_time: inDate.toISOString(),
        clock_out_time: outDate ? outDate.toISOString() : null,
        was_edited: true,
      };
      if (outDate) {
        updates.total_duration_minutes = Math.round(
          (outDate.getTime() - inDate.getTime()) / 60000
        );
      }
      await base44.entities.TimesheetEntry.update(session.id, updates);
      toast.success('Timesheet updated');
      setEditing(false);
      if (onEditChange) onEditChange(session.id, null); // clear live edit
      if (onLocalUpdate) onLocalUpdate(session.id, updates);
      onSaved();
    } catch (e) {
      toast.error('Failed to save: ' + e.message);
    }
    setSaving(false);
  };

  const duration = session.total_duration_minutes ||
    (session.clock_in_time && session.clock_out_time
      ? differenceInMinutes(parseISO(session.clock_out_time), parseISO(session.clock_in_time))
      : null);

  const missingClockOut = !session.clock_out_time;

  return (
    <div className={`border rounded-xl p-4 space-y-4 ${missingClockOut ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-white shadow-sm'}`}>
      {/* Time header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center ${missingClockOut ? 'bg-red-100' : 'bg-slate-100'}`}>
            <Clock className={`w-4 h-4 ${missingClockOut ? 'text-red-500' : 'text-slate-500'}`} />
          </div>
          <div>
            <div className="font-bold text-slate-900 text-base">
              {fmtTime(session.clock_in_time)}
              <span className="text-slate-400 mx-2">→</span>
              {session.clock_out_time
                ? <span>{fmtTime(session.clock_out_time)}</span>
                : <span className="text-red-500">Missing</span>}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              {duration && <span className="text-xs text-slate-500 font-medium">{fmtDuration(duration)}</span>}
              {missingClockOut && (
                <span className="inline-flex items-center gap-1 text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold">
                  <AlertTriangle className="w-3 h-3" /> No clock-out
                </span>
              )}
            </div>
          </div>
        </div>
        {!editing && (
          <Button size="sm" variant="outline" onClick={startEdit} className="gap-1 text-xs">
            <Edit className="w-3 h-3" /> Edit Times
          </Button>
        )}
      </div>

      {/* Edit fields */}
      {editing && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
          <p className="text-xs font-semibold text-amber-800">Edit Times (Admin Override)</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-slate-600 mb-1 block">Clock In *</Label>
              <Input type="datetime-local" value={clockIn} onChange={e => handleClockInChange(e.target.value)} className="h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs text-slate-600 mb-1 block">Clock Out</Label>
              <Input type="datetime-local" value={clockOut} onChange={e => handleClockOutChange(e.target.value)} className="h-9 text-sm" />
              <div className="mt-2">
                <p className="text-[10px] text-slate-500 mb-1">Quick subtract from clock-out:</p>
                <div className="flex flex-wrap gap-1">
                  {[30, 60, 120, 240, 360].map(subtractMins => (
                    <button
                      key={subtractMins}
                      type="button"
                      onClick={() => {
                        setClockOut(prev => {
                          if (!prev) return prev;
                          const d = new Date(prev);
                          if (isNaN(d.getTime())) return prev;
                          d.setMinutes(d.getMinutes() - subtractMins);
                          const next = format(d, "yyyy-MM-dd'T'HH:mm");
                          if (onEditChange) onEditChange(session.id, { clockIn, clockOut: next });
                          return next;
                        });
                      }}
                      className="text-[10px] font-semibold px-2 py-1 rounded-md bg-white border border-amber-300 text-amber-800 hover:bg-amber-100 transition-colors disabled:opacity-40"
                      disabled={!clockOut}
                    >
                      -{subtractMins >= 60 ? `${subtractMins / 60}h` : `${subtractMins}m`}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="outline" onClick={cancelEdit} disabled={saving} className="gap-1">
              <X className="w-3 h-3" /> Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1 bg-green-600 hover:bg-green-700 text-white">
              <Save className="w-3 h-3" /> {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      )}

      {/* Photos row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Clock In Photo</p>
          <PhotoThumb url={session.clock_in_photo_url} label="IN" large />
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Clock Out Photo</p>
          <PhotoThumb url={session.clock_out_photo_url} label="OUT" large />
        </div>
      </div>

      {/* Location */}
      <div className="space-y-2">
        {session.clock_in_coords && getMapsUrl(session.clock_in_coords) && (
          <a href={getMapsUrl(session.clock_in_coords)} target="_blank" rel="noopener noreferrer"
            className="flex items-start gap-2 text-sm text-blue-600 hover:underline bg-green-50 border border-green-100 rounded-lg p-2.5">
            <MapPin className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
            <span className="flex-1">{session.clock_in_address || `${session.clock_in_coords.lat?.toFixed(5)}, ${session.clock_in_coords.lon?.toFixed(5)}`}</span>
            <ExternalLink className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-slate-400" />
          </a>
        )}
        {session.clock_out_coords && getMapsUrl(session.clock_out_coords) && (
          <a href={getMapsUrl(session.clock_out_coords)} target="_blank" rel="noopener noreferrer"
            className="flex items-start gap-2 text-sm text-blue-600 hover:underline bg-red-50 border border-red-100 rounded-lg p-2.5">
            <MapPin className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <span className="flex-1">{session.clock_out_address || `${session.clock_out_coords.lat?.toFixed(5)}, ${session.clock_out_coords.lon?.toFixed(5)}`}</span>
            <ExternalLink className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-slate-400" />
          </a>
        )}
        {session.notes && (
          <p className="text-sm text-slate-500 italic bg-slate-50 rounded-lg p-2.5 border border-slate-100">"{session.notes}"</p>
        )}
      </div>
    </div>
  );
}

// Props:
//   isOpen, onClose, user, dayKey, sessions, onRefresh
//   allTimesheets  — all period timesheets for this user (to navigate days)
//   regularHoursPerDay, nonPayableOvertimeHours — for OT calc
export default function TimesheetDrillDownDialog({
  isOpen, onClose, user, dayKey, sessions, onRefresh,
  allTimesheets = [],
  regularHoursPerDay = 8,
  nonPayableOvertimeHours = 0,
}) {
  const [currentDayKey, setCurrentDayKey] = useState(dayKey ?? '');
  // Local overrides: map of session.id -> updated fields (after save)
  const [localOverrides, setLocalOverrides] = useState({});
  // Live edits: map of session.id -> { clockIn, clockOut } while editing
  const [liveEdits, setLiveEdits] = useState({});

  // When dayKey prop changes (new drill-down opened), reset
  useEffect(() => {
    if (dayKey) {
      setCurrentDayKey(dayKey);
      setLocalOverrides({});
      setLiveEdits({});
    }
  }, [dayKey]);

  // Build sorted list of days that have sessions for this user
  const userSessionsByDay = useMemo(() => {
    const map = {};
    allTimesheets.forEach(ts => {
      if (!ts.clock_in_time) return;
      try {
        const k = format(parseISO(ts.clock_in_time), 'yyyy-MM-dd');
        if (!map[k]) map[k] = [];
        map[k].push(ts);
      } catch {}
    });
    return map;
  }, [allTimesheets]);

  const sortedDays = useMemo(() => Object.keys(userSessionsByDay).sort(), [userSessionsByDay]);

  if (!user || !dayKey) return null;

  const currentIdx = sortedDays.indexOf(currentDayKey);
  const canPrev = currentIdx > 0;
  const canNext = currentIdx < sortedDays.length - 1;

  // Merge local overrides into sessions for immediate UI update
  const currentSessions = (userSessionsByDay[currentDayKey] || sessions)
    .map(s => localOverrides[s.id] ? { ...s, ...localOverrides[s.id] } : s)
    .slice()
    .sort((a, b) => new Date(a.clock_in_time) - new Date(b.clock_in_time));

  const userName = user.nickname || user.full_name || user.email || 'Unknown';
  const dateLabel = (() => {
    try { return format(new Date(currentDayKey + 'T00:00:00'), 'EEEE, dd MMM yyyy'); } catch { return currentDayKey; }
  })();

  const totalMins = currentSessions.reduce((sum, s) => {
    const live = liveEdits[s.id];
    let d;
    if (live) {
      // Use live-edited times for real-time stat update
      const ci = live.clockIn ? new Date(live.clockIn) : null;
      const co = live.clockOut ? new Date(live.clockOut) : null;
      d = (ci && co && co > ci) ? differenceInMinutes(co, ci) : 0;
    } else {
      d = s.total_duration_minutes ||
        (s.clock_in_time && s.clock_out_time
          ? differenceInMinutes(parseISO(s.clock_out_time), parseISO(s.clock_in_time))
          : 0);
    }
    return sum + (d || 0);
  }, 0);

  const missingCount = currentSessions.filter(s => !s.clock_out_time).length;

  // OT calculations for this day
  const totalHours = totalMins / 60;
  const extraHours = Math.max(0, totalHours - regularHoursPerDay);
  const unpaidOTHours = extraHours > 0 ? Math.min(extraHours, nonPayableOvertimeHours) : 0;
  const paidOTHours = extraHours > 0 ? Math.max(0, extraHours - nonPayableOvertimeHours) : 0;

  const navDay = (dir) => {
    const newIdx = currentIdx + dir;
    if (newIdx >= 0 && newIdx < sortedDays.length) {
      setCurrentDayKey(sortedDays[newIdx]);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:w-[520px] sm:max-w-[520px] flex flex-col p-0 overflow-hidden">
        {/* Header */}
        <SheetHeader className="px-6 py-4 border-b border-slate-200 bg-slate-800 flex-shrink-0">
          <SheetTitle className="flex items-center gap-2 text-white">
            <Clock className="w-4 h-4 text-[#AADB1E]" />
            Timesheet Detail
          </SheetTitle>
        </SheetHeader>

        {/* User + date summary */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex-shrink-0 space-y-3">
          {/* Top row: avatar + name + total worked */}
          <div className="flex items-center gap-3">
            {user.avatar_url ? (
              <img src={user.avatar_url} alt={userName} className="w-11 h-11 rounded-full object-cover border-2 border-white shadow flex-shrink-0" />
            ) : (
              <div className="w-11 h-11 rounded-full bg-indigo-600 text-white text-sm font-bold flex items-center justify-center border-2 border-white shadow flex-shrink-0">
                {userName.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="font-bold text-slate-900 text-base">{userName}</div>
              <div className="text-sm text-slate-500">{dateLabel}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-slate-400 uppercase tracking-wide">Total Worked</div>
              <div className="font-bold text-slate-800 text-lg leading-tight">{fmtDuration(totalMins)}</div>
            </div>
          </div>

          {/* Stats row: OT + Unpaid OT */}
          {extraHours > 0 && (
            <div className="flex gap-2">
              <div className="flex-1 bg-amber-50 rounded-lg px-3 py-2 border border-amber-200 text-center">
                <div className="text-[10px] text-amber-600 uppercase tracking-wide font-semibold">Overtime</div>
                <div className="font-bold text-amber-700 text-base">{fmtDuration(extraHours * 60)}</div>
              </div>
              <div className={`flex-1 rounded-lg px-3 py-2 border text-center ${unpaidOTHours > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                <div className={`text-[10px] uppercase tracking-wide font-semibold ${unpaidOTHours > 0 ? 'text-red-500' : 'text-green-600'}`}>Unpaid OT</div>
                <div className={`font-bold text-base ${unpaidOTHours > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {unpaidOTHours > 0 ? fmtDuration(unpaidOTHours * 60) : '—'}
                </div>
              </div>
              <div className="flex-1 bg-white rounded-lg px-3 py-2 border border-slate-200 text-center">
                <div className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold">Paid OT</div>
                <div className="font-bold text-slate-700 text-base">{fmtDuration(paidOTHours * 60)}</div>
              </div>
            </div>
          )}

          {/* Day navigator */}
          <div className="flex items-center justify-between bg-white rounded-lg border border-slate-200 px-1 py-1">
            <button
              onClick={() => navDay(-1)}
              disabled={!canPrev}
              className="flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900 disabled:opacity-30 disabled:cursor-not-allowed px-3 py-1.5 rounded-md hover:bg-slate-100 transition-colors font-medium"
            >
              <ChevronLeft className="w-4 h-4" />
              {canPrev ? format(new Date(sortedDays[currentIdx - 1] + 'T00:00:00'), 'dd MMM') : 'Prev'}
            </button>
            <span className="text-xs font-semibold text-slate-500">
              {sortedDays.length > 0 ? `Day ${currentIdx + 1} / ${sortedDays.length}` : '—'}
            </span>
            <button
              onClick={() => navDay(1)}
              disabled={!canNext}
              className="flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900 disabled:opacity-30 disabled:cursor-not-allowed px-3 py-1.5 rounded-md hover:bg-slate-100 transition-colors font-medium"
            >
              {canNext ? format(new Date(sortedDays[currentIdx + 1] + 'T00:00:00'), 'dd MMM') : 'Next'}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Warning banner */}
        {missingCount > 0 && (
          <div className="flex items-center gap-2 px-6 py-3 bg-red-50 border-b border-red-200 text-sm text-red-700 flex-shrink-0">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{missingCount} session{missingCount > 1 ? 's' : ''} missing clock-out — use Edit below to fix.</span>
          </div>
        )}

        {/* Sessions list — scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {currentSessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Clock className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-sm">No sessions found for this day.</p>
            </div>
          ) : (
            currentSessions.map((s, i) => (
              <div key={s.id} className="space-y-1">
                {currentSessions.length > 1 && (
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Session {i + 1}</div>
                )}
                <SessionRow
                  session={s}
                  onSaved={onRefresh}
                  onLocalUpdate={(id, updates) => setLocalOverrides(prev => ({ ...prev, [id]: { ...(prev[id] || {}), ...updates } }))}
                  onEditChange={(id, live) => setLiveEdits(prev => {
                    if (live === null) { const n = { ...prev }; delete n[id]; return n; }
                    return { ...prev, [id]: live };
                  })}
                />
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}