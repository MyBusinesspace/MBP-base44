import React, { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { AlertCircle, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import Avatar from '../Avatar';

export default function WeekOverlapPanel({ showOverlapPanel, onToggleOverlapPanel, weekOverlaps, onHideOverlaps }) {
  const [selectedOverlaps, setSelectedOverlaps] = useState(new Set());

  const handleHideSelectedOverlaps = async () => {
    if (selectedOverlaps.size === 0) {
      toast.error('No overlaps selected');
      return;
    }
    const overlapIds = Array.from(selectedOverlaps);
    await onHideOverlaps(overlapIds);
    setSelectedOverlaps(new Set());
    toast.success(`Hidden ${overlapIds.length} overlap(s)`);
  };

  return (
    <Sheet open={showOverlapPanel} onOpenChange={onToggleOverlapPanel}>
      <SheetContent side="right" className="w-[600px] sm:max-w-[600px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-orange-600" />
            Week Overlaps ({weekOverlaps.length})
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {selectedOverlaps.size > 0 && (
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <span className="text-sm font-medium">{selectedOverlaps.size} selected</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setSelectedOverlaps(new Set())}>Clear</Button>
                <Button size="sm" onClick={handleHideSelectedOverlaps}>
                  <EyeOff className="w-4 h-4 mr-2" />
                  Hide Selected
                </Button>
              </div>
            </div>
          )}

          {weekOverlaps.map((overlap, idx) => {
            const { conflict, user } = overlap;
            const overlapId = `${conflict.wo1?.id}-${conflict.wo2?.id}`;
            const isSelected = selectedOverlaps.has(overlapId);

            const toggle = () => {
              const next = new Set(selectedOverlaps);
              if (next.has(overlapId)) next.delete(overlapId);
              else next.add(overlapId);
              setSelectedOverlaps(next);
            };

            return (
              <div
                key={idx}
                className={cn(
                  "p-4 border rounded-lg space-y-3 cursor-pointer transition-colors",
                  isSelected ? "bg-indigo-50 border-indigo-300" : "bg-white hover:bg-slate-50"
                )}
                onClick={toggle}
              >
                <div className="flex items-center gap-2">
                  <Checkbox checked={isSelected} onCheckedChange={toggle} onClick={(e) => e.stopPropagation()} />
                  <Avatar user={user} size="sm" />
                  <div>
                    <div className="font-semibold text-sm">{user?.nickname || user?.first_name || user?.email || 'Unknown'}</div>
                    <div className="text-xs text-slate-500">Double Booked</div>
                  </div>
                </div>

                <div className="space-y-2 pl-10">
                  {[conflict.wo1, conflict.wo2].map((wo, i) => (
                    <div key={i} className="text-xs p-2 bg-red-50 border border-red-200 rounded">
                      <div className="font-semibold text-red-900">{wo?.work_order_number || 'N/A'} - {wo?.title}</div>
                      <div className="text-red-700">
                        {wo?.planned_start_time && format(parseISO(wo.planned_start_time), 'MMM d, HH:mm')}
                        {wo?.planned_end_time && ` - ${format(parseISO(wo.planned_end_time), 'HH:mm')}`}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}