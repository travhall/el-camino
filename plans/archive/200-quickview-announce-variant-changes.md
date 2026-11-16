# Plan 200: QuickView announces variant changes to screen readers (same as the PDP)

> **Executor instructions**: Follow step by step; run every verification command; on any STOP condition stop and report. Do NOT edit `plans/README.md`; report the outcome in your final message.
>
> **Drift check (run first)**: `git diff --stat 1ca06c0..HEAD -- src/lib/product/quickViewController.ts src/lib/product/pdpUI.ts src/lib/product/pdpController.ts src/components/QuickView.astro` — on any change, re-read the excerpts below; on a mismatch, STOP.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plan 193 (merged — provides `PDPUIManager.announce`/`announceVariantChange`)
- **Category**: bug (accessibility)
- **Planned at**: commit `1ca06c0`, 2026-09-27

## Why this matters

Plan 193 made the PDP announce price/stock changes when a shopper picks a variant. QuickView (the desktop product panel) reuses the same `PDPUIManager` and has its own near-copy of the selection logic, but no live region, so picking a size in QuickView is still silent for screen-reader users. The manager already has the announcer; QuickView only needs a live-region element and one call.

## Current state

- `src/lib/product/pdpUI.ts` (from plan 193): `ElementIds` has `liveStatus?: string`; the manager caches `document.getElementById(ids.liveStatus || 'pdp-live-status')`; `announce(message)` (debounced 250 ms, writes `textContent`) and `announceVariantChange({ label, price, info })` (builds `"<label>, <price>, <state>"`).
- `src/lib/product/pdpController.ts` (from plan 193): private `announceSelection(variation | null)` computes `info` via `cart.getProductAvailability(productId, variationId, variation.quantity || 0)` (for a non-existent combination it passes `'out-of-stock'` and `0`), then calls `uiManager.announceVariantChange({ label: <selected values joined by ' '> || shown.name, price: shown.saleInfo?.salePrice ?? shown.price, info })`. It is called only from user-driven `handleAttributeSelection` / `handleVariationSelection`, never from initialize or cart sync. **Mirror this exactly.**
- `src/lib/product/quickViewController.ts:36-50` — `initializeUIManager()` builds `new PDPUIManager({ priceDisplay: 'quick-view-price', … cartQuantity: 'quick-view-cart-quantity' })` (no `liveStatus`). `:384-388` `handleAttributeSelection(attributeType, value)` sets `selectedAttributes`, calls `updateCurrentVariation()` then `updateAttributeButtonStates()`. Variation-button selection (`~:334-340`, `~:689`) should be checked for a separate handler.
- `src/components/QuickView.astro` — no `role="status"`/`aria-live` element; product content block `#quick-view-product` (~line 74), price `#quick-view-price` (~139), availability indicator `#quick-view-availability-indicator` (~186).
- Precedent for the element: `<p id="pdp-live-status" class="sr-only" role="status" aria-live="polite" aria-atomic="true"></p>` in `src/pages/product/[id].astro` (~line 695).
- Tests: `src/lib/product/__tests__/pdpUI.test.ts` (announce tests, fake timers) and `quickViewController.test.ts` / `quickViewController-real.test.ts` — model on the plan-193 tests in `pdpController-real.test.ts`.

## Commands

`pnpm check` (0 errors), `pnpm lint` (exit 0), `pnpm test:run`, `pnpm test:coverage` (exit 0).

## Scope

**In scope**: `src/lib/product/quickViewController.ts`, `src/components/QuickView.astro` (one element), `src/lib/product/__tests__/quickViewController*.test.ts` (add tests).
**Out of scope**: `pdpUI.ts` and `pdpController.ts` (do not modify — reuse; if something is missing, STOP), the plan-183 consolidation of the two controllers, styling.

## Git workflow

Branch `advisor/200-quickview-announce`; commit `fix(a11y): announce QuickView variant changes`. Do NOT push or open a PR.

## Steps

### Step 1: Add the live region
In `QuickView.astro`, inside `#quick-view-product` next to the price, add `<p id="quick-view-live-status" class="sr-only" role="status" aria-live="polite" aria-atomic="true"></p>`. It must be present in the DOM before content is written (server-rendered — fine).
**Verify**: `grep -c 'id="quick-view-live-status"' src/components/QuickView.astro` → `1`.

### Step 2: Wire the manager and announce
In `initializeUIManager()` add `liveStatus: 'quick-view-live-status'`. Add a private `announceSelection()` in `quickViewController.ts` modelled on `pdpController.ts`'s (same label/price/info computation, using this controller's `productData`, `selectedAttributes`, `currentVariation`), and call it at the end of `handleAttributeSelection` and of the variation-button selection handler if one exists. Do NOT call it when the panel opens or on cart updates.
**Verify**: `pnpm check` → 0 errors; `grep -n "announceSelection" src/lib/product/quickViewController.ts` → the definition plus the call site(s), none inside open/initialize/cart-update paths.

### Step 3: Tests
Add tests (following the plan-193 tests): selecting an attribute triggers `announceVariantChange` (spy on `uiManager` or assert the live region text after `vi.advanceTimersByTime(250)`); opening the panel triggers no announcement; a non-existent combination announces out of stock.
**Verify**: `pnpm test:run` → all pass; `pnpm test:coverage` → exit 0.

## Test plan

Step 3, plus manual VoiceOver: open QuickView from a grid, change size, hear "<value>, $X.XX, in stock, N available".

## Done criteria

- [ ] `pnpm check`, `pnpm lint`, `pnpm test:run`, `pnpm test:coverage` exit 0
- [ ] `git status` shows only the three in-scope areas changed
- [ ] No call to `announce*` from panel-open/init/cart-update paths

## STOP conditions

- `PDPUIManager` in `pdpUI.ts` no longer has `announceVariantChange`/`liveStatus` (drift), or reusing it would require modifying `pdpUI.ts`.
- QuickView's selection state differs enough that the label/price/state can't be computed the way the PDP does without new logic in shared code.

## Maintenance notes

Plan 183 (collapse the duplicate PDP/QuickView state machine) will fold this into one controller — keep `announceSelection` a near-verbatim copy of the PDP's so that merge is mechanical. Reviewer: verify no announcement on panel open.
