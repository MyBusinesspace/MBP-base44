import { getEntity, listEntities } from '../entityStore.js';
import { getUserById } from '../userPersistence.js';
import { env } from '../config/env.js';

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function absoluteAssetUrl(url) {
  if (!url) return '';
  const s = String(url);
  if (s.startsWith('http://') || s.startsWith('https://') || s.startsWith('data:')) return s;
  if (s.startsWith('/')) return `${env.webUrl}${s}`;
  return s;
}

function addId(set, val) {
  if (!val) return;
  if (typeof val === 'string') set.add(val);
  else if (val?.id) set.add(val.id);
}

function collectIds(workOrder) {
  const employeeIds = new Set();
  const teamIds = new Set();
  const equipmentIds = new Set();

  if (Array.isArray(workOrder.employee_ids)) workOrder.employee_ids.forEach((id) => addId(employeeIds, id));
  if (Array.isArray(workOrder.team_ids)) workOrder.team_ids.forEach((id) => addId(teamIds, id));
  if (Array.isArray(workOrder.equipment_ids)) {
    workOrder.equipment_ids.forEach((id) => addId(equipmentIds, id));
  }
  addId(employeeIds, workOrder.employee_id);
  addId(teamIds, workOrder.team_id);
  addId(employeeIds, workOrder.leader_id);

  if (Array.isArray(workOrder.tasks)) {
    for (const t of workOrder.tasks) {
      if (Array.isArray(t.employee_ids)) t.employee_ids.forEach((id) => addId(employeeIds, id));
      if (Array.isArray(t.team_ids)) t.team_ids.forEach((id) => addId(teamIds, id));
      addId(employeeIds, t.employee_id);
      addId(teamIds, t.team_id);
      addId(employeeIds, t.leader_id);
    }
  }

  const filterIds = (set) =>
    Array.from(set).filter((id) => typeof id === 'string' && id.length > 5);

  return {
    employeeIds: filterIds(employeeIds),
    teamIds: filterIds(teamIds),
    equipmentIds: filterIds(equipmentIds),
  };
}

async function safeGetEntity(name, id) {
  if (!id) return null;
  try {
    return await getEntity(name, id);
  } catch {
    return null;
  }
}

/** Load related entities for work-order PDF/HTML report (Base44 generatePdf parity). */
export async function loadWorkOrderReportContext(workOrder) {
  const project = workOrder.project_id
    ? await safeGetEntity('Project', workOrder.project_id)
    : null;
  const customer = project?.customer_id
    ? await safeGetEntity('Customer', project.customer_id)
    : null;
  const branch = project?.branch_id
    ? await safeGetEntity('Branch', project.branch_id)
    : workOrder.branch_id
      ? await safeGetEntity('Branch', workOrder.branch_id)
      : null;
  const woCategory = workOrder.work_order_category_id
    ? await safeGetEntity('WorkOrderCategory', workOrder.work_order_category_id)
    : null;

  const { employeeIds, teamIds, equipmentIds } = collectIds(workOrder);

  const [allTeams, allAssets, allClientEquip] = await Promise.all([
    listEntities('Team', { limit: 5000 }).catch(() => []),
    listEntities('Asset', { limit: 5000 }).catch(() => []),
    listEntities('ClientEquipment', { limit: 5000 }).catch(() => []),
  ]);

  const assignedUsers = (
    await Promise.all(employeeIds.map((id) => getUserById(id).catch(() => null)))
  ).filter(Boolean);

  const teamById = Object.fromEntries((allTeams || []).map((t) => [t.id, t]));
  const assignedTeams = teamIds.map((id) => teamById[id]).filter(Boolean);

  const assetById = Object.fromEntries((allAssets || []).map((a) => [a.id, a]));
  const clientEquipById = Object.fromEntries((allClientEquip || []).map((e) => [e.id, e]));
  const assignedAssets = equipmentIds
    .map((id) => assetById[id] || clientEquipById[id])
    .filter(Boolean);

  const allWorkDone = [...(workOrder.work_done_items || [])];
  const allWorkPending = [...(workOrder.work_pending_items || [])];
  const allSpareParts = [...(workOrder.spare_parts_items || [])];
  const allSparePartsPending = [...(workOrder.spare_parts_pending_items || [])];
  const taskInstructions = [];

  if (workOrder.work_description_items) {
    workOrder.work_description_items.forEach((i) => taskInstructions.push(i.text));
  }
  if (Array.isArray(workOrder.tasks)) {
    for (const t of workOrder.tasks) {
      if (t.instructions) taskInstructions.push(t.instructions);
      if (t.work_done_items) allWorkDone.push(...t.work_done_items);
      if (t.work_pending_items) allWorkPending.push(...t.work_pending_items);
      if (t.spare_parts_items) allSpareParts.push(...t.spare_parts_items);
      if (t.spare_parts_pending_items) allSparePartsPending.push(...t.spare_parts_pending_items);
    }
  }

  return {
    project,
    customer,
    branch,
    woCategory,
    assignedUsers,
    assignedTeams,
    assignedAssets,
    allWorkDone,
    allWorkPending,
    allSpareParts,
    allSparePartsPending,
    taskInstructions,
  };
}

export function buildWorkOrderReportHtml(workOrder, ctx) {
  const {
    project,
    customer,
    branch,
    woCategory,
    assignedUsers,
    assignedTeams,
    assignedAssets,
    allWorkDone,
    allWorkPending,
    allSpareParts,
    allSparePartsPending,
    taskInstructions,
  } = ctx;

  const formatDate = (iso) =>
    iso
      ? new Date(iso).toLocaleDateString('en-GB', { timeZone: 'Asia/Dubai' })
      : '-';
  const formatFullDateTime = (iso) =>
    iso
      ? new Date(iso)
          .toLocaleString('en-GB', {
            hour12: true,
            hour: '2-digit',
            minute: '2-digit',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            timeZone: 'Asia/Dubai',
          })
          .replace(',', '')
      : '-';

  const logoUrl = branch?.logo_url ? absoluteAssetUrl(branch.logo_url) : '';
  const signatureUrl = workOrder.client_signature_url
    ? absoluteAssetUrl(workOrder.client_signature_url)
    : '';

  const blankRows = (items, cols) =>
    (items.length ? items : [{ text: '' }, { text: '' }, { text: '' }])
      .map(
        (i) =>
          `<tr><td>${escapeHtml(i.text)}</td><td style="width:20px; text-align:center;">${i.text ? '☐' : ''}</td>${cols || ''}</tr>`
      )
      .join('');

  const spareRows = (items) =>
    (items.length ? items : [{ text: '' }, { text: '' }, { text: '' }])
      .map(
        (i) =>
          `<tr><td>${escapeHtml(i.text)}</td><td style="width:20px;">☐</td><td style="width:40px;"></td></tr>`
      )
      .join('');

  const workerNames =
    assignedUsers.map((u) => escapeHtml(u.full_name || u.email)).join(', ') || '-';
  const teamNames =
    assignedTeams.map((t) => escapeHtml(t.name)).join(', ') || '-';
  const equipmentNames =
    assignedAssets.map((a) => escapeHtml(a.name)).join(', ') || '-';

  const instructionsHtml =
    taskInstructions.length > 0
      ? taskInstructions.map((txt) => `<span>• ${escapeHtml(txt)}</span>`).join('')
      : '<span>-</span>';

  const plannedStart = workOrder.planned_start_time
    ? new Date(workOrder.planned_start_time).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';
  const plannedEnd = workOrder.planned_end_time
    ? new Date(workOrder.planned_end_time).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  const durationStr = workOrder.duration_minutes
    ? `${Math.floor(workOrder.duration_minutes / 60)}h ${workOrder.duration_minutes % 60}m`
    : '-';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @page { size: A4; margin: 5mm; }
    body { font-family: sans-serif; font-size: 11px; margin: 0; padding: 10px; color: #333; }
    .container { width: 210mm; margin: auto; }
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; }
    .header-title { font-size: 18px; font-weight: bold; text-transform: uppercase; }
    .header-info { text-align: right; font-size: 12px; font-weight: bold; }
    .section-header { background: #d32f2f; color: white; padding: 5px 10px; font-weight: bold; text-transform: uppercase; margin-top: 10px; border: 1px solid #333; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th, td { border: 1px solid #ccc; padding: 4px 8px; text-align: left; vertical-align: middle; }
    th { background: #f8f9fa; font-weight: bold; text-transform: uppercase; width: 100px; }
    .report-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0; border-left: 1px solid #ccc; border-right: 1px solid #ccc; }
    .report-col { border-bottom: 1px solid #ccc; }
    .sub-label { background: #d32f2f; color: white; font-weight: bold; padding: 4px 8px; display: flex; justify-content: space-between; }
    .green-text { color: #2e7d32; font-weight: bold; margin: 10px 0; }
    .signature-box { display: grid; grid-template-columns: 1fr 1fr 1fr; border: 1px solid #ccc; min-height: 80px; }
    .sig-col { border-right: 1px solid #ccc; padding: 5px; }
    .sig-img { max-height: 50px; display: block; margin-top: 5px; }
    .logo { max-height: 60px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="page-header">
      <div>
        ${logoUrl ? `<img src="${escapeHtml(logoUrl)}" class="logo" alt="" />` : ''}
        <div class="header-title">Service &amp; Maintenance Report</div>
      </div>
      <div class="header-info">
        <div>Working order N: ${escapeHtml(workOrder.work_order_number || '-')}</div>
        <div>Working report N: -</div>
        <div style="font-weight: normal; font-size: 10px; color: #666;">Title: ${escapeHtml(workOrder.title || '-')}</div>
      </div>
    </div>

    <div class="section-header">1. General Information</div>
    <table>
      <tr>
        <th>Company</th><td>${escapeHtml(customer?.name || '-')}</td>
        <th>Category</th><td>${escapeHtml(woCategory?.name || '-')}</td>
      </tr>
      <tr>
        <th>Location</th><td>${escapeHtml(project?.address || workOrder?.start_address || '-')}</td>
        <th>Shift</th><td>-</td>
      </tr>
      <tr>
        <th>Project</th><td>${escapeHtml(project?.name || '-')}</td>
        <th>Date</th><td>${formatDate(workOrder.planned_start_time)}</td>
      </tr>
      <tr>
        <th>Equipment</th><td>${equipmentNames}</td>
        <th>Time</th><td>${plannedStart} - ${plannedEnd}</td>
      </tr>
      <tr>
        <th>Title</th><td colspan="3">${escapeHtml(workOrder.title || '-')}</td>
      </tr>
    </table>
    <div style="border: 1px solid #ccc; padding: 5px; font-size: 10px; border-top: none;">
      <strong>MANAGEMENT INSTRUCTIONS:</strong><br>
      <div style="display:flex; flex-direction: column;">${instructionsHtml}</div>
    </div>

    <div class="section-header">2. Assigned Resources</div>
    <table>
      <tr><th>Teams</th><td>${teamNames}</td></tr>
      <tr><th>Workers</th><td>${workerNames}</td></tr>
    </table>

    <div class="section-header">3. Site Report</div>
    <div style="display: flex; color: #2e7d32; font-weight: bold; padding: 5px 0;">
      <div style="flex: 1;">WORK DONE</div>
      <div style="flex: 1;">WORK PENDING</div>
    </div>
    <div class="report-grid">
      <div class="report-col" style="border-right: 1px solid #333;">
        <div class="sub-label"><span>TASK COMPLETED</span><span>✓</span></div>
        <table>${blankRows(allWorkDone)}</table>
      </div>
      <div class="report-col">
        <div class="sub-label"><span>TASK PENDING</span><span>✓</span></div>
        <table>${blankRows(allWorkPending)}</table>
      </div>
      <div class="report-col" style="border-right: 1px solid #333;">
        <div style="color: #2e7d32; font-weight: bold; padding: 5px;">SPARE PARTS INSTALLED</div>
        <div class="sub-label"><span>PART</span><span style="display:flex; gap: 20px;"><span>✓</span><span>QTY</span></span></div>
        <table>${spareRows(allSpareParts)}</table>
      </div>
      <div class="report-col">
        <div style="color: #e65100; font-weight: bold; padding: 5px;">SPARE PARTS PENDING</div>
        <div class="sub-label"><span>PART</span><span style="display:flex; gap: 20px;"><span>✓</span><span>QTY</span></span></div>
        <table>${spareRows(allSparePartsPending)}</table>
      </div>
    </div>
    <div class="green-text">STATUS: ${escapeHtml((workOrder.status || 'open').toUpperCase())}</div>

    <div class="section-header">4. Time Tracker Data</div>
    <table>
      <tr>
        <th>Clock In</th><td>${formatFullDateTime(workOrder.start_time)}</td>
        <th>Clock Out</th><td>${formatFullDateTime(workOrder.end_time)}</td>
      </tr>
      <tr>
        <th>Duration</th><td colspan="3">${durationStr}</td>
      </tr>
    </table>

    <div class="section-header">5. Client Approval</div>
    <div style="border: 1px solid #ccc; padding: 5px; border-bottom: none;">
      <strong>CLIENT COMMENTS:</strong><br>
      ${escapeHtml(workOrder.client_feedback_comments || '-')}
    </div>
    <div class="signature-box">
      <div class="sig-col">
        <strong>WORKERS:</strong><br>
        ${workerNames}
      </div>
      <div class="sig-col">
        <strong>CLIENT:</strong><br>
        - ${escapeHtml(workOrder.client_representative_name || '')}<br>
        - ${escapeHtml(workOrder.client_representative_phone || '')}
      </div>
      <div class="sig-col" style="border-right: none;">
        <strong>SIGNATURE:</strong><br>
        ${signatureUrl ? `<img src="${escapeHtml(signatureUrl)}" class="sig-img" alt="" />` : ''}
      </div>
    </div>
  </div>
</body>
</html>`;
}
