import React, { useState, useEffect } from 'react';
import { Briefcase, Clock, MapPin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useData } from '@/components/DataProvider';

const formatTime = (totalSeconds) => {
    const hours = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
    const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
    const seconds = (totalSeconds % 60).toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
};

const formatWONumber = (val, refISO) => {
  if (!val) return '';
  const s = String(val).trim();
  if (/^\d{3,4}\/\d{2}$/.test(s)) return s;
  let m = s.match(/^WO-(\d{4})-(\d{1,4})$/i) || s.match(/^WR-(\d{4})-(\d{1,4})$/i);
  if (m) return `${String(m[2]).padStart(4,'0')}/${String(m[1]).slice(-2)}`;
  m = s.match(/^(\d{1,4})$/);
  if (m) {
    const yy = (() => { try { return new Date(refISO || new Date()).getFullYear().toString().slice(-2); } catch { return new Date().getFullYear().toString().slice(-2); } })();
    return `${String(m[1]).padStart(4,'0')}/${yy}`;
  }
  return '';
};

export default function ActiveSessionTimer({ entry, project, task }) {
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const { customers = [] } = useData();

    useEffect(() => {
        let timer;
        if (entry?.is_active) {
            const updateTimer = () => {
                const startTime = new Date(entry.start_time);
                const now = new Date();
                setElapsedSeconds(Math.floor((now - startTime) / 1000));
            };
            updateTimer();
            timer = setInterval(updateTimer, 1000);
        }
        return () => clearInterval(timer);
    }, [entry]);

    if (!entry) return null;

    const customer = project?.customer_id ? customers.find(c => c.id === project.customer_id) : null;
    const workOrder = entry.work_order_id ? entry : null;
    const woNumber = workOrder?.work_order_number ? formatWONumber(workOrder.work_order_number, workOrder.created_date) : null;
    const currentTask = task || (entry.tasks && entry.tasks.length > 0 ? entry.tasks[0] : null);
    
    // Get location description
    const locationDesc = entry.start_address || project?.location_name || project?.address || (
      entry.start_coords ? `${entry.start_coords.lat.toFixed(4)}, ${entry.start_coords.lon.toFixed(4)}` : null
    );

    return (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4 shadow-sm">
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 overflow-hidden flex-1">
                    <Briefcase className="w-5 h-5 flex-shrink-0 text-green-600 animate-pulse mt-0.5" />
                    <div className="flex-grow overflow-hidden space-y-1.5">
                        {/* WO Number */}
                        {woNumber && (
                            <Badge variant="outline" className="font-mono text-xs bg-white">
                                {woNumber}
                            </Badge>
                        )}
                        
                        {/* Client / Project */}
                        <div className="space-y-0.5">
                            {customer && (
                                <p className="text-xs text-slate-500 truncate">
                                    {customer.name}
                                </p>
                            )}
                            <p className="text-sm font-semibold text-slate-800 truncate">
                                {project?.name || 'Unknown Project'}
                            </p>
                        </div>
                        
                        {/* Working Order Title / Task Title */}
                        <div className="space-y-0.5">
                            {entry.title && (
                                <p className="text-sm font-medium text-green-700 truncate">
                                    {entry.title}
                                </p>
                            )}
                            {currentTask && (
                                <p className="text-xs text-slate-600 truncate">
                                    {currentTask.name}
                                </p>
                            )}
                        </div>
                        
                        {/* Location */}
                        {locationDesc && (
                            <div className="flex items-start gap-1 text-xs text-slate-500">
                                <MapPin className="w-3 h-3 flex-shrink-0 mt-0.5" />
                                <span className="truncate">{locationDesc}</span>
                            </div>
                        )}
                    </div>
                </div>
                
                {/* Timer */}
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <div className="flex items-center gap-2 text-2xl font-mono font-bold tracking-tight text-green-700">
                        <Clock className="w-5 h-5" />
                        {formatTime(elapsedSeconds)}
                    </div>
                    <Badge className="bg-green-100 text-green-700 border-green-300">
                        ACTIVE NOW
                    </Badge>
                </div>
            </div>
        </div>
    );
}