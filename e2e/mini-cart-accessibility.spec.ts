import { test, expect } from "@playwright/test";

/**
 * Mini Cart Accessibility E2E Tests
 * Priority: HIGH - Keyboard/focus behavior for the mini-cart dialog
 *
 * Covers a real bug found during a WCAG 2.2 audit: MiniCart's closeMiniCart()
 * set `inert` on the panel, then restored focus to the trigger button in the
 * same synchronous tick — the browser's own async blur-to-body handling for
 * the newly-inert subtree could silently override that restore. Fixed by
 * deferring the restore past the close transition (see mini-cart-client.ts).
 *
 * Writing this test also surfaced a second, independent bug: CartButton.astro
 * re-registered its click listener on every astro:page-load with no cleanup
 * (unlike mini-cart-client.ts's own AbortController-based init), so a single
 * click could dispatch openMiniCart twice and clobber the captured trigger
 * element. Fixed with an init guard (see CartButton.astro).
 *
 * Test Coverage:
 * - Opening moves focus into the panel (close button)
 * - Tab focus is trapped inside the panel while open
 * - Escape closes the panel and restores focus to the cart trigger button
 * - Clicking the close button does the same
 *
 * WebKit note: Safari's default keyboard config excludes buttons from Tab
 * order, and a mouse click on a button does not give it focus (both real,
 * long-standing Safari behaviors — not code bugs, and not fixable from the
 * page). Assertions that depend on either are skipped for webkit below.
 */

test.describe("Mini Cart Accessibility", () => {
  test.beforeEach(async ({ page, context, isMobile }) => {
    // Mobile uses CartButtonMobile, a plain link to /cart with no mini-cart
    // panel — this whole dialog doesn't exist on mobile viewports.
    test.skip(isMobile, "Mobile cart button links to /cart directly");

    // Clear cart state before each test
    await context.clearCookies();
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test("opens on click and moves focus to the close button", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Shopping Cart" }).click();

    await expect(page.locator("#mini-cart-overlay")).not.toHaveClass(
      /\bhidden\b/
    );
    await expect(page.locator("#close-mini-cart")).toBeFocused();
  });

  test("traps Tab focus inside the panel while open", async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName === "webkit",
      "Safari's default Tab order excludes buttons entirely"
    );

    await page.getByRole("button", { name: "Shopping Cart" }).click();
    await expect(page.locator("#close-mini-cart")).toBeFocused();

    // Empty-cart state has exactly two focusable elements: the close button
    // and the "Continue Shopping" link. Forward Tab should cycle between
    // them rather than escaping to page content behind the panel.
    await page.keyboard.press("Tab");
    await expect(page.locator("#continue-shopping")).toBeFocused();

    await page.keyboard.press("Tab");
    await expect(page.locator("#close-mini-cart")).toBeFocused();

    // Shift+Tab from the first element should wrap to the last.
    await page.keyboard.press("Shift+Tab");
    await expect(page.locator("#continue-shopping")).toBeFocused();
  });

  test("closes on Escape and restores focus to the cart trigger button", async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName === "webkit",
      "Safari does not focus a button on mouse click, so there is nothing to restore"
    );

    const cartTrigger = page.getByRole("button", { name: "Shopping Cart" });

    await cartTrigger.click();
    await expect(page.locator("#close-mini-cart")).toBeFocused();

    await page.keyboard.press("Escape");

    // Restoring focus is deferred until after the ~300ms close transition —
    // toBeFocused() auto-retries, so no manual wait is needed here.
    await expect(cartTrigger).toBeFocused();
    await expect(page.locator("#mini-cart-overlay")).toHaveClass(
      /\bhidden\b/
    );
  });

  test("closing via the close button also restores focus to the trigger", async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName === "webkit",
      "Safari does not focus a button on mouse click, so there is nothing to restore"
    );

    const cartTrigger = page.getByRole("button", { name: "Shopping Cart" });

    await cartTrigger.click();
    await page.locator("#close-mini-cart").click();

    await expect(cartTrigger).toBeFocused();
    await expect(page.locator("#mini-cart-overlay")).toHaveClass(
      /\bhidden\b/
    );
  });
});
