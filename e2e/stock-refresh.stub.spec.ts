import { test, expect, type Page, type Route } from '@playwright/test';
import { TEE, DECK } from './fixtures/square-catalog.mjs';

/**
 * The PDP re-checks stock after it loads, against the real page and the Square
 * stub's catalog (see playwright.stub.config.ts).
 *
 * The page is cached at the CDN and Square's inventory webhook clears only the
 * blob-level inventory cache, so the count, stepper maximum and in-stock /
 * sold-out state it renders with can be stale. After load it asks
 * /api/cart-inventory and corrects them.
 *
 * What "fresh" says is controlled here by intercepting that one request in the
 * browser; the page, its server render, and the real endpoint (one test) are
 * not mocked.
 *
 * Stub stock at render time: Black/S 5, Black/M 0 (sold out), White/S 3,
 * White/L 4; DECK 8.0 and 8.25 both 4.
 */

const [BLACK_S, BLACK_M, WHITE_S, WHITE_L] = TEE.variations.map(
  (v: { id: string }) => v.id
);
const [DECK_8, DECK_825] = DECK.variations.map((v: { id: string }) => v.id);

interface Reply {
  inventory?: Record<string, number>;
  /** IDs the server "could not check" */
  unknown?: string[];
  status?: number;
  /** Leave `unknown` out, as an older server would */
  omitUnknown?: boolean;
  /** Hold the response until this resolves */
  gate?: Promise<void>;
}

/** Answer the PDP's own stock refresh; anything else passes through. */
async function stubRefresh(
  page: Page,
  ownIds: string[],
  reply: Reply
): Promise<{ asked: string[][] }> {
  const asked: string[][] = [];
  await page.route('**/api/cart-inventory', async (route: Route) => {
    const ids: string[] = route.request().postDataJSON()?.variationIds ?? [];
    if (!ids.some((id) => ownIds.includes(id))) return route.continue();

    asked.push(ids);
    if (reply.gate) await reply.gate;
    const body: Record<string, unknown> = {
      success: (reply.status ?? 200) < 400,
      inventory: reply.inventory ?? {},
    };
    if (!reply.omitUnknown) body.unknown = reply.unknown ?? [];
    await route.fulfill({
      status: reply.status ?? 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
  return { asked };
}

const teeIds = [BLACK_S, BLACK_M, WHITE_S, WHITE_L];
const teeStock = (overrides: Record<string, number>) => ({
  [BLACK_S]: 5,
  [BLACK_M]: 0,
  [WHITE_S]: 3,
  [WHITE_L]: 4,
  ...overrides,
});

async function open(page: Page, product: { id: string }, query = '') {
  await page.goto(`/product/${product.id}${query}`);
  await expect(page.locator('#add-to-cart-button')).toHaveAttribute(
    'data-add-to-cart-ready',
    'true'
  );
}

const cta = (page: Page) => page.locator('#add-to-cart-button');
const remaining = (page: Page) => page.locator('#remaining-count');

test.describe('PDP stock refresh: correcting a stale page', () => {
  test('asks about every variation of the product', async ({ page }) => {
    const { asked } = await stubRefresh(page, teeIds, {
      inventory: teeStock({}),
    });

    await open(page, TEE);
    await expect.poll(() => asked.length).toBe(1);

    expect([...asked[0]].sort()).toEqual([...teeIds].sort());
  });

  test('a variation that sold out after the page was cached becomes sold out', async ({
    page,
  }) => {
    await stubRefresh(page, teeIds, { inventory: teeStock({ [BLACK_S]: 0 }) });

    await open(page, TEE); // rendered with Black/S in stock (5)

    await expect(cta(page)).toHaveText('Sold Out');
    await expect(cta(page)).toBeDisabled();
    await expect(page.locator('#back-in-stock-section')).toBeVisible();
    await expect(page.locator('[data-overlay="stock"]')).toBeVisible();
  });

  test('a count that has dropped is corrected, along with the stepper maximum', async ({
    page,
  }) => {
    await stubRefresh(page, teeIds, { inventory: teeStock({ [BLACK_S]: 2 }) });

    await open(page, TEE);

    await expect(remaining(page)).toHaveText('2 available');
    await expect(page.locator('#quantity-input')).toHaveAttribute('max', '2');
    await expect(cta(page)).toHaveText('Add to Cart');
  });

  test('a variation that was restocked becomes buyable', async ({ page }) => {
    await stubRefresh(page, teeIds, { inventory: teeStock({ [BLACK_M]: 3 }) });

    await open(page, TEE, '?variant=black-m'); // rendered sold out

    await expect(cta(page)).toHaveText('Add to Cart');
    await expect(cta(page)).toBeEnabled();
    await expect(page.locator('#back-in-stock-section')).toBeHidden();
    await expect(page.locator('#quantity-section')).toBeVisible();
    await expect(remaining(page)).toHaveText('3 available');
  });

  test("another variation's change updates its chip, not the current display", async ({
    page,
  }) => {
    await stubRefresh(page, teeIds, {
      inventory: teeStock({ [WHITE_S]: 0, [WHITE_L]: 0 }),
    });

    await open(page, TEE); // Black/S is current and unaffected

    const white = page.locator(
      '.attribute-button[data-attribute-type="color"][data-attribute-value="White"]'
    );
    await expect(white).toHaveAttribute('aria-label', 'White — out of stock');
    await expect(cta(page)).toHaveText('Add to Cart');
    await expect(remaining(page)).toHaveText('5 available');
  });
});

test.describe('PDP stock refresh: when it cannot be trusted, leave the page alone', () => {
  test('a variation the server could not check is not shown as sold out', async ({
    page,
  }) => {
    // What a Square hiccup looks like: every ID reported 0, all flagged unknown
    await stubRefresh(page, teeIds, {
      inventory: teeStock({ [BLACK_S]: 0, [WHITE_S]: 0, [WHITE_L]: 0 }),
      unknown: teeIds,
    });

    await open(page, TEE);
    await page.waitForTimeout(500); // the refresh has had its chance

    await expect(cta(page)).toHaveText('Add to Cart');
    await expect(cta(page)).toBeEnabled();
    await expect(remaining(page)).toHaveText('5 available');
  });

  test('a failed request leaves the page as rendered', async ({ page }) => {
    await stubRefresh(page, teeIds, { status: 500 });

    await open(page, TEE);
    await page.waitForTimeout(500);

    await expect(cta(page)).toHaveText('Add to Cart');
    await expect(remaining(page)).toHaveText('5 available');
  });

  test('a response without the `unknown` list (an older server) is ignored', async ({
    page,
  }) => {
    await stubRefresh(page, teeIds, {
      inventory: teeStock({ [BLACK_S]: 0 }),
      omitUnknown: true,
    });

    await open(page, TEE);
    await page.waitForTimeout(500);

    await expect(cta(page)).toHaveText('Add to Cart');
    await expect(remaining(page)).toHaveText('5 available');
  });
});

test.describe('PDP stock refresh: does not disturb what the shopper is doing', () => {
  test("keeps the shopper's place in the gallery", async ({ page }) => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    await stubRefresh(page, [DECK_8, DECK_825], {
      inventory: { [DECK_8]: 2, [DECK_825]: 4 },
      gate,
    });
    await open(page, DECK);

    // Move to the third image while the refresh is still in flight...
    await page.locator('.gallery-thumb').nth(2).click();
    await expect
      .poll(() =>
        page
          .locator('#product-image')
          .evaluate((img) =>
            decodeURIComponent((img as HTMLImageElement).currentSrc)
          )
      )
      .toContain('IMG_DECK_3');

    // ...then let it land and change the current variation's stock
    release();
    await expect(remaining(page)).toHaveText('2 available');

    // Still on the third image, with its thumbnail still selected
    expect(
      await page
        .locator('#product-image')
        .evaluate((img) =>
          decodeURIComponent((img as HTMLImageElement).currentSrc)
        )
    ).toContain('IMG_DECK_3');
    const selected = await page
      .locator('.gallery-thumb')
      .evaluateAll((els) =>
        els.findIndex((e) => e.getAttribute('aria-pressed') === 'true')
      );
    expect(selected).toBe(2);
  });

  test('does not wipe an email being typed into the back-in-stock form', async ({
    page,
  }) => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    // The current variation (Black/M, sold out) is unchanged; another one changes
    await stubRefresh(page, teeIds, {
      inventory: teeStock({ [BLACK_S]: 4 }),
      gate,
    });
    await open(page, TEE, '?variant=black-m');

    await page.locator('#bis-email').fill('shopper@example.com');
    release();
    await expect(
      page.locator(
        '.attribute-button[data-attribute-type="size"][data-attribute-value="S"]'
      )
    ).toBeVisible();
    await page.waitForTimeout(300); // let the refresh be applied

    await expect(page.locator('#bis-email')).toHaveValue('shopper@example.com');
    await expect(page.locator('#back-in-stock-section')).toBeVisible();
  });
});

test.describe('PDP stock refresh: the real endpoint', () => {
  test('the page and the endpoint agree, and the response carries `unknown`', async ({
    page,
  }) => {
    const responsePromise = page.waitForResponse(
      (r) =>
        r.url().includes('/api/cart-inventory') &&
        r.request().method() === 'POST' &&
        (r.request().postData() ?? '').includes(BLACK_S)
    );

    await open(page, TEE); // not intercepted
    const body = await (await responsePromise).json();

    expect(body.success).toBe(true);
    expect(body.unknown).toEqual([]); // Square (the stub) answered for everything
    expect(body.inventory[BLACK_S]).toBe(5);
    expect(body.inventory[BLACK_M]).toBe(0);
    // And it changes nothing the page already showed
    await expect(remaining(page)).toHaveText('5 available');
    await expect(cta(page)).toHaveText('Add to Cart');
  });
});
