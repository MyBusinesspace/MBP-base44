import { api } from '@/api/client';

/** Wraps a backend function name as a callable (replaces Base44 @/functions imports). */
export function createFunctionInvoker(name) {
  return (data = {}) => api.functions.invoke(name, data);
}
