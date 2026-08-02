import { test, expect } from "@playwright/test";

// Mock URL returned by the intercepted create-checkout handler
const MOCK_CHECKOUT_URL = "http://localhost:4321/";

test.describe("Checkout Flow", () => {
  // Force desktop viewport so #checkout-button (inside hidden md:block) is visible.
  // Mobile devices render CartButtonMobile (<a>, not <button>) via SSR UA detection
  // and use a separate checkout path — skip those projects here.
  test.use({ viewport: { width: 1280, height: 800 } });

  test.beforeEach(async ({ page, context }, testInfo) => {
    test.skip(
      testInfo.project.name.startsWith("Mobile"),
      "Checkout flow tests target desktop UI; mobile checkout path differs",
    );
    await context.clearCookies();
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test("POST /api/create-checkout with correct body; no real Square call made", async ({
    page,
  }) => {
    // 1. Add a product to cart
    await page.goto("/shop/all");
    await page.waitForSelector('article[role="article"]', { timeout: 10000 });
    await page.locator('article[role="article"]').first().click();
    await page.waitForURL(/\/product\/.+/);
    await page.waitForSelector(
      '#add-to-cart-button[data-add-to-cart-ready="true"]',
    );
    await page.click('button:has-text("Add to Cart")');
    await expect(
      page.getByRole("button", { name: "Shopping Cart" }),
    ).toContainText("1");

    // 2. Navigate to cart
    await page.goto("/cart");
    await page.waitForSelector("#cart-content:not(.hidden)");

    // 3. Select pickup fulfillment
    await page.click('[data-tab="pickup"]');

    // 4. Fill required pickup fields
    await page.fill("#pickup-name", "Test User");
    await page.fill("#pickup-email", "test@example.com");
    await page.fill("#pickup-phone", "5551234567");

    // 5. Click Done — validates form, collapses it, and enables the checkout button
    await page.click("#fulfillment-done-btn");

    // 6. Intercept /api/create-checkout BEFORE triggering it — mock the Square
    //    payment link creation so no real API call is made
    await page.route("**/api/create-checkout", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          checkoutUrl: MOCK_CHECKOUT_URL,
          orderId: "test-order-e2e-123",
          fulfillmentMethod: "pickup",
          shippingCost: 0,
        }),
      });
    });
    const checkoutRequestPromise = page.waitForRequest(
      "**/api/create-checkout",
    );

    // 7. Wait for checkout button to be enabled, then click
    const checkoutBtn = page.locator("#checkout-button");
    await expect(checkoutBtn).not.toBeDisabled({ timeout: 5000 });
    await checkoutBtn.click();

    // 8. Assert request body — items, fulfillmentMethod, and pickupContact present
    const req = await checkoutRequestPromise;
    const body = req.postDataJSON() as {
      items: Array<{ variationId: string; quantity: number }>;
      fulfillmentMethod: string;
      pickupContact: { name: string; email: string; phone: string };
    };

    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.fulfillmentMethod).toBe("pickup");
    expect(body.pickupContact).toBeDefined();
    expect(body.pickupContact.name).toBe("Test User");
    expect(body.pickupContact.email).toBe("test@example.com");

    // 9. Cart page redirects to the mocked checkout URL — confirms no real Square
    //    payment link was followed
    await expect(page).toHaveURL(MOCK_CHECKOUT_URL);
  });
});
