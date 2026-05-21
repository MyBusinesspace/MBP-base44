import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Check, Loader2 } from 'lucide-react';

const ASSET_STATUSES = ['Available', 'In Use', 'Maintenance', 'Decommissioned', 'On Rent'];
const ASSET_CATEGORIES = ['Vehicle', 'Tower Crane', 'Hoist', 'Hoist Mast Section', 'Tool', 'Office Staff'];
const DEPRECIATION_METHODS = ['Straight Line', 'Declining Balance', 'Double Declining Balance', 'No Depreciation'];

const SELECT_FIELDS = {
  category: ASSET_CATEGORIES,
  status: ASSET_STATUSES,
  depreciation_method: DEPRECIATION_METHODS,
};

export default function InlineEditCell({ asset, field, displayValue, onSaved, className = 'text-xs font-medium text-slate-900', editRef }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(asset[field] ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const inputRef = useRef(null);
  const isSelect = field in SELECT_FIELDS;

  useEffect(() => {
    setValue(asset[field] ?? '');
  }, [asset, field]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      if (!isSelect && inputRef.current.select) inputRef.current.select();
    }
  }, [editing]);

  const save = async (newValue) => {
    if (newValue === (asset[field] ?? '')) { setEditing(false); return; }
    setSaving(true);
    try {
      await base44.entities.Asset.update(asset.id, { [field]: newValue });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
      onSaved && onSaved({ ...asset, [field]: newValue });
    } finally {
      setSaving(false);
      setEditing(false);
    }
  };

  // Expose setEditing via ref so parent can trigger edit
  React.useEffect(() => {
    if (editRef) editRef.current = () => setEditing(true);
  }, [editRef]);

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
          <option value="">-</option>
          {SELECT_FIELDS[field].map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );
    }
    return (
      <input
        ref={inputRef}
        type={field === 'quantity' || field === 'purchase_cost' ? 'number' : 'text'}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={(e) => save(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') save(value);
          if (e.key === 'Escape') { setValue(asset[field] ?? ''); setEditing(false); }
          e.stopPropagation();
        }}
        onClick={(e) => e.stopPropagation()}
        className="w-full text-xs border border-indigo-400 rounded px-1 py-0.5 bg-white outline-none focus:ring-1 focus:ring-indigo-400 min-w-[60px]"
      />
    );
  }

  return (
    <div
      onClick={(e) => { e.stopPropagation(); setEditing(true); }}
      className={`group relative flex items-center gap-1 cursor-pointer hover:bg-indigo-50 rounded px-1 -mx-1 transition-colors min-h-[20px] ${className}`}
      title="Click to edit"
    >
      <span className={saving || saved ? 'opacity-60' : ''}>
        {displayValue ?? (asset[field] || '-')}
      </span>
      {saving && <Loader2 className="w-3 h-3 animate-spin text-indigo-400 flex-shrink-0" />}
      {saved && <Check className="w-3 h-3 text-green-500 flex-shrink-0" />}
    </div>
  );
}