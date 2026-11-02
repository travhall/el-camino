import { test, expect, type Page } from '@playwright/test';
import { TEE } from './fixtures/square-catalog.mjs';
import { MESSAGES } from '../src/lib/product/backInStockForm.ts';

/**
 * The back-in-stock form on the PDP and in QuickView, against the real pages
 * and the Square stub's catalog (see playwright.stub.config.ts). Black/M is
 * the fixture's sold-out variant, so selecting it reveals the form.
 *
 * `/api/back-in-stock` writes to Netlify Blobs and sends mail, neither of
 * which exists under the stub, so the request is intercepted in the browser;
 * the real client code, markup and accessibility tree are what's under test.
 *
 * Pins the form's accessibility contract: a visible label, validation text
 * tied to the field and the field focused, a persistent live region for send
 * results, and focus moved to the success message.
 */

type Reply = { status: number; body?: unknown } | 'abort';

async function stubApi(page: Page, reply: Reply) {
  const requests: string[] = [];
  await page.route('**/api/back-in-stock', async (route) => {
    requests.push(route.request().postData() ?? '');
    if (reply === 'abort') return route.abort('failed');
    await route.fulfill({
      status: reply.status,
      contentType: 'application/json',
      body: JSON.stringify(reply.body ?? {}),
    });
  });
  return requests;
}

const BLACK_M = TEE.variations[1].id;

async function openPdp(page: Page) {
  await page.goto(`/product/${TEE.id}?variant=black-m`);
  await expect(page.locator('#add-to-cart-button')).toHaveAttribute(
    'data-add-to-cart-ready',
    'true'
  );
  await expect(page.locator('#back-in-stock-section')).toBeVisible();
}

async function openQuickView(page: Page) {
  await page.goto('/shop/all');
  await page.waitForFunction(() => typeof window.openQuickView === 'function');
  await page.evaluate((id) => window.openQuickView!(id), TEE.id);
  await expect(page.locator('#quick-view-product')).toBeVisible();
  await page
    .locator(
      '#quick-view-attributes button[data-attribute-type="size"][data-attribute-value="M"]'
    )
    .click();
  await expect(page.locator('#qv-bis-section')).toBeVisible();
}

declare global {
  interface Window {
    openQuickView?: (productId: string, variationId?: string) => void;
  }
}

/** The same behavior, in both places, by their own ids. */
const FORMS = [
  {
    name: 'PDP',
    open: openPdp,
    section: '#back-in-stock-section',
    email: '#bis-email',
    emailError: '#bis-email-error',
    submit: '#bis-submit',
    status: '#bis-status',
    success: '#bis-success',
    form: '#back-in-stock-form',
  },
  {
    name: 'QuickView',
    open: openQuickView,
    section: '#qv-bis-section',
    email: '#qv-bis-email',
    emailError: '#qv-bis-email-error',
    submit: '#qv-bis-submit',
    status: '#qv-bis-status',
    success: '#qv-bis-success',
    form: '#qv-bis-form',
  },
];

for (const f of FORMS) {
  test.describe(`${f.name} back-in-stock form`, () => {
    test('the email field has a visible label and the section is a named region', async ({
      page,
    }) => {
      await f.open(page);

      // QuickView's form exists (hidden) on every page, so scope to this one
      const input = page.locator(f.section).getByLabel('Email address');
      await expect(input).toBeVisible();
      await expect(input).toHaveAttribute('id', f.email.slice(1));
      await expect(
        page.getByRole('region', { name: "Get notified when it's back" })
      ).toBeVisible();
    });

    test('an empty submit sends nothing, explains why, and puts focus on the field', async ({
      page,
    }) => {
      const requests = await stubApi(page, { status: 200 });
      await f.open(page);

      await page.locator(f.submit).click();

      await expect(page.locator(f.emailError)).toHaveText(
        MESSAGES.emailRequired
      );
      await expect(page.locator(f.email)).toBeFocused();
      await expect(page.locator(f.email)).toHaveAttribute(
        'aria-invalid',
        'true'
      );
      // Read together with the field, not left for the user to find
      await expect(page.locator(f.email)).toHaveAccessibleDescription(
        MESSAGES.emailRequired
      );
      expect(requests).toHaveLength(0);
    });

    test('an address the API would reject is caught here, including "a@b"', async ({
      page,
    }) => {
      const requests = await stubApi(page, { status: 200 });
      await f.open(page);

      await page.locator(f.email).fill('shopper@localhost');
      await page.locator(f.submit).click();

      await expect(page.locator(f.emailError)).toHaveText(
        MESSAGES.emailInvalid
      );
      expect(requests).toHaveLength(0);
    });

    test('editing the field clears the error', async ({ page }) => {
      await stubApi(page, { status: 200 });
      await f.open(page);
      await page.locator(f.submit).click();
      await expect(page.locator(f.emailError)).toHaveText(
        MESSAGES.emailRequired
      );

      await page.locator(f.email).fill('s');

      await expect(page.locator(f.emailError)).toBeEmpty();
      await expect(page.locator(f.email)).not.toHaveAttribute(
        'aria-invalid',
        /.*/
      );
    });

    test('success replaces the form with the message and moves focus to it', async ({
      page,
    }) => {
      const requests = await stubApi(page, {
        status: 200,
        body: { success: true },
      });
      await f.open(page);

      await page.locator(f.email).fill('shopper@example.com');
      await page.locator(f.submit).click();

      await expect(page.locator(f.success)).toBeVisible();
      await expect(page.locator(f.success)).toContainText("You're on the list");
      await expect(page.locator(f.form)).toBeHidden();
      // The form held focus and just left the page
      await expect(page.locator(f.success)).toBeFocused();
      expect(requests).toHaveLength(1);
      expect(requests[0]).toContain(BLACK_M);
    });

    test("a rate limit is announced through the live region, in the server's words", async ({
      page,
    }) => {
      await stubApi(page, {
        status: 429,
        body: { error: 'Too many requests. Please try again in a minute.' },
      });
      await f.open(page);

      // The region exists, and is a polite status, before anything happens
      const region = page.locator(f.status);
      await expect(region).toHaveAttribute('role', 'status');
      await expect(region).toHaveAttribute('aria-live', 'polite');
      await expect(region).toBeEmpty();

      await page.locator(f.email).fill('shopper@example.com');
      await page.locator(f.submit).click();

      await expect(region).toContainText('Too many requests');
      await expect(page.locator(f.form)).toBeVisible();
      await expect(page.locator(f.submit)).toBeEnabled();
    });

    test('a server error offers an email link and lets the shopper retry', async ({
      page,
    }) => {
      await stubApi(page, {
        status: 500,
        body: { error: 'Internal server error' },
      });
      await f.open(page);

      await page.locator(f.email).fill('shopper@example.com');
      await page.locator(f.submit).click();

      const region = page.locator(f.status);
      await expect(region).toContainText('Something went wrong');
      await expect(
        region.getByRole('link', { name: 'email us directly' })
      ).toHaveAttribute('href', /^mailto:.+@.+/);
      await expect(page.locator(f.submit)).toBeEnabled();
      await expect(page.locator(f.submit)).toHaveText('Notify Me');
    });

    test('losing the network is handled the same way', async ({ page }) => {
      await stubApi(page, 'abort');
      await f.open(page);

      await page.locator(f.email).fill('shopper@example.com');
      await page.locator(f.submit).click();

      await expect(page.locator(f.status)).toContainText(
        'Something went wrong'
      );
    });

    test('a server-side email rejection is shown on the field, not as a generic error', async ({
      page,
    }) => {
      await stubApi(page, {
        status: 400,
        body: { error: 'Invalid email address' },
      });
      await f.open(page);

      await page.locator(f.email).fill('shopper@example.com');
      await page.locator(f.submit).click();

      await expect(page.locator(f.emailError)).toHaveText(
        MESSAGES.emailInvalid
      );
      await expect(page.locator(f.email)).toBeFocused();
      await expect(page.locator(f.status)).toBeEmpty();
    });
  });
}

test.describe('PDP back-in-stock form across variants', () => {
  test('moving to another variant and back does not still say "You\'re on the list"', async ({
    page,
  }) => {
    await stubApi(page, { status: 200, body: { success: true } });
    await openPdp(page);
    await page.locator('#bis-email').fill('shopper@example.com');
    await page.locator('#bis-submit').click();
    await expect(page.locator('#bis-success')).toBeVisible();

    // Black/S is in stock: the form goes away. Back to Black/M: it must be fresh.
    await page
      .locator(
        '.attribute-button[data-attribute-type="size"][data-attribute-value="S"]'
      )
      .click();
    await expect(page.locator('#back-in-stock-section')).toBeHidden();
    await page
      .locator(
        '.attribute-button[data-attribute-type="size"][data-attribute-value="M"]'
      )
      .click();

    await expect(page.locator('#back-in-stock-section')).toBeVisible();
    await expect(page.locator('#back-in-stock-form')).toBeVisible();
    await expect(page.locator('#bis-success')).toBeHidden();
    await expect(page.locator('#bis-email')).toHaveValue('');
  });
});
