import { test, expect, type Page } from '@playwright/test';
import { TEE } from './fixtures/square-catalog.mjs';

/**
 * QuickView variant selection, hero image, and listener cleanup, against the
 * real page and the Square stub's catalog (see playwright.stub.config.ts).
 *
 * Pins the QuickView side of the PDP variant work:
 * - selecting a combination that doesn't exist snapped nothing, so the price,
 *   button data and back-in-stock form described the previous variant
 * - the hero never followed the color when images live at the Item level
 * - setupEventHandlers() stacked document/window listeners on every
 *   Client Router navigation
 */

const BLACK_M = TEE.variations[1].id; // the fixture's sold-out variation

async function openQuickView(page: Page) {
  await page.goto('/shop/all');
  await page.waitForFunction(() => typeof window.openQuickView === 'function');
  await page.evaluate((id) => window.openQuickView!(id), TEE.id);
  await expect(page.locator('#quick-view-product')).toBeVisible();
  await expect(
    page.locator('#quick-view-attributes button').first()
  ).toBeVisible();
}

const chip = (page: Page, type: string, value: string) =>
  page.locator(
    `#quick-view-attributes button[data-attribute-type="${type}"][data-attribute-value="${value}"]`
  );

// QuickView marks the selected chip with the variant-selected tokens
const selected = (page: Page) =>
  page
    .locator(
      '#quick-view-attributes button[class*="ui-variant-selected-surface"]'
    )
    .evaluateAll((els) =>
      els.map((e) => (e as HTMLElement).dataset.attributeValue)
    );

const heroSrc = (page: Page) =>
  page
    .locator('#quick-view-image')
    .evaluate((img) => decodeURIComponent((img as HTMLImageElement).src));

test.describe('QuickView variant selection', () => {
  test('a combination that does not exist snaps to a real variant', async ({
    page,
  }) => {
    await openQuickView(page);
    expect(await selected(page)).toEqual(['Black', 'S']);

    await chip(page, 'size', 'L').click(); // Black/L does not exist

    await expect.poll(() => selected(page)).toEqual(['White', 'L']);
    await expect(page.locator('#qv-bis-section')).toBeHidden();
    await expect(page.locator('#quick-view-live-status')).toContainText(
      "Black isn't offered in L"
    );
  });

  test('an existing sold-out combination keeps back-in-stock on its exact variation', async ({
    page,
  }) => {
    await openQuickView(page);

    await chip(page, 'size', 'M').click(); // Black/M exists, sold out

    await expect.poll(() => selected(page)).toEqual(['Black', 'M']);
    await expect(page.locator('#qv-bis-section')).toBeVisible();
    await expect(page.locator('#qv-bis-variation-id')).toHaveValue(BLACK_M);
    await expect(page.locator('#qv-bis-product-title')).toHaveValue(
      'Test Tee — Black, M'
    );
  });

  test('the hero follows the selected color when images are stored at the Item level', async ({
    page,
  }) => {
    await openQuickView(page);
    await expect.poll(() => heroSrc(page)).toContain('IMG_TEE_BLACK');

    await chip(page, 'color', 'White').click();
    await expect.poll(() => heroSrc(page)).toContain('IMG_TEE_WHITE');

    await chip(page, 'color', 'Black').click();
    await expect.poll(() => heroSrc(page)).toContain('IMG_TEE_BLACK');
  });
});

test.describe('QuickView listeners', () => {
  test('document and window listeners do not accumulate across Client Router navigations', async ({
    page,
  }) => {
    const client = await page.context().newCDPSession(page);

    async function listenersOf(expression: string) {
      const { result } = await client.send('Runtime.evaluate', { expression });
      const { listeners } = await client.send('DOMDebugger.getEventListeners', {
        objectId: result.objectId!,
      });
      return listeners;
    }

    // Count the QuickView module's live listeners. Handler objects aren't
    // exposed without enabling the debugger, but each listener reports the
    // script it came from, and the add-to-cart button's click listener
    // identifies the QuickView module's script.
    async function quickViewListeners() {
      const atc = (
        await listenersOf(`document.getElementById('quick-view-add-to-cart')`)
      ).filter((l) => l.type === 'click');
      const script = atc[0]?.scriptId;
      const fromQuickView = (ls: typeof atc, type: string) =>
        ls.filter((l) => l.type === type && l.scriptId === script).length;
      return {
        addToCartClick: atc.length,
        documentKeydown: fromQuickView(
          await listenersOf('document'),
          'keydown'
        ),
        documentTriggerClick: fromQuickView(
          await listenersOf('document'),
          'click'
        ),
        windowCartUpdated: fromQuickView(
          await listenersOf('window'),
          'cartUpdated'
        ),
      };
    }

    const once = {
      addToCartClick: 1,
      documentKeydown: 1,
      documentTriggerClick: 1,
      windowCartUpdated: 1,
    };

    await page.goto('/shop/all');
    await page.waitForFunction(
      () => typeof window.openQuickView === 'function'
    );
    await expect.poll(quickViewListeners).toEqual(once);

    // Two Client Router navigations: to a product page and back to the shop
    await page.locator('a[href^="/product/"]').first().click();
    await page.waitForURL(/\/product\//);
    await expect.poll(quickViewListeners).toEqual(once);

    await page.goBack();
    await page.waitForURL(/\/shop\/all/);
    await expect.poll(quickViewListeners).toEqual(once);
  });
});

declare global {
  interface Window {
    openQuickView?: (productId: string, variationId?: string) => void;
  }
}
