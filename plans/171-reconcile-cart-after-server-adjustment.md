# Plan 171: Reconcile the client cart when the server drops or trims items at checkout

> **Executor instructions**: Follow step by step. Run every verification command
> and confirm the expected result. If anything in "STOP conditions" occurs, stop
> and report. When done, update this plan's status row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat ad2999d..HEAD -- src/pages/api/create-checkout.ts src/pages/cart.astro src/lib/cart/index.ts`
> On any change, compare against the excerpts below; on a mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: 152 (soft — same API file)
- **Category**: bug
- **Planned at**: commit `ad2999d`, 2026-09-05

## Why this matters

When checkout removes out-of-stock items or reduces quantities, the server tells
the client — and the client ignores it.

`/api/create-checkout` returns a `cartUpdated` boolean alongside `stockMessage`.
The cart page reads **only** `stockMessage`, shows a toast, waits 3 seconds, and
redirects to Square. `cartUpdated` is read nowhere in the client.

So the customer is sent to pay for the **adjusted** order while `localStorage`
still holds the **original** cart. After paying they return to a cart that still
contains items they were just told were removed, with a wrong mini-cart badge
count — leading to duplicate add-to-cart attempts and support contacts.

The flag was clearly built for this and left unwired. It is even asserted in the
route's own tests, which is why it has never looked broken.

## Current state

`src/pages/api/create-checkout.ts:305-313` — the server tells the truth:

```ts
      JSON.stringify({
        success: true,
        checkoutUrl: linkResponse.paymentLink?.url,
        orderId,
        fulfillmentMethod,
        shippingCost: fulfillmentMethod === 'shipping' ? shippingRate : 0,
        stockMessage: stockMessage || undefined,
        cartUpdated: removedItems.length > 0 || adjustedItems.length > 0,
      }),
```

`src/pages/cart.astro:657-669` — the client uses half of it:

```astro
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Checkout failed');
      if (!data.checkoutUrl) throw new Error('No checkout URL returned');

      if (data.stockMessage) {
        showNotification(data.stockMessage, 'error');
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }

      if (data.orderId) {
        sessionStorage.setItem('square-pending-orderId', data.orderId);
      }

      showNotification('Redirecting to checkout...', 'success');
```

`src/pages/api/__tests__/create-checkout.test.ts:218` asserts the flag:

```ts
    expect(json.cartUpdated).toBe(true);
```

A repo-wide grep for `cartUpdated` outside this route and its test finds **only**
DOM event listeners for a same-named `cartUpdated` browser event
(`CartButton.astro:94`, `mini-cart-client.ts:725`, etc.) — unrelated to the
response field. Do not confuse the two; the name collision is itself a hazard.

`src/lib/cart/index.ts` is the `CartManager` that owns `localStorage` state and
dispatches that DOM event (`:73`, `:108`, `:217`). It is well covered by
`src/lib/cart/__tests__/` and has a **per-file coverage threshold** in
`vitest.config.ts`.

## Commands you will need

| Purpose   | Command                                   | Expected             |
|-----------|-------------------------------------------|----------------------|
| Typecheck | `pnpm check`                              | exit 0               |
| Tests     | `pnpm test:run -- cart create-checkout`   | all pass             |
| Full      | `pnpm test:run`                           | exit 0               |
| Coverage  | `pnpm test:coverage`                      | exit 0, no regression|
| Lint      | `pnpm lint`                               | exit 0               |
| Dev server| `pnpm dev`                                | serves on :4321      |

Never use `pnpm test` — watch mode, it hangs.

## Scope

**In scope**:
- `src/pages/api/create-checkout.ts` (extend the response only)
- `src/pages/cart.astro` (the checkout response handler)
- `src/lib/cart/index.ts` (only if a reconciliation method is needed)
- the corresponding test files

**Out of scope** (do NOT touch):
- The gift-card / subtotal logic — **plan 152**. Land 152 first.
- The `cartUpdated` **DOM event** and its listeners. Same name, different thing.
- The 3-second toast delay. It is a UX choice; leave it.
- Mini-cart internals — it already listens to the DOM event and will update once
  `CartManager` state changes.

## Git workflow

- Branch: `advisor/171-reconcile-cart-after-server-adjustment`
- Conventional commits, e.g. `fix: apply server cart adjustments to the client before redirecting`
- Do NOT push or open a PR unless the operator instructs it.

## Steps

### Step 1: Return the adjusted cart, not just a boolean

`cartUpdated: true` tells the client *that* something changed but not *what*.
Extend the response with the actual outcome — the surviving item list with final
quantities, plus the removed `variationId`s.

Use `variationId` as the key, not the display title. `removedItems` currently
collects `item.title` (`create-checkout.ts:~106`), which is not a stable
identifier and can collide.

Keep `cartUpdated` and `stockMessage` in the response for backward compatibility;
the existing test asserts them.

**Verify**: `pnpm check` → exit 0. `pnpm test:run -- create-checkout` → existing
tests still pass.

### Step 2: Add a reconciliation method to `CartManager`

Add a method that takes the server's authoritative item list and makes local
state match — removing absent items and clamping quantities — then dispatches the
existing `cartUpdated` DOM event once, so the badge and mini-cart update.

Do **not** reuse `removeItem`/`updateQuantity` in a loop if that fires an event
per mutation; a single reconciliation should produce a single event.

**Verify**: `pnpm check` → exit 0.

### Step 3: Call it before redirecting

In `cart.astro`'s handler, when `data.cartUpdated` is true, apply the
reconciliation **before** the 3-second delay, so the user watches the cart
correct itself while reading the toast.

Order matters: reconcile → show toast → delay → redirect.

**Verify**: `grep -n "cartUpdated" src/pages/cart.astro` → the response field is
now read.

### Step 4: Verify the real flow in a browser

With `pnpm dev`:

1. Add an item, then make it out-of-stock server-side (or mock the response).
2. Click checkout.

**Verify**: the toast appears, the cart visibly drops the item, the mini-cart
badge decrements, and only then does the redirect happen. Navigate back — the
item is still gone. Record what you observed.

### Step 5: Full gate

```bash
pnpm check && pnpm lint && pnpm test:run && pnpm test:coverage
```
→ all exit 0.

## Test plan

`src/lib/cart/__tests__/` — follow the existing suite's style:

- reconciling with an item removed → local state drops it
- reconciling with a reduced quantity → local quantity is clamped
- reconciling with no changes → state untouched, and **no spurious event**
- reconciliation dispatches `cartUpdated` **exactly once**
- reconciling against an empty server list → cart emptied

`create-checkout.test.ts`: the response includes the adjusted item list keyed by
`variationId` when items were removed or clamped.

`pnpm test:coverage` → exit 0. `src/lib/cart/index.ts` has a per-file threshold
(note its documented ~84% branch ceiling from `import.meta.hot` guards) — confirm
it still passes.

## Done criteria

- [ ] The response carries the adjusted item list keyed by `variationId`
- [ ] `grep -n "data.cartUpdated" src/pages/cart.astro` → the field is read
- [ ] `CartManager` reconciliation dispatches exactly one `cartUpdated` DOM event
- [ ] Step 4's browser check performed and recorded
- [ ] Existing `cartUpdated` / `stockMessage` assertions still pass
- [ ] `pnpm check` / `pnpm lint` / `pnpm test:run` all exit 0
- [ ] `pnpm test:coverage` exits 0, `cart/index.ts` per-file threshold still met

## STOP conditions

Stop and report if:

- **Reconciliation would remove an item the customer still wants.** Being too
  aggressive here is worse than the current bug — a wrongly-emptied cart loses a
  sale outright. If the server's list is ambiguous, report.
- The `cartUpdated` DOM event name collision causes a loop (reconciliation
  dispatching an event that triggers another reconciliation). Report; renaming
  one of them may be the right fix, and that is a wider change.
- Plan 152 has not landed and you find yourself editing the gift-card or subtotal
  logic.
- `cart/index.ts`'s per-file coverage threshold drops below its minimum.

## Maintenance notes

- **The name collision is a standing hazard**: `cartUpdated` is both a response
  field and a DOM event. Worth renaming one — the response field to
  `cartWasAdjusted`, say — in a follow-up. Not in this plan, because it touches
  the route's existing tests.
- **The invariant**: after a checkout response, client cart state matches what
  the server is charging for. Any future server-side cart mutation needs the same
  treatment.
- A reviewer should check the event fires once per reconciliation, not once per
  mutated item.
