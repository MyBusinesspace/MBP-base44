/** Trim Vercel/env quirks: quotes, leading =, whitespace. */
export function normalizeEnvString(value) {
  return String(value ?? '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/^=+/, '');
}
