/**
 * Validate a redirect path to prevent open-redirect attacks.
 * Only allows relative paths starting with "/" (not protocol-relative "//").
 */
export function safeRedirect(next: string | null, fallback = '/listings'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return fallback;
  return next;
}
