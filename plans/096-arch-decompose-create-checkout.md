# Plan 096: Decompose create-checkout.ts

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `wc -l src/pages/api/create-checkout.ts && git diff --stat 915a062..HEAD -- src/pages/api/create-checkout.ts`

## Status

- **Priority**: P3
- **Effort**: L
- **Risk**: MED
- **Depends on**: plan 077 (cart undo fixes), plan 082 (parallel inventory+pricing)
- **Category**: architecture
- **Planned at**: commit `915a062`, 2026-08-01

## Why this matters

`src/pages/api/create-checkout.ts` is 500+ lines and mixes: request parsing, cart validation, inventory checking, pricing validation, fulfillment (pickup/shipping) logic, Square checkout session creation, and order creation. A single function doing all of this is untestable in parts and fragile to modify.

**Do not start until plans 077 and 082 are DONE** — both modify this file.

## Current state

Read `src/pages/api/create-checkout.ts` fully. Map its phases:
1. Request parsing and auth
2. Cart item validation
3. Inventory check (bulk)
4. Authoritative pricing validation
5. Fulfillment type resolution (pickup vs. shipping)
6. Pickup hours validation
7. Square checkout session / payment link creation
8. Response

## Commands

| Purpose | Command | Expected |
|---------|---------|---------|
| Typecheck | `pnpm check` | no errors |
| Tests | `pnpm test:run` | all pass |

## Scope

**In scope**: extracting pure business-logic functions to `src/lib/checkout/` (new directory); keeping the Astro request handler thin

**Out of scope**: changing business logic, changing API contract, modifying Square SDK usage patterns

## Git workflow

- Branch: `advisor/096-arch-decompose-create-checkout`
- Commit: `refactor: extract checkout business logic to src/lib/checkout/`

## Steps

### Step 1: Read and map

Read the full file. Identify functions that can be extracted with no change to behavior:
- `validateCartItems(items)` — cart item validation logic
- `resolvePickupWindow(pickupHours, requestedTime)` — pickup time logic (already partially extracted per plan 077)
- `buildLineItems(cartItems, prices)` — Square line item construction

### Step 2: Create src/lib/checkout/

Create the directory. Extract each identified function to an appropriately named file:
- `src/lib/checkout/validateCart.ts`
- `src/lib/checkout/fulfillment.ts`
- `src/lib/checkout/lineItems.ts`

Each file: pure functions only, no Square SDK imports (unless unavoidable).

### Step 3: Update create-checkout.ts

Replace inline logic with calls to the extracted functions. Import from `src/lib/checkout/`.

### Step 4: Typecheck and tests

```
pnpm check
pnpm test:run
```

### Step 5: Add unit tests for extracted functions

Write `src/lib/checkout/__tests__/validateCart.test.ts` and `src/lib/checkout/__tests__/fulfillment.test.ts`. These are pure functions — no mocks needed. At minimum:
- `validateCartItems` rejects empty cart
- `validateCartItems` rejects items with quantity ≤ 0
- `resolvePickupWindow` rejects times outside open hours

## Done criteria

- [ ] `src/lib/checkout/` directory exists with ≥ 2 extracted modules
- [ ] `create-checkout.ts` is measurably shorter (remove ≥ 100 lines of inline logic)
- [ ] `pnpm check` exits 0
- [ ] `pnpm test:run` exits 0
- [ ] `plans/README.md` updated to DONE

## STOP conditions

- plans 077 or 082 are not DONE — stop, they modify this file
- Extracting a function would require threading too many parameters — leave that block inline and note it; don't over-abstract

## Maintenance notes

Any new checkout feature belongs in `src/lib/checkout/`, not in the route handler.
