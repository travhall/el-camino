import { test, expect } from '@playwright/test';
import { DECKS } from './fixtures/square-catalog.mjs';

/**
 * Category pages are CDN-cached for 5 minutes. After that the CDN may serve the
 * stale page for a short window while it refetches, so the visitor on an expired
 * entry does not wait for a cold render (plan 221). The window is short because
 * the pages are not cache-tagged: the Square webhook purge does not reach them,
 * so the window is the only bound on how stale a stock badge can be.
 *
 * The CDN header must say `durable` (plan 236/237): without it Netlify stores the
 * page at one edge node and, measured on production, never reuses it, so the
 * 5-minute cache and the stale window above did nothing and every visit rendered
 * at the origin.
 */
test.describe('category page cache headers', () => {
  test('allows 60 s of stale-while-revalidate on both CDN headers, and shares the cache durably', async ({
    request,
  }) => {
    const res = await request.get(`/category/${DECKS.name.toLowerCase()}`);
    expect(res.status()).toBe(200);

    const headers = res.headers();
    expect(headers['cache-control']).toContain('s-maxage=300');
    expect(headers['cache-control']).toContain('stale-while-revalidate=60');
    expect(headers['cache-control']).toContain('no-cache');
    expect(headers['netlify-cdn-cache-control']).toBe(
      'public, s-maxage=300, stale-while-revalidate=60, durable'
    );
  });

  test('is not cache-tagged, so the webhook purge cannot reach it', async ({
    request,
  }) => {
    const res = await request.get(`/category/${DECKS.name.toLowerCase()}`);
    expect(res.headers()['netlify-cache-tag']).toBeUndefined();
  });
});
