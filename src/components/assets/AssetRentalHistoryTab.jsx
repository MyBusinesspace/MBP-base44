import React from 'react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Calendar, MapPin, Clock } from 'lucide-react';

export default function AssetRentalHistoryTab({ asset, projects = [] }) {
  const projectMap = new Map(projects.map(p => [p.id, p]));
  
  // Filter only "On Rent" entries from status history
  const rentalPeriods = (asset?.status_history || [])
    .filter(entry => entry.status === 'On Rent')
    .sort((a, b) => new Date(b.start_date) - new Date(a.start_date));

  if (!rentalPeriods.length) {
    return (
      <div className="p-6 text-center text-slate-500">
        <Calendar className="w-12 h-12 mx-auto mb-2 opacity-30" />
        <p>No rental history found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <div className="text-sm text-slate-600">
        <span className="font-medium">{rentalPeriods.length}</span> rental period(s)
      </div>

      <div className="space-y-3">
        {rentalPeriods.map((rental, idx) => {
          const project = projectMap.get(rental.project_id);
          const startDate = rental.start_date ? parseISO(rental.start_date) : null;
          const endDate = rental.end_date ? parseISO(rental.end_date) : null;
          const durationDays = rental.duration_days || (endDate && startDate ? differenceInDays(endDate, startDate) : 0);
          const isActive = !endDate;

          return (
            <div
              key={idx}
              className={cn(
                'p-4 rounded-lg border-2 transition-all',
                isActive ? 'bg-amber-50 border-amber-300' : 'bg-slate-50 border-slate-200'
              )}
            >
              {isActive && (
                <div className="mb-2">
                  <Badge className="bg-amber-500 hover:bg-amber-600 text-white text-xs">
                    Currently On Rent
                  </Badge>
                </div>
              )}

              <div className="space-y-2">
                {/* Project Info */}
                {project && (
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="font-medium text-sm text-slate-900">{project.name}</div>
                      {project.location_name && (
                        <div className="text-xs text-slate-600">{project.location_name}</div>
                      )}
                    </div>
                  </div>
                )}

                {/* Date Range */}
                {startDate && (
                  <div className="flex items-start gap-2">
                    <Calendar className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
                    <div className="space-y-0.5">
                      <div className="text-sm text-slate-700">
                        <span className="font-medium">{format(startDate, 'MMM dd, yyyy')}</span>
                        {endDate && (
                          <>
                            <span className="text-slate-500"> → </span>
                            <span className="font-medium">{format(endDate, 'MMM dd, yyyy')}</span>
                          </>
                        )}
                        {!endDate && (
                          <span className="text-amber-600 ml-2 text-xs font-medium">(ongoing)</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Duration */}
                {durationDays > 0 && (
                  <div className="flex items-start gap-2">
                    <Clock className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-sm text-slate-700">
                        <span className="font-medium">{durationDays}</span>
                        <span className="text-slate-600"> day{durationDays !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Notes */}
                {rental.notes && (
                  <div className="mt-3 pt-3 border-t border-slate-200">
                    <div className="text-xs font-medium text-slate-600 mb-1">Notes:</div>
                    <div className="text-sm text-slate-700">{rental.notes}</div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}