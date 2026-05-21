import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (user?.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Get all projects without a project_number, sorted by created_date ascending
  const allProjects = await base44.asServiceRole.entities.Project.list('created_date', 2000);
  const toNumber = allProjects.filter(p => !p.project_number);

  if (toNumber.length === 0) {
    return Response.json({ message: 'All projects already have numbers', count: 0 });
  }

  // Group by branch_id + year to assign sequential numbers per branch per year
  // Structure: { "branchId_year": { lastNumber, projects: [] } }
  const groups = {};

  for (const project of toNumber) {
    const branchId = project.branch_id || 'default';
    const year = new Date(project.created_date).getFullYear().toString();
    const key = `${branchId}_${year}`;
    if (!groups[key]) {
      groups[key] = { branchId, year, projects: [] };
    }
    groups[key].projects.push(project);
  }

  // For each group, find the current max counter in ProjectCounter
  const updated = [];

  for (const [key, group] of Object.entries(groups)) {
    const { branchId, year, projects } = group;

    // Get existing counter for this branch+year
    const counters = await base44.asServiceRole.entities.ProjectCounter.filter(
      { branch_id: branchId, year }
    );

    let lastNumber = counters.length > 0 ? (counters[0].last_number || 0) : 0;

    // Sort projects by created_date ascending to assign numbers in order
    projects.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));

    const shortYear = year.slice(-2);

    for (const project of projects) {
      lastNumber += 1;
      const project_number = `P-${String(lastNumber).padStart(3, '0')}/${shortYear}`;

      await base44.asServiceRole.entities.Project.update(project.id, { project_number });
      updated.push({ id: project.id, name: project.name, project_number });
    }

    // Update or create the counter
    if (counters.length > 0) {
      await base44.asServiceRole.entities.ProjectCounter.update(counters[0].id, { last_number: lastNumber });
    } else {
      await base44.asServiceRole.entities.ProjectCounter.create({
        branch_id: branchId,
        year,
        last_number: lastNumber,
      });
    }
  }

  return Response.json({ message: `Numbered ${updated.length} projects`, updated });
});