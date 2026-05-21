import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: Admin only' }, { status: 403 });

    const kv = await Deno.openKv().catch(() => null);
    if (kv) {
      await kv.set(['wo_enforcement_paused'], true, { expireIn: 300000 });
    }

    try {
      // Inline renumber logic (no function invoke)
      const toISO = (x) => { try { return x ? new Date(x).toISOString() : null; } catch { return null; } };
      const yearParts = (iso) => { const d = iso ? new Date(iso) : new Date(); const full = d.getFullYear(); const yy = String(full).slice(-2); return { full, yy }; };

      // Load all work orders (TimeEntry)
      const all = await base44.asServiceRole.entities.TimeEntry.list('-created_date', 50000).catch(() => []) || [];

      // Build global-per-year groups using created_date as the anchor
      const groups = new Map(); // key: `ALL-<year>` -> [{ wo, anchor, yy, year }]
      for (const wo of all) {
        const created = toISO(wo.created_date);
        const anchor = created || new Date().toISOString();
        const { full, yy } = yearParts(anchor);
        const key = `ALL-${full}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push({ wo, anchor, yy, year: full });
      }

      const updates = [];
      const summary = [];

      for (const [key, arr] of groups.entries()) {
        // Stable sort by anchor, then created_date, then id
        arr.sort((a, b) => {
          const at = new Date(a.anchor).getTime();
          const bt = new Date(b.anchor).getTime();
          if (at !== bt) return at - bt;
          const ac = new Date(a.wo.created_date || 0).getTime();
          const bc = new Date(b.wo.created_date || 0).getTime();
          if (ac !== bc) return ac - bc;
          return String(a.wo.id).localeCompare(String(b.wo.id));
        });

        let seq = 1;
        for (const r of arr) {
          const desired = String(seq).padStart(4, '0') + '/' + r.yy;
          if (r.wo.work_order_number !== desired) {
            updates.push({ id: r.wo.id, from: r.wo.work_order_number || null, to: desired, year: r.year });
          }
          seq += 1;
        }
        summary.push({ group: key, total: arr.length });
      }

      // Apply updates with throttle and simple retry/backoff to avoid rate limits
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      for (const u of updates) {
        let done = false;
        for (let attempt = 0; attempt < 4 && !done; attempt++) {
          try {
            await base44.asServiceRole.entities.TimeEntry.update(u.id, { work_order_number: u.to, updated_by: 'service_backfill' });
            done = true;
          } catch (e) {
            if (attempt === 3) throw e;
            await sleep(200 * (attempt + 1)); // backoff: 200ms, 400ms, 600ms
          }
        }
        await sleep(500); // throttle between updates
      }

      const changesCount = updates.length;
      const sampleChanges = updates.slice(0, 200);

      return Response.json({
        ok: true,
        mode: 'apply_global',
        result: {
          success: true,
          total_work_orders: all.length,
          groups: summary,
          changes_count: changesCount,
          changes_sample: sampleChanges
        }
      });
    } finally {
      if (kv) {
        await kv.delete(['wo_enforcement_paused']);
      }
    }
  } catch (err) {
    return Response.json({ ok: false, error: err?.message || 'failed' }, { status: 500 });
  }
});