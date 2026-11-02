import { test, expect, type Page } from '@playwright/test';
import { TEE, DECK } from './fixtures/square-catalog.mjs';

/**
 * PDP accessibility and robustness, against the real page and the Square
 * stub's catalog (see playwright.stub.config.ts).
 *
 * - Quantity stepper buttons have names (they were a bare "-" and "+")
 * - The hero uses a plain, variant-aware alt (it had role="img" plus an
 *   aria-label that overrode alt)
 * - The hero is visible without JavaScript (it started at opacity-0 and
 *   relied on a script to reveal it)
 */

const pdp = (product: { id: string }, query = '') =>
  `/product/${product.id}${query}`;

async function open(page: Page, url: string) {
  await page.goto(url);
  await expect(page.locator('#add-to-cart-button')).toHaveAttribute(
    'data-add-to-cart-ready',
    'true'
  );
}

test.describe('PDP quantity stepper', () => {
  test('the − and + buttons have accessible names', async ({ page }) => {
    await open(page, pdp(TEE)); // Black/S has 5 in stock, so the stepper shows

    const decrease = page.getByRole('button', { name: 'Decrease quantity' });
    const increase = page.getByRole('button', { name: 'Increase quantity' });
    await expect(decrease).toBeVisible();
    await expect(increase).toBeVisible();

    // The glyphs are decoration; the names come from aria-label
    await expect(increase).toHaveAttribute('aria-label', 'Increase quantity');
  });

  test('the buttons still work', async ({ page }) => {
    await open(page, pdp(TEE));
    const input = page.locator('#quantity-input');

    await page.getByRole('button', { name: 'Increase quantity' }).click();
    await expect(input).toHaveValue('2');
    await page.getByRole('button', { name: 'Decrease quantity' }).click();
    await expect(input).toHaveValue('1');
  });
});

test.describe('PDP hero image alt text', () => {
  test('is a plain image with a color-aware alt, not role="img" + aria-label', async ({
    page,
  }) => {
    await open(page, pdp(TEE));
    const hero = page.locator('#product-image');

    await expect(hero).not.toHaveAttribute('role', /.*/);
    await expect(hero).not.toHaveAttribute('aria-label', /.*/);
    await expect(hero).toHaveAttribute('alt', 'Test Tee — Black');
  });

  test('follows the selected color', async ({ page }) => {
    await open(page, pdp(TEE));
    const hero = page.locator('#product-image');

    await page
      .locator(
        '.attribute-button[data-attribute-type="color"][data-attribute-value="White"]'
      )
      .click();
    await expect(hero).toHaveAttribute('alt', 'Test Tee — White');
  });

  test('is rendered by the server for the requested variant', async ({
    page,
  }) => {
    const html = await (
      await page.request.get(pdp(TEE, '?variant=white-s'))
    ).text();
    const hero = html.match(/<img[^>]*id="product-image"[^>]*>/)?.[0] ?? '';

    expect(hero).toContain('alt="Test Tee — White"');
  });

  test('leaves size out of the alt text when there is no color', async ({
    page,
  }) => {
    await open(page, pdp(DECK));
    await expect(page.locator('#product-image')).toHaveAttribute(
      'alt',
      'Test Deck'
    );
  });
});

test.describe('PDP hero without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('is visible, and the loading skeleton does not sit over it', async ({
    page,
  }) => {
    await page.goto(pdp(TEE));

    // The hero starts at opacity-0 and a script reveals it; with no script it
    // must not stay invisible. The skeleton is absolutely positioned (it paints
    // above the image), and nothing removes it without JS.
    await expect(page.locator('#product-image')).toHaveCSS('opacity', '1');
    await expect(page.locator('#pdp-image-placeholder')).toBeHidden();
  });
});
