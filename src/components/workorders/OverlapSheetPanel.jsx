import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { AlertCircle, Users, Loader2 } from 'lucide-react';
import { Sparkles } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import Avatar from '@/components/Avatar';

export default function OverlapSheetPanel({
  showOverlapPanel,
  setShowOverlapPanel,
  visibleOverlaps,
  hiddenOverlaps,
  isSolvingOverlaps,
  onSolveWithAI,
  onClearHiddenOverlaps,
  onEditWorkOrder,
}) {
  if (!showOverlapPanel || visibleOverlaps.length === 0) return null;

  return (
    <Sheet open={showOverlapPanel} onOpenChange={setShowOverlapPanel}>
      <SheetContent side="right" className="w-[500px] sm:max-w-[500px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-orange-600" />
            User Overlaps ({visibleOverlaps.length})
          </SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between gap-3 mb-4">
            <p className="text-sm text-slate-500">These users have overlapping work orders scheduled at the same time.</p>
            <Button onClick={onSolveWithAI} disabled={isSolvingOverlaps} size="sm" className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-md">
              {isSolvingOverlaps ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
              Solve with AI
            </Button>
          </div>
          {visibleOverlaps.map((overlap, idx) => {
            const { user, team, conflict, overlapType } = overlap;
            return (
              <div key={idx} className="p-4 border rounded-lg space-y-3 bg-white hover:bg-slate-50">
                <div className="flex items-center gap-2">
                  {overlapType === 'user' ? (
                    <>
                      <Avatar user={user} size="sm" />
                      <div>
                        <div className="font-semibold text-sm">{user?.nickname || user?.first_name || user?.email || 'Unknown'}</div>
                        <div className="text-xs text-slate-500">User double booked on {conflict.date}</div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                        <Users className="w-4 h-4 text-indigo-600" />
                      </div>
                      <div>
                        <div className="font-semibold text-sm">{team?.name || 'Unknown Team'}</div>
                        <div className="text-xs text-slate-500">Team overlapping on {conflict.date}</div>
                      </div>
                    </>
                  )}
                </div>
                <div className="space-y-2 pl-10">
                  {[conflict.wo1, conflict.wo2].map((wo, wi) => (
                    <div key={wi} className="text-xs p-2 bg-red-50 border border-red-200 rounded cursor-pointer hover:bg-red-100 transition-colors" onClick={() => onEditWorkOrder(wo)}>
                      <div className="font-semibold text-red-900">{wo?.work_order_number || 'N/A'} - {wo?.title || 'Untitled'}</div>
                      <div className="text-red-700">
                        {wo?.planned_start_time && format(parseISO(wo.planned_start_time), 'HH:mm')}
                        {wo?.planned_end_time && ` - ${format(parseISO(wo.planned_end_time), 'HH:mm')}`}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {hiddenOverlaps.length > 0 && (
            <Button variant="outline" size="sm" onClick={onClearHiddenOverlaps} className="w-full">
              Show {hiddenOverlaps.length} hidden overlap(s)
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}