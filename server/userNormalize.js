/** IDs that must not be overwritten by Google OAuth (seed admin). */
export const PROTECTED_USER_IDS = new Set(['local-admin-user']);

/**
 * Legacy UI uses first_name + last_name before full_name.
 * Normalize API output so full_name column wins and OAuth cannot hijack admin display.
 */
export function normalizeUserForApi(user) {
  if (!user) return user;
  const out = { ...user };
  delete out.password;
  delete out.verification_code;
  delete out.verification_code_expires_at;

  const full = String(out.full_name || '').trim();
  if (full) {
    const parts = full.split(/\s+/).filter(Boolean);
    out.first_name = parts[0] || '';
    out.last_name = parts.slice(1).join(' ') || '';
    out.full_name = full;
    return out;
  }

  const first = String(out.first_name || '').trim();
  const last = String(out.last_name || '').trim();
  const combined = `${first} ${last}`.trim();
  if (combined) out.full_name = combined;
  return out;
}

export function normalizeUsersForApi(users) {
  return (Array.isArray(users) ? users : []).map(normalizeUserForApi);
}
