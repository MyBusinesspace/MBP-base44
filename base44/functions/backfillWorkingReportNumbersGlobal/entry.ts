import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

function isInvalidWR(code) {
  if (!code) return true;
  const s = String(code).trim();
  // e.g., WR-001/26 or WR-001/2026 variants are normalized by generator; accept anything missing
  return !/^WR-\d{1,4}\/\d{2}$/.test(s) && !/^\d{3,4}\/\d{2}$/.test(s);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: Admin only' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { limit = 5000, dry_run = false } = body || {};

    const reports = await base44.asServiceRole.entities.WorkingReport.list('-created_date', limit).catch(() => []) || [];

    let updated = 0, errors = 0; const details = [];

    for (const wr of reports) {
      if (!isInvalidWR(wr.report_number)) continue; // already numbered

      // Determine date for numbering
      let dateRef = wr.start_time || wr.created_date || null;
      if (!dateRef && wr.time_entry_id) {
        try {
          const teArr = await base44.asServiceRole.entities.TimeEntry.filter({ id: wr.time_entry_id }, '-updated_date', 1);
          const te = teArr?.[0] || null;
          dateRef = te?.start_time || te?.created_date || null;
        } catch { /* ignore */ }
      }
      if (!dateRef) { details.push({ id: wr.id, reason: 'no_date_ref' }); continue; }

      try {
        const r = await base44.functions.invoke('getNextWorkingReportNumber', { date: dateRef });
        const code = typeof r.data === 'string' ? r.data : (r.data?.code || r.data?.number || null);
        if (!code) { errors++; details.push({ id: wr.id, reason: 'generator_invalid', got: r.data }); continue; }
        if (!dry_run) {
          await base44.asServiceRole.entities.WorkingReport.update(wr.id, { report_number: code });
        }
        updated++; details.push({ id: wr.id, to: code });
      } catch (err) {
        errors++; details.push({ id: wr.id, reason: 'update_failed', error: err?.message || String(err) });
      }
    }

    return Response.json({ success: true, scanned: reports.length, updated, errors, dry_run, details });
  } catch (error) {
    return Response.json({ error: error?.message || 'Failed to backfill working reports' }, { status: 500 });
  }
});