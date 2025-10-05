import { Page, expect } from "@playwright/test";

/**
 * Test Helpers for El Camino E2E Tests
 * Reusable functions to reduce test code duplication
 */

/**
 * Clear all cart state
 */
export async function clearCart(page: Page) {
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

/**
 * Add first available product to cart
 * @returns Product name that was added
 */
export async function addFirstProductToCart(page: Page): Promise<string> {
  await page.goto("/shop/all");
  await page.waitForSelector('article[role="article"]', { timeout: 10000 });

  const firstProduct = page.locator('article[role="article"]').first();
  await firstProduct.click();

  await page.waitForURL(/\/product\/.+/);
  await page.waitForSelector('button:has-text("Add to Cart")');

  const productName = (await page.locator("h1").textContent()) || "";

  await page.click('button:has-text("Add to Cart")');

  // Wait for cart to update
  await page.waitForSelector('button:has-text("Shopping Cart")');

  return productName;
}

/**
 * Add specific product to cart by navigating to its URL
 */
export async function addProductToCart(
  page: Page,
  productSlug: string
): Promise<void> {
  await page.goto(`/product/${productSlug}`);
  await page.waitForSelector('button:has-text("Add to Cart")');
  await page.click('button:has-text("Add to Cart")');
  await page.waitForSelector('dialog[open] h2:has-text("Cart")');
}

/**
 * Get current cart count from badge
 */
export async function getCartCount(page: Page): Promise<number> {
  const cartButton = page.locator('button:has-text("Shopping Cart")');
  const text = await cartButton.textContent();
  const match = text?.match(/\d+/);
  return match ? parseInt(match[0]) : 0;
}

/**
 * Verify cart badge shows expected count
 */
export async function verifyCartCount(
  page: Page,
  expectedCount: number
): Promise<void> {
  if (expectedCount === 0) {
    // Badge should not contain any number
    const cartButton = page.locator('button:has-text("Shopping Cart")');
    const text = await cartButton.textContent();
    expect(text?.match(/\d+/)).toBeNull();
  } else {
    await expect(
      page.locator('button:has-text("Shopping Cart")')
    ).toContainText(expectedCount.toString());
  }
}

/**
 * Open mini-cart from header
 */
export async function openMiniCart(page: Page): Promise<void> {
  await page.click('button:has-text("Shopping Cart")');
  await page.waitForSelector('dialog[open] h2:has-text("Cart")');
}

/**
 * Close mini-cart
 */
export async function closeMiniCart(page: Page): Promise<void> {
  await page.click('button:has-text("Close cart")');
  await page.waitForSelector("dialog:not([open])");
}

/**
 * Navigate to cart page
 */
export async function goToCartPage(page: Page): Promise<void> {
  await page.goto("/cart");
  await page.waitForSelector('h1:has-text("Cart")');
}

/**
 * Remove all items from cart via Clear Cart button
 */
export async function clearCartViaButton(page: Page): Promise<void> {
  await goToCartPage(page);
  await page.click('button:has-text("Clear Cart")');
  await page.waitForSelector("text=Your cart is empty");
}

/**
 * Get product availability from product page
 */
export async function getProductAvailability(page: Page): Promise<number> {
  const availabilityText = await page
    .locator("text=/\\d+ available/")
    .textContent();
  return parseInt(availabilityText?.match(/\d+/)?.[0] || "0");
}

/**
 * Verify product is in cart
 */
export async function verifyProductInCart(
  page: Page,
  productName: string
): Promise<void> {
  await expect(page.locator("dialog[open]")).toContainText(productName);
}

/**
 * Wait for page to finish loading (network idle + specific content)
 */
export async function waitForPageLoad(
  page: Page,
  selector: string
): Promise<void> {
  await page.waitForLoadState("networkidle");
  await page.waitForSelector(selector, { timeout: 10000 });
}

/**
 * Get subtotal from mini-cart or cart page
 */
export async function getSubtotal(page: Page): Promise<string> {
  const subtotalElement = page
    .locator("text=/Subtotal:?/")
    .locator("..")
    .locator("text=/\\$[\\d.]+/");
  return (await subtotalElement.textContent()) || "$0.00";
}

/**
 * Filter products by brand
 */
export async function filterByBrand(
  page: Page,
  brandName: string
): Promise<void> {
  await page.goto("/shop/all");
  await page.waitForSelector('h3:has-text("Brand")');

  // Find and click the brand checkbox
  const brandCheckbox = page
    .locator(`label:has-text("${brandName}")`)
    .locator('input[type="checkbox"]');
  await brandCheckbox.click();

  // Wait for products to filter
  await page.waitForTimeout(500); // Wait for filter to apply
}

/**
 * Check if product is in stock
 */
export async function isProductInStock(page: Page): Promise<boolean> {
  const availability = await getProductAvailability(page);
  return availability > 0;
}

/**
 * Navigate to admin dashboard
 */
export async function goToAdminDashboard(page: Page): Promise<void> {
  await page.goto("/admin");
  await page.waitForSelector('h1:has-text("Dashboard")');
}

/**
 * Get performance health score from admin
 */
export async function getPerformanceScore(page: Page): Promise<number> {
  await goToAdminDashboard(page);
  const scoreElement = page
    .locator("text=Performance Score")
    .locator("..")
    .locator('[class*="text-"]')
    .first();
  const scoreText = await scoreElement.textContent();
  return parseInt(scoreText || "0");
}

/**
 * Take screenshot with timestamp
 */
export async function takeTimestampedScreenshot(
  page: Page,
  name: string
): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  await page.screenshot({
    path: `screenshots/${name}-${timestamp}.png`,
    fullPage: true,
  });
}

/**
 * Verify console has no errors
 */
export async function verifyNoConsoleErrors(page: Page): Promise<void> {
  const errors: string[] = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      errors.push(msg.text());
    }
  });

  // Wait a bit for any errors to appear
  await page.waitForTimeout(1000);

  expect(errors).toHaveLength(0);
}

/**
 * Wait for cart to update after action
 */
export async function waitForCartUpdate(page: Page): Promise<void> {
  await page.waitForTimeout(500); // Wait for state to settle
  await page.waitForLoadState("networkidle");
}

/**
 * Get all products on current page
 */
export async function getAllProducts(page: Page): Promise<string[]> {
  const productElements = page.locator(
    'article[role="article"] h3, article[role="article"] h4'
  );
  const count = await productElements.count();
  const products: string[] = [];

  for (let i = 0; i < count; i++) {
    const text = await productElements.nth(i).textContent();
    if (text) products.push(text.trim());
  }

  return products;
}
