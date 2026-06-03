import { createEntity, updateEntity, listEntities } from '../entityStore.js';
import { getUserById } from '../userPersistence.js';
import { normalizeMobileUserId } from '../utils/mobileUserId.js';

function getTypeLabel(type) {
  const labels = {
    sick_leave: 'Sick Leave',
    unjustified_leave: 'Unjustified Leave',
    holiday: 'Vacation',
    day_off: 'Day Off',
    personal_leave: 'Personal Leave',
    other: 'Other',
  };
  return labels[type] || type;
}

function getColorForType(type) {
  const colors = {
    sick_leave: 'red',
    unjustified_leave: 'gray',
    holiday: 'blue',
    day_off: 'green',
    personal_leave: 'purple',
    other: 'orange',
  };
  return colors[type] || 'blue';
}

/**
 * Approve a leave request and create calendar events (Base44 approveLeaveRequest parity).
 */
export async function approveLeaveRequestLogic({
  leave_request_id,
  approval_notes = '',
  approver_id,
}) {
  if (!leave_request_id) {
    const err = new Error('leave_request_id is required');
    err.status = 400;
    throw err;
  }

  const rows = await listEntities('LeaveRequest', { query: { id: leave_request_id }, limit: 1 });
  const leaveRequest = rows?.[0];
  if (!leaveRequest) {
    const err = new Error('Leave request not found');
    err.status = 404;
    throw err;
  }

  if (leaveRequest.status !== 'pending') {
    const err = new Error('Leave request has already been processed');
    err.status = 400;
    throw err;
  }

  await updateEntity('LeaveRequest', leave_request_id, {
    status: 'approved',
    approver_id: approver_id || null,
    approval_date: new Date().toISOString(),
    approval_notes: approval_notes || '',
  });

  const employee = await getUserById(
    normalizeMobileUserId(leaveRequest.employee_id) || leaveRequest.employee_id
  );
  const employeeName = employee
    ? employee.nickname || employee.full_name || employee.email
    : 'Employee';

  let eventType = 'holiday';
  if (leaveRequest.request_type === 'sick_leave') eventType = 'company_event';
  else if (leaveRequest.request_type === 'day_off') eventType = 'personal';

  const startDate = new Date(leaveRequest.start_date);
  const endDate = new Date(leaveRequest.end_date);
  const createdEventIds = [];
  const attachmentUrls = leaveRequest.attachment_urls || [];

  const docTitles = attachmentUrls.length
    ? attachmentUrls.map((_, i) => `Leave Request Attachment ${i + 1}`)
    : [];

  if (leaveRequest.request_type === 'holiday') {
    const departureStart = new Date(startDate);
    departureStart.setHours(0, 0, 0, 0);
    const departureEnd = new Date(startDate);
    departureEnd.setHours(23, 59, 59, 999);

    const startEvent = await createEntity('CalendarEvent', {
      title: `${employeeName} - Start Holidays`,
      description: `Leave Request: ${leaveRequest.reason}\n\nType: Vacation Start\nTotal Days: ${leaveRequest.total_days || 0}\nPayroll Impact: ${leaveRequest.payroll_impact || 'paid'}`,
      event_type: eventType,
      start_time: departureStart.toISOString(),
      end_time: departureEnd.toISOString(),
      all_day: true,
      participant_user_ids: [leaveRequest.employee_id],
      color: 'blue',
      document_urls: attachmentUrls,
      document_titles: docTitles,
    });
    createdEventIds.push(startEvent.id);

    const arrivalStart = new Date(endDate);
    arrivalStart.setHours(0, 0, 0, 0);
    const arrivalEnd = new Date(endDate);
    arrivalEnd.setHours(23, 59, 59, 999);

    const endEvent = await createEntity('CalendarEvent', {
      title: `${employeeName} - Finish Holidays`,
      description: `Leave Request: ${leaveRequest.reason}\n\nType: Vacation End\nTotal Days: ${leaveRequest.total_days || 0}\nPayroll Impact: ${leaveRequest.payroll_impact || 'paid'}`,
      event_type: eventType,
      start_time: arrivalStart.toISOString(),
      end_time: arrivalEnd.toISOString(),
      all_day: true,
      participant_user_ids: [leaveRequest.employee_id],
      color: 'blue',
      document_urls: attachmentUrls,
      document_titles: docTitles,
    });
    createdEventIds.push(endEvent.id);
  } else {
    const rangeStart = new Date(startDate);
    rangeStart.setHours(0, 0, 0, 0);
    const rangeEnd = new Date(endDate);
    rangeEnd.setHours(23, 59, 59, 999);

    const singleEvent = await createEntity('CalendarEvent', {
      title: `${employeeName} - ${getTypeLabel(leaveRequest.request_type)}`,
      description: `Leave Request: ${leaveRequest.reason}\n\nType: ${getTypeLabel(leaveRequest.request_type)}\nDays: ${leaveRequest.total_days || 0}\nPayroll Impact: ${leaveRequest.payroll_impact || 'paid'}`,
      event_type: eventType,
      start_time: rangeStart.toISOString(),
      end_time: rangeEnd.toISOString(),
      all_day: true,
      participant_user_ids: [leaveRequest.employee_id],
      color: getColorForType(leaveRequest.request_type),
      document_urls: attachmentUrls,
      document_titles: docTitles,
    });
    createdEventIds.push(singleEvent.id);
  }

  const updatedLeave = await updateEntity('LeaveRequest', leave_request_id, {
    calendar_event_id: createdEventIds.join(','),
  });

  if (employee && leaveRequest.payroll_impact === 'deduct_from_vacation') {
    const vacationDaysTaken =
      (employee.vacation_days_taken || 0) + (leaveRequest.total_days || 0);
    const { saveUser } = await import('../userPersistence.js');
    await saveUser({ ...employee, vacation_days_taken: vacationDaysTaken }, { id: employee.id });
  }

  return {
    success: true,
    message: `Leave request approved and ${createdEventIds.length} calendar event(s) created`,
    leave_request: updatedLeave,
    calendar_event_ids: createdEventIds,
    data: {
      leave_request: updatedLeave,
      calendar_event_ids: createdEventIds,
    },
  };
}

/** POST body handler for /functions/approveLeaveRequest (web). */
export async function handleApproveLeaveRequest(body, req) {
  const rawUserId = req?.headers?.['x-user-id'] || body?.approver_id;
  const user = rawUserId
    ? await getUserById(normalizeMobileUserId(rawUserId) || rawUserId)
    : null;
  if (!user || user.role !== 'admin') {
    return { success: false, error: 'Unauthorized - Admin access required', status: 401 };
  }

  try {
    return await approveLeaveRequestLogic({
      leave_request_id: body?.leave_request_id,
      approval_notes: body?.approval_notes || '',
      approver_id: user.id,
    });
  } catch (e) {
    return { success: false, error: e.message, status: e.status || 500 };
  }
}
