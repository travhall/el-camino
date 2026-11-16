# Plan 037: Add item caps and rate limits to public batch endpoints

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 0da82aa..HEAD -- src/pages/api/calculate-cart.ts src/pages/api/sale-info.ts src/pages/api/batch-inventory.ts src/pages/api/cart-inventory.ts`

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `0da82aa`, 2026-07-22

## Why this matters

Three public API endpoints accept unbounded arrays of variation IDs and forward
them directly to Square without rate limiting or item-count caps:

- `POST /api/calculate-cart` — each request calls `squareClient.orders.calculate()`,
  Square's most expensive catalog API call. No rate limiter exists, despite
  `create-checkout.ts` having a `checkoutLimiter` for exactly this reason.
- `POST /api/sale-info` — calls `squareClient.catalog.batchGet()` with an
  uncapped number of variation IDs.
- `GET /api/batch-inventory` — calls `checkBulkInventory()` with an uncapped
  comma-separated list of IDs.

An attacker can POST 500 variation IDs to `/api/calculate-cart` in a tight loop,
burning Square API quota and degrading the storefront for real shoppers. The fix
mirrors the already-existing pattern in `create-checkout.ts`.

## Current state

**`src/lib/rateLimit.ts`** (existing rate-limiter utility):
```typescript
export function createRateLimiter(opts: { windowMs: number; max: number }): Limiter {
  const buckets = new Map<string, Bucket>();
  return {
    check(key: string): boolean { /* returns true if rate-limited */ }
  };
}
export function clientIp(request: Request): string { /* extracts x-forwarded-for */ }
```

**`src/pages/api/create-checkout.ts:14-17`** (existing pattern to replicate):
```typescript
import { createRateLimiter, clientIp } from "@/lib/rateLimit";
// 10 checkout attempts per 5 min per IP
const checkoutLimiter = createRateLimiter({ windowMs: 5 * 60_000, max: 10 });
```

**`src/pages/api/create-checkout.ts`** (rate-limit check pattern — find in the POST handler):
```typescript
if (checkoutLimiter.check(clientIp(request))) {
  return new Response(JSON.stringify({ error: "Too many requests" }), { status: 429 });
}
```

**`src/pages/api/calculate-cart.ts:14-16`** (current state — no rate limiter):
```typescript
export const POST: APIRoute = async ({ request }) => {
  try {
    const { items, fulfillmentMethod } = (await request.json()) as CalculateRequest;
```

**`src/pages/api/sale-info.ts:5-9`** (current state — no cap or limiter):
```typescript
export const POST: APIRoute = async ({ request }) => {
  try {
    const { variationIds } = await request.json();
    if (!Array.isArray(variationIds) || variationIds.length === 0) {
      return new Response(...status: 400);
```

**`src/pages/api/batch-inventory.ts:7-29`** (current state — no cap):
```typescript
export const GET: APIRoute = async ({ url }) => {
  try {
    const param = url.searchParams.get("variationIds");
    // splits on comma, no length check:
    const variationIds = param.split(",").map(id => id.trim()).filter(Boolean);
```

## Commands you will need

| Purpose   | Command        | Expected on success       |
|-----------|----------------|---------------------------|
| Typecheck | `pnpm check`   | exit 0, no errors         |
| Unit tests | `pnpm test:run` | all pass                 |

## Scope

**In scope**:
- `src/pages/api/calculate-cart.ts`
- `src/pages/api/sale-info.ts`
- `src/pages/api/batch-inventory.ts`
- `src/pages/api/cart-inventory.ts` (check if it also lacks a cap — apply same fix)

**Out of scope**:
- `src/lib/rateLimit.ts` — no changes needed; use as-is
- `src/pages/api/create-checkout.ts` — already has rate limiting; do not touch
- `src/pages/api/check-inventory.ts` — accepts a single variation ID, not a batch

## Git workflow

- Branch: `advisor/037-rate-limit-batch-endpoints`
- Commit message: `fix: add rate limits and item caps to public batch API endpoints`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Add rate limiter and item cap to calculate-cart.ts

At the top of `src/pages/api/calculate-cart.ts`, after the existing imports, add:

```typescript
import { createRateLimiter, clientIp } from "@/lib/rateLimit";

// 30 cart-total calculations per 5 min per IP — generous for normal usage
const calculateLimiter = createRateLimiter({ windowMs: 5 * 60_000, max: 30 });
const MAX_CART_ITEMS = 50;
```

Inside the `POST` handler, immediately after parsing `{ items, fulfillmentMethod }`,
add:

```typescript
if (calculateLimiter.check(clientIp(request))) {
  return new Response(
    JSON.stringify({ success: false, error: "Too many requests" }),
    { status: 429, headers: { "Content-Type": "application/json" } }
  );
}

if (items.length > MAX_CART_ITEMS) {
  return new Response(
    JSON.stringify({ success: false, error: "Cart too large" }),
    { status: 400, headers: { "Content-Type": "application/json" } }
  );
}
```

**Verify**: `grep -n 'calculateLimiter\|MAX_CART_ITEMS' src/pages/api/calculate-cart.ts` → shows both

### Step 2: Add item cap to sale-info.ts

At the top of `src/pages/api/sale-info.ts`, after imports, add:

```typescript
const MAX_VARIATION_IDS = 50;
```

Inside the `POST` handler, after the `!Array.isArray(variationIds)` check, add:

```typescript
if (variationIds.length > MAX_VARIATION_IDS) {
  return new Response(
    JSON.stringify({ success: false, error: "Too many variation IDs" }),
    { status: 400, headers: { "Content-Type": "application/json" } }
  );
}
```

`sale-info.ts` is called by the cart UI which fetches sale prices for cart items.
A rate limiter here is less critical than a cap (the Square batchGet is cheaper
than orders.calculate), so an item cap is sufficient.

**Verify**: `grep -n 'MAX_VARIATION_IDS' src/pages/api/sale-info.ts` → shows the const

### Step 3: Add item cap to batch-inventory.ts

At the top of `src/pages/api/batch-inventory.ts`, after imports, add:

```typescript
const MAX_VARIATION_IDS = 50;
```

After the `variationIds.length === 0` check in the `GET` handler, add:

```typescript
if (variationIds.length > MAX_VARIATION_IDS) {
  return new Response(
    JSON.stringify({ success: false, error: "Too many variation IDs" }),
    { status: 400, headers: { "Content-Type": "application/json" } }
  );
}
```

**Verify**: `grep -n 'MAX_VARIATION_IDS' src/pages/api/batch-inventory.ts` → shows the const

### Step 4: Check cart-inventory.ts and apply same pattern if needed

Read `src/pages/api/cart-inventory.ts` and check if it also accepts an uncapped
`variationIds` array. If yes, add `MAX_VARIATION_IDS = 50` and the same guard.
If it already has a cap or uses a different approach, skip.

### Step 5: Typecheck and test

**Verify**: `pnpm check` → exit 0

**Verify**: `pnpm test:run` → all pass

## Done criteria

- [ ] `pnpm check` exits 0
- [ ] `pnpm test:run` exits 0
- [ ] `calculate-cart.ts` has both a rate limiter (`calculateLimiter`) and an item cap (`MAX_CART_ITEMS`)
- [ ] `sale-info.ts` has an item cap (`MAX_VARIATION_IDS`)
- [ ] `batch-inventory.ts` has an item cap (`MAX_VARIATION_IDS`)
- [ ] No files outside the in-scope list are modified
- [ ] `plans/README.md` status row for 037 updated to DONE

## STOP conditions

- `pnpm check` fails with import errors for `createRateLimiter`/`clientIp` — verify
  the import path is `@/lib/rateLimit` (not a relative path).
- The `cart-inventory.ts` file has a significantly different structure than expected —
  describe what you find rather than guessing at the right cap placement.

## Maintenance notes

- The `MAX_VARIATION_IDS = 50` cap is deliberately generous (a real cart rarely
  has >20 items). If the store starts selling product bundles or kit configurations
  with many variations, revisit this limit before raising the cap — do not simply
  double it without considering Square API quota implications.
- The `createRateLimiter` is per-function-instance (in-memory Map). A determined
  attacker can hit multiple cold Netlify instances to bypass per-instance limits.
  This is documented in `src/lib/rateLimit.ts:4-6` as an accepted trade-off. If
  abuse becomes a real concern, a Redis-backed or Netlify Blobs-backed limiter
  would be the next step.
