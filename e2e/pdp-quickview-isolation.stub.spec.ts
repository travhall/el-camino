import { test, expect, type Page } from '@playwright/test';
import { TEE } from './fixtures/square-catalog.mjs';

/**
 * QuickView is mounted on every page, so opening it on a product page puts
 * two sets of attribute chips in the document. Both controllers used to find
 * their chips with a document-wide `[data-attribute-type]` selector, so each
 * one restyled the other's chips, and QuickView overwrote `className` on the
 * PDP's, stripping the `attribute-button` class the PDP's own handlers and
 * styles hang off.
 *
 * Against the real page and the Square stub's catalog (see
 * playwright.stub.config.ts).
 */

declare global {
  interface Window {
    openQuickView?: (productId: string, variationId?: string) => void;
  }
}

const pdpChips = (page: Page) => page.locator('.attribute-button');
const pdpSelected = (page: Page) =>
  page
    .locator('.attribute-button[aria-pressed="true"]')
    .evaluateAll((els) =>
      els.map((e) => (e as HTMLElement).dataset.attributeValue)
    );

const qvChip = (page: Page, type: string, value: string) =>
  page.locator(
    `#quick-view-attributes button[data-attribute-type="${type}"][data-attribute-value="${value}"]`
  );
const qvSelected = (page: Page) =>
  page
    .locator(
      '#quick-view-attributes button[class*="ui-variant-selected-surface"]'
    )
    .evaluateAll((els) =>
      els.map((e) => (e as HTMLElement).dataset.attributeValue)
    );

async function openPdpThenQuickView(page: Page) {
  await page.goto(`/product/${TEE.id}`);
  await expect(page.locator('#add-to-cart-button')).toHaveAttribute(
    'data-add-to-cart-ready',
    'true'
  );
  await page.waitForFunction(() => typeof window.openQuickView === 'function');
  await page.evaluate((id) => window.openQuickView!(id), TEE.id);
  await expect(page.locator('#quick-view-product')).toBeVisible();
  await expect(qvChip(page, 'color', 'White')).toBeVisible();
}

test.describe('PDP chips and QuickView chips on the same page', () => {
  test("selecting in QuickView leaves the PDP's chips alone", async ({
    page,
  }) => {
    await openPdpThenQuickView(page);
    const before = await pdpChips(page).count();
    expect(await pdpSelected(page)).toEqual(['Black', 'S']);

    await qvChip(page, 'color', 'White').click();
    await expect.poll(() => qvSelected(page)).toEqual(['White', 'S']);

    // The PDP's selection hasn't moved, and its chips are still its chips
    expect(await pdpSelected(page)).toEqual(['Black', 'S']);
    await expect(pdpChips(page)).toHaveCount(before);
    for (const chip of await pdpChips(page).all()) {
      await expect(chip).toHaveClass(/attribute-button/);
    }
  });

  test("selecting on the PDP leaves QuickView's chips alone", async ({
    page,
  }) => {
    await openPdpThenQuickView(page);
    await qvChip(page, 'color', 'White').click();
    await expect.poll(() => qvSelected(page)).toEqual(['White', 'S']);
    await page.keyboard.press('Escape');
    // Closing slides the panel off-screen; its contents stay in the DOM
    await expect(page.locator('#quick-view-panel')).toHaveClass(
      /-translate-x-full/
    );

    await page
      .locator(
        '.attribute-button[data-attribute-type="size"][data-attribute-value="L"]'
      )
      .click(); // Black/L doesn't exist: the PDP snaps to White/L
    await expect.poll(() => pdpSelected(page)).toEqual(['White', 'L']);

    // QuickView still shows what it was showing
    expect(await qvSelected(page)).toEqual(['White', 'S']);
  });
});
