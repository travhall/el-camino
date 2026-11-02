import { test, expect, type Page } from '@playwright/test';
import { SOURCE, TEE, DECK } from './fixtures/square-catalog.mjs';

/**
 * The related-products filmstrip on the PDP, against the real page and the
 * Square stub's catalog (see playwright.stub.config.ts and the "Related-products
 * cluster" in e2e/fixtures/square-catalog.mjs).
 *
 * Viewed from SOURCE (brand Acme, category Decks) the cluster lands in every
 * scoring tier, so ranking and the five-card cap are both observable:
 * Acme Trucks (100) > Acme Deck Two (80) > Zeta Wheels (60) > Zeta Deck (40) >
 * Acme Sticker (20), with Acme Cap (20) cut by the cap and Unrelated Hat (0)
 * excluded.
 *
 * Pins:
 * - the PDP uses the category-aware scorer (it was brand-only)
 * - "sold out" means every variation is, not just the default
 * - the section's heading and see-all link describe what's actually in it
 * - a mouse user can scroll the row (its scrollbar is hidden)
 */

const pdp = (product: { id: string }) => `/product/${product.id}`;

const strip = (page: Page) => page.locator('#related-products-viewport');
const cards = (page: Page) => strip(page).locator('a[href^="/product/"]');
const next = (page: Page) =>
  page.getByRole('button', { name: 'Next products' });
const prev = (page: Page) =>
  page.getByRole('button', { name: 'Previous products' });
const scrollLeft = (page: Page) =>
  strip(page).evaluate((el) => (el as HTMLElement).scrollLeft);

async function open(page: Page, product: { id: string }) {
  await page.goto(pdp(product));
  await expect(page.locator('#add-to-cart-button')).toHaveAttribute(
    'data-add-to-cart-ready',
    'true'
  );
}

test.describe('Related products selection', () => {
  test('ranks by brand and category, and stops at five', async ({ page }) => {
    await open(page, SOURCE);

    const hrefs = await cards(page).evaluateAll((els) =>
      els.map((e) => e.getAttribute('href'))
    );
    expect(hrefs).toEqual([
      '/product/acme-trucks', // same brand + complementary category
      '/product/acme-deck-two', // same brand + same category
      '/product/zeta-wheels', // complementary category
      '/product/zeta-deck', // same category
      '/product/acme-sticker', // same brand only
    ]);
    // Acme Cap ties Acme Sticker but is the sixth; Unrelated Hat scores 0
    await expect(page.locator('a[href="/product/acme-cap"]')).toHaveCount(0);
    await expect(page.locator('a[href="/product/unrelated-hat"]')).toHaveCount(
      0
    );
  });

  test('a different-brand product in the same category outranks a same-brand one elsewhere', async ({
    page,
  }) => {
    await open(page, SOURCE);

    const hrefs = await cards(page).evaluateAll((els) =>
      els.map((e) => e.getAttribute('href'))
    );
    expect(hrefs.indexOf('/product/zeta-deck')).toBeLessThan(
      hrefs.indexOf('/product/acme-sticker')
    );
  });

  test('a product with no brand still gets related products from its category', async ({
    page,
  }) => {
    await open(page, TEE); // no brand; category Test Goods

    // Before, no brand meant no section at all
    const hrefs = await cards(page).evaluateAll((els) =>
      els.map((e) => e.getAttribute('href'))
    );
    expect(hrefs).toHaveLength(3);
    expect(hrefs).toEqual(
      expect.arrayContaining([
        '/product/acme-sticker',
        '/product/acme-cap',
        '/product/unrelated-hat',
      ])
    );
  });

  test('shows no section when nothing relates', async ({ page }) => {
    await open(page, DECK); // no brand, no category

    await expect(page.locator('section.related-products')).toHaveCount(0);
  });
});

test.describe('Related products sold-out labels', () => {
  const label = (page: Page, slug: string) =>
    page.locator(`a[href="/product/${slug}"]`).getAttribute('aria-label');

  test('a product is sold out only when every variation is', async ({
    page,
  }) => {
    await open(page, SOURCE);

    // Both sizes of Acme Deck Two are out
    expect(await label(page, 'acme-deck-two')).toContain('Sold Out');
    // Zeta Deck's default size is out but 8.25 is in stock: still buyable
    expect(await label(page, 'zeta-deck')).not.toContain('Sold Out');
    expect(await label(page, 'acme-trucks')).not.toContain('Sold Out');
  });
});

test.describe('Related products heading and see-all link', () => {
  test('a mixed result gets the neutral heading and links to the whole shop', async ({
    page,
  }) => {
    await open(page, SOURCE);

    await expect(page.locator('#related-products-title')).toHaveText(
      'You Might Also Like'
    );
    // The row is a named region, named by that heading
    await expect(
      page.getByRole('region', { name: 'You Might Also Like' })
    ).toBeVisible();
    // Header link (large screens) and the card at the end of the row
    const seeAll = page.getByRole('link', { name: 'See all products' });
    await expect(seeAll).toHaveCount(2);
    for (const link of await seeAll.all()) {
      await expect(link).toHaveAttribute('href', '/shop/all');
    }
  });

  test('a result that is all in the source category says so and links to it', async ({
    page,
  }) => {
    await open(page, TEE);

    await expect(page.locator('#related-products-title')).toHaveText(
      'More in Test Goods'
    );
    await expect(
      page.getByRole('link', { name: 'See all Test Goods' })
    ).toHaveAttribute('href', '/category/test-goods');
  });
});

test.describe('Related products scrolling (desktop)', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('the arrows scroll the row, starting with only "next" available', async ({
    page,
  }) => {
    await open(page, SOURCE);

    await expect(next(page)).toBeVisible();
    await expect(prev(page)).toBeVisible();
    await expect(prev(page)).toHaveAttribute('aria-disabled', 'true');
    await expect(next(page)).toHaveAttribute('aria-disabled', 'false');
    expect(await scrollLeft(page)).toBe(0);

    await next(page).click();

    await expect.poll(() => scrollLeft(page)).toBeGreaterThan(100);
    await expect(prev(page)).toHaveAttribute('aria-disabled', 'false');
  });

  test('reach the end, then "next" is spent and "previous" scrolls back', async ({
    page,
  }) => {
    await open(page, SOURCE);

    for (let i = 0; i < 6; i++) {
      if ((await next(page).getAttribute('aria-disabled')) === 'true') break;
      await next(page).click();
      await page.waitForTimeout(450); // smooth scroll
    }
    await expect(next(page)).toHaveAttribute('aria-disabled', 'true');
    const atEnd = await scrollLeft(page);

    await prev(page).click();

    await expect.poll(() => scrollLeft(page)).toBeLessThan(atEnd);
  });

  test('keep keyboard focus on "next" when it reaches the end', async ({
    page,
  }) => {
    await open(page, SOURCE);
    await next(page).focus();

    for (let i = 0; i < 6; i++) {
      if ((await next(page).getAttribute('aria-disabled')) === 'true') break;
      await page.keyboard.press('Enter');
      await page.waitForTimeout(450);
    }

    await expect(next(page)).toHaveAttribute('aria-disabled', 'true');
    await expect(next(page)).toBeFocused();
  });

  test('are tied to the row they scroll', async ({ page }) => {
    await open(page, SOURCE);

    await expect(next(page)).toHaveAttribute(
      'aria-controls',
      'related-products-viewport'
    );
    await expect(prev(page)).toHaveAttribute(
      'aria-controls',
      'related-products-viewport'
    );
  });
});

test.describe('Related products scrolling (other widths)', () => {
  test('are hidden on a phone, where the row is swiped', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await open(page, SOURCE);

    await expect(next(page)).toBeHidden();
    await expect(prev(page)).toBeHidden();
  });

  test('are hidden when everything already fits', async ({ page }) => {
    await page.setViewportSize({ width: 2600, height: 1000 });
    await open(page, SOURCE);

    const controls = page.locator('[data-filmstrip-controls]');
    await expect(controls).toHaveAttribute('data-overflow', 'false');
    await expect(next(page)).toBeHidden();
  });

  test('appear when the window is narrowed so it no longer fits', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 2600, height: 1000 });
    await open(page, SOURCE);
    await expect(next(page)).toBeHidden();

    await page.setViewportSize({ width: 1280, height: 900 });

    await expect(next(page)).toBeVisible();
  });
});
