import { Router } from 'express';
import { functionHandlers, withData } from './functionHandlers.js';
import { handleWorkOrders } from './mobileHandlers/workOrders.js';
import { handleApiAuth } from '../handlers/apiAuth.js';
import { handleApiHelper } from '../handlers/apiHelper.js';
import { handleApiTimeTracker } from '../handlers/apiTimeTracker.js';
import { handleApiWallPost } from '../handlers/apiWallPost.js';
import { handleApiPayroll } from '../handlers/apiPayroll.js';
import { handleApiQuickTasks } from '../handlers/apiQuickTasks.js';

const router = Router({ mergeParams: true });

/** Mobile / REST-style functions (GET with ?action=, headers). */
const mobileHandlers = {
  'work-orders': handleWorkOrders,
  apiAuth: handleApiAuth,
  apiHelper: handleApiHelper,
  apiTimeTracker: handleApiTimeTracker,
  apiWallPost: handleApiWallPost,
  apiPayroll: handleApiPayroll,
  apiQuickTasks: handleApiQuickTasks,
};

function functionNameFromReq(req) {
  const raw = (req.path || req.url || '').split('?')[0].replace(/\/+$/, '');
  const segments = raw.replace(/^\//, '').split('/').filter(Boolean);
  const fnIdx = segments.findIndex((s) => s.toLowerCase() === 'functions');
  if (fnIdx >= 0 && segments[fnIdx + 1]) {
    return segments.slice(fnIdx + 1).join('/');
  }
  return segments[segments.length - 1] || raw.replace(/^\//, '');
}

function resolveMobileHandler(fn) {
  if (!fn) return null;
  if (mobileHandlers[fn]) return mobileHandlers[fn];
  const lower = fn.toLowerCase();
  const key = Object.keys(mobileHandlers).find((k) => k.toLowerCase() === lower);
  return key ? mobileHandlers[key] : null;
}

async function runHandler(req, res, handler, { isMobile = false } = {}) {
  try {
    const result = isMobile ? await handler(req) : await handler(req.body ?? {}, req);
    if (result?.error && result.success === false) {
      return res.status(result.status || 500).json(withData(result));
    }
    if (result?.status && result.status >= 400) {
      return res.status(result.status).json(withData(result));
    }
    if (result?._rawHtml) {
      return res
        .status(result.status || 200)
        .type(result.contentType || 'text/html; charset=utf-8')
        .send(result.html);
    }
    return res.json(withData(result ?? { success: true }));
  } catch (e) {
    console.error(`[functions] ${functionNameFromReq(req)}:`, e.message);
    return res.status(e.status || 500).json(withData({ error: e.message, success: false }));
  }
}

/** Catch-all for /apps/:appId/functions/<name> and /apps/:appId/functions/api/foo */
router.use(async (req, res) => {
  const fn = functionNameFromReq(req);
  if (!fn) {
    return res.status(404).json(withData({ error: 'Function name required', success: false }));
  }

  // Support /functions/apiQuickTasks/create → fn=apiQuickTasks, action=create
  let functionName = fn;
  let pathAction = null;
  if (fn.includes('/')) {
    const parts = fn.split('/').filter(Boolean);
    functionName = parts[0];
    pathAction = parts[1] || null;
    if (pathAction && !req.query?.action) {
      req.query = { ...req.query, action: pathAction };
    }
  }

  const mobile = resolveMobileHandler(functionName);
  if (mobile) {
    return runHandler(req, res, mobile, { isMobile: true });
  }

  const handler = functionHandlers[functionName] || functionHandlers[fn];
  if (!handler) {
    console.warn(`[functions] Unimplemented: ${functionName || fn} (${req.method}) path=${req.path}`);
    return res.json(
      withData({
        success: true,
        _local_stub: true,
        function: fn,
        method: req.method,
      })
    );
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json(withData({ error: 'Method not allowed', success: false }));
  }

  return runHandler(req, res, handler);
});

export default router;
