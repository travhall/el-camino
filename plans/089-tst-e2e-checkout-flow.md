# Plan 089: Add E2E test for complete checkout flow

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 915a062..HEAD -- e2e/`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: test-coverage
- **Planned at**: commit `915a062`, 2026-08-01

## Why this matters

`e2e/cart-flow.spec.ts` tests the cart UI but stops before checkout. The Square payment link creation (`POST /api/create-checkout`) and subsequent redirect to Square's hosted payment page are never exercised in CI. A regression in the checkout POST handler (broken JSON, missing required fields) would reach production undetected.

The E2E test should mock the Square API response or use test credentials — it must NOT create real payment links.

## Current state

Run `ls e2e/` to see existing Playwright test files. Read `e2e/cart-flow.spec.ts` to understand the existing test patterns (selectors, helper functions, base URL config).

## Commands

| Purpose   | Command              | Expected |
|-----------|----------------------|---------|
| E2E tests | `pnpm test:e2e`      | all pass |

## Scope

**In scope**: `e2e/checkout-flow.spec.ts` (new file)

**Out of scope**: `src/pages/api/create-checkout.ts` — no source changes; unit tests for that handler already exist

## Git workflow

- Branch: `advisor/089-tst-e2e-checkout-flow`
- Commit: `test: add E2E test for checkout flow`

## Steps

### Step 1: Read existing E2E setup

Read `e2e/cart-flow.spec.ts` and `playwright.config.ts` (or equivalent) to understand:
- How the dev server is started for E2E
- How Square API calls are intercepted or mocked (if at all)
- What test fixtures/helpers exist

### Step 2: Determine Square mock strategy

Check if there's a way to intercept `POST /api/create-checkout` in Playwright:

```typescript
// Option A: Mock the Square API call at the network level
await page.route('**/squareup.com/**', route => route.fulfill({ json: mockCheckoutResponse }));

// Option B: Stub create-checkout to return a test URL
await page.route('**/api/create-checkout', route => route.fulfill({
  json: { checkoutUrl: 'http://localhost:PORT/test-payment-success' }
}));
```

Choose the approach that matches the existing pattern.

### Step 3: Write the checkout E2E test

```typescript
// e2e/checkout-flow.spec.ts
test('checkout flow: add item, proceed, receive checkout URL', async ({ page }) => {
  // 1. Navigate to a product page
  // 2. Add an item to cart
  // 3. Open cart
  // 4. Click "Continue to Payment"
  // 5. Intercept /api/create-checkout POST
  // 6. Assert request body has required fields (items, fulfillmentMethod)
  // 7. Assert response returns a checkoutUrl
});
```

**Verify**: `pnpm test:e2e` → new test passes

## Done criteria

- [ ] `e2e/checkout-flow.spec.ts` exists with at least one passing test
- [ ] `pnpm test:e2e` exits 0
- [ ] No real Square payment links are created during test
- [ ] No source files modified
- [ ] `plans/README.md` status updated to DONE

## STOP conditions

- Cannot intercept the Square API call without significant infrastructure work — scope down to testing the `POST /api/create-checkout` handler at the API level (already covered by unit tests); mark this plan as ADJUSTED with a note

## Maintenance notes

- E2E tests against the checkout flow are environment-sensitive. If Square sandbox credentials are available, consider a full-path E2E with `SQUARE_ENVIRONMENT=sandbox`.
