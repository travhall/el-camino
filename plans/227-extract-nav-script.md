# Plan 227: Extract Nav.astro's inline script to src/scripts

> **Executor instructions**: Follow step by step; run every verification. If a
> STOP condition occurs, stop and report. When done, update this plan's row in
> `plans/README.md`. Read plan 181's findings first: the recipe, hazards and
> test pattern come from its PoC (`src/scripts/modal-client.ts` and its test).

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: MED
- **Category**: tech-debt
- **Planned at**: commit `051257c`, 2026-11-16; from plan 181

## Why this matters

`Nav.astro` has 512 inline script lines with `astro:before-swap` wiring and is
on every page, so lifecycle regressions are immediately visible. Pay particular
attention to listener cleanup across navigations.

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
