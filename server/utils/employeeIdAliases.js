import { pool } from '../db.js';
import { getUserById, getUserByEmail } from '../userPersistence.js';
import { normalizeMobileUserId } from './mobileUserId.js';

/**
 * All user/employee IDs that refer to the same person (google-SUB, legacy Base44 ObjectId, etc.).
 */
export async function resolveEmployeeIdAliases(userOrId) {
  const ids = new Set();
  let user = null;

  if (typeof userOrId === 'string') {
    const normalized = normalizeMobileUserId(userOrId) || userOrId;
    user = (await getUserById(normalized)) || (await getUserById(userOrId));
    if (!user) ids.add(userOrId);
    if (normalized) ids.add(normalized);
  } else if (userOrId && typeof userOrId === 'object') {
    user = userOrId;
  }

  if (user?.id) ids.add(user.id);
  if (user?.id?.startsWith('google-')) {
    const sub = user.id.slice(7);
    ids.add(`google:${sub}`);
  }

  const email = user?.email?.toLowerCase?.()?.trim();
  if (email) {
    const byEmail = await getUserByEmail(email);
    if (byEmail?.id) ids.add(byEmail.id);

    try {
      const { rows } = await pool.query(
        `SELECT id FROM entity_records
         WHERE entity_name = 'User'
           AND LOWER(TRIM(COALESCE(data->>'email', ''))) = $1`,
        [email]
      );
      for (const row of rows) {
        if (row?.id) ids.add(row.id);
      }
    } catch {
      /* ignore */
    }
  }

  return Array.from(ids).filter(Boolean);
}

export function employeeIdMatches(recordEmployeeId, aliasIds) {
  if (!recordEmployeeId || !aliasIds?.length) return false;
  const norm = normalizeMobileUserId(recordEmployeeId) || recordEmployeeId;
  return aliasIds.some(
    (id) => id === recordEmployeeId || (normalizeMobileUserId(id) || id) === norm
  );
}

export function computeLeaveTotalDays(startDate, endDate) {
  if (!startDate || !endDate) return 0;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  const diff = Math.round((end - start) / 86400000) + 1;
  return diff > 0 ? diff : 0;
}

/** Shape leave rows like Base44 mobile client expects. */
export function formatLeaveRequestForMobile(record, employeeName, preferredEmployeeId = null) {
  const total =
    record.total_days != null
      ? Number(record.total_days)
      : computeLeaveTotalDays(record.start_date, record.end_date);

  let paid = record.paid_days != null ? Number(record.paid_days) : total;
  let unpaid = record.unpaid_days != null ? Number(record.unpaid_days) : 0;
  if (paid + unpaid !== total && total > 0) {
    paid = total;
    unpaid = 0;
  }

  return {
    ...record,
    end_date: record.end_date ?? null,
    start_date: record.start_date ?? null,
    reason: record.reason ?? '',
    approval_date: record.approval_date ?? null,
    unpaid_days: unpaid,
    paid_days: paid,
    notes: record.notes ?? null,
    attachment_urls: Array.isArray(record.attachment_urls) ? record.attachment_urls : [],
    attachments: Array.isArray(record.attachments) ? record.attachments : [],
    request_type: record.request_type ?? 'holiday',
    approval_notes: record.approval_notes ?? null,
    approver_id: record.approver_id ?? null,
    team_at_leave_start_id: record.team_at_leave_start_id ?? null,
    calendar_event_id: record.calendar_event_id ?? null,
    employee_id: preferredEmployeeId || record.employee_id,
    status: record.status ?? 'pending',
    total_days: total,
    is_sample: false,
    employee_name: employeeName || 'Unknown',
  };
}
