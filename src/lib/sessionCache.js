/** Clear stale client caches after login/logout (IndexedDB had old Base44 users). */
export function clearAppSessionCaches() {
  try {
    localStorage.removeItem('viewAsUser');
    localStorage.removeItem('currentCompanyId');
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('mpb:clear-data-cache'));
    window.dispatchEvent(new Event('mpb:session-changed'));
  }
}
