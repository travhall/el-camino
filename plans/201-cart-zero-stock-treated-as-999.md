# Plan 201: Cart page treats real stock of 0 as 999 (out-of-stock items look purchasable)

> **Executor instructions**: Follow step by step; run every verification command; on any STOP condition stop and report. Do NOT edit `plans/README.md`; report the outcome in your final message.
>
> **Drift check (run first)**: `git diff --stat 9753d7a..HEAD -- src/pages/cart.astro e2e/money-path.spec.ts e2e/helpers/test-helpers.ts` — on any change, re-read the excerpts below; on a mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW-MED (touches the cart page's stock logic; money path)
- **Depends on**: plan 195 (merged — provides `e2e/money-path.spec.ts`, `seedCart`, `mockCartApis`)
- **Category**: bug
- **Planned at**: commit `9753d7a`, 2026-09-27

## Why this matters

`src/pages/cart.astro` reads per-variation stock as `inventoryData[id] || 999`. `||` treats a real stock of `0` as falsy, so an out-of-stock item is treated as having 999 in stock. The code that should show "Out of stock" and block incrementing (`inventory === 0` / `isOutOfStock`) is therefore unreachable, and shoppers can keep increasing the quantity of an out-of-stock item. This is a display/UX bug rather than an oversell — `POST /api/create-checkout` reconciles stock server-side (`cartUpdated`/`adjustedCart`/`stockMessage`) — but the cart page misleads on the money path. One site already does it right (`?? 999`), so the page is also internally inconsistent. Found by the plan-195 executor.

Related but distinct: plan 110 (done) fixed a different fail-open in `src/lib/cart/index.ts` `addItem()` (client-side inventory check rejecting → 999; now fails closed to 0). The codebase convention is fail-closed for inventory. Do not touch that file here.

## Current state

`src/pages/cart.astro` (inline `<script>`), sites verified at `9753d7a`:
- line 389: on inventory fetch failure, `inventoryData[item.variationId] = 99` (intentional fallback; leave alone)
- line 399 (`createCartItem`): `const inventory = inventoryData[item.variationId] || 999;` then `const isOutOfStock = !item.isGiftCard && inventory <= 0;` and later `if (inventory === 0) { stockDisplay = '<div class="text-xs text-red-600">Out of stock</div>' }` — unreachable today
- line 805 (increase handler): `const inventory = inventoryData[item.variationId] || 999;` then `if (newQty <= inventory) {…} else { showNotification(\`Only ${inventory} available\`, 'error') }`
- line 919 (quantity input handler): `cartItem ? (inventoryData[cartItem.variationId] ?? 999) : 999` — **correct**
- line 949 (`updateCartItemQuantity`): `const inventory = inventoryData[item.variationId] || 999;` then `const canIncrement = item.quantity < inventory` (~line 985)

The intended semantics: a variation **missing** from `inventoryData` (unknown) → effectively unlimited (999, existing behaviour, keep it); a variation present with `0` → out of stock. `??` expresses exactly that. (`checkBulkInventory` in `src/lib/square/inventory.ts` already returns 0 for anything it couldn't determine, so missing entries are rare.)

Existing e2e (plan 195): `e2e/money-path.spec.ts` seeds `localStorage['cart']` via `seedCart(page, items)` and mocks `/api/cart-inventory` via `mockCartApis(page, { inventory: { [variationId]: n } })` — it builds the response with `opts.inventory?.[id] ?? 10`, which preserves a `0`. The existing "caps quantity at available inventory" test is the pattern to copy.

## Commands

| Purpose | Command | Expected |
|---|---|---|
| Typecheck | `pnpm check` | 0 errors |
| Lint | `pnpm lint` | exit 0 |
| Unit tests | `pnpm test:run` | all pass |
| e2e (this spec) | see "Running Playwright" below | all pass |

**Running Playwright here**: `pnpm exec playwright test` may fail with "Executable doesn't exist … chromium_headless_shell-1223" because the installed Playwright version wants a browser build that isn't cached, and a `.env` may be absent in a worktree. Do NOT download browsers. Use a temporary config (create it, use it, delete it; do not commit) named `pw.tmp.config.ts` at the repo root:

```ts
import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', retries: 0, reporter: [['list']],
  use: { baseURL: 'http://localhost:4321' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], launchOptions: {
    executablePath: process.env.HOME + '/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell' } } }],
  webServer: { command: 'pnpm dev:ci', url: 'http://localhost:4321', reuseExistingServer: false, timeout: 120000 },
});
```

(confirm which `chromium_headless_shell-*` folder exists with `ls ~/Library/Caches/ms-playwright` and use that one), then run:

`CI=1 SQUARE_ACCESS_TOKEN=ci-stub PUBLIC_SQUARE_APP_ID=ci-stub PUBLIC_SQUARE_LOCATION_ID=ci-stub PUBLIC_SQUARE_ENVIRONMENT=sandbox ADMIN_SECRET=ci-stub-admin-secret-do-not-use ADMIN_PASSWORD=ci-stub RESEND_API_KEY=ci-stub EMAIL_FROM=noreply@example.com pnpm exec playwright test -c pw.tmp.config.ts e2e/money-path.spec.ts`

(the `ci-stub` values are the non-secret placeholders from `.github/workflows/ci.yml`). Port 4321 must be free (`lsof -i :4321`); if another dev server holds it, stop and report.

## Scope

**In scope**: `src/pages/cart.astro` (the three `inventoryData[...] || 999` expressions only), `e2e/money-path.spec.ts` (add tests).
**Out of scope**: the `= 99` fetch-failure fallback (line 389); `/api/cart-inventory`, `/api/create-checkout`, `src/lib/cart/**`; any change to what the checkout button does for an out-of-stock item (observe and report it, don't change it); other pages.

## Git workflow

Branch `advisor/201-cart-zero-stock`; conventional commits (`fix: treat zero stock as out of stock on the cart page`, `test(e2e): cover out-of-stock cart items`). Do NOT push or open a PR.

## Steps

### Step 1: Reproduce with a failing test first
In `e2e/money-path.spec.ts` add, modelled on "caps quantity at available inventory": (a) seed one item (quantity 1), mock inventory `{ [variationId]: 0 }`; assert the cart shows the text `Out of stock` for the item and that its increase button (`[data-action="increase"]` inside the item container) is disabled; (b) with stock `2` and quantity `2`, clicking increase shows the "Only 2 available" notification and does not change the quantity (regression guard for the non-zero path). Run the spec: test (a) must FAIL before Step 2.
**Verify**: the new "Out of stock" test fails with the current code (paste the failure line in your report).

### Step 2: Fix the three sites
Replace `inventoryData[item.variationId] || 999` with `inventoryData[item.variationId] ?? 999` at lines ~399, ~805 and ~949 (leave line ~919 as is; it already uses `??`). Do not refactor beyond that.
**Verify**: `grep -n "|| 999" src/pages/cart.astro` → no output; `grep -c "?? 999" src/pages/cart.astro` → `4`.

### Step 3: Confirm and observe
Run the whole money-path spec (all 9 original tests + your new ones) → all pass, twice (`--repeat-each=2`). While the out-of-stock scenario is on screen, note in your report what `#checkout-button` does (enabled/disabled) and what happens on click — report only, no change.
**Verify**: e2e green; `pnpm check`, `pnpm lint`, `pnpm test:run` exit 0.

## Test plan

Step 1's two tests. They live in the existing spec, so they run in the CI chromium gate (`pnpm test:e2e:gate`) automatically.

## Done criteria

- [ ] `grep -n "|| 999" src/pages/cart.astro` returns nothing
- [ ] New out-of-stock test failed before the fix and passes after
- [ ] All money-path tests pass (`--repeat-each=2`); `pnpm check`, `pnpm lint`, `pnpm test:run` exit 0
- [ ] `git status` shows only `src/pages/cart.astro` and `e2e/money-path.spec.ts` changed (no `pw.tmp.config.ts`)

## STOP conditions

- The out-of-stock test does NOT fail before the fix (the bug isn't reproducible the way described) — report.
- After the fix, `createCartItem` renders something broken for stock 0 (e.g. layout, or the checkout flow throws) — report with the details.
- Fixing requires touching a file outside scope.
- Port 4321 is already in use.

## Maintenance notes

- Question this plan deliberately does not answer: should the checkout button be blocked while an out-of-stock item is in the cart? The server already reconciles at checkout, so today it's a UX choice — raise it with the maintainer using your Step 3 observation.
- Reviewer: check the gift-card path (`item.isGiftCard`) is unaffected — gift cards bypass the stock checks.
