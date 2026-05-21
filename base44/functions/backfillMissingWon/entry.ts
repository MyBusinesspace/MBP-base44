import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

function isValidWON(won, yearYY) {
  if (!won || typeof won !== 'string') return false;
  const m = won.match(/^(\d{4})\/(\d{2})$/);
  if (!m) return false;
  return m[2] === yearYY;
}

function yyFromDate(dateStr) {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return String(d.getFullYear()).slice(-2);
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { branch_ids = null, years = null, dry_run = false, limit = 5000 } = body || {};
    
    console.log('Starting backfill with params:', { branch_ids, years, dry_run, limit });

    const allEntries = await base44.entities.TimeEntry.list('-created_date', limit);
    const entries = Array.isArray(allEntries) ? allEntries : [];

    const needProject = entries.some(e => !e.branch_id && e.project_id);
    let projectMap = new Map();
    if (needProject) {
      const projects = await base44.entities.Project.list('-updated_date', 5000).catch(() => []);
      (projects || []).forEach(p => { if (p?.id) projectMap.set(p.id, p); });
    }

    const candidates = entries.filter(e => {
      const yy = yyFromDate(e?.created_date);
      if (!yy) return false;
      if (years && Array.isArray(years) && years.length > 0 && !years.includes(yy)) return false;
      const resolvedBranch = e.branch_id || projectMap.get(e.project_id)?.branch_id || null;
      if (branch_ids && Array.isArray(branch_ids) && branch_ids.length > 0 && (!resolvedBranch || !branch_ids.includes(resolvedBranch))) return false;
      const valid = isValidWON(e.work_order_number, yy);
      return !valid;
    });

    const groups = new Map();
    for (const e of candidates) {
      const yy = yyFromDate(e.created_date);
      const branch = e.branch_id || projectMap.get(e.project_id)?.branch_id || null;
      if (!yy || !branch) continue;
      const key = `${branch}__${yy}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(e);
    }

    for (const [key, arr] of groups.entries()) {
      arr.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
      groups.set(key, arr);
    }

    const results = [];
    let updatedCount = 0;
    let skippedNoBranch = 0;

    for (const [key, arr] of groups.entries()) {
      const [branch] = key.split('__');
      for (const entry of arr) {
        const yy = yyFromDate(entry.created_date);
        if (!branch || !yy) { skippedNoBranch++; continue; }
        if (dry_run) {
          results.push({ id: entry.id, from: entry.work_order_number || null, to: 'PENDING', branch, yy, created_date: entry.created_date });
          continue;
        }
        let won = null;
        try {
          const r = await base44.functions.invoke('getNextWorkOrderNumberAtomic', { branch_id: branch, date: entry.created_date });
          won = typeof r.data === 'string' ? r.data : (r.data?.work_order_number || r.data?.next || r.data?.number || null);
        } catch (err) {
          results.push({ id: entry.id, error: 'counter_failed', details: String(err?.message || err) });
          continue;
        }
        if (!won) {
          results.push({ id: entry.id, error: 'no_number_generated' });
          continue;
        }

        const activity_log = Array.isArray(entry.activity_log) ? [...entry.activity_log] : [];
        activity_log.push({
          timestamp: new Date().toISOString(),
          action: 'Edited',
          user_email: user.email || 'unknown',
          user_name: user.full_name || user.email || 'system',
          details: `Assigned WON ${won} anchored to created_date (${new Date(entry.created_date).toISOString()})`
        });

        await base44.entities.TimeEntry.update(entry.id, {
          work_order_number: won,
          updated_by: user.email || 'unknown',
          activity_log
        });

        updatedCount++;
        results.push({ id: entry.id, to: won, branch, yy });
      }
    }

    return Response.json({ success: true, updated: updatedCount, skipped_no_branch: skippedNoBranch, processed_groups: groups.size, details: results.slice(0, 2000) });
  } catch (error) {
    return Response.json({ error: error.message || String(error) }, { status: 500 });
  }
});