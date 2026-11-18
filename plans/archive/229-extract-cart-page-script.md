# Plan 229: Extract pages/cart.astro's inline script to src/scripts

> **Executor instructions**: Done (2026-11-18). Kept as a record; see "Outcome".
> Original instructions: follow step by step; run every verification. If a
> STOP condition occurs, stop and report. When done, update this plan's row in
> `plans/README.md`. Read plan 181's findings first: the recipe, hazards and
> test pattern come from its PoC (`src/scripts/modal-client.ts` and its test).

## Status

- **Priority**: P3
- **Effort**: L
- **Risk**: HIGH
- **Category**: tech-debt
- **Planned at**: commit `051257c`, 2026-11-16; from plan 181

## Why this matters

954 inline lines of cart mutation and totals, the largest in the repo, uncovered.
Do after 228. Same money-path verification requirement. Plan 223's saleInfo
fix and plan 161's image-URL consolidation touch the same data; land them first.

## Recipe (from the PoC)

1. Move the inline script body to `src/scripts/<name>.ts` as a move, not a
   rewrite; export `init()` guarded so it runs once; keep `astro:page-load` and
   `astro:before-swap` wiring and any `import.meta.hot.dispose`.
2. Leave `import { init } from '@/scripts/<name>'; init();` in the `.astro`.
3. Tests with happy-dom, `vi.resetModules()` per test (module singletons), one
   test for each lifecycle hook.
4. Verify in a browser on the dev server and on a `PREVIEW=true` production
   build: behavior before and after a client-side navigation, no
   `securitypolicyviolation`, no console errors.
5. Gate: `pnpm check && pnpm lint && pnpm test:coverage && pnpm build &&
   pnpm test:e2e:stub`. Do not change `src/middleware.ts` to make a script run.

## STOP conditions

- Behavior differs after a client-side navigation, or a CSP violation appears.
- Duplicated helpers (money, image URLs, filter params) tempt a cleanup: record
  them, do not fix them in the same change.

## Outcome (2026-11-18)

The 953-line hoisted script moved unchanged to `src/scripts/cart-page-client.ts`;
`cart.astro` is now `import { init } from '@/scripts/cart-page-client'; init();`.
The single `astro:page-load` registration and the `import.meta.hot.dispose` cleanup
sit in a guarded `init()`.

**Proved a move**: a character-multiset comparison of the old body and the module
(comments, quotes and whitespace normalised) differs only by the 84 characters of the
`initialized` guard and the `init()` wrapper, plus one trailing comma Prettier dropped
when the code lost two spaces of indent.

**Tests**: `cart-page-client.test.ts`, 109 tests, written first (the module did not
exist, so the file failed to load). The cart (`@/lib/cart`) and `showNotification` are
mocked; `fetch` is stubbed per URL. They cover: init and its guard; the empty cart;
rendering (links, escaping of titles, variation names and image URLs, logo fallback,
sale price and discount label, gift-card event, mobile bar); inventory (what is
requested, "Only N left", out of stock, the 99 fallback, the gift-card cap); the quantity
buttons and typed quantities (debounce, clamping); remove and Undo (every outcome);
the order summary (server totals, FREE, Calculating, both fallbacks, the 400 ms
debounce); the fulfillment callback and the checkout buttons; checkout (shipping and
pickup bodies, every required field, missing forms, server errors, `cartUpdated`,
stock message and its 3 s wait, pending order id, overlay); clear cart and its Undo;
page-load behaviour.

**Mutation checks**: 35 mutations applied by hand (money maths, stock limits,
debounce delays, required fields, validity gating, redirect, pending order id,
reconcile, guards). 31 died on the first run; four survived (the `<=` stock boundary,
checkout allowed with the valid flag unset on either button, the valid flag not reset on
page-load, the "Only N left" threshold) and the 4 tests added for them kill them. Not
testable: `import.meta.hot.dispose` (no HMR under vitest).

**Verification**: `pnpm check`, `lint`, `format:check`, `test:coverage` (2006 tests, all
files 85.63 / 73.59 / 85.14 / 87.12), `pnpm build` (the script is still emitted as an
external `_astro` file) and `test:e2e:stub` (117) pass. `e2e/money-path.spec.ts` on
Chromium and Mobile Chrome: 11 passed, 11 skipped before and after (Firefox and WebKit
are not installed here, so they did not run). Browser pane on the dev server: a seeded
cart renders after a direct load and after client-side navigation (same document, no
reload), a second visit does not double-bind (one click removes one line), no console
errors.

**CSP**: going from `/cart` to `/` the first time logs one `script-src-elem`
violation (`inline`, `transitions-router` line 89). It is identical with the original
`cart.astro` (checked by swapping the file back), so it is not from this change: it is
the home page's `ArticleGrid` inline script, the known, harmless exception in plan 235.

## Recorded, not fixed (STOP condition: do not clean up in the same change)

- **Bug (fixed afterwards in plan 238, same branch): a line's subtotal did not update when its quantity changes.**
  `updateCartItemQuantity` looks for `.font-display.font-bold.text-2xl`, but the
  markup is `text-xl md:text-2xl`, so nothing matches and the line keeps its old
  total while the order summary is right. Measured in a test: after one increase the
  line still said `$60.00` and the summary `$120.00`. The code is identical in the
  original script. Needs its own plan with a failing test first.
- Duplicated helpers: the `${item.id}:${item.variationId}` key is built 8 times and
  `MoneyUtils.format(MoneyUtils.fromFloat(x))` 13 times in this file.
- The float-versus-cents rounding mismatch recorded in plan 228 (3 x $0.10 plus
  3 x $24.90 is 74.99999999999999) also applies to `cart.getTotal()` here.
