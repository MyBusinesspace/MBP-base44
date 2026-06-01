/** Mobile app may send [google:SUB] or google:SUB — DB uses google-SUB */
export function normalizeMobileUserId(raw) {
  if (raw == null || raw === '') return null;
  let id = String(raw).trim();
  if (id.startsWith('[') && id.endsWith(']')) id = id.slice(1, -1).trim();
  if (id.startsWith('google:')) id = `google-${id.slice(7)}`;
  return id;
}
