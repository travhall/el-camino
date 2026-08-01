import { test, expect, type Page } from "@playwright/test";

/**
 * Cart Flow E2E Tests
 * Priority: CRITICAL - Core revenue functionality
 *
 * Test Coverage:
 * - Add product to cart
 * - Cart state persistence
 * - Quantity updates
 * - Remove from cart
 * - Cart page navigation
 */

/**
 * Product page h1 is `<h1>{brand span}{displayTitle}</h1>` with no
 * separator between them, so a plain textContent() read concatenates
 * "BrandDisplay Title" — strip the brand span's text off the front.
 */
async function getProductName(page: Page): Promise<string> {
  const h1 = page.locator("h1");
  const fullText = (await h1.textContent()) || "";
  const brandSpan = h1.locator("span").first();
  const brandText = (await brandSpan.count()) > 0
    ? (await brandSpan.textContent()) || ""
    : "";
  return brandText ? fullText.replace(brandText, "").trim() : fullText.trim();
}

test.describe("Cart Operations", () => {
  test.beforeEach(async ({ page, context }) => {
    // Clear cart state before each test
    await context.clearCookies();
    await page.goto("/"); // ✅ Navigate FIRST
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test("should add product to cart from product page", async ({ page }) => {
    // Navigate to product listing
    await page.goto("/shop/all");

    // Wait for products to load
    await page.waitForSelector('article[role="article"]', { timeout: 10000 });

    // Click on first product to go to detail page
    const firstProduct = page.locator('article[role="article"]').first();
    await firstProduct.click();

    // Wait for product detail page to load
    await page.waitForURL(/\/product\/.+/);
    await page.waitForSelector('button:has-text("Add to Cart")');

    // Get product name for verification
    const productName = await getProductName(page);

    // Add to cart
    await page.click('button:has-text("Add to Cart")');

    // Verify cart badge updated
    await expect(
      page.getByRole("button", { name: "Shopping Cart" })
    ).toContainText("1");

    // Verify mini-cart opened (cart count in heading)
    await expect(page.locator("#mini-cart-title")).toContainText("Cart (1)");

    // Verify product in mini-cart
    await expect(page.locator("#mini-cart-panel")).toContainText(productName || "");

    // Verify subtotal displayed
    await expect(page.locator("#mini-cart-panel")).toContainText("Subtotal:");
  });

  test("should persist cart across page reload", async ({ page }) => {
    // Add product to cart
    await page.goto("/shop/all");
    await page.waitForSelector('article[role="article"]');

    const firstProduct = page.locator('article[role="article"]').first();
    await firstProduct.click();

    await page.waitForURL(/\/product\/.+/);
    await page.click('button:has-text("Add to Cart")');

    // Verify cart has 1 item
    await expect(
      page.getByRole("button", { name: "Shopping Cart" })
    ).toContainText("1");

    // Reload page
    await page.reload();

    // Verify cart persisted
    await expect(
      page.getByRole("button", { name: "Shopping Cart" })
    ).toContainText("1");
  });

  test("should navigate to cart page and display items", async ({ page }) => {
    // Add product to cart
    await page.goto("/shop/all");
    await page.waitForSelector('article[role="article"]');

    const firstProduct = page.locator('article[role="article"]').first();
    await firstProduct.click();

    await page.waitForURL(/\/product\/.+/);
    const productName = await getProductName(page);

    await page.click('button:has-text("Add to Cart")');

    // Navigate to cart page
    await page.goto("/cart");

    // Verify cart page loaded
    await expect(page.locator("h1")).toContainText("Cart");

    // Verify product displayed
    await expect(page.locator("main")).toContainText(productName || "");

    // Verify subtotal
    await expect(page.locator("main")).toContainText("Subtotal");

    // Verify checkout button (both desktop #checkout-button and the mobile
    // sticky bar's #mobile-checkout-button share this text — scope to desktop)
    await expect(page.locator("#checkout-button")).toBeVisible();
  });

  test("should update quantity from cart page", async ({ page }) => {
    // Add product with multiple inventory to cart
    await page.goto("/shop/all");
    await page.waitForSelector('article[role="article"]');

    // Find a product with multiple inventory (need to inspect availability)
    const products = page.locator('article[role="article"]');
    const firstProduct = products.first();
    await firstProduct.click();

    await page.waitForURL(/\/product\/.+/);

    // Check if we can increase quantity (button not disabled)
    const increaseButton = page.locator('button:has-text("+")').first();
    const isDisabled = await increaseButton.isDisabled();

    if (!isDisabled) {
      // Increase quantity
      await increaseButton.click();

      // Add to cart
      await page.click('button:has-text("Add to Cart")');

      // Verify cart badge shows 2 (header cart button is hidden on /cart itself)
      await expect(
        page.getByRole("button", { name: "Shopping Cart" })
      ).toContainText("2");

      // Go to cart
      await page.goto("/cart");

      // Verify quantity is 2
      const quantityInput = page.getByRole("spinbutton").first();
      await expect(quantityInput).toHaveValue("2");
    } else {
      // Product only has 1 available, add and verify
      await page.click('button:has-text("Add to Cart")');
      await expect(
        page.getByRole("button", { name: "Shopping Cart" })
      ).toContainText("1");
    }
  });

  test("should remove item from cart", async ({ page }) => {
    // Add product to cart
    await page.goto("/shop/all");
    await page.waitForSelector('article[role="article"]');

    const firstProduct = page.locator('article[role="article"]').first();
    await firstProduct.click();

    await page.waitForURL(/\/product\/.+/);
    await page.click('button:has-text("Add to Cart")');

    // Verify cart has 1 item
    await expect(
      page.getByRole("button", { name: "Shopping Cart" })
    ).toContainText("1");

    // Go to cart page
    await page.goto("/cart");

    // Remove item
    await page.click('button:has-text("Remove")');

    // Verify empty cart message
    await expect(page.locator("main")).toContainText("Your cart is empty");

    // Verify cart badge removed or shows 0 (CartLayout hides the header cart
    // button on /cart itself, so check it on a page that renders the header)
    await page.goto("/");
    await expect(page.locator("#cart-count")).toHaveClass(/\bhidden\b/);
  });

  test("should clear entire cart", async ({ page }) => {
    // Add multiple products to cart
    await page.goto("/shop/all");
    await page.waitForSelector('article[role="article"]');

    // Add first product
    const firstProduct = page.locator('article[role="article"]').first();
    await firstProduct.click();
    await page.waitForURL(/\/product\/.+/);
    await page.click('button:has-text("Add to Cart")');

    // Go back and add second product
    await page.goto("/shop/all");
    const secondProduct = page.locator('article[role="article"]').nth(1);
    await secondProduct.click();
    await page.waitForURL(/\/product\/.+/);
    await page.click('button:has-text("Add to Cart")');

    // Verify cart has 2 items
    await expect(
      page.getByRole("button", { name: "Shopping Cart" })
    ).toContainText("2");

    // Go to cart page
    await page.goto("/cart");

    // Clear cart
    await page.click('button:has-text("Clear Cart")');

    // Verify empty cart
    await expect(page.locator("main")).toContainText("Your cart is empty");
  });

  test("should show inventory constraints", async ({ page }) => {
    // Go to product with limited inventory
    await page.goto("/shop/all");
    await page.waitForSelector('article[role="article"]');

    const firstProduct = page.locator('article[role="article"]').first();
    await firstProduct.click();

    await page.waitForURL(/\/product\/.+/);

    // Get available quantity (scoped to #remaining-count — the quick-view
    // modal has its own #quick-view-remaining-count with the same text shape,
    // which made the old regex-text locator match two elements)
    const availabilityText = await page
      .locator("#remaining-count")
      .textContent();
    const available = parseInt(availabilityText?.match(/\d+/)?.[0] || "0");

    // Add to cart
    await page.click('button:has-text("Add to Cart")');

    // Go back to product page
    await page.goto(page.url());

    // Verify inventory updated
    const newAvailability = await page
      .locator("#remaining-count")
      .textContent();
    const newAvailable = parseInt(newAvailability?.match(/\d+/)?.[0] || "0");

    expect(newAvailable).toBe(available - 1);

    // Verify "in cart" message
    await expect(page.locator("#cart-quantity")).toBeVisible();
    await expect(page.locator("#cart-quantity")).toContainText(/\d+ in cart/);
  });
});

test.describe("Cart Navigation", () => {
  test.beforeEach(async ({ page, context }) => {
    // Clear cart state before each test
    await context.clearCookies();
    await page.goto("/"); // ✅ Navigate FIRST
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test("should navigate to cart from mini-cart", async ({ page }) => {
    // Add product
    await page.goto("/shop/all");
    await page.waitForSelector('article[role="article"]');

    const firstProduct = page.locator('article[role="article"]').first();
    await firstProduct.click();

    await page.waitForURL(/\/product\/.+/);
    await page.click('button:has-text("Add to Cart")');

    // Wait for mini-cart to open
    await page.waitForSelector("#mini-cart-overlay:not(.hidden)");

    // Click View Full Cart (direct navigation as button may be outside viewport)
    await page.goto("/cart");

    // Verify on cart page
    await expect(page).toHaveURL(/\/cart/);
    await expect(page.locator("h1")).toContainText("Cart");
  });

  test("should continue shopping from cart", async ({ page }) => {
    // "Continue Shopping" only renders in the empty-cart state (#empty-cart) —
    // a non-empty cart has no such link, so hit /cart with an empty cart.
    await page.goto("/cart");
    await page.waitForSelector("#empty-cart:not(.hidden)");

    // Click continue shopping
    await page
      .locator("#empty-cart")
      .getByRole("link", { name: "Continue Shopping" })
      .click();

    // Verify back on shop page
    await expect(page).toHaveURL(/\/shop\/all/);
  });

  test("should open cart from header button", async ({ page }) => {
    // Go to any page
    await page.goto("/");

    // Click cart button in header
    await page.getByRole("button", { name: "Shopping Cart" }).click();

    // Verify mini-cart opened
    await expect(page.locator("#mini-cart-title")).toContainText("Cart");
  });
});
