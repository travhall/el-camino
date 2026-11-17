// src/lib/canonical.ts
//
// Canonical URL and indexing policy. Only the configured production host may be
// indexed; every other host (staging, deploy previews, localhost) is sent
// `noindex`, and every page names the production URL as canonical.
import { SITE_ORIGIN } from './siteOrigin';

const CANONICAL_HOST = new URL(SITE_ORIGIN).hostname;

// Listings whose ?page=N shows different posts. Everything else drops the
// whole query string (filters, sort, view, variant and tracking parameters all
// show the same page or a subset of it).
const PAGINATED_PATH = /^\/news(\/tag\/[^/]+)?\/?$/;

export function canonicalUrl(url: URL): string {
  let out = `${SITE_ORIGIN}${url.pathname}`;
  if (PAGINATED_PATH.test(url.pathname)) {
    const raw = url.searchParams.get('page') ?? '';
    const page = /^\d+$/.test(raw) ? Number(raw) : 1;
    if (page > 1) out += `?page=${page}`;
  }
  return out;
}

export function isCanonicalHost(hostname: string): boolean {
  return hostname.toLowerCase() === CANONICAL_HOST;
}

/** Value for the X-Robots-Tag header, or null when the host may be indexed. */
export function robotsTagFor(hostname: string): string | null {
  return isCanonicalHost(hostname) ? null : 'noindex, nofollow';
}
