# El Camino E2E Testing with Playwright

Complete end-to-end testing setup for El Camino e-commerce platform.

## Quick Start

### 1. Installation

```bash
# Install Playwright
pnpm add -D @playwright/test

# Install browsers
npx playwright install

# Install system dependencies (Linux only)
npx playwright install-deps
```

### 2. Run Tests

```bash
# Run all tests
pnpm exec playwright test

# Run with UI (recommended for development)
pnpm exec playwright test --ui

# Run specific test file
pnpm exec playwright test e2e/cart-flow.spec.ts

# Run in headed mode (see browser)
pnpm exec playwright test --headed

# Run on specific browser
pnpm exec playwright test --project=chromium
pnpm exec playwright test --project=firefox
pnpm exec playwright test --project=webkit
```

### 3. View Results

```bash
# Open HTML report
npx playwright show-report

# View trace for failed tests
npx playwright show-trace trace.zip
```

## Project Structure

```
e2e/
├── cart-flow.spec.ts      # Cart operations tests
├── helpers/
│   └── test-helpers.ts    # Reusable test utilities
└── README.md              # This file

playwright.config.ts       # Playwright configuration
```

## Configuration

The `playwright.config.ts` is configured to:

- **Run dev server automatically** - Tests start your local server
- **Test 5 browsers** - Chrome, Firefox, Safari, Mobile Chrome, Mobile Safari
- **Capture failures** - Screenshots, videos, and traces on failure
- **Retry on CI** - 2 retries in CI environments
- **Parallel execution** - Tests run in parallel for speed

## Writing Tests

### Basic Test Structure

```typescript
import { test, expect } from "@playwright/test";

test("should do something", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toBeVisible();
});
```

### Using Helpers

```typescript
import { addFirstProductToCart, verifyCartCount } from "./helpers/test-helpers";

test("should add product", async ({ page }) => {
  const productName = await addFirstProductToCart(page);
  await verifyCartCount(page, 1);
});
```

### Before Each Hook

```typescript
test.beforeEach(async ({ page, context }) => {
  // Clear cart state
  await context.clearCookies();
  await page.evaluate(() => localStorage.clear());
  await page.goto("/");
});
```

## Test Categories

### Cart Flow Tests (cart-flow.spec.ts)

**Priority:** CRITICAL - Core revenue functionality

Tests included:

- ✅ Add product to cart from product page
- ✅ Cart state persistence across page reload
- ✅ Navigate to cart page and display items
- ✅ Update quantity from cart page
- ✅ Remove item from cart
- ✅ Clear entire cart
- ✅ Show inventory constraints
- ✅ Navigate to cart from mini-cart
- ✅ Continue shopping from cart
- ✅ Open cart from header button

### Money-Path Tests (money-path.spec.ts)

**Priority:** CRITICAL - Cart and checkout handoff, no catalog required

Seeds `localStorage['cart']` and mocks `/api/cart-inventory`,
`/api/calculate-cart`, `/api/create-checkout` (plus `/api/sale-info` and the
ZIP autofill lookup), so it runs with no Square/WordPress credentials. It is
intentionally not tagged `@needs-catalog`, so the CI PR gate
(`pnpm test:e2e:gate`) runs it. Helpers: `seedCart` and `mockCartApis` in
`helpers/test-helpers.ts`. Desktop only (mobile projects are skipped).

Covers: seeded cart render, empty state, quantity edit/remove, inventory cap,
inventory-endpoint failure fallback, pickup and shipping checkout requests,
checkout server error, and server-adjusted cart (stock message).

It does not replace a real Square-sandbox check.

### Future Test Suites (To Add)

**checkout-flow.spec.ts** - Checkout process with Square

- Navigate to checkout
- Fill payment form
- Submit order
- Verify order confirmation
- Handle payment errors

**product-browsing.spec.ts** - Product discovery

- Browse product listing
- Filter by brand
- Filter by availability
- Product detail page
- Variation selection
- Search functionality (if implemented)

**admin-dashboard.spec.ts** - Admin tools

- Dashboard loads correctly
- Performance metrics display
- SKU reference functionality
- Navigation between admin tools

**mobile-flows.spec.ts** - Mobile-specific tests

- Mobile navigation
- Mobile cart interactions
- Touch interactions
- Responsive layouts

## Debugging Tests

### Interactive Mode (Recommended)

```bash
# Opens test runner UI - best for development
pnpm exec playwright test --ui
```

### Debug Mode

```bash
# Step through tests with inspector
pnpm exec playwright test --debug
```

### Console Logs

```bash
# Show console output
pnpm exec playwright test --headed --workers=1
```

### Screenshots on All Tests

```bash
# Take screenshot after each action
pnpm exec playwright test --screenshot=on
```

## Common Issues & Solutions

### Issue: Tests timing out

**Solution:** Increase timeout in config or specific test:

```typescript
test("slow test", async ({ page }) => {
  test.setTimeout(60000); // 60 seconds
  // ... test code
});
```

### Issue: Element not found

**Solution:** Add explicit waits:

```typescript
await page.waitForSelector("your-selector", { timeout: 10000 });
```

### Issue: Cart state from previous test

**Solution:** Clear state in beforeEach:

```typescript
test.beforeEach(async ({ page, context }) => {
  await context.clearCookies();
  await page.evaluate(() => localStorage.clear());
});
```

### Issue: Dev server not starting

**Solution:** Start manually:

```bash
# Terminal 1
pnpm dev

# Terminal 2
pnpm exec playwright test --no-server
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - uses: pnpm/action-setup@v2
        with:
          version: 9.15.0

      - uses: actions/setup-node@v3
        with:
          node-version: 20
          cache: "pnpm"

      - name: Install dependencies
        run: pnpm install

      - name: Install Playwright
        run: npx playwright install --with-deps

      - name: Run E2E tests
        run: pnpm exec playwright test
        env:
          CI: true

      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30
```

## Best Practices

### ✅ Do's

- **Use data-testid attributes** for stable selectors
- **Clear state between tests** to avoid flakiness
- **Use helper functions** to reduce duplication
- **Test critical paths first** (cart, checkout)
- **Run tests in CI** on every commit
- **Keep tests independent** - each test should run standalone
- **Use meaningful test names** - describe what's being tested

### ❌ Don'ts

- **Don't use brittle selectors** (nth-child, complex CSS)
- **Don't test external services** directly (mock Square API)
- **Don't make tests dependent** on each other
- **Don't ignore flaky tests** - fix them or mark as skip
- **Don't test implementation details** - test user behavior

## Performance Tips

### Run Tests Faster

```bash
# Run fewer workers
pnpm exec playwright test --workers=2

# Run only changed files
pnpm exec playwright test --only-changed

# Run specific browser
pnpm exec playwright test --project=chromium
```

### Reduce Flakiness

1. Use explicit waits instead of timeouts
2. Wait for network idle: `await page.waitForLoadState('networkidle')`
3. Check element state: `await expect(element).toBeVisible()`
4. Use retry logic for known issues

## Adding New Tests

1. **Create test file** in `e2e/` directory
2. **Import helpers** from `./helpers/test-helpers`
3. **Add beforeEach** to clear state
4. **Write tests** following existing patterns
5. **Run tests** locally before committing
6. **Update this README** with new test descriptions

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [API Reference](https://playwright.dev/docs/api/class-playwright)
- [Selectors Guide](https://playwright.dev/docs/selectors)
- [Debugging Guide](https://playwright.dev/docs/debug)

## Test Coverage Goals

**Current Coverage:**

- ✅ Cart operations: 10/10 tests

**Target Coverage (Future):**

- Cart operations: 10 tests ✅
- Checkout flow: 8 tests 🔄
- Product browsing: 12 tests ⏳
- Admin dashboard: 6 tests ⏳
- Mobile flows: 8 tests ⏳

**Total Target:** 44 E2E tests covering critical user journeys

---

## Quick Reference

```bash
# Install
pnpm add -D @playwright/test && npx playwright install

# Run all tests
pnpm exec playwright test

# Run with UI (best for dev)
pnpm exec playwright test --ui

# Run specific test
pnpm exec playwright test e2e/cart-flow.spec.ts

# Debug mode
pnpm exec playwright test --debug

# View report
npx playwright show-report
```

**Need help?** Check [Playwright Docs](https://playwright.dev) or ask in team chat.
