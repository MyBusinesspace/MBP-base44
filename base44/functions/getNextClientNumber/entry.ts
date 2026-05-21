import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Get or create the single counter record
    const counters = await base44.asServiceRole.entities.CustomerCounter.list();
    let counter = counters[0];

    if (!counter) {
      counter = await base44.asServiceRole.entities.CustomerCounter.create({ last_number: 0 });
    }

    const nextNumber = (counter.last_number || 0) + 1;
    const clientNumber = `CL-${String(nextNumber).padStart(4, '0')}`;

    await base44.asServiceRole.entities.CustomerCounter.update(counter.id, { last_number: nextNumber });

    return Response.json({ client_number: clientNumber });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});