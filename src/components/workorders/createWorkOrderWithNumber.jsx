import { base44 } from '@/api/base44Client';
import { TimeEntry } from '@/entities/all';

/**
 * Creates a new TimeEntry (work order) with a pre-assigned WO number.
 * Calls getNextWorkOrderNumberAtomic synchronously before creating,
 * so the number is visible in the UI immediately (no "pending" state).
 */
export async function createWorkOrderWithNumber({ updatedEntry, currentUser, currentCompany, projects }) {
  const userName = currentUser?.nickname || currentUser?.first_name || currentUser?.full_name || currentUser?.email || 'Unknown';
  const activity_log = [{
    timestamp: new Date().toISOString(),
    action: 'Created',
    user_email: currentUser?.email || 'unknown',
    user_name: userName,
    details: 'Work report created.'
  }];

  // ✅ Pre-assign WO number synchronously before creating
  let preassignedWONumber = null;
  try {
    const project = (projects || []).find(p => p.id === updatedEntry.project_id);
    const branchId = updatedEntry.branch_id || project?.branch_id || currentCompany?.id;
    const dateRef = updatedEntry.planned_start_time || new Date().toISOString();
    const res = await base44.functions.invoke('getNextWorkOrderNumberAtomic', { branch_id: branchId, date: dateRef });
    const won = typeof res.data === 'string' ? res.data : (res.data?.work_order_number || null);
    if (won && /^\d{4}\/\d{2}$/.test(String(won))) {
      preassignedWONumber = won;
    }
  } catch (e) {
    console.warn('⚠️ Could not pre-assign WO number:', e.message);
  }

  const newEntry = {
    ...updatedEntry,
    is_repeating: updatedEntry.is_repeating,
    branch_id: currentCompany?.id,
    updated_by: currentUser?.email || 'unknown',
    activity_log,
    ...(preassignedWONumber ? { work_order_number: preassignedWONumber } : {})
  };

  const created = await TimeEntry.create(newEntry);
  return { created, preassignedWONumber };
}