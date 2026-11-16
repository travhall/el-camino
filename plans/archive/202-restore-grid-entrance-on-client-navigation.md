# Plan 202: Restore the product-grid entrance animation on client-side navigation only

> **Executor instructions**: Follow step by step; run every verification command; on any STOP condition stop and report. Do NOT edit `plans/README.md`; report the outcome in your final message. **You cannot visually verify this change**: worktrees have no Square data, so category pages render no grid. Your deliverables are the code, unit tests, and a signal-detection measurement (Step 1) that works on ANY two pages. The operator does the visual check (see "Operator verification").
>
> **Drift check (run first)**: `git diff --stat 309d0a9..HEAD -- src/components/ProductGrid.astro src/lib/ui src/styles/global.css` — on any change, re-read the excerpts below; on a mismatch, STOP.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: MED (touches the grid's visibility path; the invariant below is non-negotiable)
- **Depends on**: none
- **Category**: direction (UX restore)
- **Planned at**: commit `309d0a9`, 2026-09-27

## Why this matters

Navigating between product category pages used to fade the cards in with a staggered entrance; now the grid appears instantly. That is a side effect of plan 177 (Half A, commit `2ad4001`, 2026-09-06), which deliberately made the server render the first 16 cards `opacity-100` so the grid is visible in the raw HTML — fixing a blank-then-pop first paint and a delayed LCP. Its side effect: `initializePageLoadAnimations()` in `ProductGrid.astro` selects `.product-card-wrapper.opacity-0` cards with `data-initial-index < 16` and not `display:none`; after 177 the visible initial cards are `opacity-100`, so that selector matches nothing and the function is a silent no-op. Filtering and scroll-reveal animations still work (they toggle classes themselves).

The maintainer wants the entrance back **on client-side navigation only**. Cold loads, no-JS visits and Lighthouse keep 177's behaviour exactly (server-visible cards, no animation). Soft navigations don't produce an LCP entry, so nothing measured is at risk.

## The invariant you must not break (from plans 148 and 177)

A card wrapper must **always end up visible on every path**: JS fails to run, JS runs but throws, reduced motion, script loaded late, image slow. Plan 177 additionally requires that the **server HTML is unchanged**: the first 16 cards carry `opacity-100` in the raw bytes. This plan adds a *client-only* "hide, then animate in" step and must therefore include its own independent guarantees (Step 3): try/catch restore, a hard timeout that force-reveals, reduced-motion skip. Read `plans/177-stop-rendering-whole-catalog-invisible.md` and the Maintenance notes of `plans/148-gate-card-entrance-on-image-readiness.md` first.

## Current state

`src/components/ProductGrid.astro` (script block starts ~line 313):
- SSR class (~line 190, **do not change**): ``class={`product-card-wrapper grid ${shouldHide ? 'opacity-0' : 'opacity-100'}`}``; hidden cards also carry inline `display: none`; every card has `data-initial-index={index}`; filter-hidden cards may carry `data-filter-hidden="true"`.
- CSS (~lines 84-145): `.product-card-wrapper` has `transition: opacity/transform var(--card-transition-duration)` and a stagger `transition-delay: calc(var(--animation-order, 0) * var(--product-stagger-delay))`; `.opacity-0` = `opacity:0; transform: scale(0.95) translate3d(0,10px,0); transition-duration:.15s; transition-delay:0s`; `.opacity-100` = full; `@media (scripting: none)` forces `.opacity-0` visible; `@media (prefers-reduced-motion: reduce)` disables the transitions.
- Timing vars in `src/styles/global.css:~445-472`: `--card-transition-duration` (0.5s desktop, 0.2s small), `--product-stagger-delay` (100ms / 30ms), `--grid-entrance-delay` (0ms desktop, 250ms mobile — head start for the nav-close animation).
- `initializePageLoadAnimations()` (~lines 363-427): collects `.product-card-wrapper.opacity-0` initial cards, skips under `prefersReducedMotion`, forces a reflow (`void grid.offsetHeight` — needed so the 0→1 transition fires; see the comment there), sets `--animation-order` (= column index within the row via `getCardsPerRowCurrent()`), adds `animating`, swaps `opacity-0`→`opacity-100`, clears `animating` after `duration + order*stagger`, pushing timeouts into the module-level `animationTimeouts` array.
- Lifecycle: `document.addEventListener('astro:page-load', …)` (~line 429) runs on every navigation and (when `ANIMATION_CONFIG.entranceDelay > 0`) defers `initializePageLoadAnimations()` by that many ms; a separate `DOMContentLoaded` fallback (~line 449) calls it directly; `astro:before-swap` (~line 983) tears down observers/timeouts and resets `isInitialized`. Existing comment (~line 387): `astro:page-load` fires inside the view-transition callback, i.e. in the same rendering frame as the DOM swap.
- Precedent for extracting testable DOM helpers out of an inline script: `src/lib/ui/cardEntrance.ts` (`armCardsOnImageReady`) with its test `src/components/__tests__/cardEntrance.test.ts`.
- Vitest: happy-dom, `src/**/__tests__/*.test.ts`; coverage `include` is `src/lib/**`.

## Design

At `astro:page-load` **on a client-side navigation only**, synchronously (so no frame is painted in between): find the *visible initial* cards (`opacity-100`, `data-initial-index < 16`, not `display:none`, not `data-filter-hidden="true"`), swap them to `opacity-0` **with their transitions suppressed for that swap** (inline `transition: none`), and let the existing reveal logic run — it forces a reflow, removes the inline `transition` override, then flips them back to `opacity-100` with the stagger (honouring `--grid-entrance-delay` on mobile). Server HTML is untouched, so cold loads / no-JS / crawlers see exactly what 177 ships. The arming step lives in a small pure helper so it can be unit-tested.

## Commands

| Purpose | Command | Expected |
|---|---|---|
| Typecheck | `pnpm check` | 0 errors |
| Lint | `pnpm lint` | exit 0 |
| Tests | `pnpm test:run` | all pass |
| Coverage | `pnpm test:coverage` | exit 0 |

## Scope

**In scope**: `src/lib/ui/gridEntrance.ts` (create), `src/lib/ui/__tests__/gridEntrance.test.ts` (create), `src/components/ProductGrid.astro` (script block, and the one stale CSS comment that says JS only re-triggers later).
**Out of scope**: the SSR class expression and everything in the frontmatter; `src/styles/global.css`; scroll-reveal and filtering code paths; `ArticleGrid.astro`; `filterCoordinator.ts`; the `@media (scripting: none)` and reduced-motion CSS rules (keep both); any change to how many cards are SSR-visible.

## Git workflow

Branch `advisor/202-grid-entrance-on-navigation`; conventional commits (`feat: animate product grid entrance on client-side navigation`, `test: cover grid entrance arming`). Do NOT push or open a PR.

## Steps

### Step 1: Find a reliable "this is a client-side navigation" signal (measure, don't assume)
The `astro:page-load` event fires on cold loads too, so you need a signal that distinguishes them. Candidates: (a) `document.readyState === 'complete'` at page-load (cold load is expected to be `'interactive'`); (b) `document.documentElement.dataset.astroTransition` being set; (c) a module-level flag set by an `astro:after-swap` listener — **unreliable**, because when the user arrives from a page without `ProductGrid` its script isn't loaded yet at swap time; (d) `performance.getEntriesByType('navigation')` — only describes real document loads, so likely useless. Measure (a) and (b) empirically: temporarily add (and later remove) a `document.addEventListener('astro:page-load', () => console.log('PL', document.readyState, document.documentElement.dataset.astroTransition))` in a scratch place (e.g. a throwaway inline script or `Layout.astro`, reverted afterwards), run the dev server with the CI stub env vars (see "Running Playwright here" in `plans/201-cart-zero-stock-treated-as-999.md` — temp config, cached `chromium_headless_shell-*` folder, `ci-stub` env, **no browser downloads**, use a free port and don't disturb any dev server already running on 4321), and log both for: a cold load of `/`, a client-side nav `/` → `/cart` via an in-page link click, back/forward (`history.back()`), and a reload. Any two pages that use the client router will do; you do not need product data.
**Verify**: write the 4-row table (scenario → readyState → astroTransition) in your final report and name the signal you chose. If NO signal separates cold load from client-side navigation, STOP and report the table.

### Step 2: Extract the arming helper
Create `src/lib/ui/gridEntrance.ts` exporting:
- `armInitialCardsForEntrance(root: ParentNode, maxIndex = 16): HTMLElement[]` — selects `.product-card-wrapper.opacity-100`, keeps those with `Number(dataset.initialIndex) < maxIndex`, `style.display !== 'none'` and `dataset.filterHidden !== 'true'`; for each, sets `style.transition = 'none'`, replaces `opacity-100` with `opacity-0`, and returns the list.
- `restoreCards(cards: HTMLElement[]): void` — for each card: removes `opacity-0`, adds `opacity-100`, removes the inline `transition` property and the `animating` class. Used by the safety paths.
The helper is pure DOM in / DOM out: no timers, no module globals, no `window` access.
**Verify**: `pnpm check` → 0 errors.

### Step 3: Wire it into `ProductGrid.astro` with independent guarantees
In the script block's page-load path: when the Step 1 signal says "client-side navigation" **and** `!prefersReducedMotion`, call `armInitialCardsForEntrance(document)` **synchronously in the `astro:page-load` handler** (before the `entranceDelay` timeout, so no frame is painted with the cards visible), keep the returned `armed` list, then let the existing `initializePageLoadAnimations()` do the reveal (its `.product-card-wrapper.opacity-0` selector matches the armed cards again). Inside `initializePageLoadAnimations()`, after its existing forced reflow and **before** flipping each card to `opacity-100`, remove the inline override (`htmlCard.style.removeProperty('transition')`) so the entrance transition runs. Add these guarantees, each independent of the others:
1. **try/catch**: wrap arming + scheduling; on any throw call `restoreCards(armed)`.
2. **hard timeout**: `setTimeout(() => restoreCards(armed.filter(c => c.classList.contains('opacity-0') && c.style.display !== 'none')), ANIMATION_CONFIG.entranceDelay + 1500)`, pushed into `animationTimeouts` so `cleanupObserversAndTimeouts()` clears it on the next navigation.
3. **reduced motion / no signal**: no arming at all — cards stay exactly as the server rendered them.
4. Do not touch `@media (scripting: none)` or the reduced-motion CSS rules.
Also update the stale CSS comment (~lines 125-129, "JS only re-triggers the transition later (scroll reveal, filtering)") to say JS also re-arms the initial batch on client-side navigation.
**Verify**: `pnpm check` → 0 errors; the SSR class line is untouched: `git diff -U0 src/components/ProductGrid.astro | grep -c "shouldHide ?"` → `0`.

### Step 4: Unit tests
`src/lib/ui/__tests__/gridEntrance.test.ts` (happy-dom; model on `src/components/__tests__/cardEntrance.test.ts`): build a small DOM of `.product-card-wrapper` articles and assert: (a) visible initial cards (`opacity-100`, index < 16) become `opacity-0`, get inline `transition: none`, and are returned; (b) cards with index ≥ 16, `style="display: none"`, or `data-filter-hidden="true"` are left untouched; (c) cards already `opacity-0` are not returned; (d) `restoreCards` returns every armed card to `opacity-100` and clears the inline `transition` and `animating`; (e) empty grid → returns `[]`, no throw.
**Verify**: `pnpm test:run src/lib/ui/__tests__/gridEntrance.test.ts` → all pass; `pnpm test:coverage` → exit 0.

### Step 5: Gates
**Verify**: `pnpm check`, `pnpm lint`, `pnpm test:run` exit 0; `git status` shows only in-scope files; no scratch logging remains: `grep -rn "console.log('PL'" src` → nothing.

## Operator verification (the maintainer does this with real Square data — the executor cannot)

On a real dev server with catalog data, in Chrome:
1. From `/` (or any non-grid page) click into a category → cards fade/stagger in; **no flash** of fully-visible cards before they animate (DevTools Performance screenshots if unsure).
2. Category → category via the nav → same.
3. Back/forward buttons → grid never left invisible.
4. Cold load / hard refresh of a category page → grid visible immediately, **no animation** (plan 177's behaviour).
5. macOS "Reduce motion" on → no animation, cards visible.
6. Mobile width (≤ ~640px) → ~250 ms head start, then the entrance.
7. JS disabled (DevTools) → grid visible.
8. Filtering and scroll-reveal still animate as before.
If step 1 shows a flash (visible → hidden → fade in), the page-load handler is running after first paint; see Maintenance notes.

## Done criteria

- [ ] `pnpm check`, `pnpm lint`, `pnpm test:run`, `pnpm test:coverage` exit 0
- [ ] Step 1's signal table is in the report and names the chosen signal
- [ ] SSR class expression untouched (Step 3 grep = 0); no scratch logging remains
- [ ] `git status` shows only `gridEntrance.ts`, its test, and `ProductGrid.astro`

## STOP conditions

- No reliable signal in Step 1.
- Arming/reveal requires editing the SSR class expression, `global.css`, or the filter/scroll code paths.
- You can't make the failure paths (try/catch, hard timeout) independent of the happy path.
- `initializePageLoadAnimations` has changed shape since the drift check (selectors or index cutoff).
- Port 4321 is in use by another dev server: pick another port for your run; never stop or reuse someone else's server.

## Maintenance notes

- **Fallback if the operator sees a flash**: the handler is running after paint (e.g. arriving from a page without `ProductGrid`, whose module script loads after the swap). Alternative design: a tiny listener in `Layout.astro` on `astro:after-swap` that sets an attribute on `<html>`, which a `ProductGrid` CSS rule uses to hide the initial cards until JS clears it — but that needs its own global safety net; do it as a separate plan.
- The invariant (always visible) now has these guarantees for this path: try/catch restore, `entranceDelay + 1500ms` force-reveal, reduced-motion skip, plus the existing `@media (scripting: none)` rule and the unchanged SSR HTML. Any refactor that removes one should replace it.
- Reviewer: confirm nothing here can run on a cold load, and that `cleanupObserversAndTimeouts()` clears the new timeout.
