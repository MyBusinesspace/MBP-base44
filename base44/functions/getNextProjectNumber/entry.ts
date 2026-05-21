import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const branch_id = body.branch_id || 'default';
    const year = new Date().getFullYear().toString();

    // Find existing counter for branch+year
    const counters = await base44.asServiceRole.entities.ProjectCounter.filter({ branch_id, year });
    let counter = Array.isArray(counters) ? counters[0] : null;

    let nextNumber;
    if (counter) {
      nextNumber = (counter.last_number || 0) + 1;
      await base44.asServiceRole.entities.ProjectCounter.update(counter.id, { last_number: nextNumber });
    } else {
      nextNumber = 1;
      await base44.asServiceRole.entities.ProjectCounter.create({ branch_id, year, last_number: nextNumber });
    }

    const yy = year.slice(-2);
    const formatted = `P-${String(nextNumber).padStart(3, '0')}/${yy}`;

    return Response.json({ project_number: formatted, number: nextNumber });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});