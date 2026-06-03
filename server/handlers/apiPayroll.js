import {
  createEntity,
  updateEntity,
  deleteEntity,
  listEntities,
} from '../entityStore.js';
import { getUserById } from '../userPersistence.js';
import { normalizeMobileUserId } from '../utils/mobileUserId.js';
import {
  resolveEmployeeIdAliases,
  employeeIdMatches,
  computeLeaveTotalDays,
  formatLeaveRequestForMobile,
} from '../utils/employeeIdAliases.js';
import { approveLeaveRequestLogic } from './approveLeaveRequest.js';

function fail(message, status = 400) {
  return { success: false, error: message, status };
}

function normAction(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase();
}

async function resolveUser(req) {
  const raw =
    req.headers['x-user-id'] ||
    req.headers['user_id'] ||
    req.query?.user_id;
  if (!raw) return null;
  const id = normalizeMobileUserId(raw) || String(raw).trim();
  return getUserById(id);
}

function employeeDisplayName(emp) {
  if (!emp) return 'Unknown';
  const full = `${emp.first_name || ''} ${emp.last_name || ''}`.trim();
  return full || emp.full_name || emp.email || 'Unknown';
}

async function buildEmployeeMap(employeeIds) {
  const map = {};
  const unique = [...new Set((employeeIds || []).filter(Boolean))];
  await Promise.all(
    unique.map(async (id) => {
      const normalized = normalizeMobileUserId(id) || id;
      const emp = await getUserById(normalized);
      if (emp) map[id] = employeeDisplayName(emp);
    })
  );
  return map;
}

async function getOne(entityName, id) {
  const rows = await listEntities(entityName, { query: { id }, limit: 1 });
  return rows?.[0] || null;
}

function stripSystemFields(data) {
  const out = { ...data };
  for (const k of ['id', 'created_date', 'updated_date', 'created_by', 'created_by_id']) {
    delete out[k];
  }
  return out;
}

export async function handleApiPayroll(req) {
  const method = req.method?.toUpperCase();
  const action = normAction(req.query?.action);
  const body = req.body || {};

  const currentUser = await resolveUser(req);
  if (!currentUser) {
    return fail('Missing x-user-id header or invalid user ID', 401);
  }

  const userId = currentUser.id;
  const isAdmin = currentUser.role === 'admin';

  if (!action) {
    return fail('Missing action parameter', 400);
  }

  try {
    // ==================== PAYROLL RUN ====================
    if (action === 'list_payroll_runs') {
      if (!isAdmin) return fail('Admin access required', 403);
      const runs = await listEntities('PayrollRun', { sort: '-created_date', limit: 1000 });
      return { success: true, data: runs };
    }

    if (action === 'get_payroll_run') {
      if (!isAdmin) return fail('Admin access required', 403);
      const id = req.query?.id;
      if (!id) return fail('Missing id parameter', 400);
      const run = await getOne('PayrollRun', id);
      if (!run) return fail('Payroll run not found', 404);
      return { success: true, data: run };
    }

    if (action === 'create_payroll_run' && method === 'POST') {
      if (!isAdmin) return fail('Admin access required', 403);
      const created = await createEntity('PayrollRun', stripSystemFields(body));
      return { success: true, data: created, status: 201 };
    }

    if (action === 'update_payroll_run' && (method === 'POST' || method === 'PUT')) {
      if (!isAdmin) return fail('Admin access required', 403);
      const id = req.query?.id;
      if (!id) return fail('Missing id parameter', 400);
      const updated = await updateEntity('PayrollRun', id, stripSystemFields(body));
      return { success: true, data: updated };
    }

    if (action === 'delete_payroll_run' && (method === 'POST' || method === 'DELETE' || method === 'GET')) {
      if (!isAdmin) return fail('Admin access required', 403);
      const id = req.query?.id;
      if (!id) return fail('Missing id parameter', 400);
      await deleteEntity('PayrollRun', id);
      return { success: true, message: 'Payroll run deleted' };
    }

    // ==================== PAY STUB ====================
    if (action === 'list_pay_stubs') {
      const employeeId = req.query?.employee_id;
      if (!isAdmin && employeeId && employeeId !== userId) {
        return fail('Forbidden', 403);
      }
      const query = {};
      if (employeeId) query.employee_id = normalizeMobileUserId(employeeId) || employeeId;
      const stubs = await listEntities('PayStub', { query, limit: 5000 });
      const employeeMap = await buildEmployeeMap(stubs.map((s) => s.employee_id));
      const enriched = stubs
        .map((s) => ({ ...s, employee_name: employeeMap[s.employee_id] || 'Unknown' }))
        .sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
      return { success: true, data: enriched };
    }

    if (action === 'get_pay_stub') {
      const id = req.query?.id;
      if (!id) return fail('Missing id parameter', 400);
      const stub = await getOne('PayStub', id);
      if (!stub) return fail('Pay stub not found', 404);
      if (!isAdmin && stub.employee_id !== userId) return fail('Forbidden', 403);
      const emp = await getUserById(normalizeMobileUserId(stub.employee_id) || stub.employee_id);
      return {
        success: true,
        data: { ...stub, employee_name: employeeDisplayName(emp) },
      };
    }

    if (action === 'create_pay_stub' && method === 'POST') {
      if (!isAdmin) return fail('Admin access required', 403);
      const created = await createEntity('PayStub', stripSystemFields(body));
      return { success: true, data: created, status: 201 };
    }

    if (action === 'update_pay_stub' && (method === 'POST' || method === 'PUT')) {
      if (!isAdmin) return fail('Admin access required', 403);
      const id = req.query?.id;
      if (!id) return fail('Missing id parameter', 400);
      const updated = await updateEntity('PayStub', id, stripSystemFields(body));
      return { success: true, data: updated };
    }

    if (action === 'delete_pay_stub' && (method === 'POST' || method === 'DELETE' || method === 'GET')) {
      if (!isAdmin) return fail('Admin access required', 403);
      const id = req.query?.id;
      if (!id) return fail('Missing id parameter', 400);
      await deleteEntity('PayStub', id);
      return { success: true, message: 'Pay stub deleted' };
    }

    // ==================== EMPLOYEE PAYROLL PROFILE ====================
    if (action === 'list_payroll_profiles') {
      if (!isAdmin) return fail('Admin access required', 403);
      const profiles = await listEntities('EmployeePayrollProfile', {
        sort: '-created_date',
        limit: 1000,
      });
      return { success: true, data: profiles };
    }

    if (action === 'get_payroll_profile') {
      if (!isAdmin) return fail('Admin access required', 403);
      const employeeId = req.query?.employee_id;
      if (!employeeId) return fail('Missing employee_id parameter', 400);
      const profiles = await listEntities('EmployeePayrollProfile', {
        query: { employee_id: normalizeMobileUserId(employeeId) || employeeId },
        limit: 1,
      });
      return { success: true, data: profiles[0] || null, exists: profiles.length > 0 };
    }

    if (action === 'create_payroll_profile' && method === 'POST') {
      if (!isAdmin) return fail('Admin access required', 403);
      const created = await createEntity('EmployeePayrollProfile', stripSystemFields(body));
      return { success: true, data: created, status: 201 };
    }

    if (action === 'update_payroll_profile' && (method === 'POST' || method === 'PUT')) {
      if (!isAdmin) return fail('Admin access required', 403);
      const id = req.query?.id;
      if (!id) return fail('Missing id parameter', 400);
      const updated = await updateEntity('EmployeePayrollProfile', id, stripSystemFields(body));
      return { success: true, data: updated };
    }

    if (action === 'delete_payroll_profile' && (method === 'POST' || method === 'DELETE' || method === 'GET')) {
      if (!isAdmin) return fail('Admin access required', 403);
      const id = req.query?.id;
      if (!id) return fail('Missing id parameter', 400);
      await deleteEntity('EmployeePayrollProfile', id);
      return { success: true, message: 'Payroll profile deleted' };
    }

    // ==================== LEAVE REQUEST ====================
    if (action === 'list_leave_requests') {
      const employeeIdParam = req.query?.employee_id;
      let filterAliases = await resolveEmployeeIdAliases(currentUser);

      if (employeeIdParam) {
        const paramUser =
          (await getUserById(normalizeMobileUserId(employeeIdParam) || employeeIdParam)) ||
          (await getUserById(employeeIdParam));
        const paramAliases = paramUser
          ? await resolveEmployeeIdAliases(paramUser)
          : await resolveEmployeeIdAliases(employeeIdParam);

        if (!isAdmin && !paramAliases.some((id) => filterAliases.includes(id))) {
          return fail('Forbidden', 403);
        }
        filterAliases = paramAliases;
      } else if (!isAdmin) {
        /* filterAliases already = current user */
      }

      const allRequests = await listEntities('LeaveRequest', {
        sort: '-created_date',
        limit: 5000,
      });

      const requests = isAdmin && !employeeIdParam
        ? allRequests
        : allRequests.filter((r) => employeeIdMatches(r.employee_id, filterAliases));

      const headerRaw = req.headers['x-user-id'] || req.headers['user_id'];
      const headerId = normalizeMobileUserId(headerRaw) || headerRaw;
      const preferredEmployeeId =
        headerId &&
        filterAliases.some(
          (id) => id === headerId || (normalizeMobileUserId(id) || id) === headerId
        )
          ? headerId
          : null;

      const employeeMap = await buildEmployeeMap(requests.map((r) => r.employee_id));
      const result = requests
        .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
        .map((r) =>
          formatLeaveRequestForMobile(
            r,
            employeeMap[r.employee_id] || 'Unknown',
            preferredEmployeeId
          )
        );
      return { success: true, data: result };
    }

    if (action === 'get_leave_request') {
      const id = req.query?.id;
      if (!id) return fail('Missing id parameter', 400);
      const request = await getOne('LeaveRequest', id);
      if (!request) return fail('Leave request not found', 404);
      const aliases = await resolveEmployeeIdAliases(currentUser);
      if (!isAdmin && !employeeIdMatches(request.employee_id, aliases)) {
        return fail('Forbidden', 403);
      }
      const emp = await getUserById(
        normalizeMobileUserId(request.employee_id) || request.employee_id
      );
      return {
        success: true,
        data: formatLeaveRequestForMobile(request, employeeDisplayName(emp)),
      };
    }

    if (action === 'create_leave_request' && method === 'POST') {
      const payload = stripSystemFields({ ...body });
      const aliases = await resolveEmployeeIdAliases(currentUser);

      const headerRaw = req.headers['x-user-id'] || req.headers['user_id'];
      const headerId = normalizeMobileUserId(headerRaw) || headerRaw;

      if (payload.employee_id) {
        payload.employee_id = normalizeMobileUserId(payload.employee_id) || payload.employee_id;
      } else if (headerId && aliases.some((id) => id === headerId || normalizeMobileUserId(id) === headerId)) {
        payload.employee_id = headerId;
      } else {
        payload.employee_id = userId;
      }

      if (!isAdmin && !employeeIdMatches(payload.employee_id, aliases)) {
        return fail('Forbidden', 403);
      }
      if (!payload.status) payload.status = 'pending';

      if (payload.total_days == null) {
        payload.total_days = computeLeaveTotalDays(payload.start_date, payload.end_date);
      }
      if (payload.paid_days == null && payload.unpaid_days == null) {
        payload.paid_days = payload.total_days;
        payload.unpaid_days = 0;
      }

      const newRequest = await createEntity('LeaveRequest', payload);
      const emp = await getUserById(
        normalizeMobileUserId(newRequest.employee_id) || newRequest.employee_id
      );
      return {
        success: true,
        data: formatLeaveRequestForMobile(newRequest, employeeDisplayName(emp)),
        status: 201,
      };
    }

    if (action === 'update_leave_request' && (method === 'POST' || method === 'PUT')) {
      const id = req.query?.id;
      if (!id) return fail('Missing id parameter', 400);
      const request = await getOne('LeaveRequest', id);
      if (!request) return fail('Leave request not found', 404);

      const aliases = await resolveEmployeeIdAliases(currentUser);
      if (!isAdmin) {
        if (!employeeIdMatches(request.employee_id, aliases)) return fail('Forbidden', 403);
        if (request.status !== 'pending') {
          return fail('Cannot update non-pending requests', 403);
        }
      }

      const updated = await updateEntity('LeaveRequest', id, stripSystemFields(body));
      const emp = await getUserById(
        normalizeMobileUserId(updated.employee_id) || updated.employee_id
      );
      return {
        success: true,
        data: formatLeaveRequestForMobile(updated, employeeDisplayName(emp)),
      };
    }

    if (action === 'delete_leave_request' && (method === 'POST' || method === 'DELETE' || method === 'GET')) {
      const id = req.query?.id;
      if (!id) return fail('Missing id parameter', 400);
      const request = await getOne('LeaveRequest', id);
      if (!request) return fail('Leave request not found', 404);

      const aliases = await resolveEmployeeIdAliases(currentUser);
      if (!isAdmin) {
        if (!employeeIdMatches(request.employee_id, aliases)) return fail('Forbidden', 403);
        if (request.status !== 'pending') {
          return fail('Cannot delete non-pending requests', 403);
        }
      }

      await deleteEntity('LeaveRequest', id);
      return { success: true, message: 'Leave request deleted' };
    }

    if (action === 'approve_leave_request' && method === 'POST') {
      if (!isAdmin) return fail('Admin access required', 403);
      const id = req.query?.id;
      if (!id) return fail('Missing id parameter', 400);
      const result = await approveLeaveRequestLogic({
        leave_request_id: id,
        approval_notes: body.approval_notes || '',
        approver_id: userId,
      });
      return {
        success: true,
        data: result.data,
        message: 'Leave request approved and calendar events created',
      };
    }

    if (action === 'reject_leave_request' && method === 'POST') {
      if (!isAdmin) return fail('Admin access required', 403);
      const id = req.query?.id;
      if (!id) return fail('Missing id parameter', 400);
      const approval_notes = body.approval_notes;
      if (!approval_notes) {
        return fail('approval_notes required for rejection', 400);
      }
      const request = await getOne('LeaveRequest', id);
      if (!request) return fail('Leave request not found', 404);

      const updated = await updateEntity('LeaveRequest', id, {
        status: 'rejected',
        approval_notes,
        approver_id: userId,
        approval_date: new Date().toISOString(),
      });
      const emp = await getUserById(
        normalizeMobileUserId(updated.employee_id) || updated.employee_id
      );
      return {
        success: true,
        data: formatLeaveRequestForMobile(updated, employeeDisplayName(emp)),
        message: 'Leave request rejected',
      };
    }

    // ==================== PAY ITEM TYPE ====================
    if (action === 'list_pay_item_types') {
      if (!isAdmin) return fail('Admin access required', 403);
      const types = await listEntities('PayItemType', { sort: 'sort_order', limit: 1000 });
      return { success: true, data: types };
    }

    if (action === 'get_pay_item_type') {
      if (!isAdmin) return fail('Admin access required', 403);
      const id = req.query?.id;
      if (!id) return fail('Missing id parameter', 400);
      const row = await getOne('PayItemType', id);
      if (!row) return fail('Pay item type not found', 404);
      return { success: true, data: row };
    }

    if (action === 'create_pay_item_type' && method === 'POST') {
      if (!isAdmin) return fail('Admin access required', 403);
      const created = await createEntity('PayItemType', stripSystemFields(body));
      return { success: true, data: created, status: 201 };
    }

    if (action === 'update_pay_item_type' && (method === 'POST' || method === 'PUT')) {
      if (!isAdmin) return fail('Admin access required', 403);
      const id = req.query?.id;
      if (!id) return fail('Missing id parameter', 400);
      const updated = await updateEntity('PayItemType', id, stripSystemFields(body));
      return { success: true, data: updated };
    }

    if (action === 'delete_pay_item_type' && (method === 'POST' || method === 'DELETE' || method === 'GET')) {
      if (!isAdmin) return fail('Admin access required', 403);
      const id = req.query?.id;
      if (!id) return fail('Missing id parameter', 400);
      await deleteEntity('PayItemType', id);
      return { success: true, message: 'Pay item type deleted' };
    }

    // ==================== PAY ITEM ====================
    if (action === 'list_pay_items') {
      if (!isAdmin) return fail('Admin access required', 403);
      const items = await listEntities('PayItem', { sort: 'sort_order', limit: 1000 });
      return { success: true, data: items };
    }

    if (action === 'get_pay_item') {
      if (!isAdmin) return fail('Admin access required', 403);
      const id = req.query?.id;
      if (!id) return fail('Missing id parameter', 400);
      const row = await getOne('PayItem', id);
      if (!row) return fail('Pay item not found', 404);
      return { success: true, data: row };
    }

    if (action === 'create_pay_item' && method === 'POST') {
      if (!isAdmin) return fail('Admin access required', 403);
      const created = await createEntity('PayItem', stripSystemFields(body));
      return { success: true, data: created, status: 201 };
    }

    if (action === 'update_pay_item' && (method === 'POST' || method === 'PUT')) {
      if (!isAdmin) return fail('Admin access required', 403);
      const id = req.query?.id;
      if (!id) return fail('Missing id parameter', 400);
      const updated = await updateEntity('PayItem', id, stripSystemFields(body));
      return { success: true, data: updated };
    }

    if (action === 'delete_pay_item' && (method === 'POST' || method === 'DELETE' || method === 'GET')) {
      if (!isAdmin) return fail('Admin access required', 403);
      const id = req.query?.id;
      if (!id) return fail('Missing id parameter', 400);
      await deleteEntity('PayItem', id);
      return { success: true, message: 'Pay item deleted' };
    }

    return fail(`Unknown action: ${action}`, 400);
  } catch (e) {
    console.error('[apiPayroll]', action, e.message);
    return fail(e.message || 'Internal server error', e.status || 500);
  }
}
