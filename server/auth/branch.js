import { listEntities } from '../entityStore.js';

/** Branch `is_default` lives in JSONB extra, not a SQL column. */
export async function getDefaultBranchId() {
  const branches = await listEntities('Branch', { limit: 50, sort: 'created_date' });
  const preferred = branches.find((b) => b.is_default === true) || branches[0];
  return preferred?.id || 'local-branch-1';
}
