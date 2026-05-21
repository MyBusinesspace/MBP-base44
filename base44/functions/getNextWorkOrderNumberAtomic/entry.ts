import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

function getYearParts(iso) {
  // ✅ FIX: Always use current date for year if iso is not provided or is in past year
  const now = new Date();
  let d = iso ? new Date(iso) : now;
  
  // ✅ CRITICAL: If provided date is in 2025 or earlier, use current year (2026)
  if (d.getFullYear() < now.getFullYear()) {
    console.log(`⚠️ [YEAR FIX] Date ${iso} is year ${d.getFullYear()}, using current year ${now.getFullYear()}`);
    d = now;
  }
  
  const full = d.getFullYear();
  const yy = String(full).slice(-2);
  console.log(`📅 [YEAR PARTS] Input: ${iso}, Full: ${full}, YY: ${yy}`);
  return { full: String(full), yy };
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

Deno.serve(async (req) => {
  try {
    // No user auth required; used internally by other backend functions
    const base44 = createClientFromRequest(req); // initialize for context/logging & fallback

    let payload = {};
    try { payload = await req.json(); } catch { payload = {}; }

    const branchId = payload?.branch_id || null;
    const date = payload?.date || new Date().toISOString();

    const { full, yy } = getYearParts(date);

    // Try Deno KV first; if unavailable (edge/local), fallback to entity-based counter
    let kv = null;
    try { kv = await Deno.openKv(); } catch { kv = null; }

    const key = branchId ? ["wo_counter", branchId, String(full)] : ["wo_counter_global", String(full)];

    if (kv) {
      // Atomic CAS loop using KV
      for (let attempt = 0; attempt < 10; attempt++) {
        try {
          const entry = await kv.get(key);
          const current = typeof entry.value === 'number' ? entry.value : 0;
          const nextVal = current + 1;

          const tx = kv.atomic();
          tx.check(entry);
          tx.set(key, nextVal);
          const res = await tx.commit();
          if (res.ok) {
            const formatted = String(nextVal).padStart(4, '0') + '/' + yy;
            return Response.json({ work_order_number: formatted });
          }
        } catch (_) {
          // fall through to retry
        }
        await sleep(10 + Math.floor(Math.random() * 40));
      }
    }

    // Fallback: use entity-based counter (GLOBAL per year)
    const counterKey = { branch_id: 'GLOBAL', year: String(full) };
    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        let counters = await base44.asServiceRole.entities.WorkOrderCounter.filter(counterKey, '-updated_date', 1);
        let counter = counters?.[0] || null;
        if (!counter) {
          counter = await base44.asServiceRole.entities.WorkOrderCounter.create({ ...counterKey, last_number: 0 });
        }
        const next = (counter.last_number || 0) + 1;
        await base44.asServiceRole.entities.WorkOrderCounter.update(counter.id, { last_number: next });
        const formatted = String(next).padStart(4, '0') + '/' + yy;
        return Response.json({ work_order_number: formatted });
      } catch (_) {
        await sleep(20 + Math.floor(Math.random() * 60));
      }
    }

    return Response.json({ error: 'Counter busy, please retry' }, { status: 503 });
  } catch (error) {
    return Response.json({ error: error?.message || 'Failed to get next WO number atomically' }, { status: 500 });
  }
});