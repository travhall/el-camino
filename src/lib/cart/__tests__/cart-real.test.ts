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
    it('should correctly report variation quantity in cart', async () => {
      const item: CartItem = {
        id: 'prod-1',
        variationId: 'var-1',
        catalogObjectId: 'cat-1',
        title: 'Test Product',
        price: 2500,
        quantity: 3,
        variationName: 'Small'
      };

      await cart.addItem(item);

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
          salePrice: 2000,
          originalPrice: 2500,
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

  // ── Additional coverage: gift cards, addItem edge cases, validateCart ──────

  describe('Gift card behaviour', () => {
    it('adds a gift card without calling the inventory API', async () => {
      const inventoryFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, quantity: 99 }),
      });

      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('/api/check-inventory')) return inventoryFetch(url);
        if (url.includes('/api/sale-info')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true, saleInfo: {} }),
          });
        }
        return Promise.reject(new Error(`Unexpected fetch: ${url}`));
      });

      const gcItem: CartItem = {
        id: 'gc-1',
        variationId: 'gc-var-1',
        catalogObjectId: 'gc-cat-1',
        title: 'Gift Card $25',
        price: 2500,
        quantity: 1,
        isGiftCard: true,
      };

      const result = await cart.addItem(gcItem);

      expect(result.success).toBe(true);
      // Inventory API must NOT be called for gift cards
      expect(inventoryFetch).not.toHaveBeenCalled();
      expect(cart.getItems().some((i: any) => i.isGiftCard)).toBe(true);
    });
  });

  describe('addItem — quantity edge cases', () => {
    it('caps quantity at available stock when item is not yet in cart', async () => {
      // Requesting 10, only 3 available, nothing in cart already
      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('/api/check-inventory')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true, quantity: 3 }),
          });
        }
        if (url.includes('/api/sale-info')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true, saleInfo: {} }),
          });
        }
        return Promise.reject(new Error(`Unexpected: ${url}`));
      });

      const item: CartItem = {
        id: 'prod-new',
        variationId: 'var-new',
        catalogObjectId: 'cat-new',
        title: 'Limited Item',
        price: 1000,
        quantity: 10,
      };

      const result = await cart.addItem(item);

      expect(result.success).toBe(true);
      expect(result.message).toContain('maximum available');
      expect(cart.getItems()[0].quantity).toBe(3);
    });

    it('caps existing cart item at available stock when adding more would exceed it', async () => {
      // Put 3 in cart first (within the default 10-available mock)
      const item: CartItem = {
        id: 'prod-cap',
        variationId: 'var-cap',
        catalogObjectId: 'cat-cap',
        title: 'Cap Test',
        price: 500,
        quantity: 3,
      };
      await cart.addItem(item);
      expect(cart.getItems()[0].quantity).toBe(3);

      // Now add 4 more, but only 5 total available (3 already in cart + 2 remaining)
      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('/api/check-inventory')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true, quantity: 5 }),
          });
        }
        if (url.includes('/api/sale-info')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true, saleInfo: {} }),
          });
        }
        return Promise.reject(new Error(`Unexpected: ${url}`));
      });

      const result = await cart.addItem({ ...item, quantity: 4 });

      expect(result.success).toBe(true);
      expect(result.message).toContain('maximum available');
      // Should be capped at the total available (5), not 3+4=7
      expect(cart.getItems()[0].quantity).toBe(5);
    });

    it('rejects add when the item is already at the maximum available quantity', async () => {
      // Put 5 in cart against a 5-unit stock
      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('/api/check-inventory')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true, quantity: 5 }),
          });
        }
        if (url.includes('/api/sale-info')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true, saleInfo: {} }),
          });
        }
        return Promise.reject(new Error(`Unexpected: ${url}`));
      });

      const item: CartItem = {
        id: 'prod-max',
        variationId: 'var-max',
        catalogObjectId: 'cat-max',
        title: 'Max Qty Item',
        price: 800,
        quantity: 5,
      };

      await cart.addItem(item);
      expect(cart.getItems()[0].quantity).toBe(5);

      // Try to add 1 more — should fail
      const result = await cart.addItem({ ...item, quantity: 1 });

      expect(result.success).toBe(false);
      expect(result.message).toContain('maximum available quantity');
    });
  });

  describe('addItem — fetch failure resilience', () => {
    it('proceeds with add when the inventory fetch returns a non-ok response', async () => {
      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('/api/check-inventory')) {
          return Promise.resolve({ ok: false, status: 503 });
        }
        if (url.includes('/api/sale-info')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true, saleInfo: {} }),
          });
        }
        return Promise.reject(new Error(`Unexpected: ${url}`));
      });

      const item: CartItem = {
        id: 'prod-f',
        variationId: 'var-f',
        catalogObjectId: 'cat-f',
        title: 'Fetch Fail',
        price: 300,
        quantity: 1,
      };

      // Graceful degradation: still adds (uses 999 fallback)
      const result = await cart.addItem(item);
      expect(result.success).toBe(true);
    });

    it('adds item without sale info when the sale-info fetch fails', async () => {
      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('/api/check-inventory')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true, quantity: 10 }),
          });
        }
        if (url.includes('/api/sale-info')) {
          return Promise.resolve({ ok: false, status: 500 });
        }
        return Promise.reject(new Error(`Unexpected: ${url}`));
      });

      const item: CartItem = {
        id: 'prod-nosale',
        variationId: 'var-nosale',
        catalogObjectId: 'cat-nosale',
        title: 'No Sale Info',
        price: 1200,
        quantity: 1,
      };

      const result = await cart.addItem(item);
      expect(result.success).toBe(true);
      // saleInfo should remain undefined / null since the fetch failed
      const cartItem = cart.getItems().find((i: any) => i.variationId === 'var-nosale');
      expect(cartItem).toBeDefined();
      expect(cartItem?.saleInfo).toBeFalsy();
    });
  });

  describe('validateCart', () => {
    beforeEach(async () => {
      // Ensure we start with a clean cart for these tests
      cart.clear();
      await new Promise(r => setTimeout(r, 60));
    });

    it('returns success immediately when the cart is empty', async () => {
      const result = await cart.validateCart();
      expect(result.success).toBe(true);
      expect(result.message).toBeUndefined();
    });

    it('returns success with no message when all items are still in stock', async () => {
      await cart.addItem({
        id: 'prod-v',
        variationId: 'var-v',
        catalogObjectId: 'cat-v',
        title: 'Valid Item',
        price: 500,
        quantity: 2,
      });

      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('/api/batch-inventory')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              stockLevels: { 'var-v': 10 },
            }),
          });
        }
        return Promise.reject(new Error(`Unexpected: ${url}`));
      });

      const result = await cart.validateCart();
      expect(result.success).toBe(true);
      expect(result.message).toBeUndefined();
      expect(cart.getItems()[0].quantity).toBe(2);
    });

    it('removes out-of-stock items and includes their names in the message', async () => {
      await cart.addItem({
        id: 'prod-oos',
        variationId: 'var-oos',
        catalogObjectId: 'cat-oos',
        title: 'Sold Out Widget',
        price: 999,
        quantity: 1,
      });

      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('/api/batch-inventory')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              stockLevels: { 'var-oos': 0 },
            }),
          });
        }
        return Promise.reject(new Error(`Unexpected: ${url}`));
      });

      const result = await cart.validateCart();
      expect(result.success).toBe(true);
      expect(result.message).toContain('Removed');
      expect(result.message).toContain('Sold Out Widget');
      expect(cart.getItems()).toHaveLength(0);
    });

    it('adjusts quantities to match available stock and includes names in the message', async () => {
      await cart.addItem({
        id: 'prod-adj',
        variationId: 'var-adj',
        catalogObjectId: 'cat-adj',
        title: 'Adjustable Item',
        price: 750,
        quantity: 8,
      });

      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('/api/batch-inventory')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              stockLevels: { 'var-adj': 3 },
            }),
          });
        }
        return Promise.reject(new Error(`Unexpected: ${url}`));
      });

      const result = await cart.validateCart();
      expect(result.success).toBe(true);
      expect(result.message).toContain('Adjusted');
      expect(result.message).toContain('Adjustable Item');
      expect(cart.getItems()[0].quantity).toBe(3);
    });

    it('handles multiple items with mixed stock states in one pass', async () => {
      await Promise.all([
        cart.addItem({ id: 'p1', variationId: 'v1', catalogObjectId: 'c1', title: 'OOS Item', price: 100, quantity: 1 }),
        cart.addItem({ id: 'p2', variationId: 'v2', catalogObjectId: 'c2', title: 'Adj Item', price: 200, quantity: 5 }),
        cart.addItem({ id: 'p3', variationId: 'v3', catalogObjectId: 'c3', title: 'OK Item',  price: 300, quantity: 1 }),
      ]);

      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('/api/batch-inventory')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              stockLevels: { v1: 0, v2: 2, v3: 10 },
            }),
          });
        }
        return Promise.reject(new Error(`Unexpected: ${url}`));
      });

      const result = await cart.validateCart();
      expect(result.success).toBe(true);
      expect(result.message).toContain('OOS Item');
      expect(result.message).toContain('Adj Item');
      expect(cart.getItems()).toHaveLength(2);
      const adjItem = cart.getItems().find((i: any) => i.variationId === 'v2');
      expect(adjItem?.quantity).toBe(2);
    });

    it('treats items as out-of-stock and removes them when the inventory API throws', async () => {
      // fetchBulkInventory swallows network errors and returns {}, so validateCart
      // sees every item as 0-stock and removes it. This is graceful degradation —
      // success is still true, but the cart is emptied and the message says "Removed".
      await cart.addItem({
        id: 'prod-err',
        variationId: 'var-err',
        catalogObjectId: 'cat-err',
        title: 'Error Item',
        price: 500,
        quantity: 1,
      });

      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('/api/batch-inventory')) {
          return Promise.reject(new Error('Network timeout'));
        }
        return Promise.reject(new Error(`Unexpected: ${url}`));
      });

      const result = await cart.validateCart();
      expect(result.success).toBe(true);
      expect(result.message).toContain('Removed');
      expect(cart.getItems()).toHaveLength(0);
    });
  });

  describe('getProductAvailabilityState', () => {
    it('returns OUT_OF_STOCK when totalInventory is 0', () => {
      const state = cart.getProductAvailabilityState('prod-1', 'var-1', 0);
      expect(state).toBe('out_of_stock');
    });

    it('returns AVAILABLE when inventory exceeds cart quantity', () => {
      const state = cart.getProductAvailabilityState('prod-1', 'var-1', 10);
      expect(state).toBe('available');
    });
  });

  describe('canAddToCart — ALL_IN_CART state', () => {
    it('returns false when all available stock is already in the cart', async () => {
      // Add 5 items against 5 available
      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('/api/check-inventory')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true, quantity: 5 }),
          });
        }
        if (url.includes('/api/sale-info')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true, saleInfo: {} }),
          });
        }
        return Promise.reject(new Error(`Unexpected: ${url}`));
      });

      await cart.addItem({
        id: 'prod-full',
        variationId: 'var-full',
        catalogObjectId: 'cat-full',
        title: 'Full Stock Item',
        price: 200,
        quantity: 5,
      });

      // All 5 units are in the cart; 5 total available → ALL_IN_CART
      const canAdd = cart.canAddToCart('prod-full', 'var-full', 5, 1);
      expect(canAdd).toBe(false);
    });
  });

  describe('fetchSaleInfoForCartItems — via forceRefresh', () => {
    it('updates cart items with sale info fetched after load', async () => {
      const item: CartItem = {
        id: 'prod-sale',
        variationId: 'var-sale',
        catalogObjectId: 'cat-sale',
        title: 'Sale Refresh Item',
        price: 3000,
        quantity: 1,
      };

      // Pre-load the item directly into localStorage so loadCart picks it up
      mockLocalStorage['cart'] = JSON.stringify([item]);

      const saleInfo = { salePrice: 2000, originalPrice: 3000, discountPercent: 33 };

      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('/api/sale-info')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              saleInfo: { 'var-sale': saleInfo },
            }),
          });
        }
        return Promise.reject(new Error(`Unexpected: ${url}`));
      });

      cart.forceRefresh();
      // Allow loadCart + fetchSaleInfoForCartItems to complete
      await new Promise(r => setTimeout(r, 200));

      const loaded = cart.getItems().find((i: any) => i.variationId === 'var-sale');
      expect(loaded).toBeDefined();
      expect(loaded?.saleInfo?.salePrice).toBe(2000);
      // Total should use sale price
      expect(cart.getTotal()).toBe(2000);
    });

    it('leaves items unchanged when the sale-info API returns non-ok', async () => {
      const item: CartItem = {
        id: 'prod-nok',
        variationId: 'var-nok',
        catalogObjectId: 'cat-nok',
        title: 'No-Sale Item',
        price: 1000,
        quantity: 1,
      };
      mockLocalStorage['cart'] = JSON.stringify([item]);

      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('/api/sale-info')) {
          return Promise.resolve({ ok: false, status: 503 });
        }
        return Promise.reject(new Error(`Unexpected: ${url}`));
      });

      cart.forceRefresh();
      await new Promise(r => setTimeout(r, 200));

      const loaded = cart.getItems().find((i: any) => i.variationId === 'var-nok');
      expect(loaded).toBeDefined();
      expect(loaded?.saleInfo).toBeFalsy();
    });

    it('leaves items unchanged when the sale-info response has success:false', async () => {
      const item: CartItem = {
        id: 'prod-nosuccess',
        variationId: 'var-nosuccess',
        catalogObjectId: 'cat-nosuccess',
        title: 'No Success Item',
        price: 1500,
        quantity: 1,
      };
      mockLocalStorage['cart'] = JSON.stringify([item]);

      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('/api/sale-info')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: false }),
          });
        }
        return Promise.reject(new Error(`Unexpected: ${url}`));
      });

      cart.forceRefresh();
      await new Promise(r => setTimeout(r, 200));

      const loaded = cart.getItems().find((i: any) => i.variationId === 'var-nosuccess');
      expect(loaded).toBeDefined();
      expect(loaded?.saleInfo).toBeFalsy();
    });

    it('leaves items unchanged when saleInfo map has no entry for the item variation', async () => {
      const item: CartItem = {
        id: 'prod-nomatch',
        variationId: 'var-nomatch',
        catalogObjectId: 'cat-nomatch',
        title: 'No Match Item',
        price: 2000,
        quantity: 1,
      };
      mockLocalStorage['cart'] = JSON.stringify([item]);

      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('/api/sale-info')) {
          return Promise.resolve({
            ok: true,
            // saleInfo map exists but doesn't contain 'var-nomatch'
            json: () => Promise.resolve({
              success: true,
              saleInfo: { 'var-other': { salePrice: 100, originalPrice: 200, discountPercent: 50 } },
            }),
          });
        }
        return Promise.reject(new Error(`Unexpected: ${url}`));
      });

      cart.forceRefresh();
      await new Promise(r => setTimeout(r, 200));

      const loaded = cart.getItems().find((i: any) => i.variationId === 'var-nomatch');
      expect(loaded).toBeDefined();
      expect(loaded?.saleInfo).toBeFalsy();
      // Price should be unchanged
      expect(cart.getTotal()).toBe(2000);
    });

    it('silently continues when the sale-info fetch rejects outright', async () => {
      const item: CartItem = {
        id: 'prod-reject',
        variationId: 'var-reject',
        catalogObjectId: 'cat-reject',
        title: 'Reject Item',
        price: 800,
        quantity: 1,
      };
      mockLocalStorage['cart'] = JSON.stringify([item]);

      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('/api/sale-info')) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.reject(new Error(`Unexpected: ${url}`));
      });

      cart.forceRefresh();
      await new Promise(r => setTimeout(r, 200));

      // Item should still be in cart; fetch error was swallowed
      const loaded = cart.getItems().find((i: any) => i.variationId === 'var-reject');
      expect(loaded).toBeDefined();
      expect(loaded?.saleInfo).toBeFalsy();
    });
  });

  describe('loadCart — non-array stored data', () => {
    it('warns and produces an empty cart when localStorage contains a JSON object instead of array', async () => {
      // Simulate corrupted storage that is valid JSON but not an array
      mockLocalStorage['cart'] = JSON.stringify({ corrupted: true });

      cart.forceRefresh();
      await new Promise(r => setTimeout(r, 200));

      // Should not crash; cart should be empty
      expect(cart.getItems()).toHaveLength(0);
    });

    it('skips items with zero quantity when loading from localStorage', async () => {
      const zeroQtyItem = {
        id: 'prod-zero',
        variationId: 'var-zero',
        catalogObjectId: 'cat-zero',
        title: 'Zero Qty Item',
        price: 500,
        quantity: 0, // Should be filtered out
      };
      const validItem: CartItem = {
        id: 'prod-valid',
        variationId: 'var-valid',
        catalogObjectId: 'cat-valid',
        title: 'Valid Item',
        price: 500,
        quantity: 1,
      };
      mockLocalStorage['cart'] = JSON.stringify([zeroQtyItem, validItem]);

      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('/api/sale-info')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true, saleInfo: {} }),
          });
        }
        return Promise.reject(new Error(`Unexpected: ${url}`));
      });

      cart.forceRefresh();
      await new Promise(r => setTimeout(r, 200));

      const items = cart.getItems();
      expect(items).toHaveLength(1);
      expect(items[0].variationId).toBe('var-valid');
    });
  });

  describe('removeItem — no-op when key does not exist', () => {
    it('does nothing when called with a key that is not in the cart', async () => {
      await cart.addItem({
        id: 'prod-keep',
        variationId: 'var-keep',
        catalogObjectId: 'cat-keep',
        title: 'Keep Me',
        price: 100,
        quantity: 1,
      });
      expect(cart.getItems()).toHaveLength(1);

      // Remove a key that doesn't exist — should be a no-op
      cart.removeItem('nonexistent:key');
      await new Promise(r => setTimeout(r, 100));

      expect(cart.getItems()).toHaveLength(1);
    });
  });

  describe('addItem and validateCart — outer error catch', () => {
    it('addItem returns failure when item is null/undefined (outer catch)', async () => {
      // Passing null causes item.quantity access to throw inside the try block,
      // hitting the outer catch that returns { success: false, message: ... }
      const result = await cart.addItem(null as any);
      expect(result.success).toBe(false);
      expect(result.message).toMatch(/error/i);
    });

    it('validateCart returns failure when internal state is broken (outer catch)', async () => {
      // Make this.items.get throw so the for-loop inside validateCart's try throws
      // and hits its outer catch block.
      await cart.addItem({
        id: 'prod-vc', variationId: 'var-vc', catalogObjectId: 'cat-vc',
        title: 'Validate Item', price: 100, quantity: 1,
      });

      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('/api/batch-inventory')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true, stockLevels: { 'var-vc': 10 } }),
          });
        }
        return Promise.reject(new Error(`Unexpected: ${url}`));
      });

      const origItems = (cart as any).items;
      // Replace items with a proxy whose forEach throws mid-iteration
      (cart as any).items = {
        size: 1,
        values: () => { throw new Error('broken iterator'); },
        get: origItems.get.bind(origItems),
        set: origItems.set.bind(origItems),
        delete: origItems.delete.bind(origItems),
        clear: origItems.clear.bind(origItems),
        entries: origItems.entries.bind(origItems),
      };

      try {
        const result = await cart.validateCart();
        expect(result.success).toBe(false);
        expect(result.message).toContain('Failed to validate');
      } finally {
        (cart as any).items = origItems;
      }
    });
  });

  describe('processUpdateQueue — concurrent call guard', () => {
    it('skips a second queue run when one is already in progress', async () => {
      // Add two items, then remove both synchronously.
      // The first removeItem starts the queue (isProcessing → true).
      // The second removeItem's processUpdateQueue call hits the isProcessing guard
      // and returns early — both updates are still queued and both execute when
      // the first run's setTimeout resolves.
      await cart.addItem({
        id: 'pc-1', variationId: 'vc-1', catalogObjectId: 'cc-1',
        title: 'Concurrent A', price: 100, quantity: 1,
      });
      await cart.addItem({
        id: 'pc-2', variationId: 'vc-2', catalogObjectId: 'cc-2',
        title: 'Concurrent B', price: 200, quantity: 1,
      });

      // Synchronous back-to-back removals — second hits isProcessing=true guard
      cart.removeItem('pc-1:vc-1');
      cart.removeItem('pc-2:vc-2');

      await new Promise(r => setTimeout(r, 200));

      expect(cart.getItems()).toHaveLength(0);
    });
  });

  describe('saveCart — fallback error handling', () => {
    it('swallows the error silently when both main and fallback setItem calls throw', async () => {
      // cart.addItem eventually calls saveCart directly.
      // If setItem always throws, saveCart enters the outer catch,
      // attempts the fallback save, that also throws, enters the inner catch.
      // addItem still returns success (the in-memory cart is updated).

      await cart.addItem({
        id: 'prod-save-err',
        variationId: 'var-save-err',
        catalogObjectId: 'cat-save-err',
        title: 'Save Error Item',
        price: 100,
        quantity: 1,
      });

      const storage = (cart as any).storage;
      const origSetItem = storage.setItem;
      storage.setItem = () => { throw new Error('QuotaExceededError'); };

      try {
        const result = await cart.addItem({
          id: 'prod-save-err2',
          variationId: 'var-save-err2',
          catalogObjectId: 'cat-save-err2',
          title: 'Save Error Item 2',
          price: 200,
          quantity: 1,
        });
        // addItem succeeds even though saveCart fails — in-memory state is correct
        expect(result.success).toBe(true);
      } finally {
        storage.setItem = origSetItem;
      }
    });
  });

  describe('storage = null guard paths', () => {
    it('loadCart and saveCart degrade gracefully when storage is unavailable', async () => {
      const origStorage = (cart as any).storage;

      try {
        // Nulling storage triggers the !this.storage early-return in both
        // loadCart (via forceRefresh) and saveCart (via addItem → save).
        (cart as any).storage = null;

        // forceRefresh → loadCart → !this.storage → early return (no crash)
        cart.forceRefresh();
        await new Promise(r => setTimeout(r, 100));

        // addItem eventually calls saveCart → !this.storage → early return (no crash)
        // Use a pre-existing fetch mock so inventory succeeds
        (global.fetch as any).mockImplementation((url: string) => {
          if (url.includes('/api/check-inventory')) {
            return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, quantity: 5 }) });
          }
          if (url.includes('/api/sale-info')) {
            return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, saleInfo: {} }) });
          }
          return Promise.reject(new Error(`Unexpected: ${url}`));
        });

        const result = await cart.addItem({
          id: 'prod-nostorage',
          variationId: 'var-nostorage',
          catalogObjectId: 'cat-nostorage',
          title: 'No Storage Item',
          price: 100,
          quantity: 1,
        });

        // addItem itself succeeds (it adds to the in-memory Map)
        // but saveCart silently fails because storage is null
        expect(result.success).toBe(true);
      } finally {
        (cart as any).storage = origStorage;
      }
    });
  });
});
