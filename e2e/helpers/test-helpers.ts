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
 * Minimal cart line item for seeding `localStorage['cart']`.
 * Mirrors `CartItem` in src/lib/cart/types.ts (price is in dollars).
 */
export interface SeedItem {
  id: string;
  catalogObjectId: string;
  variationId: string;
  title: string;
  price: number;
  quantity: number;
  variationName?: string;
}

/**
 * Seed the cart page's localStorage state without touching the catalog.
 * Must run on a same-origin page, so it visits "/" first, writes the cart,
 * and clears any stored fulfillment form from a previous test.
 */
export async function seedCart(page: Page, items: SeedItem[]) {
  await page.goto("/");
  await page.evaluate((cartItems) => {
    sessionStorage.clear();
    localStorage.clear();
    localStorage.setItem("cart", JSON.stringify(cartItems));
  }, items);
}

export interface MockCartApiOptions {
  /** Stock per variationId; `false` makes the endpoint return a 500 */
  inventory?: Record<string, number> | false;
  /** Overrides merged over the default calculate-cart response */
  calculate?: Record<string, unknown>;
  /** Response for create-checkout */
  checkout?: { status?: number; body: Record<string, unknown> };
}

/**
 * Mock every network call the cart page makes so it runs with no
 * Square/WordPress credentials: /api/sale-info, /api/cart-inventory,
 * /api/calculate-cart, /api/create-checkout, plus the third-party ZIP
 * autofill lookup used by the shipping form.
 */
export async function mockCartApis(page: Page, opts: MockCartApiOptions = {}) {
  const json = (body: unknown, status = 200) => ({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });

  await page.route("**/api/sale-info", (route) =>
    route.fulfill(json({ success: true, saleInfo: {} }))
  );

  await page.route("**/api/cart-inventory", (route) => {
    if (opts.inventory === false) {
      return route.fulfill(json({ success: false, error: "boom" }, 500));
    }
    const { variationIds = [] } = route.request().postDataJSON() as {
      variationIds?: string[];
    };
    const inventory: Record<string, number> = {};
    for (const id of variationIds) inventory[id] = opts.inventory?.[id] ?? 10;
    return route.fulfill(json({ success: true, inventory }));
  });

  await page.route("**/api/calculate-cart", (route) => {
    const { items = [] } = route.request().postDataJSON() as {
      items?: Array<{ price: number; quantity: number }>;
    };
    const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    return route.fulfill(
      json({
        success: true,
        shipping: 0,
        tax: 0,
        total: subtotal,
        ...opts.calculate,
      })
    );
  });

  await page.route("**/api/create-checkout", (route) => {
    const checkout = opts.checkout ?? {
      body: {
        success: true,
        checkoutUrl: "http://localhost:4321/",
        orderId: "e2e-order",
      },
    };
    return route.fulfill(json(checkout.body, checkout.status ?? 200));
  });

  // Optional ZIP → city/state autofill hits a public third-party API
  await page.route("https://api.zippopotam.us/**", (route) =>
    route.fulfill({ status: 404, body: "" })
  );
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
  await page.getByRole("button", { name: "Shopping Cart" }).waitFor();

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
  await page.waitForSelector("#mini-cart-overlay:not(.hidden)");
}

/**
 * Get current cart count from badge
 */
export async function getCartCount(page: Page): Promise<number> {
  const text = await page.locator("#cart-count").textContent();
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
    // Badge is present but visually hidden via the "hidden" class when count is 0
    await expect(page.locator("#cart-count")).toHaveClass(/\bhidden\b/);
  } else {
    await expect(page.locator("#cart-count")).toContainText(
      expectedCount.toString()
    );
  }
}

/**
 * Open mini-cart from header
 */
export async function openMiniCart(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Shopping Cart" }).click();
  await page.waitForSelector("#mini-cart-overlay:not(.hidden)");
}

/**
 * Close mini-cart
 */
export async function closeMiniCart(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Close cart" }).click();
  await page.waitForSelector("#mini-cart-overlay.hidden");
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
  await expect(page.locator("#mini-cart-panel")).toContainText(productName);
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
