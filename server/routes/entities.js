import { Router } from 'express';
import {
  listEntities,
  getEntity,
  createEntity,
  updateEntity,
  deleteEntity,
  bulkCreate,
} from '../entityStore.js';
import { authenticateUserMe } from '../middleware/authenticate.js';

const router = Router({ mergeParams: true });

router.get('/:entityName', async (req, res, next) => {
  try {
    const { entityName } = req.params;
    const { sort, limit, skip, q } = req.query;
    let query = {};
    if (q) {
      try {
        query = JSON.parse(q);
      } catch {
        return res.status(400).json({ message: 'Invalid query JSON' });
      }
    }
    const rows = await listEntities(entityName, {
      sort: sort || '-created_date',
      limit: limit ? Number(limit) : 500,
      skip: skip ? Number(skip) : 0,
      query,
    });
    if (entityName === 'User') {
      res.setHeader('Cache-Control', 'no-store');
    }
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

router.get('/:entityName/:id', authenticateUserMe, async (req, res, next) => {
  try {
    const { entityName, id } = req.params;
    if (entityName === 'User' && id === 'me') {
      return res.json(req.user);
    }
    const row = await getEntity(entityName, id);
    res.json(row);
  } catch (e) {
    if (e.status === 404) return res.status(404).json({ message: e.message });
    next(e);
  }
});

router.post('/:entityName/bulk', async (req, res, next) => {
  try {
    const items = Array.isArray(req.body) ? req.body : [];
    const rows = await bulkCreate(req.params.entityName, items);
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

router.post('/:entityName', async (req, res, next) => {
  try {
    const row = await createEntity(req.params.entityName, req.body || {});
    res.status(201).json(row);
  } catch (e) {
    next(e);
  }
});

router.put('/:entityName/:id', authenticateUserMe, async (req, res, next) => {
  try {
    const { entityName, id } = req.params;
    if (entityName === 'User' && id === 'me') {
      const row = await updateEntity('User', req.user.id, req.body || {});
      return res.json(row);
    }
    const row = await updateEntity(entityName, id, req.body || {});
    res.json(row);
  } catch (e) {
    if (e.status === 404) return res.status(404).json({ message: e.message });
    next(e);
  }
});

router.delete('/:entityName/:id', async (req, res, next) => {
  try {
    const result = await deleteEntity(req.params.entityName, req.params.id);
    res.json(result);
  } catch (e) {
    if (e.status === 404) return res.status(404).json({ message: e.message });
    next(e);
  }
});

export default router;
