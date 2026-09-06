# Plan 168: Validate the `/api/create-checkout` request body

> **Executor instructions**: Follow step by step. Run every verification command
> and confirm the expected result. If anything in "STOP conditions" occurs, stop
> and report. When done, update this plan's status row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat ad2999d..HEAD -- src/pages/api/create-checkout.ts src/lib/checkout/ src/pages/api/back-in-stock.ts src/pages/api/calculate-cart.ts`
> On any change, compare against the excerpts below; on a mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: 152 (soft — same file; land 152 first)
- **Category**: security
- **Planned at**: commit `ad2999d`, 2026-09-05

## Why this matters

The route that charges money accepts its request body unchecked. It is
destructured and cast with `as`, and the only guards are `!items?.length` and the
presence of `shippingAddress` / `pickupContact`.

Concrete consequences:

- **`email` is unvalidated** and becomes both the Square order contact and the
  Resend recipient — order confirmations can be directed anywhere.
- **`quantity` is unvalidated** and reaches Square as `String(item.quantity)`.
  Negative, fractional, or huge values produce opaque Square API failures
  surfaced as a generic 500, instead of a clean 400.
- **`checkoutKey` becomes the Square idempotency key verbatim** — any string,
  any length.
- **No cap on `items.length`** on the route that actually charges.

The repo already does better elsewhere: `src/pages/api/back-in-stock.ts:34`
validates email shape, and `calculate-cart.ts` caps cart size at 50. The
money route has neither.

Note: email *header* injection is not reachable — Resend is a JSON API — but the
recipient and content are still attacker-chosen.

## Current state

`src/pages/api/create-checkout.ts:39-58`:

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
      fulfillmentMethod?: 'shipping' | 'pickup';
      shippingAddress?: ShippingAddress;
      pickupContact?: PickupContact;
      checkoutKey?: string;
    };

    // Stable idempotency key — Square deduplicates retries with the same key.
    const idempotencyKey = checkoutKey ?? crypto.randomUUID();

    if (!items?.length) {
```

The existing exemplar to match, `src/pages/api/back-in-stock.ts:34-40`:

```ts
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: "Invalid email address" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
```

Downstream consumers that receive these values unvalidated:
`src/lib/checkout/fulfillmentBuilders.ts:24-35` (address fields → Square) and
`src/lib/checkout/lineItems.ts:12` (`String(item.quantity)` → Square).

### No schema library is currently a dependency

`package.json` has no `zod`. Adding one is a real decision — see Step 1.

## Commands you will need

| Purpose   | Command                                          | Expected             |
|-----------|--------------------------------------------------|----------------------|
| Typecheck | `pnpm check`                                     | exit 0               |
| Tests     | `pnpm test:run -- create-checkout`               | all pass             |
| Full      | `pnpm test:run`                                  | exit 0               |
| Coverage  | `pnpm test:coverage`                             | exit 0, no regression|
| Lint      | `pnpm lint`                                      | exit 0               |
| Build     | `pnpm build`                                     | exit 0               |

Never use `pnpm test` — watch mode, it hangs.

## Scope

**In scope**:
- `src/pages/api/create-checkout.ts`
- a new validation module, e.g. `src/lib/checkout/validate.ts`
- `src/lib/checkout/__tests__/validate.test.ts`
- `src/pages/api/__tests__/create-checkout.test.ts`

**Out of scope** (do NOT touch):
- The gift-card trust boundary and the shipping subtotal. **Plan 152 owns those.**
  If 152 has not landed, land it first — otherwise you will conflict.
- `src/lib/checkout/fulfillmentBuilders.ts` / `lineItems.ts`. Validate at the
  boundary; do not add defensive checks throughout.
- Other API routes. This plan hardens the money route only.
- Changing the response shape on success.

## Git workflow

- Branch: `advisor/168-validate-checkout-request-body`
- Conventional commits, e.g. `fix(security): validate the create-checkout request body`
- Do NOT push or open a PR unless the operator instructs it.

## Steps

### Step 1: Decide hand-rolled vs. a schema library, and record why

`zod` is not currently a dependency. Adding one is reasonable but adds bundle and
supply-chain surface to an SSR route.

**Recommendation: hand-roll it.** The shape is small and fixed, the repo already
hand-rolls validation in `back-in-stock.ts`, and it avoids a new dependency in a
codebase that is actively closing advisories (plan 164). If you choose `zod`
instead, justify it in the status row and add it to `package.json` properly.

**Verify**: decision recorded in `plans/README.md`.

### Step 2: Write the validator

Create `src/lib/checkout/validate.ts` exporting a function that takes the parsed
body and returns either the typed value or a list of errors. Cover:

- `items`: array, length 1–50 (match `calculate-cart.ts`'s cap — read it and use
  the same constant if one exists)
- each item: `variationId` a non-empty string of bounded length; `quantity` an
  **integer** ≥ 1 and ≤ a sane per-line cap; `price` a finite non-negative number
- `fulfillmentMethod`: exactly `'shipping'` or `'pickup'`
- `shippingAddress` when shipping: required fields present, each length-capped
- `pickupContact` when pickup: same
- `email`: matches the `back-in-stock.ts` pattern, length-capped
- `checkoutKey`: optional; if present, must look like a UUID

Return a **generic** error message to the client (`{ error: 'Invalid request' }`)
and log the specific failure server-side. Do not echo which field failed — that
is free reconnaissance.

**Verify**: `pnpm check` → exit 0.

### Step 3: Apply it at the top of the route

Call the validator immediately after `request.json()` and return **400** on
failure, before any Square call, cache read, or email.

Keep `crypto.randomUUID()` as the fallback when `checkoutKey` is absent.

**Verify**: `grep -n "as {" src/pages/api/create-checkout.ts` → the unchecked
cast is gone or is now downstream of validation.

### Step 4: Full gate

```bash
pnpm check && pnpm lint && pnpm test:run && pnpm build
```
→ all exit 0.

## Test plan

`src/lib/checkout/__tests__/validate.test.ts` — table-driven, modelled on
`src/lib/__tests__/shopHours.test.ts`:

- a valid shipping body and a valid pickup body both pass
- `quantity` of `0`, `-1`, `1.5`, `1e9`, `"3"` → rejected
- `items: []` and `items` of length 51 → rejected
- malformed emails (`a@`, `@b.com`, `a b@c.com`, 500 chars) → rejected
- `checkoutKey` of `"../../etc"` or 10 000 chars → rejected
- missing `shippingAddress` when `fulfillmentMethod: 'shipping'` → rejected
- over-long address fields → rejected

In `create-checkout.test.ts`: an invalid body returns **400** and **no Square
call is made** (assert the mock was not called) — that is the security-relevant
assertion.

`pnpm test:coverage` → exit 0, no threshold regression.

## Done criteria

- [ ] Step 1's decision recorded in `plans/README.md`
- [ ] An invalid body returns 400 with a generic message
- [ ] A test asserts no Square call occurs for an invalid body
- [ ] `quantity` must be a positive integer; a fractional value is rejected
- [ ] `email` validated with the same pattern as `back-in-stock.ts`
- [ ] `checkoutKey` must be UUID-shaped when supplied
- [ ] `items.length` capped consistently with `calculate-cart.ts`
- [ ] `src/lib/checkout/fulfillmentBuilders.ts` and `lineItems.ts` unmodified
- [ ] `pnpm check` / `pnpm lint` / `pnpm test:run` / `pnpm build` all exit 0

## STOP conditions

Stop and report if:

- **A legitimate checkout is rejected.** Address and phone rules in particular
  must mirror what Square itself accepts, not what looks tidy. Test with a real
  sandbox checkout before finishing.
- Plan 152 has not landed and you find yourself editing the gift-card or subtotal
  logic. Stop; land 152 first.
- Existing tests in `create-checkout.test.ts` send bodies your validator rejects.
  That means the fixtures were unrealistic **or** the rules are too strict —
  work out which and report; do not just loosen the rule.
- Any verification fails twice after a reasonable fix attempt.

## Maintenance notes

- **The boundary rule**: validate once, at the route edge, and let downstream
  modules trust their inputs. Scattering defensive checks through
  `src/lib/checkout/` would be worse than no validation — it hides where the
  trust boundary is.
- International addresses and phone formats are the likeliest source of false
  rejections. Keep length caps generous and format rules loose; the goal is
  rejecting garbage, not enforcing a format.
- A reviewer should confirm the client-facing error is generic and the detailed
  reason is logged server-side only.
- **Deliberately deferred**: applying the same validation to other public POST
  routes. Worth doing, separate plan.
