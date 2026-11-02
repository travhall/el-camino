import { test, expect, type Page } from '@playwright/test';
import { DECK, TEE } from './fixtures/square-catalog.mjs';

/**
 * QuickView image gallery: previous/next arrows, touch swipe, keyboard and
 * announcements, against the real page and the Square stub's catalog (see
 * playwright.stub.config.ts). It runs the same module as the PDP gallery
 * (lib/product/gallery.ts); QuickView has no zoom.
 *
 * DECK has three images shared by every size, so QuickView shows a thumbnail
 * strip and arrows. TEE has one image per color, so it has neither.
 *
 * Images don't load under the stub (the image CDN isn't served), so
 * assertions read `src`, not pixels.
 */

async function openQuickView(page: Page, product: { id: string }) {
  await page.goto('/shop/all');
  await page.waitForFunction(() => typeof window.openQuickView === 'function');
  await page.evaluate((id) => window.openQuickView!(id), product.id);
  await expect(page.locator('#quick-view-product')).toBeVisible();
}

const next = (page: Page) => page.locator('#quick-view-gallery-next');
const prev = (page: Page) => page.locator('#quick-view-gallery-prev');
const thumbs = (page: Page) => page.locator('.quick-view-thumb');

const heroSrc = (page: Page) =>
  page
    .locator('#quick-view-image')
    .evaluate((img) => decodeURIComponent((img as HTMLImageElement).src));

const pressed = (page: Page) =>
  thumbs(page).evaluateAll((els) =>
    els.map((e) => e.getAttribute('aria-pressed'))
  );

test.describe('QuickView gallery arrows', () => {
  test('step through the images and keep the thumbnails and hero in step', async ({
    page,
  }) => {
    await openQuickView(page, DECK);
    await expect(next(page)).toBeVisible();
    await expect(prev(page)).toBeVisible();
    expect(await pressed(page)).toEqual(['true', 'false', 'false']);
    expect(await heroSrc(page)).toContain('IMG_DECK_1');

    await next(page).click();
    expect(await pressed(page)).toEqual(['false', 'true', 'false']);
    await expect.poll(() => heroSrc(page)).toContain('IMG_DECK_2');

    await next(page).click();
    expect(await pressed(page)).toEqual(['false', 'false', 'true']);
    await expect.poll(() => heroSrc(page)).toContain('IMG_DECK_3');
  });

  test('wrap around at both ends', async ({ page }) => {
    await openQuickView(page, DECK);
    await prev(page).click();
    expect(await pressed(page)).toEqual(['false', 'false', 'true']);
    await next(page).click();
    expect(await pressed(page)).toEqual(['true', 'false', 'false']);
  });

  test('announce the position to screen readers', async ({ page }) => {
    await openQuickView(page, DECK);
    await next(page).click();
    await expect(page.locator('#quick-view-gallery-status')).toHaveText(
      'Image 2 of 3'
    );
  });

  test('work from the keyboard without closing the panel', async ({ page }) => {
    await openQuickView(page, DECK);
    await next(page).focus();
    await page.keyboard.press('ArrowRight');
    expect(await pressed(page)).toEqual(['false', 'true', 'false']);
    await page.keyboard.press('ArrowLeft');
    expect(await pressed(page)).toEqual(['true', 'false', 'false']);
    await expect(page.locator('#quick-view-product')).toBeVisible();
  });

  test('clicking a thumbnail still works and the arrows continue from it', async ({
    page,
  }) => {
    await openQuickView(page, DECK);
    await thumbs(page).nth(2).click();
    expect(await pressed(page)).toEqual(['false', 'false', 'true']);
    await expect.poll(() => heroSrc(page)).toContain('IMG_DECK_3');

    await next(page).click(); // wraps to the first
    expect(await pressed(page)).toEqual(['true', 'false', 'false']);
  });

  test('are hidden, with no strip, when there is one image per variant', async ({
    page,
  }) => {
    await openQuickView(page, TEE);
    await expect(
      page.locator('#quick-view-attributes button').first()
    ).toBeVisible();
    await expect(next(page)).toBeHidden();
    await expect(prev(page)).toBeHidden();
    await expect(page.locator('#quick-view-thumbnails')).toBeHidden();
  });

  test('have no zoom: no zoom button, and clicking the image opens nothing', async ({
    page,
  }) => {
    await openQuickView(page, DECK);
    await expect(next(page)).toBeVisible();
    await expect(page.locator('#gallery-zoom')).toHaveCount(0);
    await page.locator('#quick-view-image-container').click({
      position: { x: 60, y: 60 },
    });
    await expect(page.locator('dialog[open]')).toHaveCount(0);
    await expect(page.locator('#quick-view-product')).toBeVisible();
  });
});

test.describe('QuickView gallery across opens and variants', () => {
  test('exactly one thumbnail stays pressed after choosing another size', async ({
    page,
  }) => {
    await openQuickView(page, DECK);
    await next(page).click();
    await page
      .locator('#quick-view-attributes button[data-attribute-value="8.25"]')
      .click();
    // The strip is rebuilt for the new variation
    await expect
      .poll(
        async () => (await pressed(page)).filter((p) => p === 'true').length
      )
      .toBe(1);
  });

  test('closing and reopening does not make one press step twice', async ({
    page,
  }) => {
    await openQuickView(page, DECK);
    await page.locator('#close-quick-view').click();
    await page.evaluate((id) => window.openQuickView!(id), DECK.id);
    await expect(page.locator('#quick-view-product')).toBeVisible();
    await expect(next(page)).toBeVisible();

    await next(page).click();
    expect(await pressed(page)).toEqual(['false', 'true', 'false']);
  });

  test('Escape still closes the panel', async ({ page }) => {
    await openQuickView(page, DECK);
    await page.keyboard.press('Escape');
    await expect(page.locator('#quick-view-panel')).toHaveClass(
      /-translate-x-full/
    );
  });
});

test.describe('QuickView gallery swipe', () => {
  // QuickView is desktop-only (lg and up); touch matters for tablets at that
  // width, not phones.
  test.use({ hasTouch: true, viewport: { width: 1024, height: 800 } });

  async function drag(
    page: Page,
    from: [number, number],
    to: [number, number],
    pointerType = 'touch'
  ) {
    const c = page.locator('#quick-view-image-container');
    const common = { pointerType, isPrimary: true, bubbles: true };
    await c.dispatchEvent('pointerdown', {
      ...common,
      clientX: from[0],
      clientY: from[1],
    });
    await c.dispatchEvent('pointerup', {
      ...common,
      clientX: to[0],
      clientY: to[1],
    });
  }

  test('a left swipe shows the next image and a right swipe the previous', async ({
    page,
  }) => {
    await openQuickView(page, DECK);
    await expect(next(page)).toBeVisible();
    await drag(page, [250, 200], [100, 205]);
    expect(await pressed(page)).toEqual(['false', 'true', 'false']);
    await drag(page, [100, 200], [250, 195]);
    expect(await pressed(page)).toEqual(['true', 'false', 'false']);
  });

  test('a mostly-vertical gesture is a scroll, not a swipe', async ({
    page,
  }) => {
    await openQuickView(page, DECK);
    await expect(next(page)).toBeVisible();
    await drag(page, [200, 100], [150, 300]);
    expect(await pressed(page)).toEqual(['true', 'false', 'false']);
  });

  test('a mouse drag does not change the image', async ({ page }) => {
    await openQuickView(page, DECK);
    await expect(next(page)).toBeVisible();
    await drag(page, [250, 200], [100, 205], 'mouse');
    expect(await pressed(page)).toEqual(['true', 'false', 'false']);
  });
});
