import { Router } from 'express';
import { functionHandlers, withData } from './functionHandlers.js';
import { handleWorkOrders } from './mobileHandlers/workOrders.js';

const router = Router({ mergeParams: true });

/** Mobile / REST-style functions (GET with ?action=, headers). */
const mobileHandlers = {
  'work-orders': handleWorkOrders,
};

function functionNameFromReq(req) {
  const p = (req.path || req.url || '').split('?')[0];
  return p.replace(/^\//, '');
}

async function runHandler(req, res, handler, { isMobile = false } = {}) {
  try {
    const result = isMobile ? await handler(req) : await handler(req.body ?? {}, req);
    if (result?.error && result.success === false) {
      return res.status(result.status || 500).json(withData(result));
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

  const mobile = mobileHandlers[fn];
  if (mobile) {
    return runHandler(req, res, mobile, { isMobile: true });
  }

  const handler = functionHandlers[fn];
  if (!handler) {
    console.warn(`[functions] Unimplemented: ${fn} (${req.method})`);
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
