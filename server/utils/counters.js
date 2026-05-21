import { pool } from '../db.js';

export async function getNextCounter(name, branchId = 'default') {
  const key = `${name}:${branchId || 'default'}`;
  const { rows } = await pool.query(
    `INSERT INTO counters (key, value) VALUES ($1, 1)
     ON CONFLICT (key) DO UPDATE SET value = counters.value + 1
     RETURNING value`,
    [key]
  );
  const n = Number(rows[0]?.value || 1);
  const year = new Date().getFullYear();
  if (name === 'work_order') return `WO-${year}-${String(n).padStart(5, '0')}`;
  if (name === 'working_report') return `WR-${year}-${String(n).padStart(4, '0')}`;
  if (name === 'client' || name === 'project' || name === 'employee') return n;
  return String(n);
}
