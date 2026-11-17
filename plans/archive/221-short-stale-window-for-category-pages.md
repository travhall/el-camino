# Plan 221: Give category pages a short stale-while-revalidate instead of 0

> **Executor instructions**: Follow step by step; run every verification. If a
> STOP condition occurs, stop and report. When done, update this plan's row in
> `plans/README.md`.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW-MED (stock shown up to 60 s stale)
- **Depends on**: —
- **Category**: perf
- **Planned at**: commit `051257c`, 2026-11-16; from plan 176 Step 5

## Why this matters

`src/pages/category/[...slug].astro:58-62` sets `stale-while-revalidate=0`, so
when the 300 s TTL expires the visitor who arrives next waits for a full cold
render: 1.66 s on a local cold run against the Sandbox catalog, and unknown
(plan 214 saw 3.5-7.4 s cold first bytes) on a cold function. The comment gives
stale stock as the reason, but `shop/all`, `/shop/sale` and `/` already serve
stale for 900-1800 s and also show stock, so the category page is the
inconsistent one.

## Steps

1. Change both headers to `s-maxage=300, stale-while-revalidate=60`. Keep
   `no-cache` on the browser header. Update the comment above them.
2. Check how listing pages are purged: `purgeProductPages` tags product pages
   only (see CLAUDE.md); confirm category pages are not tagged, so the window
   is the only staleness bound. **Verify**: state it in the PR.
3. Test: a unit or e2e assertion on the response headers for `/category/*`.
   **Verify**: it fails before the change.
4. Gate: `pnpm check && pnpm lint && pnpm test:coverage`.

## STOP conditions

- Tyler or Travis wants stock on category pages never to be stale: close the
  plan and delete the inconsistency in the other direction (tighten `shop/all`),
  as a separate decision.
