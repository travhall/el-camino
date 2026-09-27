# Plan 203: Make PDP variant-chip availability combination-aware on first render

> **Executor instructions**: Follow step by step; run every verification command; on any STOP condition stop and report. Do NOT edit `plans/README.md`; report the outcome in your final message.
>
> **Drift check (run first)**: `git diff --stat 45060e2..HEAD -- src/pages/product/\[id\].astro src/lib/square/variationParser.ts` — on any change, re-read the excerpts below; on a mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW (additive helper + swap one block; no change to selection/cart logic)
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `45060e2`, 2026-09-27

## Why this matters

The PDP has two independent implementations of "is this attribute value available," and only one of them is correct. The client-side one, `PDPController.updateAttributeButtonStates` (`src/lib/product/pdpController.ts:286-309`), builds a candidate `testAttributes` object (current selection + the value being evaluated) and calls `findVariationByAttributes` — i.e. it checks whether **that specific combination** is in stock. The server-rendered initial state, in `src/pages/product/[id].astro`, does not: it marks a value "available" if **any** variation with that value is in stock, regardless of the other currently-selected attributes (e.g. it would show a size as available while the selected color has zero stock in that size). On the two live data sets this session, the effect happened to be invisible (whichever color was out of stock was out of stock in *every* size, so the two computations agreed by coincidence) — but the code path is wrong independent of today's data, and the failure mode is a customer selecting a chip that looks available, landing on "Sold Out," and not knowing why. This also means the server-rendered state can silently disagree with the state the client recomputes on the very first click, which is confusing on its own.

## Current state

- `src/pages/product/[id].astro:740-746` — the buggy block, inside the multi-value attribute-chip loop (`attributeTypes.map(...)`, starts `~706`):
  ```astro
  const isAvailable = variations.some((variation) => {
    if (!variation.attributes || !variation.inStock)
      return false;
    return (
      variation.attributes[attributeType] === value
    );
  });
  ```
  This ignores `selectedVariation`/every other currently-selected attribute.
- `src/lib/product/pdpController.ts:286-309` — the correct client-side version, for reference (do not change this file):
  ```ts
  private updateAttributeButtonStates(): void {
    this.uiManager.updateAttributeButtonStates(
      this.productData.availableAttributes,
      this.selectedAttributes,
      (attributeType: string, value: string): boolean => {
        const testAttributes = {
          ...this.selectedAttributes,
          [attributeType]: value,
        };
        const matchingVariation = findVariationByAttributes(
          this.productData.variations,
          testAttributes
        );
        return Boolean(
          matchingVariation?.inStock &&
          cart.canAddToCart(
            this.productData.productId,
            matchingVariation.variationId,
            matchingVariation.quantity || 0
          )
        );
      }
    );
  }
  ```
- `src/lib/square/variationParser.ts:219-235` — `findVariationByAttributes(variations, selectedAttributes)`: returns the first variation whose `attributes` match every key/value pair in `selectedAttributes` (exact match, `Object.entries(...).every(...)`). This is the shared building block to reuse.
- `src/pages/product/[id].astro:277-278` — `selectedVariation` already exists in scope at the point the chip loop runs (declared before the JSX, line 277): `const selectedVariation = variations.find((v) => v.variationId === defaultVariationId) || variations[0];` — use its `attributes` as the "currently selected" baseline, the same way `pdpController`'s `selectedAttributes` does.
- Repo convention: shared matching logic lives in `variationParser.ts` as an exported pure function with colocated unit tests in `src/lib/square/__tests__/variationParser.test.ts` — follow the existing style of `findVariationByAttributes` (JSDoc block, plain exported function, no classes).

## Commands

| Purpose | Command | Expected |
|---|---|---|
| Typecheck | `pnpm check` | 0 errors |
| Lint | `pnpm lint` | exit 0 |
| Tests | `pnpm test:run` | all pass |
| Coverage | `pnpm test:coverage` | exit 0 |

## Scope

**In scope**:
- `src/lib/square/variationParser.ts` (add one exported function)
- `src/lib/square/__tests__/variationParser.test.ts` (add tests for it)
- `src/pages/product/[id].astro` (replace the block at lines 740-746 with a call to the new function; add the import)

**Out of scope**:
- `src/lib/product/pdpController.ts` — its logic is already correct. You may leave a `// TODO` pointing at the new shared helper as a follow-up, but do not refactor it in this plan (see Maintenance notes).
- The single-value display branches (`!hasMultipleVariations`, lines 782-836) — they render a non-interactive, always-"selected" span and have no availability computation to fix.
- Cart logic, `cart.canAddToCart`, inventory fetching, or anything under `src/lib/cart/`.

## Git workflow

Branch `advisor/203-combination-aware-variant-availability`; conventional commits (e.g. `fix: make PDP variant-chip availability combination-aware`, `test: cover isAttributeValueAvailable`). Do NOT push or open a PR.

## Steps

### Step 1: Add the shared helper to `variationParser.ts`

Add, near `findVariationByAttributes` (after it, ~line 236):

```ts
/**
 * Check whether a specific attribute value is reachable (in stock) given the
 * currently-selected values of every OTHER attribute. Unlike a bare "does any
 * variation with this value have stock" check, this respects the current
 * selection — e.g. asking "is size 30 available" while color=Denim is
 * selected only returns true if the 30/Denim combination itself is in stock.
 *
 * @param variations - Full variation list (each must have `.attributes` and `.inStock` populated)
 * @param currentAttributes - The attributes currently selected elsewhere on the page (e.g. color)
 * @param attributeType - The attribute type being evaluated (e.g. 'size')
 * @param value - The candidate value for that attribute type
 * @returns true if the resulting combination exists and is in stock
 */
export function isAttributeValueAvailable(
  variations: ProductVariation[],
  currentAttributes: Record<string, string>,
  attributeType: string,
  value: string
): boolean {
  const candidate = { ...currentAttributes, [attributeType]: value };
  const match = findVariationByAttributes(variations, candidate);
  return Boolean(match?.inStock);
}
```

`ProductVariation` is already imported in this file (used by other exported functions) — reuse it, don't re-import.

**Verify**: `pnpm check` → 0 errors.

### Step 2: Unit tests

In `src/lib/square/__tests__/variationParser.test.ts`, add a `describe('isAttributeValueAvailable', ...)` block modeled on the existing `findVariationByAttributes` tests in the same file. Cover:
- Combination in stock → `true`.
- Combination exists but `inStock: false` → `false`.
- Combination does not exist at all (no variation has that pairing) → `false`.
- Two-axis product where value A is in stock for color X but not color Y — assert the function returns different results depending on `currentAttributes.color`, i.e. it is NOT equivalent to "any variation with this value is in stock" (this is the regression test for the bug this plan fixes).
- Empty `currentAttributes` (only the axis being evaluated matters, e.g. single-axis product) → matches any variation with that value in stock.

**Verify**: `pnpm test:run src/lib/square/__tests__/variationParser.test.ts` → all pass, including the new cases.

### Step 3: Wire it into `[id].astro`

Add `isAttributeValueAvailable` to the existing import from `@/lib/square/variationParser` (`src/pages/product/[id].astro:13-16`, currently imports `createInitialSelectionState, getAttributeDisplayName`).

Replace lines 740-746:
```astro
const isAvailable = variations.some((variation) => {
  if (!variation.attributes || !variation.inStock)
    return false;
  return (
    variation.attributes[attributeType] === value
  );
});
```
with:
```astro
const isAvailable = isAttributeValueAvailable(
  variations,
  selectedVariation?.attributes ?? {},
  attributeType,
  value
);
```

Do not change anything else in that `.map()` block (the `isSelected` line right below it, and everything in the returned JSX, stays as-is).

**Verify**: `pnpm check` → 0 errors; `grep -n "variations.some" src/pages/product/\[id\].astro` → confirm by eye that any remaining hits are unrelated code elsewhere in the file, not the chip-loop block you just replaced.

### Step 4: Gates

**Verify**: `pnpm check`, `pnpm lint`, `pnpm test:run`, `pnpm test:coverage` all exit 0; `git status` shows only the three in-scope files changed.

## Operator verification (the maintainer does this with real Square data — the executor cannot easily construct a live multi-axis partial-stock product)

1. Find or seed a product with 2 attribute axes (e.g. size × color) where the same size is in stock for one color but not another.
2. Load the PDP with a color selected whose current size is out of stock. Confirm that size's chip renders struck-through/unavailable **on first paint** (no click needed) — before this fix it would render as available.
3. Click through a couple of combinations and confirm the chip state never contradicts what happens when you click it (no "available-looking chip lands on Sold Out").

## Done criteria

- [ ] `pnpm check`, `pnpm lint`, `pnpm test:run`, `pnpm test:coverage` exit 0
- [ ] New tests in `variationParser.test.ts` pass, including the two-axis regression case
- [ ] `src/pages/product/[id].astro` no longer computes chip availability inline with `variations.some(...)` in the multi-value attribute loop
- [ ] `git status` shows only `variationParser.ts`, its test file, and `[id].astro` changed

## STOP conditions

- `selectedVariation` is undefined/null at the point the chip loop runs (shouldn't happen given line 277-278, but if the data shape has changed, stop rather than guessing a fallback).
- `ProductVariation`'s `attributes` field is typed differently than `Record<string, string>` in a way that breaks the new function's signature.
- The excerpts in "Current state" don't match what's on disk (see drift check above).

## Maintenance notes

- `pdpController.ts:286-309` still has its own inline version of this same check (correct, but duplicated). A natural follow-up is refactoring it to call `isAttributeValueAvailable` too, so there's one source of truth — left out of this plan to keep the diff small and low-risk. Note it as a `// TODO(plan 203): share with isAttributeValueAvailable` comment if you want, but don't perform the refactor.
- Reviewer: confirm the new function is pure (no DOM, no fetch) and that the `.astro` change is a straight swap with no behavior change to `isSelected` or the JSX below it.
