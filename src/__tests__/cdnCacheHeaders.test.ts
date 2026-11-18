// @vitest-environment node
/**
 * Guard for plan 237: a cacheable `Netlify-CDN-Cache-Control` needs `durable`.
 *
 * Without the `durable` directive Netlify stores a response at one edge node and,
 * for this site's traffic, never reuses it: measured on production, a non-durable
 * `s-maxage=300` endpoint got 0 hits in 5 requests while durable ones hit from the
 * second request (plan 236). Home, news, category and the shop pages sat in that
 * state for months, rendering at the origin on every visit while their headers and
 * `CLAUDE.md` said they were CDN-cached. Nothing failed: the header is valid, it
 * just does nothing.
 *
 * A route that sets `s-maxage` on `Netlify-CDN-Cache-Control` is asking to be
 * cached, so it must say `durable`. A response that cannot be cached anyway (a POST)
 * goes in the allowlist with the reason.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

const ROOT = resolve(__dirname, '..', '..');
const PAGES = join(ROOT, 'src', 'pages');

const NOT_CACHEABLE: Record<string, string> = {
  'src/pages/api/sale-info.ts':
    'A POST endpoint: a CDN does not cache POST responses, so `durable` would do nothing.',
};

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(astro|ts)$/.test(path) ? [path] : [];
  });
}

/**
 * The CDN-cache values a file assigns: the quoted strings, containing
 * `s-maxage`, that follow each `Netlify-CDN-Cache-Control` up to the end of that
 * statement (so a ternary's two values are both read, and a neighbouring header
 * is not).
 */
function cdnCacheValues(source: string): string[] {
  const values: string[] = [];
  const marker = /Netlify-CDN-Cache-Control/g;
  let match: RegExpExecArray | null;
  while ((match = marker.exec(source))) {
    const rest = source.slice(match.index + match[0].length);
    const statementEnd = rest.indexOf(';');
    const nextMarker = rest.search(/Netlify-CDN-Cache-Control/);
    const limits = [400, statementEnd, nextMarker].filter((n) => n >= 0);
    const window = rest.slice(0, Math.min(...limits));
    for (const literal of window.matchAll(
      /(['"])((?:(?!\1).)*s-maxage(?:(?!\1).)*)\1/g
    )) {
      values.push(literal[2]);
    }
  }
  return values;
}

function cacheableRoutes(): Record<string, string[]> {
  const found: Record<string, string[]> = {};
  for (const file of sourceFiles(PAGES)) {
    const values = cdnCacheValues(readFileSync(file, 'utf8'));
    if (values.length > 0) found[relative(ROOT, file)] = values;
  }
  return found;
}

describe('Netlify CDN cache headers (plan 237)', () => {
  const routes = cacheableRoutes();

  it('finds the routes that ask to be cached, so the guard is not vacuous', () => {
    expect(Object.keys(routes)).toEqual(
      expect.arrayContaining([
        'src/pages/index.astro',
        'src/pages/news/index.astro',
        'src/pages/category/[...slug].astro',
        'src/pages/shop/all.astro',
        'src/pages/shop/sale.astro',
        'src/pages/product/[id].astro',
        'src/pages/api/related-products.ts',
      ])
    );
  });

  it('every cacheable value says durable, or the route is listed as not cacheable', () => {
    const missing = Object.entries(routes).flatMap(([file, values]) =>
      file in NOT_CACHEABLE
        ? []
        : values
            .filter((v) => !/\bdurable\b/.test(v))
            .map((v) => `${file}: ${v}`)
    );

    expect(
      missing,
      'These Netlify-CDN-Cache-Control values have no `durable` directive, so the CDN will store them per node and effectively never reuse them. Add `durable`, or put the route in NOT_CACHEABLE with the reason.'
    ).toEqual([]);
  });

  it('every allowlist entry is still a route that sets the header, with a reason', () => {
    for (const [file, reason] of Object.entries(NOT_CACHEABLE)) {
      expect(Object.keys(routes), file).toContain(file);
      expect(reason.length, file).toBeGreaterThan(20);
    }
  });

  describe('the scanner', () => {
    it('reads a single value', () => {
      expect(
        cdnCacheValues(
          "headers.set('Netlify-CDN-Cache-Control', 'public, s-maxage=300, durable');"
        )
      ).toEqual(['public, s-maxage=300, durable']);
    });

    it('reads both branches of a ternary', () => {
      const source = `set('Netlify-CDN-Cache-Control',
        hasFilters ? 'public, s-maxage=180' : 'public, s-maxage=300, durable');`;

      expect(cdnCacheValues(source)).toEqual([
        'public, s-maxage=180',
        'public, s-maxage=300, durable',
      ]);
    });

    it('reads an object-literal property', () => {
      const source = `new Response(body, { headers: {
        'Netlify-CDN-Cache-Control':
          'public, s-maxage=300, stale-while-revalidate=1800',
        Vary: 'Accept-Encoding',
      } });`;

      expect(cdnCacheValues(source)).toEqual([
        'public, s-maxage=300, stale-while-revalidate=1800',
      ]);
    });

    it('does not run into the next header', () => {
      const source = `set('Netlify-CDN-Cache-Control', 'public, s-maxage=1');
        set('Netlify-Cache-Tag', 'tag, s-maxage=9');
        set('Netlify-CDN-Cache-Control', 'public, s-maxage=2, durable');`;

      expect(cdnCacheValues(source)).toEqual([
        'public, s-maxage=1',
        'public, s-maxage=2, durable',
      ]);
    });

    it('ignores a header that carries no s-maxage', () => {
      expect(
        cdnCacheValues("set('Netlify-CDN-Cache-Control', 'no-store');")
      ).toEqual([]);
    });
  });
});
