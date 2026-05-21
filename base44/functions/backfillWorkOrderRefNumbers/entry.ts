import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (user?.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Parse optional batch_size from body
  let batchSize = 100;
  try { const body = await req.json(); if (body?.batch_size) batchSize = body.batch_size; } catch {}

  // Get all work orders, sorted by created_date ascending
  const allWOs = await base44.asServiceRole.entities.TimeEntry.list('created_date', 5000);
  const toNumber = allWOs.filter(wo => !wo.work_order_ref).slice(0, batchSize);

  if (toNumber.length === 0) {
    return Response.json({ message: 'All work orders already have ref numbers', count: 0 });
  }

  // Group by year
  const groups = {};
  for (const wo of toNumber) {
    const year = new Date(wo.created_date).getFullYear().toString();
    if (!groups[year]) groups[year] = [];
    groups[year].push(wo);
  }

  const updated = [];

  for (const [year, wos] of Object.entries(groups)) {
    // Sort ascending by created_date
    wos.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
    const shortYear = year.slice(-2);

    // Find the current max ref number for this year to avoid collisions
    const existingWithRef = allWOs.filter(wo => {
      const wy = new Date(wo.created_date).getFullYear().toString();
      return wy === year && wo.work_order_ref;
    });
    let lastNum = 0;
    for (const wo of existingWithRef) {
      const match = wo.work_order_ref?.match(/WO-(\d+)\//);
      if (match) {
        const n = parseInt(match[1]);
        if (n > lastNum) lastNum = n;
      }
    }

    for (const wo of wos) {
      lastNum += 1;
      const work_order_ref = `WO-${lastNum}/${shortYear}`;
      await base44.asServiceRole.entities.TimeEntry.update(wo.id, { work_order_ref });
      updated.push({ id: wo.id, title: wo.title, work_order_ref });
      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 120));
    }
  }

  return Response.json({ message: `Numbered ${updated.length} work orders`, updated });
});