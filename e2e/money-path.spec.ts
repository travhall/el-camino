import { test, expect, type Page } from '@playwright/test';
import {
  mockCartApis,
  seedCart,
  type MockCartApiOptions,
  type SeedItem,
} from './helpers/test-helpers';

/**
 * Money path: cart page → quantity/limit edits → checkout handoff.
 *
 * Runs with NO Square/WordPress credentials: the cart is seeded straight into
 * localStorage and every API the cart page calls is mocked (see
 * `mockCartApis`). Deliberately not tagged for the catalog-dependent CI
 * exclusion, since it needs no catalog data. This does not
 * replace a real Square-sandbox check — see the manual checklist in
 * plans/195-catalog-free-money-path-e2e.md.
 */

const DECK: SeedItem = {
  id: 'e2e-item-deck',
  catalogObjectId: 'e2e-item-deck',
  variationId: 'e2e-var-deck',
  title: 'E2E Test Deck',
  price: 25.0,
  quantity: 1,
  variationName: '8.0',
};

const GRIP: SeedItem = {
  id: 'e2e-item-grip',
  catalogObjectId: 'e2e-item-grip',
  variationId: 'e2e-var-grip',
  title: 'E2E Test Grip Tape',
  price: 10.5,
  quantity: 1,
};

// Hosts outside the app are routed to a stub page so the "handoff" navigation
// never leaves the machine.
const MOCK_CHECKOUT_URL = 'https://checkout.example.test/pay/e2e-order';

const itemRow = (page: Page, item: SeedItem) =>
  page.locator(`[data-item-container="${item.id}:${item.variationId}"]`);

async function openCart(
  page: Page,
  items: SeedItem[],
  opts: MockCartApiOptions = {}
) {
  await mockCartApis(page, opts);
  await seedCart(page, items);
  await page.goto('/cart');
}

async function stubCheckoutHost(page: Page) {
  await page.route('https://checkout.example.test/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<html><body>mock square checkout</body></html>',
    })
  );
}

async function confirmPickup(page: Page) {
  await page.click('[data-tab="pickup"]');
  await page.fill('#pickup-name', 'Test User');
  await page.fill('#pickup-email', 'test@example.com');
  await page.fill('#pickup-phone', '5551234567');
  await page.click('#fulfillment-done-btn');
}

test.describe('Money path (no catalog needed)', () => {
  // #checkout-button lives inside hidden md:block. Mobile projects render a
  // different cart button/checkout path, so they are skipped (same as
  // checkout-flow.spec.ts).
  test.use({ viewport: { width: 1280, height: 800 } });

  test.beforeEach(async ({ context }, testInfo) => {
    test.skip(
      testInfo.project.name.startsWith('Mobile'),
      'Money-path tests target desktop UI; mobile checkout path differs'
    );
    await context.clearCookies();
  });

  test('renders a seeded cart with line items and subtotal', async ({
    page,
  }) => {
    await openCart(page, [DECK, GRIP]);

    await expect(page.locator('#cart-content')).toBeVisible();
    await expect(page.locator('#empty-cart')).toBeHidden();
    await expect(page.locator('#cart-items-list')).toContainText(DECK.title);
    await expect(page.locator('#cart-items-list')).toContainText(GRIP.title);
    await expect(
      page.locator('#cart-items-list [data-item-container]')
    ).toHaveCount(2);
    await expect(page.locator('#subtotal')).toHaveText('$35.50');
  });

  test('shows the empty state with a link back to the shop', async ({
    page,
  }) => {
    await openCart(page, []);

    await expect(page.locator('#empty-cart')).toBeVisible();
    await expect(page.locator('#cart-content')).toBeHidden();
    await expect(page.locator('#empty-cart a[href="/shop/all"]')).toBeVisible();
  });

  test('quantity edits update the subtotal; removing every item shows the empty state', async ({
    page,
  }) => {
    await openCart(page, [DECK, GRIP]);
    await expect(page.locator('#subtotal')).toHaveText('$35.50');

    const deck = itemRow(page, DECK);
    await expect(deck.locator('[data-action="decrease"]')).toBeDisabled();

    await deck.locator('[data-action="increase"]').click();
    await expect(deck.locator('input.quantity-input')).toHaveValue('2');
    await expect(page.locator('#subtotal')).toHaveText('$60.50');

    await deck.locator('[data-action="decrease"]').click();
    await expect(deck.locator('input.quantity-input')).toHaveValue('1');
    await expect(page.locator('#subtotal')).toHaveText('$35.50');

    await deck.locator('[data-action="remove"]').click();
    await expect(deck).toHaveCount(0);
    await expect(page.locator('#subtotal')).toHaveText('$10.50');

    await itemRow(page, GRIP).locator('[data-action="remove"]').click();
    await expect(page.locator('#empty-cart')).toBeVisible();
    await expect(page.locator('#cart-content')).toBeHidden();
  });

  test('caps quantity at available inventory', async ({ page }) => {
    await openCart(page, [{ ...DECK, quantity: 2 }], {
      inventory: { [DECK.variationId]: 2 },
    });

    const deck = itemRow(page, DECK);
    await expect(deck).toBeVisible();
    await expect(deck).toContainText('Only 2 left');
    await expect(deck.locator('input.quantity-input')).toHaveAttribute(
      'max',
      '2'
    );
    await expect(deck.locator('[data-action="increase"]')).toBeDisabled();

    // Dropping below the cap re-enables the increase control
    await deck.locator('[data-action="decrease"]').click();
    await expect(deck.locator('[data-action="increase"]')).toBeEnabled();
  });

  test('flags an out-of-stock item and blocks incrementing it', async ({
    page,
  }) => {
    await openCart(page, [DECK], { inventory: { [DECK.variationId]: 0 } });

    const deck = itemRow(page, DECK);
    await expect(deck).toBeVisible();
    await expect(deck).toContainText('Out of stock');
    await expect(deck.locator('[data-action="increase"]')).toBeDisabled();
  });

  test('rejects incrementing past available inventory', async ({ page }) => {
    await openCart(page, [{ ...DECK, quantity: 2 }], {
      inventory: { [DECK.variationId]: 2 },
    });

    const deck = itemRow(page, DECK);
    const increase = deck.locator('[data-action="increase"]');
    await expect(increase).toBeDisabled();

    // The button is disabled at the cap, so re-enable it to exercise the
    // click handler's own inventory guard.
    await increase.evaluate((el) => el.removeAttribute('disabled'));
    await increase.click();

    await expect(page.locator('#notification-container')).toContainText(
      'Only 2 available'
    );
    await expect(deck.locator('input.quantity-input')).toHaveValue('2');
  });

  test('still renders the cart when the inventory endpoint fails', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await openCart(page, [DECK, GRIP], { inventory: false });

    const deck = itemRow(page, DECK);
    await expect(page.locator('#cart-content')).toBeVisible();
    await expect(page.locator('#cart-items-list')).toContainText(DECK.title);
    await expect(page.locator('#subtotal')).toHaveText('$35.50');
    // Falls back to 99 per item, so nothing is capped or flagged low-stock
    await expect(deck.locator('input.quantity-input')).toHaveAttribute(
      'max',
      '99'
    );
    await expect(deck.locator('[data-action="increase"]')).toBeEnabled();
    expect(consoleErrors.join('\n')).toContain('Error loading inventory data');
  });

  test('pickup checkout posts the seeded cart and hands off to the checkout URL', async ({
    page,
  }) => {
    await stubCheckoutHost(page);
    await openCart(page, [{ ...DECK, quantity: 2 }, GRIP], {
      checkout: {
        body: {
          success: true,
          checkoutUrl: MOCK_CHECKOUT_URL,
          orderId: 'e2e-order',
        },
      },
    });
    await expect(page.locator('#cart-content')).toBeVisible();

    // Checkout stays disabled until the fulfillment form is confirmed
    await expect(page.locator('#checkout-button')).toBeDisabled();

    await confirmPickup(page);

    // Order summary reflects the (mocked) calculate-cart response
    await expect(page.locator('#shipping-cost')).toHaveText('FREE');
    await expect(page.locator('#order-total')).toHaveText('$60.50');

    const checkoutBtn = page.locator('#checkout-button');
    await expect(checkoutBtn).toBeEnabled();

    const checkoutRequest = page.waitForRequest('**/api/create-checkout');
    await checkoutBtn.click();

    const body = (await checkoutRequest).postDataJSON() as {
      items: Array<{ variationId: string; quantity: number }>;
      fulfillmentMethod: string;
      pickupContact: { name: string; email: string; phone: string };
      checkoutKey: string;
    };
    expect(
      body.items.map(({ variationId, quantity }) => ({ variationId, quantity }))
    ).toEqual([
      { variationId: DECK.variationId, quantity: 2 },
      { variationId: GRIP.variationId, quantity: 1 },
    ]);
    expect(body.fulfillmentMethod).toBe('pickup');
    expect(body.pickupContact).toMatchObject({
      name: 'Test User',
      email: 'test@example.com',
      phone: '(555) 123-4567',
    });
    expect(body.checkoutKey).toBeTruthy();

    await expect(page).toHaveURL(MOCK_CHECKOUT_URL);
  });

  test('shows an error and stays on the cart when checkout fails', async ({
    page,
  }) => {
    await openCart(page, [DECK], {
      checkout: { status: 500, body: { error: 'boom' } },
    });
    await expect(page.locator('#cart-content')).toBeVisible();
    await confirmPickup(page);

    const checkoutBtn = page.locator('#checkout-button');
    await expect(checkoutBtn).toBeEnabled();
    await checkoutBtn.click();

    await expect(page.locator('#notification-container')).toContainText('boom');
    await expect(page).toHaveURL(/\/cart$/);
    await expect(page.locator('#loading-overlay')).toBeHidden();
    await expect(checkoutBtn).toBeEnabled();
    // The cart is untouched, so the user can retry
    await expect(itemRow(page, DECK)).toBeVisible();
  });

  test('applies a server-adjusted cart and surfaces the stock message', async ({
    page,
  }) => {
    // Land back on the cart after the handoff so the adjusted quantity is visible
    const handoffUrl = 'http://localhost:4321/cart?handoff=1';
    await openCart(page, [{ ...DECK, quantity: 3 }, GRIP], {
      checkout: {
        body: {
          success: true,
          checkoutUrl: handoffUrl,
          orderId: 'e2e-order',
          cartUpdated: true,
          adjustedCart: [
            { variationId: DECK.variationId, quantity: 1 },
            { variationId: GRIP.variationId, quantity: 1 },
          ],
          stockMessage: 'Only 1 left',
        },
      },
    });
    await expect(page.locator('#cart-content')).toBeVisible();
    await confirmPickup(page);

    const checkoutBtn = page.locator('#checkout-button');
    await expect(checkoutBtn).toBeEnabled();
    await checkoutBtn.click();

    await expect(page.locator('#notification-container')).toContainText(
      'Only 1 left'
    );

    // The page holds for 3s after a stock message, then follows checkoutUrl
    await expect(page).toHaveURL(handoffUrl, { timeout: 10000 });
    await expect(
      itemRow(page, DECK).locator('input.quantity-input')
    ).toHaveValue('1');
    await expect(page.locator('#subtotal')).toHaveText('$35.50');
  });

  test('shipping checkout posts the shipping address', async ({ page }) => {
    await stubCheckoutHost(page);
    await openCart(page, [DECK, GRIP], {
      calculate: { shipping: 6, tax: 2.5, total: 44 },
      checkout: {
        body: {
          success: true,
          checkoutUrl: MOCK_CHECKOUT_URL,
          orderId: 'e2e-order',
        },
      },
    });
    await expect(page.locator('#cart-content')).toBeVisible();

    await page.click('[data-tab="shipping"]');
    await page.fill('#shipping-first-name', 'Test');
    await page.fill('#shipping-last-name', 'Buyer');
    await page.fill('#shipping-email', 'buyer@example.com');
    await page.fill('#shipping-phone', '5559876543');
    await page.fill('#shipping-address', '123 Example St');
    await page.fill('#shipping-city', 'Austin');
    await page.selectOption('#shipping-state', 'TX');
    await page.fill('#shipping-zip', '78701');
    await page.click('#fulfillment-done-btn');

    // Order summary reflects the (mocked) calculate-cart response
    await expect(page.locator('#shipping-cost')).toHaveText('$6.00');
    await expect(page.locator('#tax-amount')).toHaveText('$2.50');
    await expect(page.locator('#order-total')).toHaveText('$44.00');

    const checkoutBtn = page.locator('#checkout-button');
    await expect(checkoutBtn).toBeEnabled();

    const checkoutRequest = page.waitForRequest('**/api/create-checkout');
    await checkoutBtn.click();

    const body = (await checkoutRequest).postDataJSON() as {
      items: Array<{ variationId: string; quantity: number }>;
      fulfillmentMethod: string;
      shippingAddress: Record<string, string | undefined>;
      pickupContact?: unknown;
    };
    expect(body.fulfillmentMethod).toBe('shipping');
    expect(body.pickupContact).toBeUndefined();
    expect(body.items).toHaveLength(2);
    expect(body.shippingAddress).toMatchObject({
      name: 'Test Buyer',
      email: 'buyer@example.com',
      phone: '(555) 987-6543',
      street1: '123 Example St',
      city: 'Austin',
      state: 'TX',
      zip: '78701',
    });

    await expect(page).toHaveURL(MOCK_CHECKOUT_URL);
  });
});
