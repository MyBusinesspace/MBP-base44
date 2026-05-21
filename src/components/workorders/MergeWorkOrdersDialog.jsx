import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, GitMerge, Check } from 'lucide-react';

/**
 * MergeWorkOrdersDialog
 * Props:
 *  - groups: array of group objects { title, orders, firstOrder }  -- the selected groups
 *  - onClose: () => void
 *  - onMerged: () => void  -- called after successful merge
 */
export default function MergeWorkOrdersDialog({ groups, onClose, onMerged }) {
  // The group whose name will be kept (the "base")
  const [baseGroupIndex, setBaseGroupIndex] = useState(0);
  const [merging, setMerging] = useState(false);
  const [freshGroups, setFreshGroups] = useState(null);
  const [loadingFresh, setLoadingFresh] = useState(true);

  // Fetch fresh data for all orders on open so task counts are accurate
  useEffect(() => {
    if (!groups || groups.length < 2) return;
    const allOrderIds = groups.flatMap(g => g.orders.map(o => o.id));
    setLoadingFresh(true);
    Promise.all(allOrderIds.map(id => base44.entities.TimeEntry.get(id))).then(results => {
      const freshById = {};
      results.forEach(o => { if (o?.id) freshById[o.id] = o; });
      const rebuilt = groups.map(g => ({
        ...g,
        orders: g.orders.map(o => freshById[o.id] || o)
      }));
      setFreshGroups(rebuilt);
    }).catch(() => setLoadingFresh(false)).finally(() => setLoadingFresh(false));
  }, []);

  if (!groups || groups.length < 2) return null;

  const displayGroups = freshGroups || groups;
  const baseGroup = displayGroups[baseGroupIndex];
  const otherGroups = displayGroups.filter((_, i) => i !== baseGroupIndex);

  const handleMerge = async () => {
    setMerging(true);
    try {
      const baseTitle = baseGroup.title;

      // Collect ALL order IDs across all groups
      const allOrderIds = [];
      groups.forEach(group => group.orders.forEach(o => allOrderIds.push(o.id)));

      // Fetch fresh data for every order to ensure tasks are up-to-date
      const freshOrders = await Promise.all(allOrderIds.map(id => base44.entities.TimeEntry.get(id)));
      const freshById = {};
      freshOrders.forEach(o => { if (o?.id) freshById[o.id] = o; });

      // Collect all tasks from ALL groups using fresh data
      const allTasks = [];
      groups.forEach(group => {
        group.orders.forEach(order => {
          const fresh = freshById[order.id] || order;
          (fresh.tasks || []).forEach(task => allTasks.push(task));
        });
      });

      // The base order to keep is the first order of the base group
      const baseOrderId = baseGroup.orders[0].id;

      // Update the base order with all merged tasks
      await base44.entities.TimeEntry.update(baseOrderId, {
        title: baseTitle,
        tasks: allTasks,
      });

      // Delete all other orders
      const idsToDelete = allOrderIds.filter(id => id !== baseOrderId);
      for (const id of idsToDelete) {
        await base44.entities.TimeEntry.delete(id);
      }

      toast.success(`Merged ${groups.length} job orders into "${baseTitle}" (${allTasks.length} tasks)`);
      onMerged();
      onClose();
    } catch (e) {
      console.error(e);
      toast.error('Merge failed: ' + e.message);
    } finally {
      setMerging(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center">
            <GitMerge className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900">Merge Job Orders</h2>
            <p className="text-xs text-slate-500">All tasks will be combined into the selected job order name.</p>
          </div>
        </div>

        {/* Select base */}
        <div>
          <p className="text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wide">Select the name to keep:</p>
          {loadingFresh ? (
            <div className="flex items-center gap-2 py-4 text-slate-500 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading task counts...
            </div>
          ) : (
            <div className="space-y-2">
              {displayGroups.map((group, i) => {
                const isBase = i === baseGroupIndex;
                const totalTasks = group.orders.reduce((sum, o) => sum + (o.tasks?.length || 0), 0);
                return (
                  <button
                    key={group.title + i}
                    onClick={() => setBaseGroupIndex(i)}
                    className={`w-full text-left flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all ${
                      isBase
                        ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-400'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${isBase ? 'border-indigo-500 bg-indigo-500' : 'border-slate-300'}`}>
                        {isBase && <Check className="w-2.5 h-2.5 text-white" />}
                      </div>
                      <span className="text-sm font-medium text-slate-800">{group.title}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className="text-[10px]">{group.orders.length} WO{group.orders.length !== 1 ? 's' : ''}</Badge>
                      <Badge variant="secondary" className="text-[10px]">{totalTasks} task{totalTasks !== 1 ? 's' : ''}</Badge>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-800">
          <strong>What will happen:</strong>
          <ul className="mt-1 space-y-0.5 list-disc list-inside">
            <li>All tasks from <strong>{otherGroups.map(g => `"${g.title}"`).join(', ')}</strong> will be moved into <strong>"{baseGroup.title}"</strong></li>
            <li>The other job order records will be <strong>permanently deleted</strong></li>
            <li>Total tasks after merge: <strong>{displayGroups.reduce((s, g) => s + g.orders.reduce((ss, o) => ss + (o.tasks?.length || 0), 0), 0)}</strong></li>
          </ul>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose} disabled={merging}>Cancel</Button>
          <Button
            onClick={handleMerge}
            disabled={merging}
            className="gap-2 bg-indigo-600 hover:bg-indigo-700"
          >
            {merging ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitMerge className="w-4 h-4" />}
            Merge
          </Button>
        </div>
      </div>
    </div>
  );
}