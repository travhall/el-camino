/**
 * Characterization tests for QuickViewController's real implementation —
 * add-to-cart, variation resolution, stock gating, and the back-in-stock
 * form. Follows pdpController-real.test.ts's pattern: real happy-dom DOM,
 * fixture markup mounted, `cart` and `PDPUIManager` stubbed.
 *
 * These tests document current behavior. The "no matching variation" cases
 * originally characterized a bug (a non-existent combination left
 * currentVariation stale, so the back-in-stock form targeted the previous
 * variant); that was fixed to snap to the nearest real variation, mirroring
 * PDPController, and the tests below assert the corrected behavior.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@/lib/cart', () => ({
  cart: {
    getProductAvailability: vi.fn(() => ({
      state: 'AVAILABLE',
      total: 10,
      inCart: 0,
      remaining: 10,
      canAdd: true,
    })),
    canAddToCart: vi.fn(() => true),
    addItem: vi.fn(() =>
      Promise.resolve({ success: true, message: 'Added to cart' })
    ),
  },
}));

vi.mock('@/lib/product/pdpUI', () => ({
  // Real PDPUIManager does DOM work through cached elements; mocking it
  // (as pdpController-real.test.ts does) isolates QuickViewController's own
  // logic. updateButtonProductData is the one method reimplemented for real
  // here — QuickViewController's addToCart() reads
  // `addToCartButton.dataset.product` directly (not through the UI manager),
  // so faithfully setting it is required to assert full cart.addItem payloads.
  PDPUIManager: class {
    updateAvailabilityDisplay = vi.fn();
    updateQuantityControls = vi.fn();
    updateAddToCartButton = vi.fn();
    updateImageOverlay = vi.fn();
    updateInventoryDisplay = vi.fn();
    updatePriceDisplay = vi.fn();
    updateProductImage = vi.fn();
    updateProductImageAlt = vi.fn();
    updateAttributeButtonStates = vi.fn();
    announceVariantChange = vi.fn();
    updateButtonProductData = vi.fn((productData: unknown) => {
      const btn = document.getElementById(
        'quick-view-add-to-cart'
      ) as HTMLButtonElement | null;
      if (btn) btn.dataset.product = JSON.stringify(productData);
    });
  },
}));

vi.mock('@/lib/square/errorUtils', () => ({
  processClientError: vi.fn((error) => ({
    message: error instanceof Error ? error.message : String(error),
  })),
  logError: vi.fn(),
}));

vi.mock('@/lib/events', () => ({
  showNotification: vi.fn(),
}));

vi.mock('astro:transitions/client', () => ({
  navigate: vi.fn(),
}));

import { cart } from '@/lib/cart';
import { showNotification } from '@/lib/events';
import { QuickViewController } from '../quickViewController';
import type { Product, ProductVariation } from '@/lib/square/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Internal = any;

function internals(controller: QuickViewController): Internal {
  return controller as unknown as Internal;
}

function setupDom(): void {
  document.body.innerHTML = `
    <div id="quick-view-overlay" class="hidden opacity-0"></div>
    <div id="quick-view-panel" class="-translate-x-full"></div>
    <div id="quick-view-loading" class="hidden"></div>
    <div id="quick-view-error" class="hidden"></div>
    <div id="quick-view-product" class="hidden"></div>
    <div id="quick-view-footer" class="hidden"></div>
    <button id="close-quick-view"></button>
    <button id="quick-view-retry"></button>
    <button id="quick-view-full-details"></button>

    <img id="quick-view-image" />
    <div id="quick-view-image-container"></div>
    <div id="quick-view-image-placeholder"></div>
    <p id="quick-view-brand" class="hidden"></p>
    <h3 id="quick-view-title-text"></h3>
    <p id="quick-view-description" class="hidden"></p>
    <div id="quick-view-attributes"></div>
    <div id="quick-view-thumbnails" class="hidden"></div>

    <div id="quick-view-price"></div>
    <div id="quick-view-original-price" class="hidden"></div>
    <span id="quick-view-unit" class="hidden"></span>
    <div id="quick-view-remaining-count"></div>
    <div id="quick-view-cart-quantity" class="hidden"></div>

    <div id="quick-view-quantity-section" class="hidden">
      <button id="quick-view-decrease"></button>
      <input id="quick-view-quantity" value="1" max="10" />
      <button id="quick-view-increase"></button>
    </div>
    <div id="qv-atc-wrapper">
      <button id="quick-view-add-to-cart">
        <span class="add-to-cart-text">Add to Cart</span>
        <span class="add-to-cart-loading hidden">Adding…</span>
      </button>
    </div>

    <div id="qv-bis-section" class="hidden">
      <p id="qv-bis-label"></p>
      <form id="qv-bis-form">
        <input id="qv-bis-product-id" name="product_id" />
        <input id="qv-bis-variation-id" name="variation_id" />
        <input id="qv-bis-product-title" name="product_title" />
        <input id="qv-bis-product-url" name="product_url" />
        <input id="qv-bis-email" name="email" />
        <button id="qv-bis-submit" type="submit">Notify Me</button>
      </form>
      <div id="qv-bis-success" class="hidden"></div>
      <div id="qv-bis-error" class="hidden"></div>
    </div>
  `;
}

function makeVariation(overrides: Partial<ProductVariation>): ProductVariation {
  return {
    id: overrides.variationId ?? 'v',
    variationId: 'v',
    name: 'Variation',
    price: 10,
    quantity: 10,
    inStock: true,
    attributes: {},
    ...overrides,
  };
}

// Multi-variation product: size x color, but Large/Blue does not exist —
// selecting that combination exercises the "no matching variation" branch.
function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'prod-1',
    catalogObjectId: 'cat-1',
    variationId: 'var-sm-red',
    title: 'Test Deck',
    image: 'main.jpg',
    price: 65,
    unit: 'UNIT',
    url: '/product/test-deck',
    variations: [
      makeVariation({
        id: 'v1',
        variationId: 'var-sm-red',
        name: 'Small / Red',
        price: 65,
        quantity: 10,
        inStock: true,
        attributes: { size: 'Small', color: 'Red' },
        image: 'sm-red.jpg',
        unit: 'UNIT',
      }),
      makeVariation({
        id: 'v2',
        variationId: 'var-lg-red',
        name: 'Large / Red',
        price: 75,
        quantity: 5,
        inStock: true,
        attributes: { size: 'Large', color: 'Red' },
        image: 'lg-red.jpg',
        unit: 'UNIT',
      }),
      makeVariation({
        id: 'v3',
        variationId: 'var-sm-blue',
        name: 'Small / Blue',
        price: 65,
        quantity: 0,
        inStock: false,
        attributes: { size: 'Small', color: 'Blue' },
        image: 'sm-blue.jpg',
        unit: 'UNIT',
      }),
    ],
    ...overrides,
  };
}

function mockFetchOnce(product: Product): void {
  global.fetch = vi.fn(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: () => Promise.resolve(product),
    })
  ) as unknown as typeof fetch;
}

async function openWith(
  controller: QuickViewController,
  product: Product
): Promise<void> {
  mockFetchOnce(product);
  await controller.openQuickView(product.id);
}

function attrButton(type: string, value: string): HTMLButtonElement {
  const btn = document.querySelector<HTMLButtonElement>(
    `[data-attribute-type="${type}"][data-attribute-value="${value}"]`
  );
  if (!btn) throw new Error(`No button for ${type}=${value}`);
  return btn;
}

describe('QuickViewController — real implementation', () => {
  let controller: QuickViewController;

  beforeEach(() => {
    vi.clearAllMocks();
    setupDom();

    // clearAllMocks() does not undo a prior test's mockReturnValue /
    // mockRejectedValue — reassert defaults here.
    vi.mocked(cart.getProductAvailability).mockReturnValue({
      state: 'AVAILABLE',
      total: 10,
      inCart: 0,
      remaining: 10,
      canAdd: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    vi.mocked(cart.canAddToCart).mockReturnValue(true);
    vi.mocked(cart.addItem).mockResolvedValue({
      success: true,
      message: 'Added to cart',
    });

    controller = QuickViewController.getInstance();
  });

  describe('harness sanity', () => {
    it('a click resolves the matching variation from the selected attributes', async () => {
      await openWith(controller, makeProduct());

      attrButton('size', 'Large').click();

      expect(internals(controller).currentVariation?.variationId).toBe(
        'var-lg-red'
      );
    });
  });

  describe('addToCart', () => {
    it('happy path: calls cart.addItem once with the full expected payload', async () => {
      await openWith(controller, makeProduct());

      const quantityInput = document.getElementById(
        'quick-view-quantity'
      ) as HTMLInputElement;
      quantityInput.value = '2';

      await controller.addToCart();

      expect(cart.addItem).toHaveBeenCalledTimes(1);
      expect(cart.addItem).toHaveBeenCalledWith({
        id: 'prod-1',
        catalogObjectId: 'cat-1',
        variationId: 'var-sm-red',
        title: 'Test Deck',
        price: 65,
        image: 'sm-red.jpg',
        unit: 'UNIT',
        variationName: 'Small / Red',
        quantity: 2,
      });
    });

    it('cart.canAddToCart returning false blocks the call', async () => {
      await openWith(controller, makeProduct());
      vi.mocked(cart.canAddToCart).mockReturnValue(false);

      await controller.addToCart();

      expect(cart.addItem).not.toHaveBeenCalled();
      expect(showNotification).toHaveBeenCalledWith(
        expect.stringContaining('Cannot add that quantity'),
        'error'
      );
    });

    it('cart.addItem rejecting surfaces an error without crashing and restores button state', async () => {
      await openWith(controller, makeProduct());
      vi.mocked(cart.addItem).mockRejectedValue(new Error('network down'));

      const addToCartBtn = document.getElementById(
        'quick-view-add-to-cart'
      ) as HTMLButtonElement;

      await expect(controller.addToCart()).resolves.toBeUndefined();

      expect(showNotification).toHaveBeenCalledWith('network down', 'error');
      expect(addToCartBtn.disabled).toBe(false);
      expect(internals(controller).isProcessing).toBe(false);
      expect(
        addToCartBtn
          .querySelector('.add-to-cart-text')
          ?.classList.contains('hidden')
      ).toBe(false);
      expect(
        addToCartBtn
          .querySelector('.add-to-cart-loading')
          ?.classList.contains('hidden')
      ).toBe(true);
    });

    it('double-submit guard: two rapid calls result in exactly one cart.addItem call', async () => {
      await openWith(controller, makeProduct());

      // isProcessing is set synchronously before the first `await`, so a
      // second call issued before the first resolves is a no-op.
      const p1 = controller.addToCart();
      const p2 = controller.addToCart();
      await Promise.all([p1, p2]);

      expect(cart.addItem).toHaveBeenCalledTimes(1);
    });

    it('invalid quantity is rejected before cart.addItem is called', async () => {
      await openWith(controller, makeProduct());

      const quantityInput = document.getElementById(
        'quick-view-quantity'
      ) as HTMLInputElement;
      quantityInput.value = '0';

      await controller.addToCart();

      expect(cart.addItem).not.toHaveBeenCalled();
      expect(showNotification).toHaveBeenCalledWith(
        expect.stringContaining('valid quantity'),
        'error'
      );
    });

    it('non-numeric quantity is rejected before cart.addItem is called', async () => {
      await openWith(controller, makeProduct());

      const quantityInput = document.getElementById(
        'quick-view-quantity'
      ) as HTMLInputElement;
      quantityInput.value = 'abc';

      await controller.addToCart();

      expect(cart.addItem).not.toHaveBeenCalled();
    });

    it('cart.addItem resolving with success: false surfaces its message without adding', async () => {
      await openWith(controller, makeProduct());
      vi.mocked(cart.addItem).mockResolvedValue({
        success: false,
        message: 'Out of stock',
      });

      await controller.addToCart();

      expect(showNotification).toHaveBeenCalledWith('Out of stock', 'error');
    });
  });

  describe('variation resolution and stock gating', () => {
    it('selecting attributes resolves the matching in-stock variation and updates price/quantity data', async () => {
      await openWith(controller, makeProduct());

      attrButton('size', 'Large').click();
      attrButton('color', 'Red').click();

      const current = internals(controller).currentVariation;
      expect(current?.variationId).toBe('var-lg-red');
      expect(current?.inStock).toBe(true);
    });

    it('a combination that does not exist snaps to the nearest real variation instead of leaving a phantom selection', async () => {
      await openWith(controller, makeProduct());

      expect(() => {
        attrButton('size', 'Large').click(); // Large/Red
        attrButton('color', 'Blue').click(); // Large/Blue does not exist
      }).not.toThrow();

      // Blue only exists as Small/Blue (sold out), so size snaps Large -> Small
      expect(internals(controller).currentVariation?.variationId).toBe(
        'var-sm-blue'
      );
      expect(internals(controller).selectedAttributes).toEqual({
        size: 'Small',
        color: 'Blue',
      });
      // ...which is sold out, so the back-in-stock state is shown
      expect(
        document.getElementById('qv-bis-section')?.classList.contains('hidden')
      ).toBe(false);
      expect(
        document
          .getElementById('quick-view-quantity-section')
          ?.classList.contains('hidden')
      ).toBe(true);
    });

    it('drives image, price and button data from the snapped variation, not the previous one', async () => {
      await openWith(controller, makeProduct());
      const uiManager = internals(controller).uiManager;
      attrButton('size', 'Large').click();
      uiManager.updateProductImage.mockClear();
      uiManager.updatePriceDisplay.mockClear();

      attrButton('color', 'Blue').click(); // snaps to Small/Blue

      expect(uiManager.updateProductImage).toHaveBeenCalledWith('sm-blue.jpg');
      expect(uiManager.updatePriceDisplay).toHaveBeenLastCalledWith(
        65,
        expect.anything()
      );
      const btn = document.getElementById(
        'quick-view-add-to-cart'
      ) as HTMLButtonElement;
      expect(JSON.parse(btn.dataset.product!).variationId).toBe('var-sm-blue');
    });

    it('snaps to an in-stock variation when one carries the requested value', async () => {
      await openWith(controller, makeProduct());
      attrButton('color', 'Blue').click(); // Small/Blue exists, sold out
      expect(internals(controller).currentVariation?.variationId).toBe(
        'var-sm-blue'
      );

      // Large/Blue doesn't exist; only Large/Red carries Size=Large
      attrButton('size', 'Large').click();

      expect(internals(controller).currentVariation?.variationId).toBe(
        'var-lg-red'
      );
      expect(internals(controller).selectedAttributes).toEqual({
        size: 'Large',
        color: 'Red',
      });
      expect(
        document.getElementById('qv-bis-section')?.classList.contains('hidden')
      ).toBe(true);
    });

    it('ignores a value that is not on any variation', async () => {
      await openWith(controller, makeProduct());
      const before = internals(controller).currentVariation;

      internals(controller).handleAttributeSelection('size', 'Huge');

      expect(internals(controller).currentVariation).toBe(before);
    });

    it('canAddToCartForAttribute returns true for an available combination', async () => {
      await openWith(controller, makeProduct());

      const isAvailable = internals(controller).canAddToCartForAttribute(
        'size',
        'Large'
      );

      expect(isAvailable).toBe(true);
    });

    it('canAddToCartForAttribute returns false for a combination with no in-stock match', async () => {
      await openWith(controller, makeProduct());

      // Small + Blue matches var-sm-blue, which is inStock: false
      const isAvailable = internals(controller).canAddToCartForAttribute(
        'color',
        'Blue'
      );

      expect(isAvailable).toBe(false);
    });

    it('canAddToCartForAttribute judges a non-existent combination by the variation a click would snap to', async () => {
      await openWith(controller, makeProduct());
      attrButton('size', 'Large').click();

      // Large/Blue does not exist; a click snaps to Small/Blue, which is sold out
      expect(
        internals(controller).canAddToCartForAttribute('color', 'Blue')
      ).toBe(false);

      attrButton('color', 'Blue').click(); // now on Small/Blue
      // Large/Blue does not exist, but a click snaps to buyable Large/Red
      expect(
        internals(controller).canAddToCartForAttribute('size', 'Large')
      ).toBe(true);
    });

    it('an existing sold-out combination keeps the back-in-stock form on its real variation and hides the stepper and CTA', async () => {
      await openWith(controller, makeProduct());

      attrButton('color', 'Blue').click(); // Small/Blue exists, sold out

      expect(
        (document.getElementById('qv-bis-product-id') as HTMLInputElement).value
      ).toBe('prod-1');
      expect(
        (document.getElementById('qv-bis-variation-id') as HTMLInputElement)
          .value
      ).toBe('var-sm-blue');
      expect(
        (document.getElementById('qv-bis-product-title') as HTMLInputElement)
          .value
      ).toBe('Test Deck — Small / Blue');
      expect(
        document.getElementById('qv-atc-wrapper')?.classList.contains('hidden')
      ).toBe(true);
    });
  });

  describe("QuickView's chips versus a PDP's on the same page", () => {
    it("restyles only the chips inside #quick-view-attributes, never a page's own", async () => {
      document.body.insertAdjacentHTML(
        'beforeend',
        `<div class="product-info">
           <button id="pdp-chip" class="attribute-button" data-attribute-type="color" data-attribute-value="Blue"></button>
         </div>`
      );
      await openWith(controller, makeProduct());

      attrButton('color', 'Blue').click(); // QuickView's own Blue chip

      const pdpChip = document.getElementById('pdp-chip')!;
      // QuickView overwrites className on its chips; the PDP's must keep its own
      expect(pdpChip.className).toBe('attribute-button');
    });
  });

  describe('hero alt text', () => {
    it('stores the product title as the base alt and follows the selected color', async () => {
      await openWith(controller, makeProduct());
      const image = document.getElementById(
        'quick-view-image'
      ) as HTMLImageElement;
      const uiManager = internals(controller).uiManager;

      expect(image.dataset.baseAlt).toBe('Test Deck');
      expect(image.alt).toBe('Test Deck');

      attrButton('color', 'Blue').click();

      expect(uiManager.updateProductImageAlt).toHaveBeenLastCalledWith(
        expect.objectContaining({
          attributes: { size: 'Small', color: 'Blue' },
        })
      );
    });
  });

  describe('color images stored at the item level', () => {
    // Square often stores one image per color on the Item, not on each
    // variation. The PDP maps those onto variations; QuickView must too, or
    // the hero never follows the selected color.
    const itemLevelProduct = () =>
      makeProduct({
        images: ['red.jpg', 'blue.jpg'],
        variations: makeProduct().variations!.map((v) => ({
          ...v,
          image: undefined,
        })),
      });

    it('the hero follows the selected color', async () => {
      await openWith(controller, itemLevelProduct());
      const uiManager = internals(controller).uiManager;

      // Opens on Small/Red -> the first (Red) image
      expect(uiManager.updateProductImage).toHaveBeenLastCalledWith('red.jpg');

      attrButton('color', 'Blue').click(); // Small/Blue

      expect(uiManager.updateProductImage).toHaveBeenLastCalledWith('blue.jpg');
    });

    it('a snapped selection also takes the image of the variation it lands on', async () => {
      await openWith(controller, itemLevelProduct());
      const uiManager = internals(controller).uiManager;
      attrButton('color', 'Blue').click(); // Small/Blue

      attrButton('size', 'Large').click(); // Large/Blue doesn't exist -> Large/Red

      expect(uiManager.updateProductImage).toHaveBeenLastCalledWith('red.jpg');
    });

    it('still honors a variation-level image over the item-level one', async () => {
      const product = itemLevelProduct();
      product.variations![2].image = 'sm-blue-own.jpg'; // Small/Blue
      await openWith(controller, product);

      attrButton('color', 'Blue').click();

      expect(
        internals(controller).uiManager.updateProductImage
      ).toHaveBeenLastCalledWith('sm-blue-own.jpg');
    });
  });

  describe('screen reader announcements', () => {
    it('does not announce when the panel opens', async () => {
      await openWith(controller, makeProduct());

      expect(
        internals(controller).uiManager.announceVariantChange
      ).not.toHaveBeenCalled();
    });

    it('does not announce on cart updates', async () => {
      await openWith(controller, makeProduct());
      internals(controller).uiManager.updateAvailabilityDisplay.mockClear();

      // The cartUpdated window listener isn't registered in this harness, so
      // drive the handler directly.
      internals(controller).handleCartUpdate();

      // Guard against a vacuous pass: the cart-update handler did run
      expect(
        internals(controller).uiManager.updateAvailabilityDisplay
      ).toHaveBeenCalled();
      expect(
        internals(controller).uiManager.announceVariantChange
      ).not.toHaveBeenCalled();
    });

    it('announces once after a user-driven attribute selection', async () => {
      await openWith(controller, makeProduct());
      const uiManager = internals(controller).uiManager;

      attrButton('size', 'Large').click();

      expect(uiManager.announceVariantChange).toHaveBeenCalledTimes(1);
      expect(uiManager.announceVariantChange).toHaveBeenCalledWith({
        label: 'Large Red',
        price: 75,
        info: expect.objectContaining({ state: 'AVAILABLE' }),
      });
      expect(cart.getProductAvailability).toHaveBeenCalledWith(
        'prod-1',
        'var-lg-red',
        5
      );
    });

    it('announces the snapped variation, naming what moved, for a combination that does not exist', async () => {
      await openWith(controller, makeProduct());
      const uiManager = internals(controller).uiManager;
      attrButton('size', 'Large').click();
      uiManager.announceVariantChange.mockClear();
      vi.mocked(cart.getProductAvailability).mockClear();

      attrButton('color', 'Blue').click(); // Large/Blue does not exist -> Small/Blue

      expect(cart.getProductAvailability).toHaveBeenCalledWith(
        'prod-1',
        'var-sm-blue',
        0
      );
      expect(uiManager.announceVariantChange).toHaveBeenCalledTimes(1);
      expect(uiManager.announceVariantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          label: "Small Blue (Large isn't offered in Blue)",
        })
      );
    });

    it('does not add a "not offered" note when the exact combination exists', async () => {
      await openWith(controller, makeProduct());
      const uiManager = internals(controller).uiManager;

      attrButton('size', 'Large').click(); // Large/Red exists

      const { label } = uiManager.announceVariantChange.mock.calls.at(-1)![0];
      expect(label).not.toContain("isn't offered");
    });
  });

  describe('back-in-stock form', () => {
    async function triggerOutOfStock(): Promise<void> {
      await openWith(controller, makeProduct());
      // Small/Blue exists but is sold out, which reveals and wires up the BIS
      // form via updateQuantityAndBis(false, 0).
      attrButton('color', 'Blue').click();
    }

    it('submitting the form POSTs to /api/back-in-stock with the form body', async () => {
      await triggerOutOfStock();

      global.fetch = vi.fn(() =>
        Promise.resolve({ ok: true, status: 200, statusText: 'OK' })
      ) as unknown as typeof fetch;

      const form = document.getElementById('qv-bis-form') as HTMLFormElement;
      const emailInput = document.getElementById(
        'qv-bis-email'
      ) as HTMLInputElement;
      emailInput.value = 'shopper@example.com';

      form.dispatchEvent(new Event('submit', { cancelable: true }));
      await Promise.resolve();
      await Promise.resolve();

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/back-in-stock',
        expect.objectContaining({ method: 'POST' })
      );
      const [, options] = vi.mocked(global.fetch).mock.calls[0];
      expect((options as RequestInit).body).toBeInstanceOf(FormData);
    });

    it('a successful POST hides the form and shows the success message', async () => {
      await triggerOutOfStock();

      global.fetch = vi.fn(() =>
        Promise.resolve({ ok: true, status: 200, statusText: 'OK' })
      ) as unknown as typeof fetch;

      const form = document.getElementById('qv-bis-form') as HTMLFormElement;
      (document.getElementById('qv-bis-email') as HTMLInputElement).value =
        'shopper@example.com';

      form.dispatchEvent(new Event('submit', { cancelable: true }));
      await Promise.resolve();
      await Promise.resolve();

      expect(form.classList.contains('hidden')).toBe(true);
      expect(
        document.getElementById('qv-bis-success')?.classList.contains('hidden')
      ).toBe(false);
    });

    it('a failed POST surfaces an error without hiding the form, and re-enables the submit button', async () => {
      await triggerOutOfStock();

      global.fetch = vi.fn(() =>
        Promise.resolve({ ok: false, status: 500, statusText: 'Error' })
      ) as unknown as typeof fetch;

      const form = document.getElementById('qv-bis-form') as HTMLFormElement;
      (document.getElementById('qv-bis-email') as HTMLInputElement).value =
        'shopper@example.com';
      const submitBtn = document.getElementById(
        'qv-bis-submit'
      ) as HTMLButtonElement;

      form.dispatchEvent(new Event('submit', { cancelable: true }));
      await Promise.resolve();
      await Promise.resolve();

      expect(form.classList.contains('hidden')).toBe(false);
      expect(
        document.getElementById('qv-bis-error')?.classList.contains('hidden')
      ).toBe(false);
      expect(submitBtn.disabled).toBe(false);
      expect(submitBtn.textContent).toBe('Notify Me');
    });

    it('a network rejection is handled the same way as a non-OK response', async () => {
      await triggerOutOfStock();

      global.fetch = vi.fn(() =>
        Promise.reject(new Error('offline'))
      ) as unknown as typeof fetch;

      const form = document.getElementById('qv-bis-form') as HTMLFormElement;
      (document.getElementById('qv-bis-email') as HTMLInputElement).value =
        'shopper@example.com';

      expect(() =>
        form.dispatchEvent(new Event('submit', { cancelable: true }))
      ).not.toThrow();
      await Promise.resolve();
      await Promise.resolve();

      expect(
        document.getElementById('qv-bis-error')?.classList.contains('hidden')
      ).toBe(false);
    });

    it('the submit listener is wired only once across repeated out-of-stock states (no duplicate submissions)', async () => {
      await triggerOutOfStock();

      const form = document.getElementById('qv-bis-form') as HTMLFormElement;
      const addSpy = vi.spyOn(form, 'addEventListener');

      // Re-trigger the BIS-showing path again on the same form.
      attrButton('color', 'Red').click();
      attrButton('color', 'Blue').click();

      expect(addSpy).not.toHaveBeenCalled();
      expect(form.dataset.initialized).toBe('true');
    });
  });

  describe('setupEventHandlers() is safe to call repeatedly', () => {
    // initQuickView() calls it directly, again on astro:page-load, and again
    // on every Client Router navigation. Each call must replace the previous
    // set of listeners, not add to it.
    afterEach(() => {
      // QuickViewController is a singleton and document/window outlive the DOM
      // reset in beforeEach, so detach whatever these tests attached.
      internals(controller).listenersAbort?.abort();
      vi.restoreAllMocks();
    });

    it('a click on add-to-cart runs addToCart once, not once per setup call', async () => {
      await openWith(controller, makeProduct());
      const addToCart = vi
        .spyOn(controller, 'addToCart')
        .mockResolvedValue(undefined);

      controller.setupEventHandlers();
      controller.setupEventHandlers();
      controller.setupEventHandlers();
      document.getElementById('quick-view-add-to-cart')!.click();

      expect(addToCart).toHaveBeenCalledTimes(1);
    });

    it('cartUpdated triggers handleCartUpdate once per event', async () => {
      await openWith(controller, makeProduct());
      const handleCartUpdate = vi
        .spyOn(internals(controller), 'handleCartUpdate')
        .mockImplementation(() => {});

      controller.setupEventHandlers();
      controller.setupEventHandlers();
      window.dispatchEvent(new CustomEvent('cartUpdated'));

      expect(handleCartUpdate).toHaveBeenCalledTimes(1);
    });

    it('Escape closes the panel once, not once per setup call', async () => {
      await openWith(controller, makeProduct());
      document
        .getElementById('quick-view-panel')!
        .classList.remove('-translate-x-full');
      const closeModal = vi
        .spyOn(internals(controller), 'closeModal')
        .mockImplementation(() => {});

      controller.setupEventHandlers();
      controller.setupEventHandlers();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

      expect(closeModal).toHaveBeenCalledTimes(1);
    });

    it('re-binds to fresh DOM after a swap, and detaches from the old DOM', async () => {
      await openWith(controller, makeProduct());
      controller.setupEventHandlers();
      const oldButton = document.getElementById('quick-view-add-to-cart')!;

      // Client Router swap: same ids, brand-new elements
      setupDom();
      controller.setupEventHandlers();
      const addToCart = vi
        .spyOn(controller, 'addToCart')
        .mockResolvedValue(undefined);

      document.getElementById('quick-view-add-to-cart')!.click();
      expect(addToCart).toHaveBeenCalledTimes(1);

      oldButton.click();
      expect(addToCart).toHaveBeenCalledTimes(1);
    });
  });

  describe('modal lifecycle', () => {
    it('open -> close -> reopen leaves no stale product/variation state before the new product loads', async () => {
      await openWith(controller, makeProduct());
      expect(internals(controller).currentVariation).not.toBeNull();

      controller.closeModal();
      expect(internals(controller).currentVariation).toBeNull();
      expect(internals(controller).currentProduct).toBeNull();
      expect(internals(controller).selectedAttributes).toEqual({});
      expect(internals(controller).isProcessing).toBe(false);

      await openWith(
        controller,
        makeProduct({ id: 'prod-2', title: 'Second Deck' })
      );

      expect(internals(controller).currentProduct?.id).toBe('prod-2');
      expect(
        document.getElementById('quick-view-title-text')?.textContent
      ).toBe('Second Deck');
    });
  });
});
