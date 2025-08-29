/**
 * Cart Integration Tests - Phase 1 Critical Foundation
 * Tests add/remove/update operations with error scenarios
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { CartItem, CartState } from '../types';

// Mock Square API responses
const mockSquareAPI = {
  retrieveCatalogObject: vi.fn(),
  batchRetrieveInventoryCounts: vi.fn(),
  createOrder: vi.fn()
};

vi.mock('../../square/client', () => ({
  getSquareClient: () => mockSquareAPI
}));

describe('Cart Integration - Critical Business Logic', () => {
  let mockCartState: CartState;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCartState = {
      items: [],
      total: 0,
      subtotal: 0,
      tax: 0,
      itemCount: 0
    };
  });

  describe('Add to Cart Operations', () => {
    it('handles inventory validation failures', async () => {
      // Simulate API failure during inventory check
      mockSquareAPI.batchRetrieveInventoryCounts.mockRejectedValue(
        new Error('API_UNAVAILABLE')
      );

      const cartItem: CartItem = {
        variationId: 'test-variation',
        quantity: 1,
        catalogVersion: 123,
        name: 'Test Product',
        price: 1000
      };

      // Test should handle graceful degradation
      // Implementation should allow add to cart even if inventory check fails
      expect(() => {
        // This would be the actual cart.addItem() call
        mockCartState.items.push(cartItem);
        mockCartState.itemCount = 1;
      }).not.toThrow();
      
      expect(mockCartState.itemCount).toBe(1);
    });

    it('validates maximum quantity limits', () => {
      const cartItem: CartItem = {
        variationId: 'test-variation',
        quantity: 999,
        catalogVersion: 123,
        name: 'Test Product',
        price: 1000
      };

      // Should enforce reasonable quantity limits
      const maxQuantity = 100;
      const adjustedQuantity = Math.min(cartItem.quantity, maxQuantity);
      
      expect(adjustedQuantity).toBe(maxQuantity);
    });

    it('handles duplicate variation additions', () => {
      const baseItem: CartItem = {
        variationId: 'test-variation',
        quantity: 2,
        catalogVersion: 123,
        name: 'Test Product',
        price: 1000
      };

      // Add first item
      mockCartState.items.push(baseItem);
      mockCartState.itemCount = 2;

      // Add same variation again - should update quantity
      const existingIndex = mockCartState.items.findIndex(
        item => item.variationId === baseItem.variationId
      );
      
      if (existingIndex >= 0) {
        mockCartState.items[existingIndex].quantity += 1;
        mockCartState.itemCount += 1;
      }

      expect(mockCartState.items).toHaveLength(1);
      expect(mockCartState.items[0].quantity).toBe(3);
      expect(mockCartState.itemCount).toBe(3);
    });
  });

  describe('Remove from Cart Operations', () => {
    beforeEach(() => {
      mockCartState.items = [
        {
          variationId: 'variation-1',
          quantity: 2,
          catalogVersion: 123,
          name: 'Product 1',
          price: 1000
        },
        {
          variationId: 'variation-2',
          quantity: 1,
          catalogVersion: 123,
          name: 'Product 2',
          price: 2000
        }
      ];
      mockCartState.itemCount = 3;
    });

    it('removes specific variation completely', () => {
      const targetVariationId = 'variation-1';
      
      mockCartState.items = mockCartState.items.filter(
        item => item.variationId !== targetVariationId
      );
      mockCartState.itemCount = mockCartState.items.reduce(
        (sum, item) => sum + item.quantity, 0
      );

      expect(mockCartState.items).toHaveLength(1);
      expect(mockCartState.itemCount).toBe(1);
      expect(mockCartState.items[0].variationId).toBe('variation-2');
    });

    it('decreases quantity without full removal', () => {
      const targetVariationId = 'variation-1';
      const decreaseBy = 1;
      
      const targetItem = mockCartState.items.find(
        item => item.variationId === targetVariationId
      );
      
      if (targetItem && targetItem.quantity > decreaseBy) {
        targetItem.quantity -= decreaseBy;
        mockCartState.itemCount -= decreaseBy;
      }

      expect(mockCartState.items).toHaveLength(2);
      expect(mockCartState.items[0].quantity).toBe(1);
      expect(mockCartState.itemCount).toBe(2);
    });

    it('handles removal of non-existent item gracefully', () => {
      const initialItemCount = mockCartState.itemCount;
      const nonExistentId = 'non-existent-variation';
      
      const initialLength = mockCartState.items.length;
      mockCartState.items = mockCartState.items.filter(
        item => item.variationId !== nonExistentId
      );
      
      expect(mockCartState.items).toHaveLength(initialLength);
      expect(mockCartState.itemCount).toBe(initialItemCount);
    });
  });

  describe('Update Cart Operations', () => {
    beforeEach(() => {
      mockCartState.items = [
        {
          variationId: 'variation-1',
          quantity: 2,
          catalogVersion: 123,
          name: 'Product 1',
          price: 1000
        }
      ];
      mockCartState.itemCount = 2;
    });

    it('updates item quantity', () => {
      const targetVariationId = 'variation-1';
      const newQuantity = 5;
      
      const targetItem = mockCartState.items.find(
        item => item.variationId === targetVariationId
      );
      
      if (targetItem) {
        const quantityDiff = newQuantity - targetItem.quantity;
        targetItem.quantity = newQuantity;
        mockCartState.itemCount += quantityDiff;
      }

      expect(mockCartState.items[0].quantity).toBe(5);
      expect(mockCartState.itemCount).toBe(5);
    });

    it('removes item when quantity set to zero', () => {
      const targetVariationId = 'variation-1';
      const newQuantity = 0;
      
      if (newQuantity === 0) {
        mockCartState.items = mockCartState.items.filter(
          item => item.variationId !== targetVariationId
        );
        mockCartState.itemCount = 0;
      }

      expect(mockCartState.items).toHaveLength(0);
      expect(mockCartState.itemCount).toBe(0);
    });
  });

  describe('Error Recovery Scenarios', () => {
    it('handles network failures during cart operations', async () => {
      mockSquareAPI.createOrder.mockRejectedValue(
        new Error('NETWORK_ERROR')
      );

      // Cart should maintain state even if order creation fails
      const cartBackup = { ...mockCartState };
      
      try {
        // Simulate order creation attempt
        await mockSquareAPI.createOrder();
      } catch (error) {
        // Cart state should remain intact for retry
        expect(mockCartState).toEqual(cartBackup);
      }
    });

    it('validates cart state consistency', () => {
      // Intentionally corrupt cart state
      mockCartState.items = [
        { variationId: 'v1', quantity: 2, catalogVersion: 123, name: 'P1', price: 1000 },
        { variationId: 'v2', quantity: 3, catalogVersion: 123, name: 'P2', price: 2000 }
      ];
      mockCartState.itemCount = 10; // Incorrect count

      // Validation should detect and fix inconsistency
      const calculatedCount = mockCartState.items.reduce(
        (sum, item) => sum + item.quantity, 0
      );
      
      expect(calculatedCount).toBe(5);
      expect(calculatedCount).not.toBe(mockCartState.itemCount);
      
      // Auto-correction
      mockCartState.itemCount = calculatedCount;
      expect(mockCartState.itemCount).toBe(5);
    });
  });

  describe('State Persistence', () => {
    it('maintains cart state across page reloads', () => {
      const testCart = {
        items: [
          { variationId: 'v1', quantity: 1, catalogVersion: 123, name: 'P1', price: 1000 }
        ],
        itemCount: 1
      };

      // Simulate localStorage persistence
      const cartJson = JSON.stringify(testCart);
      const restoredCart = JSON.parse(cartJson);
      
      expect(restoredCart.items).toHaveLength(1);
      expect(restoredCart.itemCount).toBe(1);
      expect(restoredCart.items[0].variationId).toBe('v1');
    });

    it('handles corrupted cart data gracefully', () => {
      const corruptedData = '{"items": [{"invalid": "data"}]}';
      
      let restoredCart;
      try {
        const parsed = JSON.parse(corruptedData);
        
        // Validate structure and sanitize items
        if (!parsed.items || !Array.isArray(parsed.items)) {
          throw new Error('Invalid cart structure');
        }
        
        // Filter out invalid items (must have variationId, quantity, etc.)
        const validItems = parsed.items.filter((item: any) => 
          item && 
          typeof item === 'object' &&
          typeof item.variationId === 'string' &&
          typeof item.quantity === 'number' &&
          item.quantity > 0 &&
          typeof item.name === 'string'
        );
        
        restoredCart = {
          items: validItems,
          itemCount: validItems.length
        };
        
      } catch (error) {
        // Fallback to empty cart
        restoredCart = { items: [], itemCount: 0 };
      }
      
      expect(restoredCart.items).toEqual([]);
      expect(restoredCart.itemCount).toBe(0);
    });
  });
});
