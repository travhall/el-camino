# Plan 236: **Investigation**: home, news and category pages are not being served from the CDN cache

> **Executor instructions**: The investigation is finished. The fix is
> deliberately **not applied**: it has consequences that need a decision (see
> "Decisions"). Read those before changing anything.

## Status

- **Priority**: P2
- **Effort**: S (the fix) / investigation done
- **Risk**: MED (the fix changes freshness and widens the shared-nonce gap)
- **Depends on**: 235 (which found the symptom)
- **Category**: perf
- **Planned at**: commit `bc62fd9`, 2026-11-18
- **Outcome**: Cause established; fix proposed, awaiting decisions

## What was seen

While checking CSP nonces for plan 235, two requests 1.2 s apart to `/`, `/news`
and `/category/skateboards` on production and staging returned a different nonce
each time. Those pages send `public, s-maxage=300, stale-while-revalidate=1800`
(category: `stale-while-revalidate=60`), so a cache hit would have returned the same
nonce. `CLAUDE.md` says listing pages are CDN-cached and "still expire on their TTL".

Five requests 3 s apart to production, full `cache-status`:

- `/`: every request `Durable; fwd=bypass || Edge; fwd=miss; stored`, a fresh
  nonce and `age` 0 to 1 each time.
- `/product/bronze-truck-t-shirt`: every request `Durable; hit`, one nonce, `age`
  and TTL counting down (`ttl=40`, `37`, `33`, ...).

## Cause

The product page (and `api/resolve-product`, `api/related-products`) send
`Netlify-CDN-Cache-Control` with the **`durable`** directive, with a comment saying
why ("durable directive shares cache globally across all edge nodes"). `index.astro`,
`category/[...slug].astro`, `news/index.astro`, `shop/all.astro`, `shop/sale.astro`
and `api/get-categories.ts` send the same header **without** `durable`.

A controlled comparison on the same platform, same `Vary`, same TTL class, only
`durable` differing (five GETs each, 2.5 s apart, production):

| endpoint | `durable` | result |
|---|---|---|
| `/api/get-categories` (`s-maxage=300`) | no | 0 of 5 hits: `Durable; fwd=bypass`, `Edge; miss; stored`, `age` 0 to 1 |
| `/api/related-products` (`s-maxage=900`) | yes | one `uri-miss; stored`, then 4 of 4 hits, TTL counting down |
| `/api/resolve-product` (`s-maxage=3600`) | yes | hits; the fifth request was even an `Edge; hit` |

So without `durable` the response is stored at an edge node but, for this site's
traffic, is not reused (consistent with a per-node cache that a visitor rarely hits
twice); with `durable` it is shared and reused. The effect is that **these routes
render at the origin function on every request**, whatever their headers promise.

Not established: why Netlify's non-durable edge cache never produced a hit here (a
per-node cache with several nodes per location fits, but that is an inference), and
whether the same holds at higher traffic. One machine, one afternoon.

## What this changes in what we believed

- `CLAUDE.md`'s "listing pages still expire on their TTL" is wrong in practice.
- Plan 221 (category `stale-while-revalidate=60`) and plan 222's cold-render
  figures were tuning a cache that was not serving. The "live CDN behaviour of
  category `swr=60`" item in the known-unverified list now has its answer: there is
  no caching there to tune.
- Cold TTFB on `/shop/all` (137 to 2,110 ms, plan 231 notes) is every visit, not
  only the first after a deploy.
- Stock on category pages is currently always fresh, because it is never cached.

## Proposed fix

Add `durable` to `Netlify-CDN-Cache-Control` on `index.astro`,
`category/[...slug].astro`, `news/index.astro`, `shop/all.astro`, `shop/sale.astro`
and `api/get-categories.ts` (one token each), update
`e2e/category-cache.stub.spec.ts`, which pins the exact header, and correct
`CLAUDE.md`. Optionally tag the listing pages (`Netlify-Cache-Tag: products`) so the
Square webhook's `purgeProductPages` reaches them too.

## Decisions needed before doing it

1. **The shared-nonce gap grows.** Plan 235 found that cached product pages share
   one CSP nonce across all visitors for the cache window. Caching home, news and
   category pages the same way extends that to most of the site. Either accept it
   (low exploitability, see plan 235) or move to a hash-based CSP first, which
   removes the problem and the router nonce mismatch together.
2. **Freshness changes, by design.** Category pages are untagged, so once cached
   the webhook purge does not reach them and stock there can lag up to about 6
   minutes (`s-maxage=300` plus `stale-while-revalidate=60`), the bound plan 221
   documented. News and home lag longer on purpose. Tagging them would narrow
   this.
3. **It cannot be verified locally.** Netlify's CDN is not reproducible on the dev
   server. Confirming it takes one deploy preview (`[preview]` in the commit
   message), i.e. one build, plus the same `curl` comparison as above.

## Method (to re-run)

Read-only GETs with `curl`, five per URL spaced a few seconds apart; read
`cache-status` (`Netlify Durable`, `Netlify Edge`), `age` and the CSP nonce. On this
Mac use `curl` rather than Python's `urllib` (its certificate store is empty) and
never disable verification; in zsh do not name a variable `path`.
