# Plan 061: Eliminate N Square API calls in category nav visibility check

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 9b5556b..HEAD -- src/lib/square/categoryUtils.ts src/lib/square/client.ts`
> If any changes appear, compare before proceeding.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: performance
- **Planned at**: commit `9b5556b`, 2026-07-22

## Why this matters

`categoryUtils.ts:batchCheckCategoriesHaveProducts` (lines ~86–124) runs one
`squareClient.catalog.searchItems({ categoryIds: [id], limit: 1 })` call **per
category** on every cold navigation render. With the category cache cold, this
means N Square API calls before any page can render the nav. The category cache
TTL helps on warm servers, but cold starts (Netlify serverless functions) always
incur the full N-call penalty.

The fix: derive the "has products" map from the full product catalog that
`fetchProducts` already fetches and caches in `productCache`. The product
catalog contains each item's `categoryIds` array; scanning it once to build a
`Set<categoryId>` answers the same question without any additional API call.

**Risk is MED**: this changes the data source used for category visibility.
Verify against actual Square catalog data that the `categoryIds` field is
populated on items in this store's catalog (see Step 1).

## Current state

`src/lib/square/categoryUtils.ts` (inside `batchCheckCategoriesHaveProducts`):

```ts
// One Square API call per category:
const result = await squareClient.catalog.searchItems({
  categoryIds: [categoryId],
  limit: 1,
});
const hasProducts = !!searchResult?.items?.length;
```

`src/lib/square/client.ts` (available for reuse):

- `fetchProducts()` fetches all `ITEM` catalog objects and caches them in
  `productCache` under the `"all-products-v3"` key.
- Each `Product` returned has a `categoryId` field (set from
  `item.itemData?.categories?.[0]?.id` during mapping).

## Commands you will need

| Purpose        | Command              | Expected on success      |
|----------------|----------------------|--------------------------|
| Typecheck      | `pnpm check`         | exit 0, no errors        |
| Unit tests     | `pnpm test:run`      | all pass                 |

## Scope

**In scope**:
- `src/lib/square/categoryUtils.ts` — `batchCheckCategoriesHaveProducts` only

**Out of scope**:
- `src/lib/square/client.ts` — use `fetchProducts` as-is; do not modify it
- `src/lib/square/categories.ts` — call sites unchanged
- Any nav component

## Git workflow

- Branch: `advisor/061-category-nav-n-plus-one`
- Commit message: `perf: derive category product presence from cached catalog instead of N API calls`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Verify categoryId is populated on Products

Read `src/lib/square/client.ts` and find where products are mapped. Check that
the `categoryId` field is set from `item.itemData?.categories?.[0]?.id` or
`item.itemData?.categoryId` (the exact field name may vary by SDK version).

Run the dev server briefly and hit any page that triggers `fetchProducts` to
confirm products have `categoryId` set:

```bash
grep -n "categoryId\|categories" src/lib/square/client.ts | head -20
```

If `categoryId` is NOT set on products, STOP and report — the fix cannot
proceed without that data.

### Step 2: Read `batchCheckCategoriesHaveProducts` fully

```bash
grep -n "" src/lib/square/categoryUtils.ts | head -140
```

Understand:
1. What the function signature is.
2. Where category results are cached after the API call.
3. Whether there is a "cache hit" fast path that already avoids API calls.

### Step 3: Import `fetchProducts` in categoryUtils.ts

Add an import at the top of `src/lib/square/categoryUtils.ts`:

```ts
import { fetchProducts } from "./client";
```

If `fetchProducts` is not currently exported from `client.ts`, export it:

```ts
// In client.ts — change:
async function fetchProducts(...)
// to:
export async function fetchProducts(...)
```

### Step 4: Replace the per-category API call

Inside `batchCheckCategoriesHaveProducts`, replace the N API calls with a
single catalog scan:

```ts
// Before: one API call per category ID
// After:
const products = await fetchProducts(); // uses existing productCache
const categoryIdsWithProducts = new Set(
  products.products.map((p) => p.categoryId).filter(Boolean)
);
const result: Record<string, boolean> = {};
for (const id of categoryIds) {
  result[id] = categoryIdsWithProducts.has(id);
  // Populate per-category cache entries so callers using cached lookups still work
  await categoryCache.set(`category-has-products:${id}`, result[id]);
}
return result;
```

Preserve the `categoryCache.set` calls so the cached-lookup path remains warm.

**Important**: the signature and return type of `batchCheckCategoriesHaveProducts`
must not change — callers depend on `Record<string, boolean>`.

### Step 5: Typecheck and test

```bash
pnpm check
```

Expected: exit 0.

```bash
pnpm test:run
```

Expected: all pass.

## Done criteria

- [ ] `pnpm check` exits 0
- [ ] `pnpm test:run` exits 0
- [ ] `grep "searchItems" src/lib/square/categoryUtils.ts` → no match inside `batchCheckCategoriesHaveProducts`
- [ ] The function still returns `Record<string, boolean>` (same shape as before)
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

- `categoryId` is not populated on products from `fetchProducts` — the approach
  won't work; report the actual field names on the Product type and stop.
- The existing cache warm path (`categoryCache.get`) already short-circuits for
  all IDs — in that case the N-call path may never trigger in prod; report and
  confirm before changing.
- `pnpm check` reports circular import — `categoryUtils.ts` already imports
  from `client.ts`, or `client.ts` imports from `categoryUtils.ts`; if adding
  the import creates a cycle, report the cycle and stop.
