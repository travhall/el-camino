# Plan 142: Add characterization tests for `pdpUI.ts` and `pdpEvents.ts`

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat cdf74a3..HEAD -- src/lib/product/pdpUI.ts src/lib/product/pdpEvents.ts`
> If either file changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding; on a mismatch,
> treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: L
- **Risk**: LOW
- **Depends on**: none
- **Category**: test-coverage
- **Planned at**: commit `cdf74a3`, 2026-09-04

## Why this matters

`src/lib/product/pdpUI.ts` (486 lines) and `src/lib/product/pdpEvents.ts`
(350 lines) are the largest coverage gap by line count in the repo outside
the webhook/WordPress code — confirmed 0% coverage, no matching test files
exist (only `pdpController.test.ts`, `pdpController-real.test.ts`, and
`quickViewController.test.ts` exist under
`src/lib/product/__tests__/`, none of which import from these two files).
Together they own the entire product-detail-page interaction surface:
variant/attribute selection, quantity stepper logic, add-to-cart wiring
(including the cart-availability check, loading-state button management,
and MiniCart-open behavior), and every DOM update that reflects
availability/price/image state. A regression here (e.g. a stepper that lets
quantity exceed stock, or an add-to-cart handler that double-fires) ships
silently today.

This repo already has an established pattern for characterizing exactly
this kind of DOM-heavy, singleton-style controller without an exhaustive
test suite: `src/lib/product/__tests__/quickViewController.test.ts`
(`QuickViewController`, extracted by Plan 053) explicitly states its goal as
"coverage of the singleton pattern and a couple of key public methods, not
exhaustive behavior testing." `PDPEventManager` (`pdpEvents.ts`) depends on
the *exact same four modules* that file already mocks
(`@/lib/cart`, `@/lib/product/pdpUI`'s `PDPUIManager` class,
`@/lib/square/errorUtils`, `@/lib/events`) — this plan follows that file's
mocking setup directly rather than inventing a new approach.

## Current state

**`src/lib/product/pdpUI.ts`** (full file, 486 lines) — `PDPUIManager` class,
constructed with optional custom element IDs, caches DOM elements by ID in
its constructor (`cacheElements`, lines 52-98). No external module
dependencies beyond pure functions/types from `@/lib/square/types` and
`MoneyUtils` from `@/lib/square/money` — this makes it the easier, more
valuable target to test directly with real `happy-dom` DOM fixtures, no
mocking required at all. Public methods:
`updateAvailabilityDisplay`, `updateQuantityControls`,
`updateAddToCartButton`, `updateImageOverlay`, `updateInventoryDisplay`,
`updatePriceDisplay`, `updateProductImage`, `updateButtonProductData`,
`updateAttributeButtonStates`, `updateVariationButtonStates`,
`updateGalleryThumbnails`, `resetQuantityToOne`, `getQuantityValue`,
`setButtonText`, `refreshElements`.

**`src/lib/product/pdpEvents.ts`** (full file, 350 lines) — `PDPEventManager`
class, constructed with a `PDPUIManager` instance, `ProductPageData`, and a
`callbacks` object (`onAttributeSelection`, `onVariationSelection`,
`onCartUpdate`). `setupAllEventHandlers()` wires 6 private setup methods
(attribute buttons, quantity controls, fallback variation buttons,
add-to-cart, cart event listener, location modal). The highest-value
private method is `handleAddToCart` (lines 172-244) — async, validates
quantity, checks `cart.canAddToCart(...)`, calls `cart.addItem(...)`,
shows a notification, resets quantity, fires `onCartUpdate`, and
conditionally dispatches `openMiniCart` on desktop widths — plus a
`finally` block with a documented ordering subtlety (comment at lines
236-240: `setButtonLoading(false)` can overwrite `onCartUpdate()`'s state,
so `onCartUpdate()` is called again after it).

Exemplar mocking setup — `src/lib/product/__tests__/quickViewController.test.ts`
(lines 1-40+):
```ts
vi.mock("@/lib/cart", () => ({
  cart: {
    getProductAvailability: vi.fn(() => ({ state: "AVAILABLE", total: 10, inCart: 0, remaining: 10, canAdd: true })),
    canAddToCart: vi.fn(() => true),
    addItem: vi.fn(() => Promise.resolve({ success: true })),
  },
}));
vi.mock("@/lib/product/pdpUI", () => ({
  PDPUIManager: class {
    updateAvailabilityDisplay = vi.fn();
    updatePriceDisplay = vi.fn();
    updateProductImage = vi.fn();
    updateButtonProductData = vi.fn();
    updateAttributeButtonStates = vi.fn();
  },
}));
vi.mock("@/lib/square/errorUtils", () => ({
  processClientError: vi.fn((error) => ({ message: String(error) })),
  logError: vi.fn(),
}));
vi.mock("@/lib/events", () => ({
  showNotification: vi.fn(),
}));
```
Test environment is `happy-dom` globally (`vitest.config.ts:8`), so
`document.body.innerHTML = ...` fixture setup (as `quickViewController.test.ts`
does) works without any per-file environment override.

## Commands you will need

| Purpose   | Command                                          | Expected on success |
|-----------|-------------------------------------------------------|----------------------|
| Typecheck | `pnpm check`                                        | exit 0, no errors    |
| Tests     | `pnpm test:run -- pdpUI pdpEvents`                 | all pass             |
| Coverage  | `pnpm test:coverage`                                 | exit 0, thresholds met |

## Scope

**In scope**:
- New file: `src/lib/product/__tests__/pdpUI.test.ts`
- New file: `src/lib/product/__tests__/pdpEvents.test.ts`

**Out of scope**:
- `src/lib/product/pdpUI.ts`, `src/lib/product/pdpEvents.ts` themselves —
  tests only, no source changes. If a test reveals what looks like a real
  bug, report it and stop rather than silently fixing source or writing the
  test to match buggy behavior.
- `src/lib/product/pdpController.ts` and its existing tests, and
  `src/lib/product/quickViewController.ts` and its existing test — untouched
  (used only as reference/exemplar).
- Exhaustive coverage of every private method in `pdpEvents.ts` — per this
  repo's established "characterization, not exhaustive" precedent
  (`quickViewController.test.ts`'s stated goal), this plan targets the
  highest-value public surface and `handleAddToCart`, not every DOM
  wiring detail.

## Git workflow

- Branch: `advisor/142-test-pdp-events-and-ui`
- One commit per file (pdpUI first, then pdpEvents) or a single combined
  commit — operator's call.
- Commit message style: lowercase, conventional-ish prefix, e.g.
  `test: add characterization tests for pdpUI.ts and pdpEvents.ts`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Test `PDPUIManager` — start here, it's dependency-free

Create `src/lib/product/__tests__/pdpUI.test.ts`. Set up
`document.body.innerHTML` in a `beforeEach` with the element IDs
`PDPUIManager`'s default `cacheElements` expects (`price-display`,
`original-price-display`, `unit-display`, `quantity-input`,
`add-to-cart-button`, `decrease-quantity`, `increase-quantity`,
`product-image`, `product-image-container`, `remaining-count`,
`cart-quantity`, `inventory-status`, plus `quantity-stepper` and
`gallery-thumbnails` for the methods that touch those directly by ID).
Instantiate `new PDPUIManager()` fresh per test (no mocking needed — real
DOM via `happy-dom`).

Cases, using minimal fixture `ProductAvailabilityInfo`/`SaleInfo` objects
(check `@/lib/square/types` for exact shapes):
- `updateQuantityControls`: for a normal in-stock product, sets
  `quantityInput.value`/`.max` correctly and enables/disables the
  increase/decrease buttons at the boundaries (value at max → increase
  disabled; value at 1 → decrease disabled). For `isGiftCard: true`, caps
  max at 10 regardless of `info`, defaults quantity to 1, never disables
  the input. Shows/hides the `#quantity-stepper` element per the documented
  `AVAILABLE && effectiveMax > 1` (or gift-card) condition.
- `updateAddToCartButton`: sets button text and disabled state from
  `getButtonText`/`isButtonDisabled` for at least an `AVAILABLE` and an
  `OUT_OF_STOCK` state.
- `updateImageOverlay`: injects a `[data-overlay="stock"]` element for
  `OUT_OF_STOCK` (and adds `opacity-75` to the image); injects
  `[data-overlay="sale"]` with the discount-percent text when `saleInfo` is
  given and state isn't out-of-stock; removes any existing overlay before
  adding a new one (call it twice with different states, assert only one
  overlay element exists after).
- `updateInventoryDisplay`: shows/hides `remaining-count` correctly for
  gift cards vs. not; shows the "in cart" count only when `info.inCart > 0`;
  injects the out-of-stock message into `inventory-status` only for
  `OUT_OF_STOCK`.
- `updatePriceDisplay`: with no `saleInfo`, sets the formatted price and
  hides `original-price-display`; with `saleInfo`, shows the strikethrough
  original price and the sale price; re-attaches `unit-display` as a child
  of `price-display` after the `textContent` reset (this is the subtle
  behavior documented in the source's own comment at lines 259-264 — assert
  `unit-display` is still present in the DOM and shows/hides correctly
  based on whether `unit` was passed).
- `updateAttributeButtonStates`: given a button with
  `data-attribute-type`/`data-attribute-value`, asserts the
  available/selected class toggling and `aria-pressed`/`aria-label`
  behavior for both an available-and-selected and an
  unavailable-and-unselected button.
- `getQuantityValue`/`resetQuantityToOne`: round-trip correctly.
- `updateGalleryThumbnails`: hides the container for 0 or 1 image; renders
  one `.gallery-thumb` button per image for 2+, with the first marked
  `aria-pressed="true"`; updates the main image `src` to the first image.

**Verify**: `pnpm test:run -- pdpUI` → all cases pass.

### Step 2: Test `PDPEventManager` — mock the four dependencies

Create `src/lib/product/__tests__/pdpEvents.test.ts`. Copy the `vi.mock`
blocks for `@/lib/cart`, `@/lib/product/pdpUI` (mock `PDPUIManager` as a
class with the methods `PDPEventManager` actually calls on it:
`updateVariationButtonStates`, `refreshElements`, `getQuantityValue`,
`resetQuantityToOne` — check the source for the exact set), `@/lib/square/errorUtils`,
and `@/lib/events` (note: `pdpEvents.ts` also imports `showLocationModal`
from `@/lib/events`, not just `showNotification` — include both in the
mock) directly from `quickViewController.test.ts`'s pattern.

Set up a minimal DOM fixture with `#add-to-cart-button` (with a
`data-product` attribute holding a JSON product string),
`#quantity-input`/`#decrease-quantity`/`#increase-quantity`, and at least
one `.attribute-button` and one `[data-variation-id]` element, matching
what `setupAllEventHandlers`'s sub-methods query for.

Cases:
- **Constructor + `setupAllEventHandlers`**: instantiating and calling it
  doesn't throw, and attaches `data-add-to-cart-ready="true"` to the
  (cloned) add-to-cart button (the source's own documented e2e-test hook,
  lines 164-166) — a cheap, valuable smoke assertion.
- **`handleAddToCart` success path**: mock `cart.canAddToCart` → `true`,
  `cart.addItem` → `{ success: true, message: '...' }`. Simulate a click on
  the add-to-cart button (or call the handler path it wires up). Assert:
  `showNotification` called with a success-style call; `onCartUpdate`
  callback invoked; quantity reset. Do NOT assert on the `openMiniCart`
  `CustomEvent` dispatch unless you also mock/control `window.innerWidth`
  in the test environment — if `happy-dom`'s default width doesn't
  reliably hit the `>= 1024` branch, skip asserting that specific dispatch
  rather than writing a flaky assertion.
- **`handleAddToCart` — invalid quantity**: quantity input value set to
  `0` or non-numeric → `showNotification` called with the "Please enter a
  valid quantity" error, `cart.addItem` NOT called.
- **`handleAddToCart` — `canAddToCart` returns false**: `showNotification`
  called with "Cannot add that quantity to cart", `cart.addItem` NOT
  called.
- **`handleAddToCart` — `cart.addItem` rejects**: mock `cart.addItem` to
  reject → `processClientError`/`logError` called, `showNotification`
  called with the generic failure message, and — this is the specific
  behavior documented in the source's own comment at lines 234-243 — the
  button's loading state is cleared and `onCartUpdate` is called in the
  `finally` block regardless of success or failure. Assert `onCartUpdate`
  was called even on this failure path.
- **Double-submit guard**: calling the add-to-cart flow while
  `isProcessing` is already `true` (or firing two rapid clicks) results in
  `cart.addItem` being called only once — this is the class's own
  documented guard (`if (button.disabled || this.isProcessing) return;`,
  line 173).

**Verify**: `pnpm test:run -- pdpEvents` → all cases pass.

## Test plan

This entire plan *is* the test plan — see Steps 1-2 above for the exact
cases. `pdpUI.test.ts` needs no mocking (real DOM assertions);
`pdpEvents.test.ts` mocks exactly the four modules
`quickViewController.test.ts` already mocks for the same underlying
dependencies.

- Verification: `pnpm test:run -- pdpUI pdpEvents` → all new cases pass.
- Verification: `pnpm test:coverage` → both files rise substantially from
  their current 0% baseline; no repo-wide threshold regression.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm check` exits 0
- [ ] `pnpm test:run -- pdpUI` exits 0, covering the methods listed in
      Step 1
- [ ] `pnpm test:run -- pdpEvents` exits 0, covering the cases listed in
      Step 2
- [ ] `pnpm test:coverage` exits 0, no threshold regression; both
      `pdpUI.ts` and `pdpEvents.ts` measurably above their 0% baseline
- [ ] Only the two new test files created (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Either source file's live content doesn't match "Current state" (drift).
- A test reveals what looks like a real bug (e.g. the double-submit guard
  doesn't actually prevent a second `cart.addItem` call, or the
  `onCartUpdate`-after-`setButtonLoading` ordering documented in the
  source's own comment doesn't hold) — report it as a separate finding
  rather than "fixing" the source inline (out of scope for this plan) or
  writing the test to match the buggy behavior.
- `window.innerWidth`/`happy-dom`'s viewport behavior makes the
  `openMiniCart` dispatch assertion unreliable — skip that specific
  assertion per Step 2's guidance rather than fighting the test
  environment for it.

## Maintenance notes

- `pdpEvents.test.ts`'s mock of `PDPUIManager` (a plain class with `vi.fn()`
  methods) means these tests don't catch a real integration bug between
  `PDPEventManager` and the *real* `PDPUIManager` — that's an accepted
  tradeoff of the characterization-test approach already established by
  `quickViewController.test.ts`. If integration-level coverage is wanted
  later, that's a separate, larger effort (e.g. an E2E test exercising the
  real PDP page).
- If `handleAddToCart`'s `finally`-block ordering (documented in the
  source's own comment) ever changes, revisit this plan's "cart.addItem
  rejects" test case — it's specifically asserting that documented
  behavior.
