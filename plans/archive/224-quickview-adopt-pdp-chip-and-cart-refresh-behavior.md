# Plan 224: Have QuickView delegate chip rendering/state and cart refresh to PDPUIManager

> **Executor instructions**: Follow step by step; run every verification. Write
> failing tests first. If a STOP condition occurs, stop and report. When done,
> update this plan's row in `plans/README.md`.

## Status

- **Priority**: P2
- **Effort**: S-M
- **Risk**: LOW-MED
- **Depends on**: —
- **Category**: a11y / consistency
- **Planned at**: commit `051257c`, 2026-11-16; from plan 183

## Why this matters

Fixes made to the product page's variant chips (#41, #42) never reached
QuickView, which keeps its own copy of the class strings and state logic:
- touch targets: PDP chips are 44 px (`min-w-11 min-h-11 px-3 py-2`), QuickView's
  about 30 px (`px-2.5 py-1.5`), also the single-value spans;
- sold-out state: QuickView stacks `opacity-60 line-through` on the selected
  fill, the low-contrast state #41 removed on the PDP;
- accessibility: no `aria-pressed`, no `"<value> — out of stock"` label;
- `handleCartUpdate` omits `keepQuantity: true`, so a cart refresh resets the
  chosen quantity.
`PDPUIManager.updateAttributeButtonStates` already takes a root selector and
QuickView already passes `#quick-view-attributes`, so QuickView can call it.

## Steps

1. Failing tests in `quickViewController-real.test.ts`: chips are at least 44 px
   (class contains `min-h-11`), a sold-out selected chip has the ring and no
   `opacity-60`, `aria-pressed` follows selection, a sold-out chip has the
   out-of-stock label, and a cart update keeps the quantity. **Verify**: fail on
   master.
2. Replace `QuickViewController.updateAttributeButtonStates` (`:639`) with a call
   to `this.uiManager.updateAttributeButtonStates(...)` and the shared predicate.
3. Build the initial chips (`renderVariations`, `:315`) with the same base class
   string `pdpUI` uses; export it from `pdpUI.ts` so the SSR page, `pdpUI` and
   QuickView share one definition.
4. Pass `{ keepQuantity: true }` from `handleCartUpdate`.
5. Check a QuickView opened on a product page, where PDP chips share
   `[data-attribute-type]`: the root selector must keep them apart (an existing
   test covers it; keep it green).
6. Gate: `pnpm check && pnpm lint && pnpm test:coverage && pnpm test:e2e:stub`;
   open QuickView on a real listing at a 375 px width and tap each chip.

## STOP conditions

- The shared chip style does not fit QuickView's modal layout (chips wrap badly
  at 375 px): report with a screenshot rather than shrinking the target.
