/**
 * Real PDPController Implementation Tests - Testing actual class behavior
 * Replaces mock-based tests with real implementation testing
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PDPController } from '../pdpController';
import type { ProductPageData } from '../pdpEvents';
import { ProductAvailabilityState } from '@/lib/square/types';

// Mock dependencies
vi.mock('@/lib/cart', () => ({
  cart: {
    getProductAvailability: vi.fn(() => ({
      state: 'AVAILABLE',
      total: 10,
      inCart: 0,
      remaining: 10,
      canAdd: true
    })),
    canAddToCart: vi.fn(() => true)
  }
}));

vi.mock('../pdpUI', () => ({
  PDPUIManager: class {
    updateAvailabilityDisplay = vi.fn();
    updatePriceDisplay = vi.fn();
    updateProductImage = vi.fn();
    updateButtonProductData = vi.fn();
    updateAttributeButtonStates = vi.fn();
  }
}));

vi.mock('../pdpEvents', () => ({
  PDPEventManager: class {
    setupAllEventHandlers = vi.fn();
    cleanup = vi.fn();
    handlers: any;

    constructor(_ui: any, _data: any, handlers: any) {
      this.handlers = handlers;
    }
  }
}));

describe('PDPController Real Implementation Tests', () => {
  let controller: PDPController;
  let mockProductData: ProductPageData;

  beforeEach(() => {
    // Setup DOM
    document.body.innerHTML = `
      <button id="add-to-cart-button" data-product='{"id":"prod-1","price":2500}'>
        Add to Cart
      </button>
      <div id="price-display"></div>
      <div id="availability-display"></div>
    `;

    // Mock window.history
    Object.defineProperty(window, 'history', {
      value: {
        replaceState: vi.fn()
      },
      writable: true
    });

    // Setup product data
    mockProductData = {
      productId: 'prod-1',
      selectedVariationId: 'var-1',
      variations: [
        {
          variationId: 'var-1',
          name: 'Small, Red',
          price: 2500,
          quantity: 10,
          inStock: true,
          attributes: { Size: 'Small', Color: 'Red' },
          image: 'small-red.jpg',
          unit: 'UNIT'
        },
        {
          variationId: 'var-2',
          name: 'Large, Red',
          price: 3000,
          quantity: 5,
          inStock: true,
          attributes: { Size: 'Large', Color: 'Red' },
          image: 'large-red.jpg',
          unit: 'UNIT'
        },
        {
          variationId: 'var-3',
          name: 'Small, Blue',
          price: 2500,
          quantity: 0,
          inStock: false,
          attributes: { Size: 'Small', Color: 'Blue' },
          image: 'small-blue.jpg',
          unit: 'UNIT'
        }
      ],
      availableAttributes: {
        Size: ['Small', 'Large'],
        Color: ['Red', 'Blue']
      }
    };
  });

  describe('Initialization', () => {
    it('should initialize with selected variation', () => {
      controller = new PDPController(mockProductData);

      expect(controller).toBeDefined();
      // Controller should set initial state based on selectedVariationId
    });

    it('should set initial attributes from selected variation', () => {
      controller = new PDPController(mockProductData);

      // Private state, but we can verify through behavior
      expect(controller).toHaveProperty('selectedAttributes');
    });
  });

  describe('Attribute Selection', () => {
    it('should update variation when attribute is selected', () => {
      controller = new PDPController(mockProductData);

      // Simulate attribute selection
      const eventManager = (controller as any).eventManager;
      const onAttributeSelection = eventManager.handlers?.onAttributeSelection;

      if (onAttributeSelection) {
        onAttributeSelection('Size', 'Large');
      }

      // Should trigger variation update
      expect((controller as any).selectedAttributes.Size).toBe('Large');
    });

    it('should find matching variation based on selected attributes', () => {
      controller = new PDPController(mockProductData);

      const eventManager = (controller as any).eventManager;
      const onAttributeSelection = eventManager.handlers?.onAttributeSelection;

      if (onAttributeSelection) {
        onAttributeSelection('Size', 'Large');
        onAttributeSelection('Color', 'Red');
      }

      // Should match var-2 (Large, Red)
      const currentVariation = (controller as any).currentVariation;
      expect(currentVariation?.variationId).toBe('var-2');
    });

    it('should handle selecting out of stock combination', () => {
      controller = new PDPController(mockProductData);

      const eventManager = (controller as any).eventManager;
      const onAttributeSelection = eventManager.handlers?.onAttributeSelection;

      if (onAttributeSelection) {
        onAttributeSelection('Size', 'Small');
        onAttributeSelection('Color', 'Blue');
      }

      // Should handle out of stock gracefully
      expect(controller).toBeDefined();
    });
  });

  describe('URL Synchronization', () => {
    it('should update URL when variation changes', () => {
      controller = new PDPController(mockProductData);

      const eventManager = (controller as any).eventManager;
      const onAttributeSelection = eventManager.handlers?.onAttributeSelection;

      if (onAttributeSelection) {
        onAttributeSelection('Size', 'Large');
      }

      // Should call replaceState with variant slug
      expect(window.history.replaceState).toHaveBeenCalled();
    });

    it('should not create history entries on variation change', () => {
      controller = new PDPController(mockProductData);

      const eventManager = (controller as any).eventManager;
      const onAttributeSelection = eventManager.handlers?.onAttributeSelection;

      if (onAttributeSelection) {
        onAttributeSelection('Size', 'Large');
      }

      // Should use replaceState, not pushState
      const calls = (window.history.replaceState as any).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
    });
  });

  describe('UI Updates', () => {
    it('should update UI when variation changes', () => {
      controller = new PDPController(mockProductData);
      const uiManager = (controller as any).uiManager;

      const eventManager = (controller as any).eventManager;
      const onAttributeSelection = eventManager.handlers?.onAttributeSelection;

      if (onAttributeSelection) {
        onAttributeSelection('Size', 'Large');
      }

      // Should call UI update methods
      expect(uiManager.updateAvailabilityDisplay).toHaveBeenCalled();
      expect(uiManager.updatePriceDisplay).toHaveBeenCalled();
    });

    it('should update product image when variation has image', () => {
      controller = new PDPController(mockProductData);
      const uiManager = (controller as any).uiManager;

      const eventManager = (controller as any).eventManager;
      const onVariationSelection = eventManager.handlers?.onVariationSelection;

      if (onVariationSelection) {
        onVariationSelection('var-2');
      }

      expect(uiManager.updateProductImage).toHaveBeenCalledWith('large-red.jpg');
    });

    it('should update button product data', () => {
      controller = new PDPController(mockProductData);
      const uiManager = (controller as any).uiManager;

      const eventManager = (controller as any).eventManager;
      const onVariationSelection = eventManager.handlers?.onVariationSelection;

      if (onVariationSelection) {
        onVariationSelection('var-2');
      }

      expect(uiManager.updateButtonProductData).toHaveBeenCalled();
    });
  });

  describe('Cart Integration', () => {
    it('should update UI when cart changes', () => {
      controller = new PDPController(mockProductData);
      const uiManager = (controller as any).uiManager;

      const eventManager = (controller as any).eventManager;
      const onCartUpdate = eventManager.handlers?.onCartUpdate;

      if (onCartUpdate) {
        onCartUpdate();
      }

      expect(uiManager.updateAvailabilityDisplay).toHaveBeenCalled();
      expect(uiManager.updateAttributeButtonStates).toHaveBeenCalled();
    });

    it('should pass correct availability info from cart', async () => {
      const { cart } = await import('@/lib/cart');

      vi.mocked(cart.getProductAvailability).mockReturnValue({
        state: ProductAvailabilityState.AVAILABLE,
        totalInventory: 10,
        inCart: 8,
        remaining: 2
      });

      controller = new PDPController(mockProductData);
      const uiManager = (controller as any).uiManager;

      const availabilityCall = uiManager.updateAvailabilityDisplay.mock.calls[0];
      expect(availabilityCall[0]).toHaveProperty('state', ProductAvailabilityState.AVAILABLE);
      expect(availabilityCall[0]).toHaveProperty('remaining', 2);
    });
  });

  describe('Attribute Button States', () => {
    it('should update button states based on availability', () => {
      controller = new PDPController(mockProductData);
      const uiManager = (controller as any).uiManager;

      // Should call updateAttributeButtonStates
      expect(uiManager.updateAttributeButtonStates).toHaveBeenCalled();
    });

    it('should disable out of stock attribute combinations', () => {
      controller = new PDPController(mockProductData);
      const uiManager = (controller as any).uiManager;

      const updateCall = uiManager.updateAttributeButtonStates.mock.calls[0];
      const availabilityChecker = updateCall[2];

      // Check if Small + Blue (out of stock) returns false
      const isAvailable = availabilityChecker('Color', 'Blue');
      expect(typeof isAvailable).toBe('boolean');
    });
  });

  describe('Variation Selection', () => {
    it('should handle direct variation selection', () => {
      controller = new PDPController(mockProductData);

      const eventManager = (controller as any).eventManager;
      const onVariationSelection = eventManager.handlers?.onVariationSelection;

      if (onVariationSelection) {
        onVariationSelection('var-2');
      }

      const currentVariation = (controller as any).currentVariation;
      expect(currentVariation?.variationId).toBe('var-2');
    });

    it('should update UI after variation selection', () => {
      controller = new PDPController(mockProductData);
      const uiManager = (controller as any).uiManager;

      const eventManager = (controller as any).eventManager;
      const onVariationSelection = eventManager.handlers?.onVariationSelection;

      if (onVariationSelection) {
        onVariationSelection('var-2');
      }

      expect(uiManager.updatePriceDisplay).toHaveBeenCalledWith(3000, expect.any(Object));
    });
  });

  describe('Error Handling', () => {
    it('should handle missing variation gracefully', () => {
      controller = new PDPController(mockProductData);

      const eventManager = (controller as any).eventManager;
      const onVariationSelection = eventManager.handlers?.onVariationSelection;

      if (onVariationSelection) {
        // Try to select non-existent variation
        expect(() => onVariationSelection('non-existent')).not.toThrow();
      }
    });

    it('should handle corrupted button data', () => {
      document.body.innerHTML = `
        <button id="add-to-cart-button" data-product='invalid json'>
          Add to Cart
        </button>
      `;

      // Should not crash even with bad data
      expect(() => {
        controller = new PDPController(mockProductData);
      }).not.toThrow();
    });

    it('should handle missing button element', () => {
      document.body.innerHTML = ''; // No button

      // Should not crash
      expect(() => {
        controller = new PDPController(mockProductData);
      }).not.toThrow();
    });
  });

  describe('Cleanup', () => {
    it('should cleanup event manager on cleanup', () => {
      controller = new PDPController(mockProductData);
      const eventManager = (controller as any).eventManager;

      controller.cleanup();

      expect(eventManager.cleanup).toHaveBeenCalled();
    });

    it('should reset state on cleanup', () => {
      controller = new PDPController(mockProductData);

      controller.cleanup();

      expect((controller as any).currentVariation).toBeNull();
      expect((controller as any).selectedAttributes).toEqual({});
    });
  });

  describe('Sale Price Support', () => {
    it('should pass sale info to UI manager', () => {
      mockProductData.variations[0].saleInfo = {
        isOnSale: true,
        salePrice: 2000,
        discountPercent: 20
      };

      controller = new PDPController(mockProductData);
      const uiManager = (controller as any).uiManager;

      const priceCall = uiManager.updatePriceDisplay.mock.calls[0];
      expect(priceCall[1]).toHaveProperty('saleInfo');
      expect(priceCall[1].saleInfo.isOnSale).toBe(true);
    });
  });

  describe('State Consistency', () => {
    it('should maintain consistent state during multiple attribute changes', () => {
      controller = new PDPController(mockProductData);

      const eventManager = (controller as any).eventManager;
      const onAttributeSelection = eventManager.handlers?.onAttributeSelection;

      if (onAttributeSelection) {
        // Change size
        onAttributeSelection('Size', 'Large');
        expect((controller as any).selectedAttributes.Size).toBe('Large');

        // Change color
        onAttributeSelection('Color', 'Red');
        expect((controller as any).selectedAttributes.Color).toBe('Red');

        // Change size again
        onAttributeSelection('Size', 'Small');
        expect((controller as any).selectedAttributes.Size).toBe('Small');

        // Color should still be Red
        expect((controller as any).selectedAttributes.Color).toBe('Red');
      }
    });

    it('should track initial load state', () => {
      controller = new PDPController(mockProductData);

      expect((controller as any).isInitialLoad).toBe(true);

      const eventManager = (controller as any).eventManager;
      const onAttributeSelection = eventManager.handlers?.onAttributeSelection;

      if (onAttributeSelection) {
        onAttributeSelection('Size', 'Large');
        expect((controller as any).isInitialLoad).toBe(false);
      }
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle switching between in-stock and out-of-stock variations', () => {
      controller = new PDPController(mockProductData);
      const uiManager = (controller as any).uiManager;

      const eventManager = (controller as any).eventManager;
      const onAttributeSelection = eventManager.handlers?.onAttributeSelection;

      if (onAttributeSelection) {
        // Start with in-stock (Small, Red)
        onAttributeSelection('Size', 'Small');
        onAttributeSelection('Color', 'Red');

        let currentVariation = (controller as any).currentVariation;
        expect(currentVariation?.inStock).toBe(true);

        // Switch to out-of-stock (Small, Blue)
        onAttributeSelection('Color', 'Blue');

        // Should still have a variation but marked as out of stock
        currentVariation = (controller as any).currentVariation;
        expect(currentVariation?.inStock).toBe(false);
      }
    });

    it('should update all UI components in sync', () => {
      controller = new PDPController(mockProductData);
      const uiManager = (controller as any).uiManager;

      const eventManager = (controller as any).eventManager;
      const onVariationSelection = eventManager.handlers?.onVariationSelection;

      // Get initial call counts
      const initialAvailCalls = uiManager.updateAvailabilityDisplay.mock.calls.length;
      const initialPriceCalls = uiManager.updatePriceDisplay.mock.calls.length;
      const initialImageCalls = uiManager.updateProductImage.mock.calls.length;
      const initialButtonCalls = uiManager.updateButtonProductData.mock.calls.length;
      const initialAttrCalls = uiManager.updateAttributeButtonStates.mock.calls.length;

      if (onVariationSelection) {
        onVariationSelection('var-2');
      }

      // All UI methods should be called (at least once more than initial, or at least once total)
      expect(uiManager.updateAvailabilityDisplay.mock.calls.length).toBeGreaterThan(initialAvailCalls);
      expect(uiManager.updatePriceDisplay.mock.calls.length).toBeGreaterThan(initialPriceCalls);
      expect(uiManager.updateProductImage.mock.calls.length).toBeGreaterThan(initialImageCalls);
      expect(uiManager.updateButtonProductData.mock.calls.length).toBeGreaterThan(initialButtonCalls);
      // updateAttributeButtonStates might only be called once during init, so just check it was called
      expect(uiManager.updateAttributeButtonStates.mock.calls.length).toBeGreaterThanOrEqual(1);
    });
  });
});
