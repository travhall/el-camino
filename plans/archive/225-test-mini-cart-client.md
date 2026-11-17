# Plan 225: Test src/scripts/mini-cart-client.ts so src/scripts can enter the coverage gate

> **Executor instructions**: Follow step by step; run every verification. If a
> STOP condition occurs, stop and report. When done, update this plan's row in
> `plans/README.md`. Read plan 181's findings first: the recipe, hazards and
> test pattern come from its PoC (`src/scripts/modal-client.ts` and its test).

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Category**: tech-debt
- **Planned at**: commit `051257c`, 2026-11-16; from plan 181

## Why this matters

`mini-cart-client.ts` is 779 lines at 0% coverage, and with `imageShimmer.ts` and
`initDeviceDetection.ts` it is why adding `src/scripts/**` to the coverage
`include` drops measured coverage from 79.6/69.6/80.0/81.0 to 73.5/64.5/75.3/74.7,
below the 77/67/77/78 thresholds (plan 181, Step 5). This plan adds tests until
the `include` can ship without re-baselining. Cart totals, undo bar and focus
management live here.

## Steps

1. Characterize the module the way `quickViewController-real.test.ts` does:
   real happy-dom DOM, `cart` stubbed. Cover render, remove-with-undo, quantity
   change, open/close focus restore, and `astro:page-load` re-init.
2. Add tests for `imageShimmer.ts` and `initDeviceDetection.ts`.
3. Add `src/scripts/**/*.ts` to the coverage `include` in the same change and
   confirm the gate still passes. If it does not, report the numbers; do not
   re-baseline silently.

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
