# Plan 206: Add screen-reader labels distinguishing regular vs. sale price on the PDP

> **Executor instructions**: Follow step by step; run every verification command; on any STOP condition stop and report. Do NOT edit `plans/README.md`; report the outcome in your final message. **This is a non-visual, non-layout change** — do not alter any visible text, spacing, color, or the strikethrough/badge treatment. If a step seems to require a visual change, stop and report rather than making one.
>
> **Drift check (run first)**: `git diff --stat 45060e2..HEAD -- src/pages/product/\[id\].astro src/lib/product/pdpUI.ts` — on a mismatch, re-read the excerpts below before proceeding.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW (adds `aria-label` attributes only; no markup structure, class, or text-content change)
- **Depends on**: none
- **Category**: bug (accessibility)
- **Planned at**: commit `45060e2`, 2026-09-27

## Why this matters

When a product is on sale, the PDP shows the struck-through original price directly above the sale price (plus a separate "N% Off" badge on the image). Sighted users read this as a before/after pair from the strikethrough styling and layout alone. A screen reader has no equivalent signal: it announces two dollar amounts back to back with nothing establishing which is which. This is an `aria-label` addition only — no visible text, spacing, or color changes, so it doesn't add the visual density the maintainer explicitly wants to avoid.

## Current state

- `src/pages/product/[id].astro:663-688` — the price block, server-rendered:
  ```astro
  <div class="mb-6">
    {/* Original price strikethrough when on sale */}
    <div
      id="original-price-display"
      class:list={[
        'text-lg text-(--content-meta) line-through',
        !isOnSale || !formattedOriginalPrice ? 'hidden' : '',
      ]}
    >
      {formattedOriginalPrice || ''}
    </div>
    {/* Sale/Regular price */}
    <p
      id="price-display"
      class="text-4xl lg:text-5xl xl:text-6xl font-display font-bold text-(--content-emphasis)"
    >
      {formattedPrice}
      {/* Unit display */}
      {
        unitDisplay && (
          <span class="text-xl ps-1" id="unit-display">
            {unitDisplay}
          </span>
        )
      }
    </p>
    ...
  ```
  Neither element has an `aria-label` today.
- `src/lib/product/pdpUI.ts:279-326` — `updatePriceDisplay(price, options)`, called on every variant change. It sets `textContent` on both elements (and toggles `originalPriceDisplay`'s `hidden` class) but never touches `aria-label` — so any label added only in the SSR markup would go stale (announce the pre-variant-change price) the first time the user switches variants. **This function must be updated too, not just the `.astro` markup**, or the fix only works on first paint.
- `MoneyUtils.format(...)` (imported in both files) already produces the exact display string (e.g. `"$63.95"`) — reuse its output for the label text, don't reformat separately.

## Commands

| Purpose | Command | Expected |
|---|---|---|
| Typecheck | `pnpm check` | 0 errors |
| Lint | `pnpm lint` | exit 0 |
| Tests | `pnpm test:run` | all pass |

## Scope

**In scope**:
- `src/pages/product/[id].astro` (add `aria-label` to the two price elements, lines 663-688 only)
- `src/lib/product/pdpUI.ts` (`updatePriceDisplay`, lines 279-326 — set the matching `aria-label` alongside each `textContent` write)
- `src/lib/product/__tests__/pdpUI.test.ts` (extend existing price-display tests)

**Out of scope**: any visible styling, the sale badge (`data-overlay="sale"`, `updateImageOverlay` in `pdpUI.ts:209-239` — already text content "N% Off", no ambiguity there, leave it alone), the unit-display span, `[id].astro`'s image-overlay JSX.

## Git workflow

Branch `advisor/206-sr-only-price-labels`; conventional commits (e.g. `fix: label regular/sale price for screen readers`, `test: cover updatePriceDisplay aria-label`). Do NOT push or open a PR.

## Steps

### Step 1: SSR markup

In `src/pages/product/[id].astro:665-673`, add to the `original-price-display` div:
```astro
aria-label={isOnSale && formattedOriginalPrice ? `Regular price ${formattedOriginalPrice}` : undefined}
```
(Only meaningful while visible — `undefined` when hidden is fine since the element is also `hidden`/not exposed.)

In `src/pages/product/[id].astro:675-679`, add to the `price-display` `<p>`:
```astro
aria-label={isOnSale ? `Sale price ${formattedPrice}` : undefined}
```
Leave it `undefined` (no override) when not on sale — the plain price needs no extra label, the visible text is already unambiguous on its own.

**Verify**: `pnpm check` → 0 errors.

### Step 2: Client-side update path

In `src/lib/product/pdpUI.ts`, `updatePriceDisplay` (lines 279-326):
- Where `originalPriceDisplay.textContent` is set (inside the `if (saleInfo)` branch, ~line 292-295), also set:
  ```ts
  originalPriceDisplay.setAttribute(
    'aria-label',
    `Regular price ${MoneyUtils.format(MoneyUtils.fromFloat(saleInfo.originalPrice))}`
  );
  ```
- Where `priceDisplay.textContent` is set for the sale case (~line 298-300), also set:
  ```ts
  priceDisplay.setAttribute(
    'aria-label',
    `Sale price ${MoneyUtils.format(MoneyUtils.fromFloat(saleInfo.salePrice))}`
  );
  ```
- In the non-sale (`else`) branch (~line 301-309), remove any stale label so a variant switch from "on sale" to "not on sale" doesn't leave an old announcement behind:
  ```ts
  priceDisplay.removeAttribute('aria-label');
  ```
  and, where `originalPriceDisplay.classList.add('hidden')` already runs (~line 307-309):
  ```ts
  originalPriceDisplay.removeAttribute('aria-label');
  ```

Watch the existing comment at `pdpUI.ts:312-317` — `priceDisplay.textContent = ...` (via the `formattedPrice` assignment above it) clears all children including the `#unit-display` span, which is then re-appended. Setting `aria-label` on `priceDisplay` itself (an attribute, not a child) is unaffected by this and can be set either before or after that re-append — order doesn't matter here, but keep the label-setting lines next to the `textContent` lines they correspond to for readability.

**Verify**: `pnpm check` → 0 errors.

### Step 3: Tests

In `src/lib/product/__tests__/pdpUI.test.ts`, extend (or add alongside) the existing `updatePriceDisplay` test coverage:
- Sale case: after calling `updatePriceDisplay(price, { saleInfo })`, assert `priceDisplay.getAttribute('aria-label')` contains `"Sale price"` and the formatted sale price string, and `originalPriceDisplay.getAttribute('aria-label')` contains `"Regular price"` and the formatted original price string.
- Non-sale case: after calling `updatePriceDisplay(price)` with no `saleInfo`, assert neither element has an `aria-label` (or that any prior one was removed — simulate a sale→non-sale transition by calling the sale case first, then the non-sale case, and assert the labels are gone).
- Model the test structure on whatever existing `describe('updatePriceDisplay', ...)` block is already in this file.

**Verify**: `pnpm test:run src/lib/product/__tests__/pdpUI.test.ts` → all pass, including the new cases.

### Step 4: Gates

**Verify**: `pnpm check`, `pnpm lint`, `pnpm test:run` all exit 0; `git status` shows only `[id].astro`, `pdpUI.ts`, and the test file changed; visually confirm in a browser (or by reading the rendered classes) that no `class`, layout, or text-content changed — only `aria-label` attributes were added/removed.

## Done criteria

- [ ] `pnpm check`, `pnpm lint`, `pnpm test:run` exit 0
- [ ] New/updated tests in `pdpUI.test.ts` pass
- [ ] `git diff` shows no changes to any `class`, `class:list`, or visible text — only `aria-label` add/remove
- [ ] A sale→non-sale variant switch removes both stale labels (covered by the Step 3 test)

## STOP conditions

- The excerpts above don't match the live code (drift check).
- Achieving the label requires restructuring the DOM (e.g. wrapping both prices in a new container) rather than adding attributes to the existing two elements — stop and report, don't restructure.

## Maintenance notes

- If a future change adds more price-adjacent states (e.g. a "was/was/now" three-tier promo), extend this same `aria-label` pattern rather than introducing visible "Regular:"/"Sale:" text labels, per the maintainer's explicit preference for zero added visual density here.
- Reviewer: confirm no visible diff by loading a sale product before/after in a browser — screenshots should be pixel-identical.
