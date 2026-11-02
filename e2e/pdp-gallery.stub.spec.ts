import { test, expect, type Page } from '@playwright/test';
import { TEE, DECK } from './fixtures/square-catalog.mjs';

/**
 * PDP image gallery: previous/next arrows, touch swipe, and the zoom
 * lightbox, against the real page and the Square stub's catalog (see
 * playwright.stub.config.ts).
 *
 * DECK has three images shared by every size, so it shows a thumbnail strip
 * and arrows. TEE has one image per color, so it has no strip: the controls
 * reduce to zoom.
 *
 * Images don't load under the stub (the image CDN isn't served), so
 * assertions read `currentSrc` / `src`, not pixels.
 */

const pdp = (product: { id: string }) => `/product/${product.id}`;

async function open(page: Page, product: { id: string }) {
  await page.goto(pdp(product));
  await expect(page.locator('#add-to-cart-button')).toHaveAttribute(
    'data-add-to-cart-ready',
    'true'
  );
  // The controls stay hidden until the gallery module has initialised
  await expect(page.locator('#gallery-zoom')).toBeVisible();
}

const heroSrc = (page: Page) =>
  page
    .locator('#product-image')
    .evaluate((img) =>
      decodeURIComponent((img as HTMLImageElement).currentSrc)
    );

const lightboxSrc = (page: Page) =>
  page
    .locator('#pdp-lightbox-image')
    .evaluate((img) => decodeURIComponent((img as HTMLImageElement).src));

const selectedThumb = (page: Page) =>
  page
    .locator('.gallery-thumb')
    .evaluateAll((els) =>
      els.findIndex((e) => e.getAttribute('aria-pressed') === 'true')
    );

const prev = (page: Page) => page.locator('#gallery-prev');
const next = (page: Page) => page.locator('#gallery-next');
const zoom = (page: Page) => page.locator('#gallery-zoom');
const lightbox = (page: Page) => page.locator('#pdp-lightbox');

test.describe('PDP gallery arrows', () => {
  test('step through the images and keep the thumbnails and hero in step', async ({
    page,
  }) => {
    await open(page, DECK);
    await expect(prev(page)).toBeVisible();
    await expect(next(page)).toBeVisible();
    expect(await heroSrc(page)).toContain('IMG_DECK_1');

    await next(page).click();
    await expect.poll(() => heroSrc(page)).toContain('IMG_DECK_2');
    expect(await selectedThumb(page)).toBe(1);

    await next(page).click();
    await expect.poll(() => heroSrc(page)).toContain('IMG_DECK_3');
    expect(await selectedThumb(page)).toBe(2);
  });

  test('wrap around at both ends', async ({ page }) => {
    await open(page, DECK);

    await prev(page).click(); // first -> last
    await expect.poll(() => heroSrc(page)).toContain('IMG_DECK_3');

    await next(page).click(); // last -> first
    await expect.poll(() => heroSrc(page)).toContain('IMG_DECK_1');
  });

  test('announce the position to screen readers', async ({ page }) => {
    await open(page, DECK);

    await next(page).click();
    await expect(page.locator('#gallery-status')).toHaveText('Image 2 of 3');
  });

  test('work from the keyboard (arrow keys while focus is in the gallery)', async ({
    page,
  }) => {
    await open(page, DECK);
    await next(page).focus();

    await page.keyboard.press('ArrowRight');
    await expect.poll(() => heroSrc(page)).toContain('IMG_DECK_2');
    await page.keyboard.press('ArrowLeft');
    await expect.poll(() => heroSrc(page)).toContain('IMG_DECK_1');
  });

  test('clicking a thumbnail still works and the arrows continue from it', async ({
    page,
  }) => {
    await open(page, DECK);

    await page.locator('.gallery-thumb').nth(2).click();
    await expect.poll(() => heroSrc(page)).toContain('IMG_DECK_3');

    await next(page).click(); // from the last thumbnail, wraps to the first
    await expect.poll(() => heroSrc(page)).toContain('IMG_DECK_1');
  });

  test('are hidden when there is only one image per variant', async ({
    page,
  }) => {
    await open(page, TEE);

    await expect(prev(page)).toBeHidden();
    await expect(next(page)).toBeHidden();
    await expect(zoom(page)).toBeVisible();
  });
});

test.describe('PDP gallery thumbnails', () => {
  test('load a small CDN image but keep the original for the hero and zoom', async ({
    page,
  }) => {
    await open(page, DECK);

    const thumbs = await page.locator('.gallery-thumb').evaluateAll((els) =>
      els.map((e) => ({
        original: (e as HTMLElement).dataset.gallerySrc,
        shown: e.querySelector('img')!.getAttribute('src'),
      }))
    );

    expect(thumbs).toHaveLength(3);
    for (const { original, shown } of thumbs) {
      // The 64px slot loads a 128px (2x) image, not the full-size original
      expect(original).toContain('items-images-sandbox.s3.amazonaws.com/');
      expect(shown).toContain('/.netlify/images?');
      expect(shown).toContain('w=128');
      // ...and the original is what the hero swaps to
      expect(decodeURIComponent(shown!)).toContain(original!);
    }
  });
});

test.describe('PDP gallery swipe', () => {
  test.use({ hasTouch: true, viewport: { width: 375, height: 800 } });

  const container = (page: Page) => page.locator('#product-image-container');

  async function drag(
    page: Page,
    from: [number, number],
    to: [number, number],
    pointerType = 'touch'
  ) {
    const c = container(page);
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
    await open(page, DECK);

    await drag(page, [300, 200], [100, 205]);
    await expect.poll(() => heroSrc(page)).toContain('IMG_DECK_2');

    await drag(page, [100, 200], [300, 205]);
    await expect.poll(() => heroSrc(page)).toContain('IMG_DECK_1');
  });

  test('a swipe does not open the lightbox, but a tap does', async ({
    page,
  }) => {
    await open(page, DECK);

    await drag(page, [300, 200], [100, 205]);
    // A swipe can still end in a click; it must not zoom
    await container(page).dispatchEvent('click');
    await expect(lightbox(page)).not.toHaveAttribute('open', '');

    await page.waitForTimeout(400); // past the click-suppression window
    await container(page).dispatchEvent('click');
    await expect(lightbox(page)).toHaveAttribute('open', '');
  });

  test('a mostly-vertical gesture is a scroll, not a swipe', async ({
    page,
  }) => {
    await open(page, DECK);

    await drag(page, [200, 100], [140, 400]);
    await page.waitForTimeout(100);

    expect(await heroSrc(page)).toContain('IMG_DECK_1');
  });

  test('a mouse drag does not change the image', async ({ page }) => {
    await open(page, DECK);

    await drag(page, [300, 200], [100, 205], 'mouse');
    await page.waitForTimeout(100);

    expect(await heroSrc(page)).toContain('IMG_DECK_1');
  });
});

test.describe('PDP zoom lightbox', () => {
  test('opens from the zoom button with the current image, larger', async ({
    page,
  }) => {
    await open(page, DECK);
    await expect(lightbox(page)).not.toHaveAttribute('open', '');

    await zoom(page).click();

    await expect(lightbox(page)).toHaveAttribute('open', '');
    expect(await lightboxSrc(page)).toContain('IMG_DECK_1');
    expect(await lightboxSrc(page)).toContain('w=1600');
    await expect(page.locator('#pdp-lightbox-count')).toHaveText('1 / 3');
  });

  test('opens when the hero is clicked', async ({ page }) => {
    await open(page, DECK);

    await page.locator('#product-image').click();

    await expect(lightbox(page)).toHaveAttribute('open', '');
  });

  test('navigates with its own arrows and the arrow keys, in step with the page behind it', async ({
    page,
  }) => {
    await open(page, DECK);
    await zoom(page).click();

    await page.locator('#pdp-lightbox-next').click();
    await expect.poll(() => lightboxSrc(page)).toContain('IMG_DECK_2');
    await expect(page.locator('#pdp-lightbox-count')).toHaveText('2 / 3');

    await page.keyboard.press('ArrowRight');
    await expect.poll(() => lightboxSrc(page)).toContain('IMG_DECK_3');

    await page.keyboard.press('ArrowLeft');
    await expect.poll(() => lightboxSrc(page)).toContain('IMG_DECK_2');

    // The hero and thumbnail behind the dialog followed along
    expect(await heroSrc(page)).toContain('IMG_DECK_2');
    expect(await selectedThumb(page)).toBe(1);
  });

  test('closes with Escape and returns focus to the zoom button', async ({
    page,
  }) => {
    await open(page, DECK);
    await zoom(page).focus();
    await page.keyboard.press('Enter');
    await expect(lightbox(page)).toHaveAttribute('open', '');

    await page.keyboard.press('Escape');

    await expect(lightbox(page)).not.toHaveAttribute('open', '');
    await expect(zoom(page)).toBeFocused();
  });

  test('closes with the close button', async ({ page }) => {
    await open(page, DECK);
    await zoom(page).click();

    await page.locator('#pdp-lightbox-close').click();

    await expect(lightbox(page)).not.toHaveAttribute('open', '');
  });

  test('closes when the dimmed area around the image is clicked', async ({
    page,
  }) => {
    await open(page, DECK);
    await zoom(page).click();

    await page.mouse.click(5, 300); // far left, clear of the image and buttons

    await expect(lightbox(page)).not.toHaveAttribute('open', '');
  });

  test('works for a single image: no arrows or counter', async ({ page }) => {
    await open(page, TEE);
    await zoom(page).click();

    await expect(lightbox(page)).toHaveAttribute('open', '');
    expect(await lightboxSrc(page)).toContain('IMG_TEE_BLACK');
    await expect(page.locator('#pdp-lightbox-prev')).toBeHidden();
    await expect(page.locator('#pdp-lightbox-next')).toBeHidden();
    await expect(page.locator('#pdp-lightbox-count')).toBeHidden();
  });

  test('shows the image for the selected color', async ({ page }) => {
    await open(page, TEE);
    await page
      .locator(
        '.attribute-button[data-attribute-type="color"][data-attribute-value="White"]'
      )
      .click();
    await expect.poll(() => heroSrc(page)).toContain('IMG_TEE_WHITE');

    await zoom(page).click();

    expect(await lightboxSrc(page)).toContain('IMG_TEE_WHITE');
  });
});
