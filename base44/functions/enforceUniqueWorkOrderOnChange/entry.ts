import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

function getYear(iso) {
  const d = iso ? new Date(iso) : new Date();
  return d.getFullYear();
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    let payload = {};
    try { payload = await req.json(); } catch { payload = {}; }

    const event = payload?.event;
    const data = payload?.data;

    // Global bypass: if backfill in progress, skip enforcement
    try {
      const kv = await Deno.openKv();
      const pause = await kv.get(['wo_enforcement_paused']);
      if (pause?.value === true) {
        return Response.json({ ok: true, skipped: 'paused_for_backfill' });
      }
    } catch {}

    // Allow service-role/system backfill updates without enforcement
    if (data?.updated_by === 'service_backfill') {
      return Response.json({ ok: true, skipped: 'service_backfill' });
    }

    if (!data?.id) {
      return Response.json({ ok: true, skipped: 'no data in payload' });
    }

    const createdISO = data.created_date || new Date().toISOString();
    const year = getYear(createdISO);

    // Global numbering: branch removed from enforcement
    // No branch scoping; operate on global sequence

    const won = data.work_order_number;
    const isFormatted = typeof won === 'string' && /^\d{3,4}\/\d{2}$/.test(won);
    if (!isFormatted) {
      // Not in target format; creation hook assigns numbers. Do nothing here.
      return Response.json({ ok: true, skipped: 'won not formatted' });
    }

    // DISABLED: Allow multiple work orders with same number (for same project/task)
    // Check for duplicates of this exact number globally (year encoded in WON)
    const dupes = await base44.asServiceRole.entities.TimeEntry.filter({
      work_order_number: won
    }, undefined, 3);

    // Commenting out duplicate enforcement to allow multiple bubbles on same project
    if (false && Array.isArray(dupes) && dupes.length > 1) {
      // Prevent loops with a short KV lock per branch+year
      const kv = await Deno.openKv();
      const lockKey = ['wo_renumber_lock_global', String(year)];
      const existing = await kv.get(lockKey);
      if (existing.value) {
        return Response.json({ ok: true, locked: true });
      }
      const tx = kv.atomic();
      tx.check(existing);
      tx.set(lockKey, { at: Date.now() }, { expireIn: 30000 });
      const committed = await tx.commit();
      if (!committed.ok) {
        return Response.json({ ok: true, locked: true });
      }

      // Invoke centralized global renumber for this year (anchored to created_date)
      const res = await base44.functions.invoke('renumberWorkOrders', {
        dry_run: false,
        scope: 'global_per_year',
        years: [year]
      });

      // Log on the triggering entry
      try {
        const now = new Date().toISOString();
        const entry = await base44.asServiceRole.entities.TimeEntry.get(data.id);
        const activity = Array.isArray(entry?.activity_log) ? entry.activity_log : [];
        activity.push({
          timestamp: now,
          action: 'Edited',
          user_email: 'system@base44',
          user_name: 'Auto-Renumber',
          details: `Auto renumber triggered due to duplicate ${won} (global, year ${year})`
        });
        await base44.asServiceRole.entities.TimeEntry.update(data.id, { activity_log: activity });
      } catch {
        // ignore log errors
      }

      return Response.json({ ok: true, invoked: true, result: res?.data || null });
    }

    return Response.json({ ok: true, no_duplicates: true });
  } catch (error) {
    return Response.json({ ok: false, error: error?.message || 'failed' }, { status: 500 });
  }
});