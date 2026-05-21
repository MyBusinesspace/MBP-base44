import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

function isInvalidWON(won) {
  if (!won) return true;
  const s = String(won).trim();
  return !/^\d{3,4}\/\d{2}$/.test(s);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: Admin only' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { years = null, limit = 5000, dry_run = false } = body || {};

    const entries = await base44.asServiceRole.entities.TimeEntry.list('-created_date', limit).catch(() => []) || [];

    const candidates = entries.filter(e => {
      if (!isInvalidWON(e.work_order_number)) return false;
      if (years && Array.isArray(years) && years.length > 0) {
        const d = e.planned_start_time || e.created_date;
        if (!d) return false;
        const y = new Date(d).getFullYear();
        if (!years.includes(y)) return false;
      }
      return true;
    });

    let updated = 0, errors = 0;
    const details = [];

    for (const e of candidates) {
      const anchor = e.planned_start_time || e.created_date || new Date().toISOString();
      try {
        const r = await base44.functions.invoke('getNextWorkOrderNumberAtomic', { date: anchor });
        const won = typeof r.data === 'string' ? r.data : (r.data?.work_order_number || r.data?.number || r.data?.next);
        if (!won || isInvalidWON(won)) {
          errors++; details.push({ id: e.id, reason: 'generator_invalid', got: r.data });
          continue;
        }
        if (!dry_run) {
          await base44.asServiceRole.entities.TimeEntry.update(e.id, { work_order_number: won });
        }
        updated++; details.push({ id: e.id, to: won });
      } catch (err) {
        errors++; details.push({ id: e.id, reason: 'update_failed', error: err?.message || String(err) });
      }
    }

    return Response.json({ success: true, scanned: entries.length, candidates: candidates.length, updated, errors, dry_run, details });
  } catch (error) {
    return Response.json({ error: error?.message || 'Failed to backfill work orders' }, { status: 500 });
  }
});