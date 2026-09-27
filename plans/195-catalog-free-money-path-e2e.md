# Plan 195: Money-path e2e that runs without Square (seeded cart + mocked APIs)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 426d14e..HEAD -- src/pages/cart.astro src/lib/cart/index.ts src/lib/cart/types.ts e2e/ playwright.config.ts .github/workflows/ci.yml`
> On any change, compare against the excerpts below; on a mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW (test-only)
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `426d14e`, 2026-09-26

## Why this matters

The design audit could not exercise add-to-cart → cart edit → Square checkout
handoff because no Square/WordPress credentials were available, and flagged
that path as the one where "a UX regression costs revenue directly."
Today nearly every cart e2e is tagged `@needs-catalog` because it starts by
clicking a real product on `/shop/all`, so the money path only runs where real
Square data exists. But the cart page reads its items from `localStorage`, and
its three network calls (`/api/cart-inventory`, `/api/calculate-cart`,
`/api/create-checkout`) are easy to mock with Playwright. Seeding the cart and
mocking those routes lets the cart/quantity/limit/checkout-handoff logic run
anywhere (including a credential-less CI or a fresh clone).

This plan does **not** replace a real Square-sandbox check — see the manual
checklist in Step 5.

## Current state

- Cart persistence: `src/lib/cart/index.ts:26` `const CART_STORAGE_KEY = 'cart'`; on load (`~line 126-160`) it `JSON.parse`s an **array** of `CartItem` from `localStorage['cart']`, keeping items with truthy `id` and `quantity > 0`, keyed by `` `${item.id}:${item.variationId}` ``. On load it also fires a sale-info fetch (`fetchSaleInfoForCartItems`) — mock or tolerate its failure (check what URL it calls in that function; `page.route` it to a benign response or confirm it fails soft).
- `CartItem` (`src/lib/cart/types.ts`): `{ id, catalogObjectId, variationId, title, price (number, dollars), quantity, image?, variationName?, unit?, saleInfo?, isGiftCard? }`.
- Cart page `src/pages/cart.astro`: `#cart-loading` → either `#empty-cart` or `#cart-content` (~lines 1076-1092); items rendered into `#cart-items-list`; subtotal `#subtotal`; `#checkout-button` (~line 122); `#clear-cart-button`; fulfillment UI: `[data-tab="pickup"]`, `#pickup-name`, `#pickup-email`, `#pickup-phone`, `#fulfillment-done-btn`, `input[name="fulfillment"]`.
- Network calls made by the page (all `POST`, JSON): `fetch('/api/cart-inventory', { variationIds })` (~line 367) → expects `{ success: true, inventory: { [variationId]: number } }` (on failure the page falls back to `99` per item — a behavior worth asserting); `fetch('/api/calculate-cart', { items, fulfillmentMethod })` (~line 1029) → expects `{ success: true, shipping, tax, total, … }` (read the code after line 1029 for every field the UI consumes before writing the mock); `fetch('/api/create-checkout', …)` (~line 651) → `{ checkoutUrl, orderId?, cartUpdated?, adjustedCart?, stockMessage? }`; a non-ok response or missing `checkoutUrl` throws and surfaces an error notification.
- Existing precedent to model on: `e2e/checkout-flow.spec.ts` (it already mocks `**/api/create-checkout` and asserts the request body; but it first adds a real product → `@needs-catalog`) and `e2e/mini-cart-accessibility.spec.ts` (structure, desktop-only skip for mobile projects). `e2e/README.md` documents conventions; `e2e/helpers/test-helpers.ts` has `clearCart`.
- Desktop only: cart specs `test.skip` mobile projects because `CartButtonMobile` differs (copy the skip from `checkout-flow.spec.ts:8-22`).
- CI: `.github/workflows/ci.yml:~86` runs a PR-gate subset selected by the `@needs-catalog` tag. **Do not tag the new spec `@needs-catalog`** — it must not need catalog data. Read that CI section before finishing to confirm how untagged specs are treated and don't change CI (out of scope) — just report what happens.

## Commands you will need

| Purpose | Command | Expected |
|---------|---------|----------|
| Run new spec | `pnpm exec playwright test e2e/money-path.spec.ts --project=chromium` | all pass (dev server auto-starts via `playwright.config.ts` webServer) |
| Typecheck | `pnpm check` | 0 errors |
| Lint | `pnpm lint` | exit 0 |
| Unit tests | `pnpm test:run` | all pass (vitest excludes `e2e/**`) |

## Scope

**In scope**:
- `e2e/money-path.spec.ts` (create)
- `e2e/helpers/test-helpers.ts` (add a `seedCart(page, items)` helper + a `mockCartApis(page, opts)` helper if it reduces duplication — keep additions small)
- `e2e/README.md` (add a short section documenting the new spec + that it needs no catalog)

**Out of scope**:
- `.github/workflows/ci.yml`, `playwright.config.ts` — no config changes
- Any `src/` file — if a selector is missing, use an existing one; if you need a `data-testid` added to `cart.astro`, STOP and report instead
- `e2e/cart-flow.spec.ts`, `e2e/checkout-flow.spec.ts` (leave existing tests as they are)

## Git workflow

- Branch: `advisor/195-money-path-e2e`
- Conventional commit: `test(e2e): add catalog-free cart and checkout money-path spec`
- Do NOT push or open a PR.

## Steps

### Step 1: Helpers
In `e2e/helpers/test-helpers.ts` add `seedCart(page, items: SeedItem[])`: existing specs do `goto('/')` then `evaluate(localStorage.clear())`; for seeding, `page.evaluate(items => localStorage.setItem('cart', JSON.stringify(items)), items)` **then** `page.goto('/cart')` (or use `page.addInitScript` if that proves more reliable). Also add a typed `mockCartApis(page, { inventory?, calculate?, checkout? })` that installs `page.route` handlers for the three endpoints with sane defaults (inventory: 10 per variation; calculate: `{ success: true, shipping: 0, tax: 0, total: <sum> }` — confirm the shape the UI consumes from `cart.astro` after line 1029; checkout: `{ success: true, checkoutUrl: 'http://localhost:4321/', orderId: 'e2e-order' }`). Also route any sale-info endpoint the cart module fetches on load (see Current state) to a benign empty response.

**Verify**: `pnpm check` → 0 errors (if `pnpm check` doesn't cover `e2e/`, run `pnpm exec tsc --noEmit -p tsconfig.json` and confirm no new errors under `e2e/`).

### Step 2: Spec — the cases (desktop only, non-`@needs-catalog`)
`e2e/money-path.spec.ts`, using two fixture items (synthetic titles/ids, prices e.g. `25.00` and `10.50`):
1. **Renders seeded cart**: `/cart` shows both line items in `#cart-items-list`, `#cart-content` visible, `#empty-cart` hidden, `#subtotal` = expected sum.
2. **Empty state**: with an empty `localStorage`, `#empty-cart` is visible and contains a link to `/shop/all`.
3. **Quantity edit**: increase quantity on item 1 → subtotal updates; decrease to 0 / remove → item disappears; last removal shows empty state.
4. **Inventory limit**: mock inventory `{ [variationId]: 2 }` and seed quantity 2 → the "increase" control is disabled or at the cap (inspect `cart.astro`'s render code around the inventory clamp to assert the actual behavior — write the assertion to the real behavior, not a guess).
5. **Inventory endpoint failure**: `/api/cart-inventory` returns 500 → page still renders the cart (fallback to 99 per item), no crash (`console.error` is expected; assert the cart still shows).
6. **Checkout handoff (pickup)**: follow `checkout-flow.spec.ts` steps 3-9 but with the seeded cart and mocked APIs: select pickup, fill name/email/phone, click `#fulfillment-done-btn`, assert `#checkout-button` enabled, click, assert the `POST /api/create-checkout` body has `items[]` matching seeded `variationId`/`quantity`, `fulfillmentMethod: 'pickup'`, `pickupContact`, and that the browser navigates to the mocked `checkoutUrl`.
7. **Checkout server error**: mock `create-checkout` → 500 `{ error: 'boom' }`: user stays on `/cart`, an error notification appears (`#notification-container` contains text), checkout button re-enabled (not stuck in loading).
8. **Server-adjusted cart**: mock `create-checkout` → `{ success: true, checkoutUrl, cartUpdated: true, adjustedCart: [...reduced qty], stockMessage: 'Only 1 left' }` → the stock message appears and the cart quantity reflects the adjustment (the code waits 3 s after `stockMessage` — assert with an appropriate timeout).
Use `test.use({ viewport: { width: 1280, height: 800 } })` and the mobile-project skip.

**Verify**: `pnpm exec playwright test e2e/money-path.spec.ts --project=chromium` → 8 tests pass. Run with `--repeat-each=3` → all pass (no flakes).

### Step 3: Shipping path
Add a 9th test for the **shipping** branch (`fulfillmentMethod: 'shipping'`): read `cart.astro:~553-610` to see the required address fields/selectors and assert the checkout request includes them. If the shipping form needs a live address-validation service, STOP and report instead of mocking blindly.

**Verify**: same command → 9 pass.

### Step 4: Docs
Add a short section to `e2e/README.md` under the test list: "Money-path spec (`money-path.spec.ts`) — seeds `localStorage['cart']` and mocks `/api/cart-inventory`, `/api/calculate-cart`, `/api/create-checkout`, so it runs with no Square/WordPress credentials."

### Step 5: Manual Square-sandbox checklist (record in the plan status row — do not run)
The mocked spec cannot verify real Square behavior. When someone has sandbox credentials, verify by hand: add a real item → edit quantity to the stock limit → choose pickup and ship → reach the Square hosted checkout with correct line items and tax → complete a sandbox payment → land on `/order-confirmation`. Copy this checklist into the plan's status-row note in `plans/README.md`.

## Test plan

Steps 2-3 are the tests. Run under all desktop projects at least once (`pnpm exec playwright test e2e/money-path.spec.ts`) — webkit may need the same focus-behavior caveats documented in `mini-cart-accessibility.spec.ts`; if a test is webkit-flaky due to those known Safari behaviors, skip that project for that test with a comment (as that file does), not the whole spec.

## Done criteria

- [ ] `pnpm exec playwright test e2e/money-path.spec.ts --project=chromium --repeat-each=3` exits 0
- [ ] `grep -c "@needs-catalog" e2e/money-path.spec.ts` → `0`
- [ ] `pnpm check`, `pnpm lint`, `pnpm test:run` exit 0
- [ ] `git status` shows only in-scope files changed (no `src/` changes)
- [ ] `plans/README.md` status row updated, including the Step 5 manual checklist

## STOP conditions

- A required selector doesn't exist and testing needs a `data-testid` added in `src/` (out of scope) — list exactly which.
- The shipping form requires a live third-party service (Step 3).
- Seeded cart items are rejected/overwritten by the cart module (e.g. server reconciliation on load discards them) in a way that can't be mocked.
- CI's tag-selection logic would run the untagged new spec in a job that has no browsers/webServer env (report what you find; do not edit CI).

## Maintenance notes

- If the cart's `localStorage` schema changes (`CartItem` in `src/lib/cart/types.ts`), update `seedCart` — the spec will fail loudly, which is the point.
- If the calculate-cart response shape changes, update the single default in `mockCartApis`.
- Keep this spec free of real network calls; a real-Square variant belongs behind an env flag in a separate spec.
