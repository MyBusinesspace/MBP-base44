import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Check, Loader2 } from 'lucide-react';

const WO_STATUSES = ['open', 'closed'];

const SELECT_FIELDS = {
  status: WO_STATUSES,
};

/**
 * Inline editable cell for TimeEntry (Work Order) fields.
 * For task-level fields (title, notes on a task), pass taskId to update within tasks array.
 */
export default function InlineEditWOCell({ entry, field, displayValue, taskId, tasks, onSaved, className = '' }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const inputRef = useRef(null);
  const isSelect = field in SELECT_FIELDS;

  // Resolve current value
  const getCurrentValue = () => {
    if (taskId && tasks) {
      const task = tasks.find(t => t.id === taskId);
      if (task) return task[field] ?? '';
    }
    return entry[field] ?? '';
  };

  useEffect(() => {
    setValue(getCurrentValue());
  }, [entry, taskId, field]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      if (!isSelect && inputRef.current.select) inputRef.current.select();
    }
  }, [editing]);

  const save = async (newValue) => {
    const current = getCurrentValue();
    if (newValue === current) { setEditing(false); return; }
    setSaving(true);
    try {
      let updateData = {};
      if (taskId && tasks) {
        // Update within tasks array
        const updatedTasks = tasks.map(t =>
          t.id === taskId ? { ...t, [field]: newValue } : t
        );
        updateData = { tasks: updatedTasks };
      } else {
        updateData = { [field]: newValue };
      }
      await base44.entities.TimeEntry.update(entry.id, updateData);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
      onSaved && onSaved(updateData);
    } finally {
      setSaving(false);
      setEditing(false);
    }
  };

  if (editing) {
    if (isSelect) {
      return (
        <select
          ref={inputRef}
          value={value}
          onChange={(e) => { setValue(e.target.value); save(e.target.value); }}
          onBlur={() => save(value)}
          className="w-full text-xs border border-indigo-400 rounded px-1 py-0.5 bg-white outline-none focus:ring-1 focus:ring-indigo-400"
          onClick={(e) => e.stopPropagation()}
        >
          {SELECT_FIELDS[field].map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );
    }
    return (
      <textarea
        ref={inputRef}
        value={value}
        rows={2}
        onChange={(e) => setValue(e.target.value)}
        onBlur={(e) => save(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save(value); }
          if (e.key === 'Escape') { setValue(getCurrentValue()); setEditing(false); }
          e.stopPropagation();
        }}
        onClick={(e) => e.stopPropagation()}
        className="w-full text-xs border border-indigo-400 rounded px-1 py-0.5 bg-white outline-none focus:ring-1 focus:ring-indigo-400 resize-none min-w-[80px]"
      />
    );
  }

  const display = displayValue ?? (getCurrentValue() || '-');

  return (
    <div
      onClick={(e) => { e.stopPropagation(); e.preventDefault(); setEditing(true); }}
      onMouseDown={(e) => { e.stopPropagation(); }}
      className={`group relative flex items-start gap-1 cursor-pointer hover:bg-indigo-50 rounded px-1 -mx-1 transition-colors min-h-[18px] ${className}`}
      title="Click to edit"
    >
      <span className={`flex-1 ${saving || saved ? 'opacity-60' : ''}`}>{display}</span>
      {saving && <Loader2 className="w-3 h-3 animate-spin text-indigo-400 flex-shrink-0 mt-0.5" />}
      {saved && <Check className="w-3 h-3 text-green-500 flex-shrink-0 mt-0.5" />}
      {!saving && !saved && (
        <span className="opacity-0 group-hover:opacity-100 text-[9px] text-indigo-400 flex-shrink-0 mt-0.5">✎</span>
      )}
    </div>
  );
}