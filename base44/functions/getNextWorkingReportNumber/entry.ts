import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

function formatCode(n, yearFull) {
  return `${String(n).padStart(5, '0')}/${yearFull}`;
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

Deno.serve(async (req) => {
  try {
    createClientFromRequest(req);
    let payload = {};
    try { payload = await req.json(); } catch { payload = {}; }

    const dateStr = payload.date || null;
    const now = dateStr ? new Date(dateStr) : new Date();
    const yearFull = now.getFullYear();

    const kv = await Deno.openKv();
    const key = ["wr_counter_global", String(yearFull)];

    for (let attempt = 0; attempt < 10; attempt++) {
      const entry = await kv.get(key);
      const current = typeof entry.value === 'number' ? entry.value : 0;
      const nextVal = current + 1;

      const tx = kv.atomic();
      tx.check(entry);
      tx.set(key, nextVal);
      const res = await tx.commit();
      if (res.ok) {
        const code = formatCode(nextVal, yearFull);
        return Response.json({ data: code });
      }
      await sleep(10 + Math.floor(Math.random() * 40));
    }

    return Response.json({ error: 'Counter busy, please retry' }, { status: 503 });
  } catch (error) {
    return Response.json({ error: error?.message || 'Failed to get next WR number' }, { status: 500 });
  }
});