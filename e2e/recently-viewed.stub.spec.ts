import { test, expect, type Page } from '@playwright/test';
import { SOURCE, TEE } from './fixtures/square-catalog.mjs';

/**
 * What the PDP records into "Recently viewed", against the real page and the
 * Square stub's catalog (see playwright.stub.config.ts).
 *
 * It used to scrape the brand out of the heading's markup
 * (`.product-info h1 span.uppercase`), so restructuring the heading silently
 * dropped the brand from every card, and it stored `img.src`, which is the
 * hero's 800px image-CDN URL (or the logo placeholder after a load error)
 * rather than the product's own image.
 */

const STORAGE_KEY = 'el-camino:recently-viewed';

type Stored = { id: string; title: string; brand?: string; image: string };

async function viewed(page: Page): Promise<Stored[]> {
  return page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key) ?? '[]'),
    STORAGE_KEY
  );
}

async function open(page: Page, product: { id: string }) {
  await page.goto(`/product/${product.id}`);
  await expect(page.locator('#add-to-cart-button')).toHaveAttribute(
    'data-add-to-cart-ready',
    'true'
  );
}

test.describe('PDP recently-viewed tracking', () => {
  test("records the product's brand", async ({ page }) => {
    await open(page, SOURCE); // brand Acme

    const [item] = await viewed(page);
    expect(item).toMatchObject({ title: 'Source Deck', brand: 'Acme' });
  });

  test("records the brand even when the heading's markup changes", async ({
    page,
  }) => {
    // Strip the heading's brand <span> as soon as the parser inserts it, i.e.
    // before the page script runs. A restructured heading must not cost the
    // card its brand.
    await page.addInitScript(() => {
      new MutationObserver(() => {
        document.querySelectorAll('h1 span').forEach((el) => el.remove());
      }).observe(document, { childList: true, subtree: true });
    });

    await open(page, SOURCE);

    expect(await page.locator('h1 span').count()).toBe(0); // the premise
    const [item] = await viewed(page);
    expect(item.brand).toBe('Acme');
  });

  test('records no brand for a product that has none', async ({ page }) => {
    await open(page, TEE);

    const [item] = await viewed(page);
    expect(item.brand).toBeUndefined();
  });

  test("stores the product's own image URL, not the hero's CDN-resized one", async ({
    page,
  }) => {
    await open(page, SOURCE);

    const [item] = await viewed(page);
    // The card resizes this itself (to 400px); an already-proxied URL is passed
    // through as-is, which would mean showing the 800px hero image instead.
    expect(item.image).toContain('items-images-sandbox.s3.amazonaws.com/');
    expect(item.image).not.toContain('/.netlify/images');
  });

  test('keeps the original image when the hero image fails to load', async ({
    page,
  }) => {
    // Under the stub the CDN route doesn't exist, so the hero errors and the
    // page swaps its src for the logo placeholder. The record must not follow.
    await open(page, SOURCE);
    await expect
      .poll(() =>
        page
          .locator('#product-image')
          .evaluate((img) => (img as HTMLImageElement).src)
      )
      .toMatch(/^data:/);

    const [item] = await viewed(page);
    expect(item.image).not.toMatch(/^data:/);
    expect(item.image).toContain('items-images-sandbox.s3.amazonaws.com/');
  });
});
