import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function isValidWONumber(s) { return typeof s === 'string' && /^\d{3,4}\/\d{2}$/.test(s); }

async function getNextNumberDirect(base44, date) {
  const d = date ? new Date(date) : new Date();
  const full = d.getFullYear();
  const yy = String(full).slice(-2);

  // Try KV first
  try {
    const kv = await Deno.openKv();
    const key = ["wo_counter_global", String(full)];
    for (let attempt = 0; attempt < 10; attempt++) {
      const entry = await kv.get(key);
      const current = typeof entry.value === 'number' ? entry.value : 0;
      const nextVal = current + 1;
      const tx = kv.atomic();
      tx.check(entry);
      tx.set(key, nextVal);
      const res = await tx.commit();
      if (res.ok) {
        return String(nextVal).padStart(4, '0') + '/' + yy;
      }
      await sleep(10 + Math.floor(Math.random() * 40));
    }
  } catch (_) { /* no KV, continue */ }

  // Fallback: entity-based counter
  try {
    const keyFilter = { branch_id: 'GLOBAL', year: String(full) };
    let counters = await base44.asServiceRole.entities.WorkOrderCounter.filter(keyFilter, '-updated_date', 1);
    let counter = counters?.[0] || null;
    if (!counter) {
      counter = await base44.asServiceRole.entities.WorkOrderCounter.create({ ...keyFilter, last_number: 0 });
    }
    const next = (counter.last_number || 0) + 1;
    await base44.asServiceRole.entities.WorkOrderCounter.update(counter.id, { last_number: next });
    return String(next).padStart(4, '0') + '/' + yy;
  } catch (_) { /* ignore */ }

  return null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let payload = {};
    try { payload = await req.json(); } catch { payload = {}; }

    const event = payload?.event || null;
    let data = payload?.data || null;
    const entityId = event?.entity_id || data?.id || null;

    // Handle only create events
    if (!event || event.type !== 'create') {
      return Response.json({ ok: true, skipped: true, reason: 'Not a create event' });
    }

    if (!entityId) {
      return Response.json({ ok: false, error: 'Missing entity_id' }, { status: 400 });
    }

    // Fetch entity if not provided or payload too large
    if (!data || payload?.payload_too_large) {
      try { 
        data = await base44.asServiceRole.entities.TimeEntry.get(entityId); 
      } catch (err) {
        return Response.json({ ok: false, error: `Failed to fetch TimeEntry: ${err.message}` }, { status: 500 });
      }
    }

    if (!data) {
      return Response.json({ ok: false, error: 'No data available' }, { status: 400 });
    }

    // Global backfill pause guard
    try {
      const kv = await Deno.openKv();
      const paused = await kv.get(['wo_enforcement_paused']);
      if (paused?.value === true) {
        return Response.json({ ok: true, skipped: true, reason: 'paused_for_backfill' });
      }
    } catch { /* ignore */ }

    // Skip if already numbered with valid format
    const existing = data.work_order_number;
    if (isValidWONumber(existing)) {
      return Response.json({ ok: true, skipped: true, reason: 'Already numbered', number: existing });
    }

    // Use planned_start_time or created_date for the year
    const date = data.planned_start_time || data.created_date || new Date().toISOString();

    // Get next number
    let number = await getNextNumberDirect(base44, date);
    if (!isValidWONumber(number)) {
      return Response.json({ ok: false, error: 'Failed to generate WO number' }, { status: 500 });
    }

    // Check for uniqueness (retry if duplicate found)
    for (let i = 0; i < 6; i++) {
      const clashes = await base44.asServiceRole.entities.TimeEntry.filter({ work_order_number: number }, '-updated_date', 1);
      if (!Array.isArray(clashes) || clashes.length === 0) break;
      number = await getNextNumberDirect(base44, date);
      if (!isValidWONumber(number)) break;
      await sleep(50);
    }

    // Update the TimeEntry with the number
    await base44.asServiceRole.entities.TimeEntry.update(entityId, { 
      work_order_number: number
    });

    return Response.json({ ok: true, assigned: number, entity_id: entityId });
  } catch (error) {
    console.error('Error in assignWorkOrderNumberOnCreate:', error);
    return Response.json({ error: error?.message || 'Failed to assign WO number' }, { status: 500 });
  }
});