/**
 * A safe post-login destination: a same-origin path only, never an open redirect.
 *
 * Resolved with the URL parser rather than prefix checks, because browsers read
 * `/\evil.com` and `/<tab>/evil.com` as `//evil.com`, and dot segments
 * normalise away (`/.//evil.com` has the pathname `//evil.com`). Only the path,
 * query and hash of a same-origin result are returned, and never one that a
 * browser would read as another host.
 */
export function safeRedirectPath(next: string | undefined, siteUrl: string, fallback = '/dashboard'): string {
  if (!next || !next.startsWith('/')) return fallback;
  try {
    const base = new URL(siteUrl);
    const url = new URL(next, base);
    if (url.origin !== base.origin) return fallback;
    const path = `${url.pathname}${url.search}${url.hash}`;
    return path.startsWith('//') ? fallback : path;
  } catch {
    return fallback;
  }
}
