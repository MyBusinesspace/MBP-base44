import React, { useState, useRef, useEffect } from 'react';
import { Search, X, Plus } from 'lucide-react';

export default function WorkingOrderSelector({
  openWorkOrders = [],
  projects = [],
  customers = [],
  onSelectWorkOrder,
  onCreateNew,
  newTitle = '',
  onNewTitleChange,
  disabled = false,
  disableSelection = false
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

  const filtered = openWorkOrders.filter(wo => {
    if (!newTitle.trim()) return true;
    const q = newTitle.toLowerCase();
    const proj = projects.find(p => p.id === wo.project_id);
    const customer = proj ? customers.find(c => c.id === proj.customer_id) : null;
    return (
      (wo.title || '').toLowerCase().includes(q) ||
      (wo.work_order_number || '').toLowerCase().includes(q) ||
      (proj?.name || '').toLowerCase().includes(q) ||
      (customer?.name || '').toLowerCase().includes(q)
    );
  }).slice(0, 50);

  const handleSelect = (wo) => {
    if (disableSelection) return;
    onSelectWorkOrder(wo);
    onNewTitleChange && onNewTitleChange(wo.title || '');
    setIsOpen(false);
  };

  const handleClear = () => {
    onNewTitleChange && onNewTitleChange('');
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={newTitle}
          onChange={(e) => { onNewTitleChange && onNewTitleChange(e.target.value); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
          placeholder="Search existing work orders or enter new name..."
          disabled={disabled}
          className="w-full h-9 pl-7 pr-7 text-xs rounded-md border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-[#007B80] focus:border-[#007B80] placeholder:text-slate-400 disabled:opacity-50"
        />
        {newTitle && (
          <button onClick={handleClear} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {isOpen && !disableSelection && (
        <div className="absolute z-[9999] mt-1 w-full min-w-[420px] bg-white border border-slate-200 rounded-lg shadow-xl max-h-72 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-3 text-xs text-slate-400 text-center">No open work orders found — the name above will be used for a new one</div>
          ) : (
            filtered.map((wo) => {
              const proj = projects.find(p => p.id === wo.project_id);
              const customer = proj ? customers.find(c => c.id === proj.customer_id) : null;
              return (
                <button
                  key={wo.id}
                  onClick={() => handleSelect(wo)}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 border-b border-slate-50 last:border-0"
                >
                  <div className="flex items-center gap-2">
                    {wo.work_order_number && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 flex-shrink-0">
                        {wo.work_order_number}
                      </span>
                    )}
                    <span className="text-xs font-medium text-slate-800 truncate">{wo.title || 'Untitled'}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                    {customer?.name && <span className="font-medium text-slate-500">{customer.name}</span>}
                    {customer?.name && proj?.name && <span> · </span>}
                    {proj?.name && <span>{proj.name}</span>}
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}