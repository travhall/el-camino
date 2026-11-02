import { test, expect, type Page } from '@playwright/test';
import { TEE, DECK, PROMO } from './fixtures/square-catalog.mjs';

/**
 * PDP variant selection, hero image, and deep-link behavior, against the real
 * page and the Square stub's catalog (see playwright.stub.config.ts and
 * e2e/fixtures/square-catalog.mjs for the fixture matrix).
 *
 * Each test pins a bug fixed in the PDP variant work:
 * - duplicate controller init (two live click handlers per chip)
 * - hero image not changing: SSR <picture> <source>s outranked the <img>
 * - selecting a combination that doesn't exist left the UI describing
 *   different variants (and back-in-stock registered the wrong variation)
 * - a sold-out ?variant= link was silently swapped for another variant
 * - the server-rendered hero/preload/OG/JSON-LD used the item's primary image
 *   for a promoted default or an explicit ?variant= on another color
 *
 * Images are served by the Netlify Image CDN in production and don't load
 * here, so image assertions read `currentSrc` / the URL, not pixels.
 */

const pdp = (product: { id: string }, query = '') =>
  `/product/${product.id}${query}`;

// Black/M is the fixture's sold-out variation
const BLACK_M = TEE.variations[1].id;

async function open(page: Page, url: string) {
  await page.goto(url);
  // Set once the controller has attached its handlers (see pdpEvents.ts)
  await expect(page.locator('#add-to-cart-button')).toHaveAttribute(
    'data-add-to-cart-ready',
    'true'
  );
}

const chip = (page: Page, type: string, value: string) =>
  page.locator(
    `.attribute-button[data-attribute-type="${type}"][data-attribute-value="${value}"]`
  );

const selected = (page: Page) =>
  page
    .locator('.attribute-button[aria-pressed="true"]')
    .evaluateAll((els) =>
      els.map((e) => (e as HTMLElement).dataset.attributeValue)
    );

const heroSrc = (page: Page) =>
  page
    .locator('#product-image')
    .evaluate((img) =>
      decodeURIComponent((img as HTMLImageElement).currentSrc)
    );

const heroSources = (page: Page) =>
  page.locator('#product-image-container picture source').count();

test.describe('PDP variant selection', () => {
  test('a combination that does not exist snaps to a real variant, and the whole UI agrees', async ({
    page,
  }) => {
    await open(page, pdp(TEE));
    expect(await selected(page)).toEqual(['Black', 'S']);

    await chip(page, 'size', 'L').click(); // Black/L does not exist

    await expect.poll(() => selected(page)).toEqual(['White', 'L']);
    await expect(page).toHaveURL(/\?variant=white-l$/);
    await expect(page.locator('#add-to-cart-button')).toHaveText('Add to Cart');
    await expect(page.locator('#add-to-cart-button')).toBeEnabled();
    await expect(page.locator('#back-in-stock-section')).toBeHidden();
    expect(await heroSrc(page)).toContain('IMG_TEE_WHITE');
    // Screen readers are told what moved
    await expect(page.locator('#pdp-live-status')).toContainText(
      "Black isn't offered in L"
    );
  });

  test('an existing but sold-out combination stays selected, and back-in-stock targets that exact variation', async ({
    page,
  }) => {
    await open(page, pdp(TEE));

    await chip(page, 'size', 'M').click(); // Black/M exists, sold out

    await expect.poll(() => selected(page)).toEqual(['Black', 'M']);
    await expect(page.locator('#add-to-cart-button')).toHaveText('Sold Out');
    await expect(page.locator('#add-to-cart-button')).toBeDisabled();
    await expect(page.locator('#back-in-stock-section')).toBeVisible();
    await expect(page.locator('#bis-variation-id')).toHaveValue(BLACK_M);
    await expect(page.locator('#bis-label-product')).toContainText('Black, M');
  });

  test('every chip has exactly one click listener (no duplicate controller)', async ({
    page,
  }) => {
    await open(page, pdp(TEE));

    const client = await page.context().newCDPSession(page);
    const { result } = await client.send('Runtime.evaluate', {
      expression: `document.querySelector('.attribute-button[data-attribute-value="L"]')`,
    });
    const { listeners } = await client.send('DOMDebugger.getEventListeners', {
      objectId: result.objectId!,
    });

    expect(listeners.filter((l) => l.type === 'click')).toHaveLength(1);
  });
});

test.describe('PDP hero image', () => {
  test('follows the selected color even though the SSR <picture> has AVIF/WebP sources', async ({
    page,
  }) => {
    await open(page, pdp(TEE));
    expect(await heroSources(page)).toBe(2);
    expect(await heroSrc(page)).toContain('IMG_TEE_BLACK');

    await chip(page, 'color', 'White').click();
    await expect.poll(() => heroSrc(page)).toContain('IMG_TEE_WHITE');
    expect(await heroSources(page)).toBe(0);

    await chip(page, 'color', 'Black').click();
    await expect.poll(() => heroSrc(page)).toContain('IMG_TEE_BLACK');
  });

  test('thumbnail clicks change the hero', async ({ page }) => {
    await open(page, pdp(DECK));
    const thumbs = page.locator('.gallery-thumb');
    await expect(thumbs).toHaveCount(3);
    expect(await heroSrc(page)).toContain('IMG_DECK_1');

    await thumbs.nth(2).click();
    await expect.poll(() => heroSrc(page)).toContain('IMG_DECK_3');

    await thumbs.nth(1).click();
    await expect.poll(() => heroSrc(page)).toContain('IMG_DECK_2');
  });
});

test.describe('PDP sold-out ?variant= links', () => {
  test('a sold-out requested variant is shown as sold out, not swapped', async ({
    page,
  }) => {
    await open(page, pdp(TEE, '?variant=black-m'));

    expect(await selected(page)).toEqual(['Black', 'M']);
    await expect(page).toHaveURL(/\?variant=black-m$/);
    await expect(page).toHaveTitle(/Black, M/);
    await expect(page.locator('#add-to-cart-button')).toHaveText('Sold Out');
    await expect(page.locator('#back-in-stock-section')).toBeVisible();
    await expect(page.locator('#bis-variation-id')).toHaveValue(BLACK_M);
    await expect(page.locator('#quantity-section')).toBeHidden();
  });

  test('switching from a sold-out landing variant to an in-stock one brings back the quantity stepper', async ({
    page,
  }) => {
    await open(page, pdp(TEE, '?variant=black-m'));

    await chip(page, 'size', 'S').click(); // Black/S, 5 in stock

    await expect.poll(() => selected(page)).toEqual(['Black', 'S']);
    await expect(page.locator('#quantity-section')).toBeVisible();
    await expect(page.locator('#quantity-stepper')).toBeVisible();
    await expect(page.locator('#remaining-count')).toHaveText('5 available');
    await expect(page.locator('#back-in-stock-section')).toBeHidden();
  });

  test('an implicit sold-out default is still promoted to the first in-stock variant', async ({
    page,
  }) => {
    await open(page, pdp(PROMO)); // default Black/S is sold out

    expect(await selected(page)).toEqual(['White', 'S']);
    await expect(page.locator('#add-to-cart-button')).toHaveText('Add to Cart');
  });
});

test.describe('PDP server-rendered hero image', () => {
  // Raw HTML only: no JS runs, so hydration can't mask a wrong SSR image.
  const safeDecode = (s: string) => {
    try {
      return decodeURIComponent(s);
    } catch {
      return s;
    }
  };
  const tag = (html: string, re: RegExp) =>
    safeDecode(html.match(re)?.[0] ?? '');

  async function ssrImages(page: Page, url: string) {
    const html = await (await page.request.get(url)).text();
    return {
      hero: tag(html, /<img[^>]*id="product-image"[^>]*>/),
      preload: tag(html, /<link[^>]*rel="preload"[^>]*as="image"[^>]*>/),
      og: tag(html, /<meta[^>]*property="og:image"[^>]*>/),
      jsonLd: safeDecode(
        (
          html.match(/<script[^>]*ld\+json[^>]*>[\s\S]*?<\/script>/g) ?? []
        ).join('\n')
      ),
    };
  }

  test('an explicit ?variant= on another color renders that color everywhere', async ({
    page,
  }) => {
    const ssr = await ssrImages(page, pdp(TEE, '?variant=white-s'));

    expect(ssr.hero).toContain('IMG_TEE_WHITE');
    expect(ssr.preload).toContain('IMG_TEE_WHITE');
    expect(ssr.og).toContain('IMG_TEE_WHITE');
    expect(ssr.jsonLd).toContain('IMG_TEE_WHITE');
  });

  test('a promoted default on another color renders that color everywhere', async ({
    page,
  }) => {
    const ssr = await ssrImages(page, pdp(PROMO));

    expect(ssr.hero).toContain('IMG_PROMO_WHITE');
    expect(ssr.preload).toContain('IMG_PROMO_WHITE');
    expect(ssr.og).toContain('IMG_PROMO_WHITE');
    expect(ssr.jsonLd).toContain('IMG_PROMO_WHITE');
  });

  test('the default variant is unchanged', async ({ page }) => {
    const ssr = await ssrImages(page, pdp(TEE));

    expect(ssr.hero).toContain('IMG_TEE_BLACK');
    expect(ssr.preload).toContain('IMG_TEE_BLACK');
  });

  test('hydration leaves the SSR AVIF/WebP sources in place when the server already rendered the right image', async ({
    page,
  }) => {
    await open(page, pdp(PROMO));

    expect(await heroSources(page)).toBe(2);
    expect(await heroSrc(page)).toContain('IMG_PROMO_WHITE');
  });
});
