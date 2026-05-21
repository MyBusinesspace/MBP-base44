import React, { useState, useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';

export default function TaskSelector({
  tasks = [],
  selectedTaskName = '',
  onSelectTask,
  disabled = false,
  onNameChange
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = tasks.filter(t => {
    if (!selectedTaskName.trim()) return true;
    return (t.name || '').toLowerCase().includes(selectedTaskName.toLowerCase());
  });

  const handleSelect = (task) => {
    setIsOpen(false);
    if (onSelectTask) onSelectTask(task);
  };

  const handleClear = () => {
    if (onNameChange) onNameChange('');
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={selectedTaskName}
          onChange={(e) => { onNameChange && onNameChange(e.target.value); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
          placeholder="Search existing tasks or enter new task name..."
          disabled={disabled}
          className="w-full h-8 pl-7 pr-7 text-xs rounded-md border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-[#007B80] focus:border-[#007B80] placeholder:text-slate-400 disabled:opacity-50"
        />
        {selectedTaskName && (
          <button onClick={handleClear} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {isOpen && tasks.length > 0 && (
        <div className="absolute z-[9999] mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-xl max-h-52 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-3 text-xs text-slate-400 text-center">No matching tasks — the name above will be used for a new one</div>
          ) : (
            filtered.map((task) => (
              <button
                key={task.id}
                onClick={() => handleSelect(task)}
                className="w-full text-left px-3 py-2 hover:bg-slate-50 border-b border-slate-50 last:border-0"
              >
                <div className="flex items-center gap-2">
                  {task.ref && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 flex-shrink-0">
                      {task.ref}
                    </span>
                  )}
                  <span className="text-xs font-medium text-slate-800 truncate">{task.name || 'Untitled'}</span>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}