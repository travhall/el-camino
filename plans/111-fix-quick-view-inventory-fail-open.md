# Plan 111: Fix Quick View inventory fail-open and remove dead fallback branch

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 8ff3096..HEAD -- src/pages/api/quick-view-product.ts src/lib/square/productMapper.ts`
> If either file changed since this plan was written, compare the "Current
> state" excerpts below against the live file before proceeding; on a
> mismatch, treat it as a STOP condition — this plan's dead-code claim in
> particular depends on `productMapper.ts`'s current guard clause, which
> must be re-verified if that file changed.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `8ff3096`, 2026-08-06

## Why this matters

`src/pages/api/quick-view-product.ts` (the API backing the Quick View modal)
has two inventory-related issues, both confirmed by reading the code:

1. **Fail-open on error** (real, reachable): when `checkBulkInventory`
   throws, the `catch` block marks every variation as `inStock: true,
   quantity: 999` instead of failing closed. This inverts the fail-closed
   convention used everywhere else (`checkBulkInventory` itself is designed
   to never throw and already fails closed to `0` internally; other
   inventory call sites like `create-checkout.ts:213` default missing data
   to `0`). If this catch block is ever reached (e.g. a bug introduced
   later in `checkBulkInventory` that causes it to throw despite its
   current no-throw design), a sold-out item would incorrectly show as
   available with 999 units in the Quick View modal. Checkout still
   re-validates server-side, so this is a UX-correctness bug, not a
   financial/oversell risk.
2. **Dead fallback branch** (confirmed unreachable today, worth removing
   rather than leaving as misleading dead code): the `else` branch for
   "single variation product" reads from `inventoryMap`, a variable that is
   only ever populated inside the sibling `if`/`else if` branches above it
   — so in the `else` branch, `inventoryMap` is always the empty object
   `{}` it was initialized to, and `quantity` is always `|| 999`. This
   branch was verified unreachable in practice: `fetchProduct()` (this
   route's data source) calls `mapSingleCatalogItemToProduct()`
   (`src/lib/square/productMapper.ts:238`), which has an early `if
   (!defaultVariation || !defaultPriceMoney) return null;` guard before
   building `productVariations` — meaning any non-null product returned by
   `fetchProduct()` always has at least one variation, so the `else if
   (product.variations && product.variations.length > 0)` branch above
   always fires and the final `else` is currently dead. Confirm this is
   still true (see Drift check) before treating it as removable.

## Current state

- `src/pages/api/quick-view-product.ts:29-73` (full relevant block):
  ```ts
      // Get inventory for all variations — skip for gift cards (unlimited stock)
      let inventoryMap: Record<string, number> = {};

      if (product.isGiftCard) {
        // Gift cards: always in stock, no inventory tracking
        product.variations = (product.variations || []).map((v) => ({
          ...v,
          inStock: true,
          quantity: 99,
        }));
      } else if (product.variations && product.variations.length > 0) {
        try {
          const variationIds = product.variations.map((v) => v.variationId);
          inventoryMap = await checkBulkInventory(variationIds);

          // Update variations with inventory data
          product.variations = product.variations.map((v) => ({
            ...v,
            inStock: (inventoryMap[v.variationId] || 0) > 0,
            quantity: inventoryMap[v.variationId] || 0,
          }));
        } catch {
          // console.error("Inventory check failed:", error);
          // Default to in stock if inventory check fails
          product.variations = product.variations.map((v) => ({
            ...v,
            inStock: true,
            quantity: 999,
          }));
        }
      } else {
        // Single variation product (non-gift-card)
        const quantity = inventoryMap[product.variationId] || 999;
        product.variations = [
          {
            id: product.variationId,
            variationId: product.variationId,
            name: product.title,
            price: product.price,
            inStock: quantity > 0,
            quantity: quantity,
            attributes: {},
          },
        ];
      }
  ```
- `src/lib/square/productMapper.ts:238-249` — the guard clause proving the
  `else` branch above is currently unreachable:
  ```ts
  export function mapSingleCatalogItemToProduct(
    item: CatalogObject.Item,
    imageUrl: string,
    allImageUrls: string[],
    variationImages: Record<string, string>,
    unitsMap: Record<string, string>
  ): Product | null {
    const variations = (item.itemData?.variations || []).filter(isItemVariation);

    const defaultVariation = variations[0];
    const defaultPriceMoney = defaultVariation?.itemVariationData?.priceMoney;

    if (!defaultVariation || !defaultPriceMoney) return null;
  ```
  Because `productVariations` (built later in this function) is derived
  from `variations`, and `variations[0]` (`defaultVariation`) must exist
  for the function to return non-null at all, any product this function
  returns has ≥ 1 variation. `src/lib/square/client.ts`'s `fetchProduct()`
  uses this mapper for single-product fetches (confirm with
  `grep -n "mapSingleCatalogItemToProduct" src/lib/square/client.ts`).

## Commands you will need

| Purpose   | Command          | Expected on success |
|-----------|------------------|----------------------|
| Typecheck | `pnpm check`     | exit 0, "0 errors" |
| Tests     | `pnpm test:run`  | all pass |
| Lint      | `pnpm lint`      | exit 0 |
| Build     | `pnpm build`     | exit 0 |

## Scope

**In scope** (the only files you should modify):
- `src/pages/api/quick-view-product.ts`
- Its test file if one exists — check with
  `find src/pages/api -iname "*quick-view-product*test*"`; if none exists,
  do not create a new full test suite for this route (out of scope, see
  below) — a targeted unit test isn't required to verify this fix (see
  Test plan).

**Out of scope** (do NOT touch, even though they look related):
- `src/lib/square/productMapper.ts` — read-only reference for this plan's
  dead-code claim; do not modify it.
- `src/lib/square/inventory.ts`'s `checkBulkInventory` — already correctly
  fails closed internally; no change needed there.
- `src/lib/cart/index.ts` — the related but separate `999` fail-open bug in
  the cart is `plans/110-fix-cart-inventory-fail-open.md`, a different file
  and a different plan.
- Writing a full new test suite for `quick-view-product.ts` if none
  currently exists — this plan's fix is small and low-risk enough not to
  require standing up new test infrastructure; if a test file already
  exists, add to it (see Test plan), but don't create one from scratch
  purely for this change.

## Git workflow

- Branch: `advisor/111-fix-quick-view-inventory-fail-open`
- Commit message style: conventional commits, e.g. `fix: fail closed on
  Quick View inventory check error, remove dead fallback branch` (matches
  `28d7b68 fix: validate productUrl scheme, encode gallery src, encode
  cookie value` in `git log`).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Fix the catch-block fallback to fail closed

Change:
```ts
        } catch {
          // console.error("Inventory check failed:", error);
          // Default to in stock if inventory check fails
          product.variations = product.variations.map((v) => ({
            ...v,
            inStock: true,
            quantity: 999,
          }));
        }
```
to:
```ts
        } catch {
          product.variations = product.variations.map((v) => ({
            ...v,
            inStock: false,
            quantity: 0,
          }));
        }
```
(Also drop the two commented-out lines above `product.variations = ...` —
they're dead comments describing the old, now-reversed, behavior; don't
carry stale comments forward. If a `logError`/`processSquareError` import
already used elsewhere in this file — both are imported at the top per the
excerpt above — is the established pattern for reporting a caught error in
this file's other catch blocks, match that pattern here too instead of a
silent catch; check the rest of the file for how other catches in this
same route handle logging before deciding.)

**Verify**: `grep -n "quantity: 999" src/pages/api/quick-view-product.ts`
→ 1 match remaining (the dead `else` branch, removed in Step 2).

### Step 2: Remove the dead `else` branch

Delete the entire `else` block (the "Single variation product" branch shown
in "Current state" above) — it is unreachable given
`mapSingleCatalogItemToProduct`'s guard clause (re-verify this is still
true per the Drift check before deleting). After removal, the `if
(product.isGiftCard) { ... } else if (product.variations &&
product.variations.length > 0) { ... }` structure needs no trailing `else`
— if `product.variations` is ever unexpectedly empty at runtime despite the
mapper's guarantee, `product.variations` after this whole block simply
stays as whatever it already was (typically `[]` or `undefined`), which is
the same effective behavior as the block being removed for the case that
matters (no fabricated 999 stock).

**Verify**: `pnpm check` → 0 errors (confirms removing the branch doesn't
break a type that expected the `else` to always run — if it does, this is
a STOP condition, not something to work around by re-adding a stub).

## Test plan

- If `src/pages/api/quick-view-product.ts` already has a test file: add a
  case mocking `checkBulkInventory` to throw, asserting the returned
  product's variations all have `inStock: false, quantity: 0` (not `true`/
  `999`).
- If no test file exists for this route today, this plan does not require
  creating one from scratch (see Scope) — the fix is a direct, easily
  code-reviewed value swap plus a dead-branch deletion. Note this decision
  in the commit message or PR description if one is opened.
- Verification: `pnpm test:run` → all pass (no regressions; new case
  passing if added).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm check` exits 0, "0 errors"
- [ ] `pnpm test:run` exits 0
- [ ] `pnpm lint` exits 0
- [ ] `pnpm build` exits 0
- [ ] `grep -c "quantity: 999" src/pages/api/quick-view-product.ts` → 0
- [ ] `grep -n "Single variation product" src/pages/api/quick-view-product.ts` → no matches (dead branch removed)
- [ ] No files outside the Scope list are modified (`git status`)
- [ ] `plans/README.md` status row for 111 updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code doesn't match the "Current state" excerpts (drift since this
  plan was written) — especially if `productMapper.ts`'s guard clause has
  changed such that a null/empty-variations product could now reach the
  route without going through `if (!product) return 404` earlier in the
  file (re-read the full file from the top before assuming the dead-branch
  claim still holds).
- `pnpm check` reports a type error after removing the `else` branch that
  isn't trivially resolved by leaving `product.variations` unmodified in
  that fallthrough case — investigate rather than force a type assertion
  to make it pass.

## Maintenance notes

- This is the same class of fail-open bug as
  `plans/110-fix-cart-inventory-fail-open.md`, in a different, independent
  file — no code overlap, but a reviewer should note the pattern recurring
  a second time and consider whether a shared "inventory-check failure
  means 0, always" convention/helper is worth extracting in a future pass
  if a third instance turns up.
- If `mapSingleCatalogItemToProduct`'s guard clause is ever relaxed in the
  future (e.g. to support a genuinely variation-less product type), the
  removed `else` branch's absence means such a product would flow through
  with whatever `product.variations` already was (likely `undefined`) —
  a future author extending product types should re-add explicit handling
  at that point rather than assuming this route already covers it.
