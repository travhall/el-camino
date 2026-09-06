# Plan 152: Stop trusting the client's `isGiftCard` flag and price at checkout

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
> When done, update this plan's status row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat ad2999d..HEAD -- src/pages/api/create-checkout.ts src/pages/api/calculate-cart.ts src/lib/config/shipping.ts src/lib/square/pricing.ts`
> If any in-scope file changed, compare the "Current state" excerpts against the
> live code first; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `ad2999d`, 2026-09-05

## Why this matters

`/api/create-checkout` splits the incoming cart on a boolean the client
supplies, and that split disables two server-side controls at once.

An attacker (or anyone with devtools) sends one cart item with
`isGiftCard: true` and `price: 999`. Two things follow:

1. **Inventory check skipped.** Gift-card items are copied straight into
   `validItems` without going through `checkBulkInventory`, so sold-out or
   discontinued variations can be ordered — producing unfulfillable orders and
   refunds.
2. **Free shipping obtained.** Because gift-card items are excluded from
   `variationIds`, `pricing[item.variationId]` is *always* `undefined` for them,
   so the subtotal falls back to the client-supplied `item.price`. That
   subtotal drives `calculateShippingRate`, which returns 0 above the $75
   threshold. The $5.99 shipping line item is silently never added.

This is repeatable per order and is a direct revenue leak on a live storefront.

**What is NOT broken, and must not be "fixed" here**: the price Square actually
charges is safe. `src/lib/checkout/lineItems.ts:22-29` only overrides
`basePriceMoney` when the Square catalog confirms an active sale, so a missing
price lookup falls back to the catalog's regular price rather than an
attacker-supplied discount. This is a shipping-revenue and inventory-bypass
bug, not a "buy it for $1" bug. Scope your change accordingly.

## Current state

`src/pages/api/create-checkout.ts:39-52` — the body is destructured and cast
with no validation of `isGiftCard` or `price`:

```ts
    const body = await request.json();
    const {
      items,
      fulfillmentMethod = 'shipping',
      shippingAddress,
      pickupContact,
      checkoutKey,
    } = body as {
      items: CartItem[];
      ...
    };
```

`src/pages/api/create-checkout.ts:80-83` — the split:

```ts
    // Skip gift cards — they have no tracked inventory and are always available
    const nonGiftCardItems = items.filter((item) => !item.isGiftCard);
    const giftCardItems = items.filter((item) => item.isGiftCard);

    const variationIds = nonGiftCardItems.map((item) => item.variationId);
```

`src/pages/api/create-checkout.ts:99` — the inventory bypass:

```ts
    const validItems: CartItem[] = [...giftCardItems]; // gift cards always valid
```

`src/pages/api/create-checkout.ts:158-162` — the price fallback:

```ts
    const subtotal = validItems.reduce((sum, item) => {
      const effectivePrice =
        pricing[item.variationId]?.effectivePrice ?? item.price;
      return sum + effectivePrice * item.quantity;
    }, 0);
```

The same `?? item.price` fallback exists at
`src/pages/api/calculate-cart.ts:63-66`.

**The server already knows the truth.** `src/lib/square/productMapper.ts:152`
derives `isGiftCard` from a Square custom attribute via `extractIsGiftCard` —
read that function before starting, it is the authority you will reuse.

`src/lib/config/shipping.ts:35-36, 58-60`:

```ts
export const FREE_SHIPPING_THRESHOLD_DOLLARS =
  SHIPPING_RATES.find((r) => r.id === "free")!.freeThreshold!;
...
export function calculateShippingRate(subtotal: number): number {
  return subtotal >= FREE_SHIPPING_THRESHOLD_DOLLARS
```

### Repo conventions

- API routes live in `src/pages/api/`, return `new Response(JSON.stringify(...))`
  with an explicit status. Error shape: `{ error: string }`.
- Tests are Vitest in `__tests__/` beside the code. The exemplar for this route
  is `src/pages/api/__tests__/create-checkout.test.ts` — read it before writing
  tests; it already mocks the Square client and the pricing/inventory helpers.

## Commands you will need

| Purpose   | Command                                        | Expected            |
|-----------|------------------------------------------------|---------------------|
| Typecheck | `pnpm check`                                   | exit 0, 0 errors    |
| Tests     | `pnpm test:run -- create-checkout calculate-cart` | all pass         |
| Full tests| `pnpm test:run`                                | exit 0              |
| Coverage  | `pnpm test:coverage`                           | exit 0, no regression|
| Lint      | `pnpm lint`                                    | exit 0              |

Never use `pnpm test` — watch mode, it hangs.

## Scope

**In scope**:
- `src/pages/api/create-checkout.ts`
- `src/pages/api/calculate-cart.ts`
- `src/pages/api/__tests__/create-checkout.test.ts`
- `src/pages/api/__tests__/calculate-cart.test.ts` (create if absent)

**Out of scope** (do NOT touch):
- `src/lib/checkout/lineItems.ts` — the charged-price path is already correct
  and fails safe toward the merchant. Changing it risks a real pricing bug.
- `src/lib/config/shipping.ts` — the threshold and rate values are business
  config, not a security control.
- `src/lib/square/productMapper.ts` — read `extractIsGiftCard`, don't change it.
- General request-body schema validation for this route. That is plan 168's
  job; this plan fixes only the gift-card trust boundary. Resist the urge.

## Git workflow

- Branch: `advisor/152-server-derive-giftcard-flag`
- Conventional commits, e.g.
  `fix(security): derive isGiftCard from the catalog instead of the request body`
- Do NOT push or open a PR unless the operator instructs it.

## Steps

### Step 1: Fetch pricing for ALL items, not just non-gift-card ones

Change `variationIds` to be built from `items`, not `nonGiftCardItems`, so the
`getAuthoritativePricing` call at `create-checkout.ts:90` covers every item.
This is the enabling change for Steps 2 and 3 — the catalog lookup is what
gives you server-side truth.

Keep `checkBulkInventory` receiving only the ids it should check (Step 2
decides which those are).

**Verify**: `pnpm check` → exit 0.

### Step 2: Decide gift-card status from the catalog, not the request

Using the pricing/catalog data now available for every variation, build a
server-derived set of gift-card variation ids (via the same Square custom
attribute `extractIsGiftCard` reads). Use **that** set — not `item.isGiftCard` —
to decide which items skip the inventory check.

An item the client flagged as a gift card but the catalog does not confirm must
go through the normal inventory path like any other item.

**Verify**: `grep -n "item.isGiftCard" src/pages/api/create-checkout.ts`
→ no matches, or only inside a comment explaining why the client value is
ignored.

### Step 3: Never fall back to the client's price for the shipping subtotal

Replace `?? item.price` at `create-checkout.ts:160` so a missing server price
contributes **0** to the subtotal rather than the client's number. Do the same
at `calculate-cart.ts:63-66`.

Contributing 0 fails safe: a missing price can only ever *reduce* the subtotal,
so the worst case is the customer being charged shipping they might have earned
free — never the reverse. Add a comment saying exactly that, so a future reader
does not "helpfully" restore the fallback.

If the catalog genuinely has no price for a variation (variable-price gift
cards are the stated reason the fallback existed), log it server-side.

**Verify**: `grep -n "?? item.price" src/pages/api/create-checkout.ts src/pages/api/calculate-cart.ts`
→ no matches.

### Step 4: Full gate

```bash
pnpm check && pnpm lint && pnpm test:run
```
→ all exit 0.

## Test plan

Add to `src/pages/api/__tests__/create-checkout.test.ts`, following its existing
mocking style:

- **The regression proof**: a request with one item carrying
  `isGiftCard: true, price: 999` for a variation the catalog says is NOT a gift
  card → the item goes through inventory, and the computed shipping rate is
  `STANDARD_SHIPPING_RATE`, not 0.
- A genuine catalog-confirmed gift card still skips inventory and still checks out.
- An item whose variation has no server price contributes 0 to the subtotal
  (assert the resulting shipping rate).
- An out-of-stock item flagged `isGiftCard: true` is removed, and appears in
  `removedItems`.

Mirror the price-fallback test in `calculate-cart.test.ts`.

`pnpm test:coverage` → exit 0, no threshold regression.

## Done criteria

- [ ] `grep -n "item.isGiftCard" src/pages/api/create-checkout.ts` → no live uses
- [ ] `grep -n "?? item.price" src/pages/api/create-checkout.ts src/pages/api/calculate-cart.ts` → no matches
- [ ] The forged-gift-card regression test exists and passes
- [ ] `src/lib/checkout/lineItems.ts` unmodified (`git status`)
- [ ] `pnpm check` / `pnpm lint` / `pnpm test:run` all exit 0
- [ ] `pnpm test:coverage` exits 0, no threshold regression
- [ ] Only in-scope files modified (`git status`)

## STOP conditions

Stop and report if:

- **The Square catalog does not expose a gift-card attribute you can read for
  every variation** in the pricing response. Do not fall back to trusting the
  client flag "temporarily" — report and let the operator decide.
- Fetching pricing for all items (Step 1) meaningfully slows checkout. The
  existing comment at `create-checkout.ts:85-87` shows latency was already
  traded deliberately here; a regression needs the operator's call.
- Real variable-price gift cards break — i.e. a legitimate gift card now gets
  rejected or priced at 0 in a way that changes what the customer is charged.
- Any verification fails twice after a reasonable fix attempt.

## Maintenance notes

- **The rule to protect**: nothing the client sends may decide whether a
  server-side check runs. `isGiftCard` was a category flag that quietly became
  an authorization flag. Review any future `items[].*` field the same way.
- A reviewer should confirm the charged-price path (`lineItems.ts`) is untouched
  and that the subtotal change fails *toward* charging shipping.
- **Deliberately deferred**: full request-body schema validation (plan 168) and
  the unread `cartUpdated` reconciliation field (plan 171).
