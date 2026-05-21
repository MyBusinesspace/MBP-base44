import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

function formatCode(n, yearFull) {
  return `${String(n).padStart(5, '0')}/${yearFull}`;
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const payload = await req.json().catch(() => ({}));
    const { dryRun = false, limit = 5000 } = payload || {};

    // Load ALL working reports
    const list = await base44.asServiceRole.entities.WorkingReport.list('-created_date', limit).catch(() => []);
    const allWRs = Array.isArray(list) ? list : [];

    // Sort by start_time or created_date ascending (oldest = lowest number)
    allWRs.sort((a, b) => {
      const da = new Date(a.start_time || a.created_date || 0).getTime();
      const db = new Date(b.start_time || b.created_date || 0).getTime();
      return da - db;
    });

    // Group by year
    const byYear = {};
    for (const wr of allWRs) {
      const d = new Date(wr.start_time || wr.created_date || new Date());
      const year = d.getFullYear();
      if (!byYear[year]) byYear[year] = [];
      byYear[year].push(wr);
    }

    let updated = 0;
    const processed = [];
    const yearMaxCounters = {};

    for (const [yearStr, wrs] of Object.entries(byYear)) {
      const year = parseInt(yearStr);
      let counter = 0;

      for (const wr of wrs) {
        counter++;
        const newCode = formatCode(counter, year);
        const oldCode = wr.report_number || null;

        if (!dryRun) {
          await base44.asServiceRole.entities.WorkingReport.update(wr.id, { report_number: newCode });
          await sleep(50);
        }
        updated++;
        processed.push({ id: wr.id, old: oldCode, new: newCode });
      }

      yearMaxCounters[year] = counter;
    }

    // Update KV counters so future numbers continue correctly
    if (!dryRun) {
      try {
        const kv = await Deno.openKv();
        for (const [year, maxN] of Object.entries(yearMaxCounters)) {
          const key = ["wr_counter_global", String(year)];
          await kv.set(key, maxN);
        }
      } catch (kvErr) {
        console.warn('KV update skipped (not available in this env):', kvErr?.message);
      }
    }

    return Response.json({ success: true, updated, dryRun, yearMaxCounters, processed });
  } catch (error) {
    return Response.json({ error: error?.message || String(error) }, { status: 500 });
  }
});