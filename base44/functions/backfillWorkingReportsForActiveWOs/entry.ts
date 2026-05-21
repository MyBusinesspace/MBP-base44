import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function formatCode(n, yearFull) {
  return `${String(n).padStart(5, '0')}/${yearFull}`;
}

// Parse a report_number like "00007/2026" or "WR-007/26" into { n, year }
function parseReportNumber(str) {
  if (!str) return null;
  // format: 00007/2026
  let m = String(str).match(/^(\d+)\/(\d{4})$/);
  if (m) return { n: parseInt(m[1]), year: parseInt(m[2]) };
  // format: WR-007/26
  m = String(str).match(/^WR-(\d+)\/(\d{2})$/i);
  if (m) return { n: parseInt(m[1]), year: 2000 + parseInt(m[2]) };
  return null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const payload = await req.json().catch(() => ({}));
    const { dryRun = true, limit = 3000 } = payload || {};

    // Load all TimeEntries that have start_time (have been clocked in)
    const allEntries = await base44.asServiceRole.entities.TimeEntry.list('-updated_date', limit);
    const entries = (Array.isArray(allEntries) ? allEntries : []).filter(e => e.start_time);

    // Load all existing WorkingReports
    const allReports = await base44.asServiceRole.entities.WorkingReport.list('-created_date', 5000);
    const safeReports = Array.isArray(allReports) ? allReports : [];
    const coveredIds = new Set(safeReports.map(r => r.time_entry_id));

    // Find entries with NO linked report
    const missing = entries.filter(e => !coveredIds.has(e.id));

    if (missing.length === 0) {
      return Response.json({ success: true, created: 0, message: 'All clocked-in WOs already have a WorkingReport.' });
    }

    // Build per-year counters starting from current max in DB
    const counters = {};
    for (const wr of safeReports) {
      const parsed = parseReportNumber(wr.report_number);
      if (!parsed) continue;
      const { n, year } = parsed;
      if (!counters[year] || n > counters[year]) counters[year] = n;
    }

    // Sort missing by start_time ascending so numbering is chronological
    missing.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

    let created = 0;
    const results = [];

    for (const entry of missing) {
      const startDate = new Date(entry.start_time);
      const yearFull = startDate.getFullYear();
      if (!counters[yearFull]) counters[yearFull] = 0;
      counters[yearFull]++;
      const reportNumber = formatCode(counters[yearFull], yearFull);

      if (!dryRun) {
        await base44.asServiceRole.entities.WorkingReport.create({
          time_entry_id: entry.id,
          branch_id: entry.branch_id || null,
          report_number: reportNumber,
          team_ids: Array.isArray(entry.team_ids) ? entry.team_ids : [],
          employee_ids: Array.isArray(entry.employee_ids) ? entry.employee_ids : [],
          start_time: entry.start_time || null,
          end_time: entry.end_time || null,
          duration_minutes: entry.duration_minutes || null,
          status: 'draft'
        });
        await sleep(30);
      }

      created++;
      results.push({ wo_id: entry.id, title: entry.title, report_number: reportNumber });
    }

    // Update KV counters so future numbers continue correctly (best effort)
    if (!dryRun) {
      try {
        const kv = await Deno.openKv();
        for (const [year, maxN] of Object.entries(counters)) {
          await kv.set(["wr_counter_global", String(year)], maxN);
        }
      } catch (kvErr) {
        console.warn('KV update skipped:', kvErr?.message);
      }
    }

    return Response.json({
      success: true,
      total_missing: missing.length,
      created,
      dryRun,
      counters_after: counters,
      results: results.slice(0, 100)
    });
  } catch (error) {
    return Response.json({ error: error?.message || String(error) }, { status: 500 });
  }
});