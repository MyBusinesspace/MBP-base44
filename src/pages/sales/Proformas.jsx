import React, { useState } from 'react';
import { Plus, Search, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Proformas() {
  const [search, setSearch] = useState('');

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Proformas</h1>
          <p className="text-slate-500 text-sm mt-1">Manage proforma invoices</p>
        </div>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          New Proforma
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200">
        <div className="p-4 border-b border-slate-100 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search proformas..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
        </div>
        <div className="p-12 flex flex-col items-center justify-center text-center">
          <FileText className="w-14 h-14 text-slate-300 mb-4" />
          <h3 className="text-base font-semibold text-slate-700">No proformas yet</h3>
          <p className="text-slate-400 text-sm mt-1">Create your first proforma to get started.</p>
          <Button className="mt-4 gap-2" size="sm">
            <Plus className="w-4 h-4" /> New Proforma
          </Button>
        </div>
      </div>
    </div>
  );
}