# Plan 082: Parallelize inventory check and authoritative pricing in create-checkout

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 915a062..HEAD -- src/pages/api/create-checkout.ts`
> If the file changed, compare the excerpt before proceeding.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: performance
- **Planned at**: commit `915a062`, 2026-08-01

## Why this matters

`src/pages/api/create-checkout.ts` makes two independent network calls to
Square's API sequentially at checkout time:

1. `await checkBulkInventory(variationIds)` — fetches live stock counts
2. `await getAuthoritativePricing(pricedVariationIds)` — fetches current prices

They run back-to-back. Because Square API calls typically take 150–500ms each,
the total wait is 300–1000ms just for these two calls. They are independent:
inventory levels don't affect what prices Square returns. The fix is to run
them in parallel with `Promise.all`, cutting the combined wait to the slower of
the two calls.

The trade-off: the pricing call will fetch prices for ALL non-gift-card
variation IDs, including items that turn out to be out-of-stock. This is a
small amount of wasted work (pricing for OOS items is fetched but discarded),
but it is strictly faster than waiting for inventory before starting pricing.

## Current state

**File**: `src/pages/api/create-checkout.ts`

Current sequential flow (abridged):

```typescript
// Step A: inventory check (await 1)
const variationIds = nonGiftCardItems.map((item) => item.variationId);
const inventoryLevels = variationIds.length > 0
  ? await checkBulkInventory(variationIds)
  : {};

// ... filter validItems from inventory results ...

// Step B: pricing (await 2 — only after inventory completes)
const pricedVariationIds = validItems
  .filter((item) => !item.isGiftCard)
  .map((item) => item.variationId);
const pricing = await getAuthoritativePricing(pricedVariationIds);
```

Read `src/pages/api/create-checkout.ts` around lines 216–278 to confirm the
exact variable names and structure before editing.

## Commands you will need

| Purpose   | Command                           | Expected on success |
|-----------|-----------------------------------|---------------------|
| Typecheck | `pnpm check`                      | exit 0, no errors   |
| Tests     | `pnpm test:run -- create-checkout`| all pass            |

## Scope

**In scope**:
- `src/pages/api/create-checkout.ts`

**Out of scope**:
- `src/lib/square/inventory.ts` (`checkBulkInventory` implementation — do not change)
- `src/lib/square/pricing.ts` (`getAuthoritativePricing` implementation — do not change)

## Git workflow

- Branch: `advisor/082-perf-parallel-inventory-pricing`
- Commit: `perf: run inventory check and authoritative pricing in parallel at checkout`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Read the current inventory/pricing flow

Read `src/pages/api/create-checkout.ts` lines 210–285 to confirm:
- Exact function names for the inventory and pricing calls
- Variable names used after each call
- That no intermediate result from inventory is passed TO the pricing call

If inventory results ARE used as input to the pricing call, the parallelization
described here is not possible — treat this as a STOP condition and report.

### Step 2: Parallelize with Promise.all

Replace the two sequential awaits with a parallel fetch using the FULL list of
non-gift-card variation IDs for both calls:

```typescript
// Fetch inventory and pricing in parallel — they are independent
const [inventoryLevels, pricingAll] = await Promise.all([
  variationIds.length > 0
    ? checkBulkInventory(variationIds)
    : Promise.resolve({} as Record<string, number>),
  variationIds.length > 0
    ? getAuthoritativePricing(variationIds)  // full list, not just valid items
    : Promise.resolve({} as Record<string, { effectivePrice: number; originalPrice: number }>),
]);
```

Then remove the second `getAuthoritativePricing` call and replace the existing
`pricing` variable reference with `pricingAll`:

```typescript
// Use pricingAll everywhere 'pricing' was previously used
// (pricingAll has entries for OOS items too, but those are excluded by validItems filter)
const pricing = pricingAll;
```

The `validItems` filter (built from inventory results) already excludes OOS
items from the subtotal calculation, so pricing entries for OOS items are
simply ignored.

### Step 3: Confirm types

Run `pnpm check` and fix any type mismatches introduced by the `Promise.all`
destructuring or the type of `pricingAll`.

**Verify**: `pnpm check` → exit 0

### Step 4: Run tests

```
pnpm test:run -- create-checkout
```

**Verify**: all pass; no regressions.

## Done criteria

- [ ] `pnpm check` exits 0
- [ ] `pnpm test:run -- create-checkout` exits 0
- [ ] `checkBulkInventory` and `getAuthoritativePricing` run inside a single `Promise.all`
- [ ] No sequential `await` for one before starting the other
- [ ] No files outside the in-scope list are modified
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

- Inventory results are used as direct input to `getAuthoritativePricing` (not just for filtering `validItems`) — parallelization is blocked; report the dependency chain
- `getAuthoritativePricing` is not idempotent or has side effects that make double-calling with extra IDs unsafe — confirm before parallelizing
- Tests fail because the pricing mock is now called with a different argument set — update test mock to accept the full `variationIds` list

## Maintenance notes

- The `pricingAll` Map may have entries for OOS items. The existing `validItems`
  filter already excludes those items from the subtotal/line-items computation,
  so this is safe by construction — but leave a comment noting the intentional
  extra fetch.
- If `getAuthoritativePricing` becomes expensive per ID, the trade-off reverses:
  pre-filter to valid items only (restoring sequential dependency). For the current
  implementation (Square batch API), the per-extra-ID cost is negligible.
