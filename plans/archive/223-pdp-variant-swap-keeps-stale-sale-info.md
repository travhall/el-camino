# Plan 223: Fix the PDP leaving the first variation's sale info on the add-to-cart data

> **Executor instructions**: Follow step by step; run every verification. Write
> the failing test first. If a STOP condition occurs, stop and report. When done,
> update this plan's row in `plans/README.md`.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: —
- **Category**: bug
- **Planned at**: commit `051257c`, 2026-11-16; found by plan 183

## Why this matters

On a product page, `PDPController.updateButtonProductData`
(`src/lib/product/pdpController.ts:105-121`) updates `variationId`,
`variationName`, `price`, `image` and `unit` on the add-to-cart button's
`data-product` when the shopper swaps variants, but never `saleInfo`. The button
starts with the initially selected variation's `saleInfo`
(`src/pages/product/[id].astro:1115`) and keeps it.

Reproduced with a throwaway unit test: a $20 sale variation swapped for a $30
non-sale one leaves `saleInfo.salePrice = 2000` on the button data.
`cart.addItem` (`src/lib/cart/index.ts:490-526`) takes `fetchedSaleInfo ??
item.saleInfo`; `/api/sale-info` returns nothing for a non-sale variation, so the
stale value is kept, and `getTotal()` (`:288`) uses `saleInfo.salePrice ?? price`.
The shopper would then see the sale price in the cart for an item that is not on
sale. Checkout totals are computed by the server (confirm in Step 1). QuickView
does not have the bug: its `buildProductData` sets `saleInfo` per variation.

## Steps

1. Confirm the cart consequence end to end: swap, add, read `cart.getItems()`
   and the mini-cart total; and confirm what `/api/calculate-cart` charges.
   **Verify**: record both the displayed and the charged amount.
2. Add a failing test to `pdpController-real.test.ts`: swapping from a variation
   with `saleInfo` to one without leaves no `saleInfo` in the data passed to
   `uiManager.updateButtonProductData`; swapping to one with `saleInfo` sets
   that variation's. **Verify**: fails on master.
3. In `updateButtonProductData`, set `productData.saleInfo = variation.saleInfo`
   (deleting the key when absent).
4. Decide separately whether `cart.addItem` should trust `item.saleInfo` at all
   when the server answered "not on sale": that is a second change; do not mix.
5. Gate: `pnpm check && pnpm lint && pnpm test:coverage && pnpm test:e2e:stub`.

## STOP conditions

- Step 1 shows the charged amount is also wrong: report immediately, before
  fixing.
