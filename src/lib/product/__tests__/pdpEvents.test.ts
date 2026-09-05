/**
 * Characterization tests for PDPEventManager (plan 142). Mocks the same four
 * modules quickViewController.test.ts already mocks for the same underlying
 * dependencies (@/lib/cart, @/lib/product/pdpUI, @/lib/square/errorUtils,
 * @/lib/events). Goal is the highest-value public surface and
 * handleAddToCart, not exhaustive coverage of every private wiring detail.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/cart', () => ({
  cart: {
    canAddToCart: vi.fn(() => true),
    addItem: vi.fn(() => Promise.resolve({ success: true, message: 'Added to cart' })),
  },
}));

vi.mock('@/lib/product/pdpUI', () => ({
  PDPUIManager: class {
    updateVariationButtonStates = vi.fn();
    refreshElements = vi.fn();
    getQuantityValue = vi.fn(() => 1);
    resetQuantityToOne = vi.fn();
  },
}));

vi.mock('@/lib/square/errorUtils', () => ({
  processClientError: vi.fn((error) => ({ message: String(error) })),
  logError: vi.fn(),
}));

vi.mock('@/lib/events', () => ({
  showNotification: vi.fn(),
  showLocationModal: vi.fn(),
}));

import { cart } from '@/lib/cart';
import { PDPUIManager } from '../pdpUI';
import { showNotification } from '@/lib/events';
import { PDPEventManager, type ProductPageData } from '../pdpEvents';

function setupDom(): void {
  document.body.innerHTML = `
    <button id="add-to-cart-button" data-product='{"variationId":"var-1"}'></button>
    <input id="quantity-input" value="1" max="10" />
    <button id="decrease-quantity"></button>
    <button id="increase-quantity"></button>
    <button class="attribute-button" data-attribute-type="color" data-attribute-value="red"></button>
    <button data-variation-id="var-1"></button>
  `;
}

function productData(overrides: Partial<ProductPageData> = {}): ProductPageData {
  return {
    variations: [{ id: 'var-1', variationId: 'var-1', name: 'Test', price: 10, quantity: 10 }],
    availableAttributes: { color: ['red'] },
    selectedVariationId: 'var-1',
    productId: 'prod-1',
    ...overrides,
  };
}

describe('PDPEventManager', () => {
  let uiManager: PDPUIManager;
  let onCartUpdate: () => void;
  let onAttributeSelection: (attributeType: string, value: string) => void;
  let onVariationSelection: (variationId: string) => void;
  let manager: PDPEventManager;

  beforeEach(() => {
    vi.clearAllMocks();
    // clearAllMocks() wipes call history but not mockReturnValue/mockRejectedValue
    // overrides from a prior test — reassert defaults so tests don't leak into each other.
    vi.mocked(cart.canAddToCart).mockReturnValue(true);
    vi.mocked(cart.addItem).mockResolvedValue({ success: true, message: 'Added to cart' });
    setupDom();
    uiManager = new PDPUIManager();
    onCartUpdate = vi.fn();
    onAttributeSelection = vi.fn();
    onVariationSelection = vi.fn();
    manager = new PDPEventManager(uiManager, productData(), {
      onAttributeSelection,
      onVariationSelection,
      onCartUpdate,
    });
  });

  it('setupAllEventHandlers() does not throw and marks the add-to-cart button ready', () => {
    expect(() => manager.setupAllEventHandlers()).not.toThrow();
    const button = document.getElementById('add-to-cart-button');
    expect(button?.dataset.addToCartReady).toBe('true');
  });

  describe('handleAddToCart via a click on the add-to-cart button', () => {
    function clickAddToCart(): Promise<void> {
      manager.setupAllEventHandlers();
      const button = document.getElementById('add-to-cart-button') as HTMLButtonElement;
      button.click();
      // handleAddToCart is async; flush microtasks
      return new Promise((resolve) => setTimeout(resolve, 0));
    }

    it('success path: shows a success notification, calls onCartUpdate, and resets quantity', async () => {
      await clickAddToCart();

      expect(cart.addItem).toHaveBeenCalledTimes(1);
      expect(showNotification).toHaveBeenCalledWith(
        'Added to cart',
        'success',
        expect.any(Number),
        expect.objectContaining({ href: '/cart' })
      );
      expect(uiManager.resetQuantityToOne).toHaveBeenCalled();
      expect(onCartUpdate).toHaveBeenCalled();
    });

    it('invalid quantity: shows the validation error and never calls cart.addItem', async () => {
      vi.mocked(uiManager.getQuantityValue).mockReturnValue(0);

      await clickAddToCart();

      expect(showNotification).toHaveBeenCalledWith('Please enter a valid quantity', 'error');
      expect(cart.addItem).not.toHaveBeenCalled();
    });

    it('canAddToCart() false: shows the "cannot add" error and never calls cart.addItem', async () => {
      vi.mocked(cart.canAddToCart).mockReturnValue(false);

      await clickAddToCart();

      expect(showNotification).toHaveBeenCalledWith('Cannot add that quantity to cart', 'error');
      expect(cart.addItem).not.toHaveBeenCalled();
    });

    it('cart.addItem() rejects: still clears loading state and calls onCartUpdate in finally', async () => {
      vi.mocked(cart.addItem).mockRejectedValue(new Error('boom'));

      await clickAddToCart();

      expect(showNotification).toHaveBeenCalledWith('Failed to add to cart', 'error');
      const button = document.getElementById('add-to-cart-button') as HTMLButtonElement;
      expect(button.hasAttribute('data-loading')).toBe(false);
      expect(onCartUpdate).toHaveBeenCalled();
    });

    it('double-submit guard: two rapid clicks only result in one cart.addItem call', async () => {
      manager.setupAllEventHandlers();
      const button = document.getElementById('add-to-cart-button') as HTMLButtonElement;
      button.click();
      button.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(cart.addItem).toHaveBeenCalledTimes(1);
    });
  });
});
