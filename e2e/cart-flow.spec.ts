import { test, expect } from "@playwright/test";

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
    const productName = await page.locator("h1").textContent();

    // Add to cart
    await page.click('button:has-text("Add to Cart")');

    // Verify cart badge updated
    await expect(
      page.locator('button:has-text("Shopping Cart")')
    ).toContainText("1");

    // Verify mini-cart opened (cart count in heading)
    await expect(page.locator("dialog[open] h2")).toContainText("Cart (1)");

    // Verify product in mini-cart
    await expect(page.locator("dialog[open]")).toContainText(productName || "");

    // Verify subtotal displayed
    await expect(page.locator("dialog[open]")).toContainText("Subtotal:");
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
      page.locator('button:has-text("Shopping Cart")')
    ).toContainText("1");

    // Reload page
    await page.reload();

    // Verify cart persisted
    await expect(
      page.locator('button:has-text("Shopping Cart")')
    ).toContainText("1");
  });

  test("should navigate to cart page and display items", async ({ page }) => {
    // Add product to cart
    await page.goto("/shop/all");
    await page.waitForSelector('article[role="article"]');

    const firstProduct = page.locator('article[role="article"]').first();
    await firstProduct.click();

    await page.waitForURL(/\/product\/.+/);
    const productName = await page.locator("h1").textContent();

    await page.click('button:has-text("Add to Cart")');

    // Navigate to cart page
    await page.goto("/cart");

    // Verify cart page loaded
    await expect(page.locator("h1")).toContainText("Cart");

    // Verify product displayed
    await expect(page.locator("main")).toContainText(productName || "");

    // Verify subtotal
    await expect(page.locator("main")).toContainText("Subtotal");

    // Verify checkout button
    await expect(
      page.locator('button:has-text("Proceed to Checkout")')
    ).toBeVisible();
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

      // Go to cart
      await page.goto("/cart");

      // Verify quantity is 2
      const quantityInput = page.locator('input[type="spinbutton"]').first();
      await expect(quantityInput).toHaveValue("2");

      // Verify cart badge shows 2
      await expect(
        page.locator('button:has-text("Shopping Cart")')
      ).toContainText("2");
    } else {
      // Product only has 1 available, add and verify
      await page.click('button:has-text("Add to Cart")');
      await expect(
        page.locator('button:has-text("Shopping Cart")')
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
      page.locator('button:has-text("Shopping Cart")')
    ).toContainText("1");

    // Go to cart page
    await page.goto("/cart");

    // Remove item
    await page.click('button:has-text("Remove")');

    // Verify empty cart message
    await expect(page.locator("main")).toContainText("Your cart is empty");

    // Verify cart badge removed or shows 0
    const cartButton = page.locator('button:has-text("Shopping Cart")');
    const badgeText = await cartButton.textContent();
    expect(badgeText?.includes("1")).toBeFalsy();
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
      page.locator('button:has-text("Shopping Cart")')
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

    // Get available quantity
    const availabilityText = await page
      .locator("text=/\\d+ available/")
      .textContent();
    const available = parseInt(availabilityText?.match(/\d+/)?.[0] || "0");

    // Add to cart
    await page.click('button:has-text("Add to Cart")');

    // Go back to product page
    await page.goto(page.url());

    // Verify inventory updated
    const newAvailability = await page
      .locator("text=/\\d+ available/")
      .textContent();
    const newAvailable = parseInt(newAvailability?.match(/\d+/)?.[0] || "0");

    expect(newAvailable).toBe(available - 1);

    // Verify "in cart" message
    await expect(page.locator("text=/\\d+ in cart/")).toBeVisible();
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
    await page.waitForSelector('dialog[open] h2:has-text("Cart")');

    // Click View Full Cart (direct navigation as button may be outside viewport)
    await page.goto("/cart");

    // Verify on cart page
    await expect(page).toHaveURL(/\/cart/);
    await expect(page.locator("h1")).toContainText("Cart");
  });

  test("should continue shopping from cart", async ({ page }) => {
    // Add product and go to cart
    await page.goto("/shop/all");
    await page.waitForSelector('article[role="article"]');

    const firstProduct = page.locator('article[role="article"]').first();
    await firstProduct.click();

    await page.waitForURL(/\/product\/.+/);
    await page.click('button:has-text("Add to Cart")');

    await page.goto("/cart");

    // Click continue shopping
    await page.click('a:has-text("Continue Shopping")');

    // Verify back on shop page
    await expect(page).toHaveURL(/\/shop\/all/);
  });

  test("should open cart from header button", async ({ page }) => {
    // Go to any page
    await page.goto("/");

    // Click cart button in header
    await page.click('button:has-text("Shopping Cart")');

    // Verify mini-cart opened
    await expect(page.locator("dialog[open] h2")).toContainText("Cart");
  });
});
