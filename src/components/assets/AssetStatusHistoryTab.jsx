import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { format, parseISO, differenceInDays, differenceInHours } from 'date-fns';
import { Clock, Calendar, User, Edit2, Check, X } from 'lucide-react';

const STATUS_COLORS = {
  'Available':      { bg: 'bg-green-50',  border: 'border-green-200',  text: 'text-green-700',  dot: 'bg-green-500'  },
  'In Use':         { bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-700',   dot: 'bg-blue-500'   },
  'On Rent':        { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', dot: 'bg-purple-500' },
  'Maintenance':    { bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-700',  dot: 'bg-amber-500'  },
  'Decommissioned': { bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-700',    dot: 'bg-red-500'    },
};

function getStatusColors(status) {
  return STATUS_COLORS[status] || { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-700', dot: 'bg-slate-400' };
}

function formatDuration(startDate, endDate) {
  const start = typeof startDate === 'string' ? parseISO(startDate) : startDate;
  const end = endDate ? (typeof endDate === 'string' ? parseISO(endDate) : endDate) : new Date();
  const days = differenceInDays(end, start);
  if (days === 0) {
    const hours = differenceInHours(end, start);
    return hours <= 1 ? 'Less than 1h' : `${hours}h`;
  }
  if (days < 30) return `${days} day${days !== 1 ? 's' : ''}`;
  const months = Math.floor(days / 30);
  const remDays = days % 30;
  return remDays > 0 ? `${months}mo ${remDays}d` : `${months} month${months !== 1 ? 's' : ''}`;
}

export default function AssetStatusHistoryTab({ formData, setFormData, isAdmin, projects = [] }) {
  const [editingIdx, setEditingIdx] = useState(null);
  const [editNotes, setEditNotes] = useState('');

  const history = [...(formData.status_history || [])].reverse(); // newest first

  const startEditNotes = (originalIdx, notes) => {
    setEditingIdx(originalIdx);
    setEditNotes(notes || '');
  };

  const saveNotes = (originalIdx) => {
    const updated = [...(formData.status_history || [])];
    updated[originalIdx] = { ...updated[originalIdx], notes: editNotes };
    setFormData(prev => ({ ...prev, status_history: updated }));
    setEditingIdx(null);
  };

  if (!history.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <Clock className="w-14 h-14 mb-4 text-slate-200" />
        <p className="text-sm font-medium">No status history yet</p>
        <p className="text-xs mt-1">Status changes will appear here after saving</p>
      </div>
    );
  }

  // Summary: total days per status
  const totals = {};
  (formData.status_history || []).forEach(entry => {
    const start = parseISO(entry.start_date);
    const end = entry.end_date ? parseISO(entry.end_date) : new Date();
    const days = Math.max(0, differenceInDays(end, start));
    totals[entry.status] = (totals[entry.status] || 0) + days;
  });

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {Object.entries(totals).map(([status, days]) => {
          const c = getStatusColors(status);
          return (
            <div key={status} className={`rounded-lg p-3 ${c.bg} border ${c.border}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className={`w-2 h-2 rounded-full ${c.dot}`} />
                <span className={`text-xs font-semibold ${c.text}`}>{status}</span>
              </div>
              <p className={`text-lg font-bold ${c.text}`}>{days}d</p>
              <p className="text-[10px] text-slate-500">total days</p>
            </div>
          );
        })}
      </div>

      {/* Timeline */}
      <div className="relative">
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-200" />
        <div className="space-y-3 pl-10">
          {history.map((entry, revIdx) => {
            // original index in the non-reversed array
            const originalIdx = (formData.status_history || []).length - 1 - revIdx;
            const c = getStatusColors(entry.status);
            const isActive = !entry.end_date;
            const project = projects.find(p => p.id === entry.project_id);

            return (
              <div key={revIdx} className={`relative rounded-lg border p-4 ${c.bg} ${c.border}`}>
                {/* timeline dot */}
                <span className={`absolute -left-[26px] top-5 w-3.5 h-3.5 rounded-full border-2 border-white ${c.dot} shadow`} />

                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={`${c.bg} ${c.text} border ${c.border} text-xs font-semibold`}>
                      {entry.status}
                    </Badge>
                    {isActive && (
                      <Badge className="bg-green-100 text-green-700 border border-green-300 text-xs animate-pulse">
                        Current
                      </Badge>
                    )}
                  </div>
                  <span className={`text-sm font-bold ${c.text}`}>
                    {formatDuration(entry.start_date, entry.end_date)}
                  </span>
                </div>

                <div className="mt-2 space-y-1 text-xs text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span>
                      <span className="font-medium">From:</span>{' '}
                      {format(parseISO(entry.start_date), 'dd MMM yyyy, HH:mm')}
                    </span>
                  </div>
                  {entry.end_date ? (
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span>
                        <span className="font-medium">To:</span>{' '}
                        {format(parseISO(entry.end_date), 'dd MMM yyyy, HH:mm')}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span className="italic text-slate-400">Still active</span>
                    </div>
                  )}
                  {(project || entry.project_name) && (
                    <div className="flex items-center gap-1.5">
                      <span className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 text-center font-bold">P</span>
                      <span><span className="font-medium">Project:</span> {project?.name || entry.project_name}</span>
                    </div>
                  )}
                  {entry.user_name && (
                    <div className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span>{entry.user_name}</span>
                    </div>
                  )}
                </div>

                {/* Notes */}
                <div className="mt-2">
                  {editingIdx === originalIdx ? (
                    <div className="flex items-center gap-2">
                      <Input
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        placeholder="Add notes..."
                        className="h-7 text-xs flex-1"
                        autoFocus
                      />
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => saveNotes(originalIdx)}>
                        <Check className="w-3.5 h-3.5 text-green-600" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingIdx(null)}>
                        <X className="w-3.5 h-3.5 text-slate-500" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 group">
                      {entry.notes ? (
                        <p className="text-xs text-slate-600 italic flex-1">"{entry.notes}"</p>
                      ) : (
                        <p className="text-xs text-slate-400 italic flex-1">No notes</p>
                      )}
                      {isAdmin && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => startEditNotes(originalIdx, entry.notes)}
                        >
                          <Edit2 className="w-3 h-3 text-slate-500" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}