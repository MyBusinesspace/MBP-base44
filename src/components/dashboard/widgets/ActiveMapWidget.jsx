import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useData } from "@/components/DataProvider";
import GoogleMapsLocations from "@/components/time-tracker/GoogleMapsLocations";

export default function ActiveMapWidget({ editing = false }) {
  const [timesheets, setTimesheets] = useState([]);
  const { users = [] } = useData();

  useEffect(() => {
    const loadData = async () => {
      try {
        // Fetch all timesheet entries and filter client-side for actual active sessions
        const ts = await base44.entities.TimesheetEntry.list('-updated_date', 500);
        
        // Filter for entries that are ACTIVELY clocked in TODAY
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        
        const activeTS = ts.filter(t => {
          // Must be explicitly marked as active
          if (t.is_active !== true) return false;
          // Must have clock_in coords
          if (!t.clock_in_coords || !t.clock_in_coords.lat) return false;
          // Must have started today
          if (t.clock_in_time) {
            const startDate = new Date(t.clock_in_time);
            if (startDate < todayStart) return false;
          }
          return true;
        });
        
        setTimesheets(activeTS);
      } catch { 
        setTimesheets([]);
      }
    };

    // Load data initially
    loadData();

    // Subscribe to TimesheetEntry updates for real-time tracking
    const unsubscribe = base44.entities.TimesheetEntry.subscribe((event) => {
      if (event.type === 'update' || event.type === 'create') {
        // Reload all timesheet entries when any update occurs
        base44.entities.TimesheetEntry.list('-updated_date', 500)
          .then(ts => {
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            const activeTS = ts.filter(t => {
              if (t.is_active !== true) return false;
              if (!t.clock_in_coords || !t.clock_in_coords.lat) return false;
              if (t.clock_in_time) {
                const startDate = new Date(t.clock_in_time);
                if (startDate < todayStart) return false;
              }
              return true;
            });
            setTimesheets(activeTS);
          })
          .catch(() => setTimesheets([]));
      }
    });

    return () => unsubscribe();
  }, []);

  const locations = useMemo(() => {
    const locs = [];
    console.log('🗺️ [ActiveMapWidget] Processing timesheets:', timesheets.length);
    
    // Include ALL active timesheets with coordinates
    timesheets.forEach(ts => {
      console.log('🗺️ [ActiveMapWidget] Checking timesheet:', { 
        id: ts.id, 
        employee_id: ts.employee_id,
        start_coords: ts.start_coords,
        clock_in_coords: ts.clock_in_coords,
        is_active: ts.is_active
      });
      
      const u = users.find(x => x.id === ts.employee_id);
      const name = u?.nickname || u?.first_name || u?.full_name || u?.email || 'Unknown';
      const avatarUrl = u?.profile_picture_url || u?.avatar_url || null;
      
      const coords = ts.clock_in_coords;
      if (coords && coords.lat) {
        console.log(`✅ [ActiveMapWidget] Adding location for ${name}:`, coords);
        locs.push({ 
          lat: coords.lat, 
          lng: coords.lon, 
          type: 'current', 
          time: ts.clock_in_time || ts.updated_date, 
          address: ts.clock_in_address, 
          user: { 
            first_name: name,
            avatar_url: avatarUrl,
            profile_picture_url: avatarUrl,
            id: u?.id
          } 
        });
      } else {
        console.warn(`❌ [ActiveMapWidget] No coordinates for ${name}`);
      }
    });
    
    console.log('🗺️ [ActiveMapWidget] Total locations to display:', locs.length);
    return locs;
  }, [timesheets, users]);

  const count = timesheets.length;
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-slate-600">Active workers (map)</div>
        <div className="text-base font-semibold">{count}</div>
      </div>
      <div className="flex-1 min-h-[240px]" style={{ pointerEvents: editing ? 'none' : 'auto' }}>
        {locations.length > 0 ? (
          <GoogleMapsLocations locations={locations} />
        ) : (
          <div className="h-full flex items-center justify-center text-sm text-slate-500 bg-slate-100 rounded">No active locations</div>
        )}
      </div>
    </div>
  );
}