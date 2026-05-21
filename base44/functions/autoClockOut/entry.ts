import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Automatic Clock-Out Job
 * 
 * Runs at midnight (00:00 Dubai time = 20:00 UTC).
 * Finds all active timesheets from the PREVIOUS day and force-closes them at 23:59:59 of that day.
 * This prevents timesheets spanning more than one day.
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Dubai is UTC+4, so midnight Dubai = 20:00 UTC previous day
    // We find all timesheets that are still active and whose clock_in_time is before today (Dubai time)
    const nowUtc = new Date();
    
    // Current date in Dubai (UTC+4)
    const dubaiOffsetMs = 4 * 60 * 60 * 1000;
    const nowDubai = new Date(nowUtc.getTime() + dubaiOffsetMs);
    const todayDubai = nowDubai.toISOString().split('T')[0]; // YYYY-MM-DD in Dubai time

    console.log(`Auto clock-out job running. Dubai date: ${todayDubai}, UTC time: ${nowUtc.toISOString()}`);

    // Fetch all active timesheets
    const activeTimesheets = await base44.asServiceRole.entities.TimesheetEntry.filter({
      is_active: true
    });

    console.log(`Found ${activeTimesheets.length} active timesheets`);

    let processedCount = 0;
    let skippedCount = 0;

    for (const timesheet of activeTimesheets) {
      if (!timesheet.clock_in_time) {
        skippedCount++;
        continue;
      }

      // Get the clock-in date in Dubai time
      const clockInUtc = new Date(timesheet.clock_in_time);
      const clockInDubai = new Date(clockInUtc.getTime() + dubaiOffsetMs);
      const clockInDateDubai = clockInDubai.toISOString().split('T')[0];

      // Only auto clock-out if the clock-in was on a PREVIOUS day (not today)
      if (clockInDateDubai >= todayDubai) {
        skippedCount++;
        continue;
      }

      // Set clock-out time to 23:59:59 of the clock-in date (in Dubai time → convert to UTC)
      const clockOutDubai = new Date(`${clockInDateDubai}T23:59:59.000+04:00`);
      const clockOutTime = clockOutDubai.toISOString();

      const clockInTime = new Date(timesheet.clock_in_time);
      const totalDurationMinutes = Math.round((clockOutDubai - clockInTime) / 60000);

      // Close the last open segment
      const segments = timesheet.work_order_segments || [];
      if (segments.length > 0) {
        const lastSegment = segments[segments.length - 1];
        if (!lastSegment.end_time) {
          const segmentStartTime = new Date(lastSegment.start_time);
          const segmentDuration = Math.round((clockOutDubai - segmentStartTime) / 60000);
          lastSegment.end_time = clockOutTime;
          lastSegment.duration_minutes = Math.max(0, segmentDuration);
        }
      }

      // Update the timesheet
      await base44.asServiceRole.entities.TimesheetEntry.update(timesheet.id, {
        clock_out_time: clockOutTime,
        is_active: false,
        status: 'completed',
        total_duration_minutes: Math.max(0, totalDurationMinutes),
        work_order_segments: segments,
        notes: (timesheet.notes ? timesheet.notes + ' | ' : '') + 'Auto clock-out by system at midnight',
        was_edited: true
      });

      // Also deactivate the last work order segment's TimeEntry
      if (segments.length > 0) {
        const lastSegment = segments[segments.length - 1];
        if (lastSegment?.work_order_id) {
          try {
            await base44.asServiceRole.entities.TimeEntry.update(lastSegment.work_order_id, {
              is_active: false,
              end_time: clockOutTime,
              duration_minutes: Math.max(0, totalDurationMinutes)
            });
          } catch (err) {
            console.warn(`Could not update TimeEntry ${lastSegment.work_order_id}:`, err.message);
          }
        }
      }

      console.log(`Auto clocked out: employee=${timesheet.employee_id}, timesheet=${timesheet.id}, clockIn=${clockInDateDubai}, clockOut=${clockOutTime}`);
      processedCount++;
    }

    return Response.json({
      success: true,
      message: `Auto clock-out completed. Processed: ${processedCount}, Skipped: ${skippedCount}`,
      processed: processedCount,
      skipped: skippedCount
    });

  } catch (error) {
    console.error('Auto clock-out error:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});