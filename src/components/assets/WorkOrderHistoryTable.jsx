import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import Avatar from '../Avatar';

export default function WorkOrderHistoryTable({
  workOrders,
  workOrderCategories,
  allEmployees,
  woSort,
  setWOSort,
  woCategoryFilter,
  setWOCategoryFilter,
  woStatusFilter,
  setWOStatusFilter,
  onClickWO
}) {
  if (workOrders.length === 0) {
    return <p className="text-xs text-slate-500 italic">No work orders found.</p>;
  }

  let filtered = workOrders.filter(wo => {
    const cat = workOrderCategories.find(c => c.id === wo.work_order_category_id);
    const catName = cat?.name || 'Uncategorized';
    const status = wo.status || 'open';
    const matchesCategory = woCategoryFilter.length === 0 || woCategoryFilter.includes(catName);
    const matchesStatus = woStatusFilter.length === 0 || woStatusFilter.includes(status);
    return matchesCategory && matchesStatus;
  });

  filtered.sort((a, b) => {
    const catA = workOrderCategories.find(c => c.id === a.work_order_category_id);
    const catB = workOrderCategories.find(c => c.id === b.work_order_category_id);
    let valA, valB;
    if (woSort.key === 'date') { valA = a.task_start_date || a.planned_start_time || ''; valB = b.task_start_date || b.planned_start_time || ''; }
    else if (woSort.key === 'number') { valA = a.work_order_number || ''; valB = b.work_order_number || ''; }
    else if (woSort.key === 'title') { valA = (a.title || a.task || '').toLowerCase(); valB = (b.title || b.task || '').toLowerCase(); }
    else if (woSort.key === 'status') { valA = a.status || 'open'; valB = b.status || 'open'; }
    else if (woSort.key === 'category') { valA = catA?.name || ''; valB = catB?.name || ''; }
    if (valA < valB) return woSort.direction === 'asc' ? -1 : 1;
    if (valA > valB) return woSort.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const categoryCounts = {};
  workOrders.forEach(wo => {
    const cat = workOrderCategories.find(c => c.id === wo.work_order_category_id);
    const name = cat?.name || 'Uncategorized';
    categoryCounts[name] = (categoryCounts[name] || 0) + 1;
  });

  const statusCounts = {};
  workOrders.forEach(wo => {
    const s = wo.status || 'open';
    statusCounts[s] = (statusCounts[s] || 0) + 1;
  });

  const sortHead = (key, label) => (
    <TableHead
      className="text-[10px] font-medium text-slate-500 h-7 py-1 px-2 cursor-pointer hover:bg-slate-100"
      onClick={(e) => { e.stopPropagation(); setWOSort(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' })); }}
    >
      {label} {woSort.key === key && (woSort.direction === 'asc' ? '↑' : '↓')}
    </TableHead>
  );

  return (
    <>
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        {Object.entries(categoryCounts).map(([name, count]) => (
          <Button key={name} variant={woCategoryFilter.includes(name) ? 'default' : 'outline'} size="sm"
            onClick={(e) => { e.stopPropagation(); setWOCategoryFilter(prev => prev.includes(name) ? prev.filter(c => c !== name) : [...prev, name]); }}
            className={cn("h-5 px-1.5 text-[9px]", woCategoryFilter.includes(name) && "bg-indigo-600 hover:bg-indigo-700")}
          >{name} ({count})</Button>
        ))}
        {Object.entries(statusCounts).map(([status, count]) => (
          <Button key={status} variant={woStatusFilter.includes(status) ? 'default' : 'outline'} size="sm"
            onClick={(e) => { e.stopPropagation(); setWOStatusFilter(prev => prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]); }}
            className={cn("h-5 px-1.5 text-[9px]", woStatusFilter.includes(status) && "bg-green-600 hover:bg-green-700")}
          >{status} ({count})</Button>
        ))}
        {(woCategoryFilter.length > 0 || woStatusFilter.length > 0) && (
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setWOCategoryFilter([]); setWOStatusFilter([]); }} className="h-5 px-1.5 text-[9px]">
            <X className="w-2.5 h-2.5 mr-0.5" />Clear
          </Button>
        )}
      </div>
      <div className="rounded-md border border-slate-200 overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow className="h-7 border-b border-slate-200">
              {sortHead('date', 'Date')}
              {sortHead('number', 'WO #')}
              {sortHead('title', 'Title')}
              {sortHead('status', 'Status')}
              {sortHead('category', 'Category')}
              <TableHead className="text-[10px] font-medium text-slate-500 h-7 py-1 px-2">Users</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(wo => {
              const woCategory = workOrderCategories.find(c => c.id === wo.work_order_category_id);
              const woDate = wo.task_start_date || wo.planned_start_time;
              return (
                <TableRow key={wo.id} className="h-7 hover:bg-slate-50 border-b border-slate-100 last:border-0 cursor-pointer" onClick={(e) => { e.stopPropagation(); onClickWO(wo); }}>
                  <TableCell className="py-1 px-2"><span className="text-[10px] text-slate-500">{woDate ? format(new Date(woDate), 'dd/MM/yy') : '-'}</span></TableCell>
                  <TableCell className="py-1 px-2"><span className="text-xs font-medium text-indigo-600 hover:underline">{wo.work_order_number || '-'}</span></TableCell>
                  <TableCell className="py-1 px-2"><span className="text-[10px] text-slate-600 truncate block max-w-[150px]">{wo.title || wo.task || '-'}</span></TableCell>
                  <TableCell className="py-1 px-2"><span className={cn("text-[10px] font-medium", wo.status === 'closed' ? "text-green-600" : "text-blue-600")}>{wo.status === 'closed' ? 'closed' : 'open'}</span></TableCell>
                  <TableCell className="py-1 px-2"><span className="text-[10px] text-slate-500">{woCategory?.name || '-'}</span></TableCell>
                  <TableCell className="py-1 px-2">
                    <div className="flex -space-x-1 overflow-hidden">
                      {(wo.employee_ids || []).slice(0, 3).map(uid => {
                        const u = allEmployees.find(user => user.id === uid);
                        return u ? <Avatar key={uid} user={u} size="xs" /> : null;
                      })}
                      {(wo.employee_ids || []).length > 3 && (
                        <div className="inline-block h-5 w-5 rounded-full ring-1 ring-white bg-slate-200 flex items-center justify-center text-[8px] font-medium text-slate-600">
                          +{(wo.employee_ids || []).length - 3}
                        </div>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </>
  );
}