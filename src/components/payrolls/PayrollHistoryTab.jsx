import React, { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { usePayrollCurrency } from '@/hooks/usePayrollCurrency';

export default function PayrollHistoryTab({ payStubs = [], loading, filterCategory, setFilterCategory, filterSubcategory, setFilterSubcategory, filterPayItem, setFilterPayItem }) {
  const { format: formatCurrency } = usePayrollCurrency();
  const [expandedStub, setExpandedStub] = useState(null);

  // Collect all categories, subcategories, and pay items from line items across all stubs
  const { categories, subcategoriesMap, payItemsMap } = useMemo(() => {
    const cats = new Set();
    const subMap = {};
    const piMap = {}; // key: "cat||sub" => Set of pay item names
    payStubs.forEach(stub => {
      const snap = stub.data_snapshot || {};
      const earnings = Array.isArray(snap.earnings_breakdown) ? snap.earnings_breakdown : Array.isArray(snap.earnings) ? snap.earnings : [];
      const deductions = Array.isArray(snap.deductions_breakdown) ? snap.deductions_breakdown : Array.isArray(snap.deductions) ? snap.deductions : [];
      const allRows = [...earnings, ...deductions];
      allRows.forEach(row => {
        const cat = row.category || row.selected_category || '';
        const sub = row.subcategory || row.selected_subcategory || '';
        const item = row.pay_item_name || row.name || '';
        if (cat) {
          cats.add(cat);
          if (!subMap[cat]) subMap[cat] = new Set();
          if (sub) subMap[cat].add(sub);
        }
        const piKey = `${cat}||${sub}`;
        if (!piMap[piKey]) piMap[piKey] = new Set();
        if (item) piMap[piKey].add(item);
      });
    });
    const result = {};
    Object.keys(subMap).forEach(k => { result[k] = Array.from(subMap[k]).sort(); });
    const piResult = {};
    Object.keys(piMap).forEach(k => { piResult[k] = Array.from(piMap[k]).sort(); });
    return { categories: Array.from(cats).sort(), subcategoriesMap: result, payItemsMap: piResult };
  }, [payStubs]);

  // Available subcategories based on selected category
  const availableSubcategories = filterCategory !== 'all' ? (subcategoriesMap[filterCategory] || []) : [];

  // Available pay items based on selected category + subcategory
  const piKey = `${filterCategory === 'all' ? '' : filterCategory}||${filterSubcategory === 'all' ? '' : filterSubcategory}`;
  const availablePayItems = useMemo(() => {
    if (filterCategory === 'all' && filterSubcategory === 'all') {
      // All pay items
      const all = new Set();
      Object.values(payItemsMap).forEach(set => set.forEach(i => all.add(i)));
      return Array.from(all).sort();
    }
    return payItemsMap[piKey] || [];
  }, [filterCategory, filterSubcategory, payItemsMap, piKey]);

  // Filter line items per stub
  const filteredStubs = useMemo(() => {
    return payStubs.map(stub => {
      const snap = stub.data_snapshot || {};
      const earnings = Array.isArray(snap.earnings_breakdown) ? snap.earnings_breakdown : Array.isArray(snap.earnings) ? snap.earnings : [];
      const deductions = Array.isArray(snap.deductions_breakdown) ? snap.deductions_breakdown : Array.isArray(snap.deductions) ? snap.deductions : [];
      const allRows = [...earnings, ...deductions];
      const filtered = allRows.filter(row => {
        const cat = row.category || row.selected_category || '';
        const sub = row.subcategory || row.selected_subcategory || '';
        const item = row.pay_item_name || row.name || '';
        if (filterCategory !== 'all' && cat !== filterCategory) return false;
        if (filterSubcategory !== 'all' && sub !== filterSubcategory) return false;
        if (filterPayItem && filterPayItem !== 'all' && item !== filterPayItem) return false;
        return true;
      });
      return { ...stub, filteredRows: filtered };
    }).filter(stub => {
      if (filterCategory === 'all' && filterSubcategory === 'all') return true;
      return stub.filteredRows.length > 0;
    });
  }, [payStubs, filterCategory, filterSubcategory, filterPayItem]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400 text-sm">
        Loading payroll history...
      </div>
    );
  }

  if (payStubs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400">
        <p className="text-sm font-medium">No payroll history found</p>
        <p className="text-xs mt-1">This employee has no processed payslips yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex gap-2 items-center">
        <Select value={filterCategory} onValueChange={(v) => { setFilterCategory(v); setFilterSubcategory('all'); }}>
          <SelectTrigger className="h-7 text-xs w-44">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent className="z-[9999]">
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map(cat => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {filterCategory !== 'all' && availableSubcategories.length > 0 && (
          <Select value={filterSubcategory} onValueChange={(v) => { setFilterSubcategory(v); setFilterPayItem && setFilterPayItem('all'); }}>
            <SelectTrigger className="h-7 text-xs w-44">
              <SelectValue placeholder="All Subcategories" />
            </SelectTrigger>
            <SelectContent className="z-[9999]">
              <SelectItem value="all">All Subcategories</SelectItem>
              {availableSubcategories.map(sub => (
                <SelectItem key={sub} value={sub}>{sub}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {availablePayItems.length > 0 && setFilterPayItem && (
          <Select value={filterPayItem || 'all'} onValueChange={setFilterPayItem}>
            <SelectTrigger className="h-7 text-xs w-48">
              <SelectValue placeholder="All Pay Items" />
            </SelectTrigger>
            <SelectContent className="z-[9999]">
              <SelectItem value="all">All Pay Items</SelectItem>
              {availablePayItems.map(item => (
                <SelectItem key={item} value={item}>{item}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <span className="text-xs text-slate-400 ml-auto">{filteredStubs.length} period{filteredStubs.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-3 py-2 font-semibold text-slate-500 uppercase tracking-wide" style={{fontSize: '10px', width: '30px'}}></th>
              <th className="text-left px-3 py-2 font-semibold text-slate-500 uppercase tracking-wide" style={{fontSize: '10px'}}>Period</th>
              <th className="text-left px-3 py-2 font-semibold text-slate-500 uppercase tracking-wide" style={{fontSize: '10px'}}>Status</th>
              <th className="text-right px-3 py-2 font-semibold text-slate-500 uppercase tracking-wide" style={{fontSize: '10px'}}>Gross</th>
              <th className="text-right px-3 py-2 font-semibold text-slate-500 uppercase tracking-wide" style={{fontSize: '10px'}}>Deductions</th>
              <th className="text-right px-3 py-2 font-semibold text-slate-500 uppercase tracking-wide" style={{fontSize: '10px'}}>Net Pay</th>
            </tr>
          </thead>
          <tbody>
            {filteredStubs.map((stub, idx) => {
              const snap = stub.data_snapshot || {};
              const isExpanded = expandedStub === stub.id;
              const isOdd = idx % 2 === 0;

              return (
                <React.Fragment key={stub.id}>
                  {/* Summary Row */}
                  <tr
                    className={`border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors ${isOdd ? 'bg-white' : 'bg-slate-50/40'}`}
                    onClick={() => setExpandedStub(isExpanded ? null : stub.id)}
                  >
                    <td className="px-3 py-2 text-slate-400">
                      {isExpanded
                        ? <ChevronDown className="w-3 h-3" />
                        : <ChevronRight className="w-3 h-3" />}
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-slate-800">
                        {snap.period_start_date
                          ? format(new Date(snap.period_start_date), 'MMM d') + ' – ' + (snap.period_end_date ? format(new Date(snap.period_end_date), 'MMM d, yyyy') : '')
                          : stub.created_date ? format(new Date(stub.created_date), 'MMM d, yyyy') : '—'}
                      </div>
                      {snap.pay_date && (
                        <div className="text-slate-400" style={{fontSize: '10px'}}>
                          Paid {format(new Date(snap.pay_date), 'MMM d, yyyy')}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <Badge
                        className={`text-[10px] px-1.5 py-0.5 font-medium ${
                          stub.status === 'Paid'
                            ? 'bg-green-50 text-green-700 border border-green-200'
                            : stub.status === 'Failed'
                            ? 'bg-red-50 text-red-700 border border-red-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                        variant="outline"
                      >
                        {stub.status || 'Pending'}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-slate-700">{formatCurrency(stub.gross_pay || 0)}</td>
                    <td className="px-3 py-2 text-right font-mono text-red-600">-{formatCurrency(stub.deductions || 0)}</td>
                    <td className="px-3 py-2 text-right font-mono font-semibold text-slate-900">{formatCurrency(stub.net_pay || 0)}</td>
                  </tr>

                  {/* Expanded Line Items */}
                  {isExpanded && (
                    <tr className="bg-slate-50/80 border-b border-slate-200">
                      <td colSpan={6} className="px-0 py-0">
                        <div className="px-6 py-3">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-slate-200">
                                <th className="text-left pb-1.5 font-semibold text-slate-400 uppercase tracking-wide" style={{fontSize: '10px'}}>Pay Item</th>
                                <th className="text-left pb-1.5 font-semibold text-slate-400 uppercase tracking-wide" style={{fontSize: '10px'}}>Category</th>
                                <th className="text-left pb-1.5 font-semibold text-slate-400 uppercase tracking-wide" style={{fontSize: '10px'}}>Note</th>
                                <th className="text-right pb-1.5 font-semibold text-slate-400 uppercase tracking-wide" style={{fontSize: '10px'}}>Qty</th>
                                <th className="text-right pb-1.5 font-semibold text-slate-400 uppercase tracking-wide" style={{fontSize: '10px'}}>Rate</th>
                                <th className="text-right pb-1.5 font-semibold text-slate-400 uppercase tracking-wide" style={{fontSize: '10px'}}>Amount</th>
                              </tr>
                            </thead>
                            <tbody>
                              {stub.filteredRows.map((row, rIdx) => {
                                const isDeduction = (row.category || '').toLowerCase().includes('deduction');
                                return (
                                  <tr key={rIdx} className="border-b border-slate-100 last:border-0">
                                    <td className="py-1.5 pr-3 text-slate-700 font-medium">{row.pay_item_name || row.name || '—'}</td>
                                    <td className="py-1.5 pr-3">
                                      <span className="text-slate-500">{row.category || row.selected_category || '—'}</span>
                                      {(row.subcategory || row.selected_subcategory) && (
                                        <span className="text-slate-400 ml-1">/ {row.subcategory || row.selected_subcategory}</span>
                                      )}
                                    </td>
                                    <td className="py-1.5 pr-3 text-slate-400 italic">{row.note || '—'}</td>
                                    <td className="py-1.5 pr-3 text-right text-slate-500">{row.qty != null ? row.qty : '—'}</td>
                                    <td className="py-1.5 pr-3 text-right text-slate-500">{row.rate != null ? formatCurrency(row.rate) : '—'}</td>
                                    <td className={`py-1.5 text-right font-mono font-semibold ${isDeduction ? 'text-red-600' : 'text-slate-800'}`}>
                                      {isDeduction ? '-' : ''}{formatCurrency(row.amount || 0)}
                                    </td>
                                  </tr>
                                );
                              })}
                              {stub.filteredRows.length === 0 && (
                                <tr>
                                  <td colSpan={6} className="py-3 text-center text-slate-400 italic">No matching line items</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}