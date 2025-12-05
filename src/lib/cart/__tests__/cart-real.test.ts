/**
 * Real Cart Implementation Tests - Testing actual CartManager class
 * Replaces mock-based tests with real implementation testing
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { CartItem } from '../types';

// Mock dependencies before importing cart
vi.mock('../../square/inventory', () => ({
  checkBulkInventory: vi.fn()
}));

// Mock fetch for inventory API calls
global.fetch = vi.fn();

describe('CartManager Real Implementation Tests', () => {
  let CartManager: any;
  let cart: any;
  let mockLocalStorage: { [key: string]: string };

  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup localStorage mock
    mockLocalStorage = {};
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: (key: string) => mockLocalStorage[key] || null,
        setItem: (key: string, value: string) => {
          mockLocalStorage[key] = value;
        },
        removeItem: (key: string) => {
          delete mockLocalStorage[key];
        },
        clear: () => {
          mockLocalStorage = {};
        }
      },
      writable: true
    });

    // Mock successful inventory check by default
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/api/check-inventory')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, quantity: 10 })
        });
      }
      if (url.includes('/api/sale-info')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, saleInfo: {} })
        });
      }
      return Promise.reject(new Error('Unexpected fetch call'));
    });

    // Dynamically import to get fresh instance
    const cartModule = await import('../index');
    cart = cartModule.cart;

    // Clear cart before each test
    cart.clear();

    // Wait for initialization
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  afterEach(() => {
    cart.clear();
  });

  describe('Basic Operations', () => {
    it('should add item to cart', async () => {
      const item: CartItem = {
        id: 'prod-1',
        variationId: 'var-1',
        catalogObjectId: 'cat-1',
        title: 'Test Product',
        price: 2500,
        quantity: 1,
        variationName: 'Small',
        image: 'test.jpg',
        unit: 'UNIT'
      };

      const result = await cart.addItem(item);

      expect(result.success).toBe(true);
      expect(cart.getItems()).toHaveLength(1);
      expect(cart.getItems()[0].title).toBe('Test Product');
      expect(cart.getItemCount()).toBe(1);
    });

    it('should calculate total correctly', async () => {
      const item1: CartItem = {
        id: 'prod-1',
        variationId: 'var-1',
        catalogObjectId: 'cat-1',
        title: 'Product 1',
        price: 2500,
        quantity: 2,
        variationName: 'Small'
      };

      const item2: CartItem = {
        id: 'prod-2',
        variationId: 'var-2',
        catalogObjectId: 'cat-2',
        title: 'Product 2',
        price: 1500,
        quantity: 1,
        variationName: 'Medium'
      };

      await cart.addItem(item1);
      await cart.addItem(item2);

      // (2500 * 2) + (1500 * 1) = 6500
      expect(cart.getTotal()).toBe(6500);
    });

    it('should update quantity correctly', async () => {
      const item: CartItem = {
        id: 'prod-1',
        variationId: 'var-1',
        catalogObjectId: 'cat-1',
        title: 'Test Product',
        price: 2500,
        quantity: 1,
        variationName: 'Small'
      };

      await cart.addItem(item);
      const itemKey = `${item.id}:${item.variationId}`;

      const result = await cart.updateQuantity(itemKey, 3);

      expect(result.success).toBe(true);
      expect(cart.getItems()[0].quantity).toBe(3);
      expect(cart.getItemCount()).toBe(3);
    });

    it('should remove item from cart', async () => {
      const item: CartItem = {
        id: 'prod-1',
        variationId: 'var-1',
        catalogObjectId: 'cat-1',
        title: 'Test Product',
        price: 2500,
        quantity: 1,
        variationName: 'Small'
      };

      await cart.addItem(item);
      expect(cart.getItems()).toHaveLength(1);

      const itemKey = `${item.id}:${item.variationId}`;
      cart.removeItem(itemKey);

      // Wait for async removal
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(cart.getItems()).toHaveLength(0);
    });

    it('should clear entire cart', async () => {
      const item1: CartItem = {
        id: 'prod-1',
        variationId: 'var-1',
        catalogObjectId: 'cat-1',
        title: 'Product 1',
        price: 2500,
        quantity: 1,
        variationName: 'Small'
      };

      const item2: CartItem = {
        id: 'prod-2',
        variationId: 'var-2',
        catalogObjectId: 'cat-2',
        title: 'Product 2',
        price: 1500,
        quantity: 1,
        variationName: 'Medium'
      };

      await cart.addItem(item1);
      await cart.addItem(item2);

      cart.clear();
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(cart.getItems()).toHaveLength(0);
      expect(cart.getItemCount()).toBe(0);
      expect(cart.getTotal()).toBe(0);
    });
  });

  describe('Inventory Integration', () => {
    it('should handle out of stock items', async () => {
      (global.fetch as any).mockImplementationOnce((url: string) => {
        if (url.includes('/api/check-inventory')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true, quantity: 0 })
          });
        }
        return Promise.reject(new Error('Unexpected fetch'));
      });

      const item: CartItem = {
        id: 'prod-1',
        variationId: 'var-1',
        catalogObjectId: 'cat-1',
        title: 'Out of Stock Product',
        price: 2500,
        quantity: 1,
        variationName: 'Small'
      };

      const result = await cart.addItem(item);

      expect(result.success).toBe(false);
      expect(result.message).toContain('out of stock');
      expect(cart.getItems()).toHaveLength(0);
    });

    it('should limit quantity to available stock', async () => {
      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('/api/check-inventory')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true, quantity: 3 })
          });
        }
        if (url.includes('/api/sale-info')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true, saleInfo: {} })
          });
        }
        return Promise.reject(new Error('Unexpected fetch'));
      });

      const item: CartItem = {
        id: 'prod-1',
        variationId: 'var-1',
        catalogObjectId: 'cat-1',
        title: 'Limited Stock Product',
        price: 2500,
        quantity: 5, // Requesting more than available
        variationName: 'Small'
      };

      const result = await cart.addItem(item);

      expect(result.success).toBe(true);
      expect(result.message).toContain('maximum available');
      expect(cart.getItems()[0].quantity).toBe(3); // Should be limited to available
    });

    it('should handle inventory API failures gracefully', async () => {
      (global.fetch as any).mockImplementationOnce((url: string) => {
        if (url.includes('/api/check-inventory')) {
          return Promise.resolve({
            ok: false,
            status: 500
          });
        }
        return Promise.reject(new Error('Unexpected fetch'));
      });

      const item: CartItem = {
        id: 'prod-1',
        variationId: 'var-1',
        catalogObjectId: 'cat-1',
        title: 'Test Product',
        price: 2500,
        quantity: 1,
        variationName: 'Small'
      };

      // Should still allow add when inventory check fails (graceful degradation)
      const result = await cart.addItem(item);
      expect(result.success).toBe(true);
    });
  });

  describe('Persistence', () => {
    it('should persist cart to localStorage', async () => {
      const item: CartItem = {
        id: 'prod-1',
        variationId: 'var-1',
        catalogObjectId: 'cat-1',
        title: 'Test Product',
        price: 2500,
        quantity: 1,
        variationName: 'Small'
      };

      await cart.addItem(item);

      // Wait for save
      await new Promise(resolve => setTimeout(resolve, 100));

      const savedData = mockLocalStorage['cart'];
      expect(savedData).toBeDefined();

      const parsed = JSON.parse(savedData);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].title).toBe('Test Product');
    });

    it('should load cart from localStorage on init', async () => {
      const item: CartItem = {
        id: 'prod-1',
        variationId: 'var-1',
        catalogObjectId: 'cat-1',
        title: 'Persisted Product',
        price: 2500,
        quantity: 2,
        variationName: 'Small'
      };

      // Manually set localStorage
      mockLocalStorage['cart'] = JSON.stringify([item]);

      // Reimport to trigger load
      const cartModule = await import('../index');
      const freshCart = cartModule.cart;
      freshCart.forceRefresh();

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(freshCart.getItems()).toHaveLength(1);
      expect(freshCart.getItems()[0].title).toBe('Persisted Product');
      expect(freshCart.getItemCount()).toBe(2);
    });

    it('should handle corrupted localStorage data', async () => {
      mockLocalStorage['cart'] = 'invalid json data';

      const cartModule = await import('../index');
      const freshCart = cartModule.cart;
      freshCart.forceRefresh();

      await new Promise(resolve => setTimeout(resolve, 100));

      // Should not crash, should start with empty cart
      expect(freshCart.getItems()).toHaveLength(0);
    });
  });

  describe('Duplicate Prevention', () => {
    it('should update quantity when adding same variation', async () => {
      const item: CartItem = {
        id: 'prod-1',
        variationId: 'var-1',
        catalogObjectId: 'cat-1',
        title: 'Test Product',
        price: 2500,
        quantity: 1,
        variationName: 'Small'
      };

      await cart.addItem(item);
      expect(cart.getItems()).toHaveLength(1);
      expect(cart.getItems()[0].quantity).toBe(1);

      await cart.addItem(item);
      expect(cart.getItems()).toHaveLength(1); // Still just one item
      expect(cart.getItems()[0].quantity).toBe(2); // Quantity increased
    });

    it('should allow same product with different variations', async () => {
      const item1: CartItem = {
        id: 'prod-1',
        variationId: 'var-1',
        catalogObjectId: 'cat-1',
        title: 'Test Product',
        price: 2500,
        quantity: 1,
        variationName: 'Small'
      };

      const item2: CartItem = {
        id: 'prod-1',
        variationId: 'var-2',
        catalogObjectId: 'cat-2',
        title: 'Test Product',
        price: 3000,
        quantity: 1,
        variationName: 'Large'
      };

      await cart.addItem(item1);
      await cart.addItem(item2);

      expect(cart.getItems()).toHaveLength(2); // Two separate items
    });
  });

  describe('Availability Checks', () => {
    it('should correctly report variation quantity in cart', () => {
      const item: CartItem = {
        id: 'prod-1',
        variationId: 'var-1',
        catalogObjectId: 'cat-1',
        title: 'Test Product',
        price: 2500,
        quantity: 3,
        variationName: 'Small'
      };

      cart.addItem(item);

      const inCart = cart.getVariationQuantity('prod-1', 'var-1');
      expect(inCart).toBe(3);
    });

    it('should calculate remaining quantity correctly', () => {
      const totalAvailable = 10;
      const remaining = cart.getRemainingQuantity('prod-1', 'var-1', totalAvailable);

      expect(remaining).toBe(10); // Nothing in cart yet
    });

    it('should check if product can be added to cart', () => {
      const canAdd = cart.canAddToCart('prod-1', 'var-1', 5, 3);
      expect(canAdd).toBe(true);

      const cannotAdd = cart.canAddToCart('prod-1', 'var-1', 0, 1);
      expect(cannotAdd).toBe(false);
    });

    it('should get max addable quantity', () => {
      const max = cart.getMaxAddableQuantity('prod-1', 'var-1', 5);
      expect(max).toBe(5);
    });
  });

  describe('Sale Price Handling', () => {
    it('should use sale price in total calculation when available', async () => {
      const item: CartItem = {
        id: 'prod-1',
        variationId: 'var-1',
        catalogObjectId: 'cat-1',
        title: 'Sale Product',
        price: 2500,
        quantity: 2,
        variationName: 'Small',
        saleInfo: {
          isOnSale: true,
          salePrice: 2000,
          discountPercent: 20
        }
      };

      await cart.addItem(item);

      // Should use sale price: 2000 * 2 = 4000
      expect(cart.getTotal()).toBe(4000);
    });

    it('should use regular price when no sale info', async () => {
      const item: CartItem = {
        id: 'prod-1',
        variationId: 'var-1',
        catalogObjectId: 'cat-1',
        title: 'Regular Product',
        price: 2500,
        quantity: 2,
        variationName: 'Small'
      };

      await cart.addItem(item);

      // Should use regular price: 2500 * 2 = 5000
      expect(cart.getTotal()).toBe(5000);
    });
  });

  describe('State Management', () => {
    it('should return current cart state', async () => {
      const item: CartItem = {
        id: 'prod-1',
        variationId: 'var-1',
        catalogObjectId: 'cat-1',
        title: 'Test Product',
        price: 2500,
        quantity: 2,
        variationName: 'Small'
      };

      await cart.addItem(item);

      const state = cart.getState();

      expect(state).toHaveProperty('items');
      expect(state).toHaveProperty('total');
      expect(state).toHaveProperty('itemCount');
      expect(state.items).toHaveLength(1);
      expect(state.total).toBe(5000);
      expect(state.itemCount).toBe(2);
    });

    it('should update quantity to zero by removing item', async () => {
      const item: CartItem = {
        id: 'prod-1',
        variationId: 'var-1',
        catalogObjectId: 'cat-1',
        title: 'Test Product',
        price: 2500,
        quantity: 2,
        variationName: 'Small'
      };

      await cart.addItem(item);
      const itemKey = `${item.id}:${item.variationId}`;

      await cart.updateQuantity(itemKey, 0);
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(cart.getItems()).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle localStorage setItem failures', async () => {
      // Mock localStorage failure
      Object.defineProperty(window, 'localStorage', {
        value: {
          getItem: () => null,
          setItem: () => {
            throw new Error('QuotaExceededError');
          },
          removeItem: () => {},
          clear: () => {}
        },
        writable: true
      });

      const item: CartItem = {
        id: 'prod-1',
        variationId: 'var-1',
        catalogObjectId: 'cat-1',
        title: 'Test Product',
        price: 2500,
        quantity: 1,
        variationName: 'Small'
      };

      // Should not throw even if save fails
      await expect(cart.addItem(item)).resolves.not.toThrow();
    });

    it('should return error when updating non-existent item', async () => {
      const result = await cart.updateQuantity('non-existent-key', 5);

      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });
  });
});
