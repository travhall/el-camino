# Plan 237: Make home, news, category and shop pages actually CDN-cached (`durable`)

> **Executor instructions**: Implemented; **not yet verified on the real CDN**.
> The verification step at the end needs one deploy preview and has not been run.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: MED (freshness changes; see "What changes for visitors")
- **Depends on**: 236 (the investigation that found the cause), 235
- **Category**: perf
- **Planned at**: commit `bc62fd9`, 2026-11-18
- **Outcome**: Code changed and guarded; CDN behaviour unverified

## Why

Plan 236 found that these routes render at the origin function on every request,
whatever their headers say: they send `Netlify-CDN-Cache-Control` without the
`durable` directive, and on production a non-durable `s-maxage=300` endpoint got 0
hits in 5 requests while durable ones hit from the second request. The decisions
that plan listed were taken: **accept** that cached pages share one CSP nonce for
the cache window (plan 235), and **add `durable`**.

## What changed

`, durable` added to `Netlify-CDN-Cache-Control` on seven routes:

- pages: `index.astro`, `category/[...slug].astro`, `news/index.astro`,
  `shop/all.astro` (both values), `shop/sale.astro` (both values);
- endpoints: `api/get-categories.ts` and `api/quick-view-product.ts`. The second was
  not in plan 236's list of six; it has the same defect and is already cache-tagged
  for the webhook purge, so there is no freshness cost to caching it.

Left alone on purpose: `api/sale-info.ts` is a POST, which a CDN does not cache, so
`durable` would do nothing.

## The guard

`src/__tests__/cdnCacheHeaders.test.ts` fails on any `Netlify-CDN-Cache-Control`
value that contains `s-maxage` but not `durable`, unless the route is in an
allowlist with a reason (`sale-info`). The header is valid either way, so nothing
else would ever notice. Without it the next route would repeat this for months.
`CLAUDE.md` records the rule and how to check a deployed route.

## What changes for visitors

- **Faster**: a cached page skips the origin render. Cold TTFB on `/shop/all` was
  137 to 2,110 ms on every visit (plan 231 notes).
- **Stock on category pages can lag by up to about 6 minutes** (`s-maxage=300` plus
  `stale-while-revalidate=60`). They are untagged, so the webhook purge does not
  reach them; plan 221 set that bound on purpose. Until now it was always fresh only
  because the page was never cached. The PDP re-checks stock on load as a backstop.
- **Home, news and shop lag longer** (up to 30 minutes stale-while-revalidate),
  as their headers always said.
- **A cached page is served with one nonce to every visitor** for the cache window,
  now across most of the site, not only product pages (accepted, plan 235).
- Query strings stay part of the cache key (`netlify-vary: query`), so a filtered URL
  is its own entry.

## Verification

- Tests first: the guard failed against the old code naming exactly the seven
  routes (nine values), and `e2e/category-cache.stub.spec.ts`, which pins the exact
  header, failed on `...stale-while-revalidate=60` where `..., durable` was expected;
  both pass now. Guard mutations: `durable` stripped from `index.astro`, and a new
  non-durable route added; each fails it. Scanner tests cover a single value, a
  ternary, an object-literal property, not running into the next header, and a
  header with no `s-maxage`.
- Gate: see the PR.

## NOT verified: the real CDN

Netlify's CDN is not reproducible on the dev server, so the effect itself is
unverified. To verify, ship one deploy preview (put `[preview]` in the commit
message; builds are limited) and run, against the preview URL, for each of `/`,
`/news`, `/category/skateboards`, `/shop/all`:

    for i in 1 2 3 4 5; do curl -s -D- -o /dev/null URL | grep -iE '^age|^cache-status'; sleep 3; done

Expect `cache-status: "Netlify Durable"; hit` from the second request, a growing
`age`, and the same CSP nonce each time (before the change: `fwd=bypass`, `age` 0,
a different nonce every time). Then confirm `/cart`, `/the-shop` and the product page
are unchanged. Also check that a category page behind a stock change shows the new
state within the expected window.
