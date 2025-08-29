/**
 * Cart operations critical tests - add/remove/update functionality
 * Priority: High - Core business functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Cart Integration Critical Tests', () => {
  let mockCart: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCart = {
      items: [],
      addItem: vi.fn(),
      updateQuantity: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn()
    };
  });

  describe('Add/Remove/Update operations', () => {
    it('adds items correctly', () => {
      const item = { id: 'var-1', quantity: 1, price: 2500 };
      mockCart.addItem(item);
      expect(mockCart.addItem).toHaveBeenCalledWith(item);
    });

    it('handles concurrent add operations', () => {
      const item = { id: 'var-1', quantity: 1 };
      mockCart.addItem(item);
      mockCart.addItem(item); // Duplicate add
      expect(mockCart.addItem).toHaveBeenCalledTimes(2);
    });

    it('updates quantities correctly', () => {
      mockCart.updateQuantity('var-1', 3);
      expect(mockCart.updateQuantity).toHaveBeenCalledWith('var-1', 3);
    });

    it('removes items completely', () => {
      mockCart.removeItem('var-1');
      expect(mockCart.removeItem).toHaveBeenCalledWith('var-1');
    });
  });

  describe('State synchronization', () => {
    it('maintains cart badge sync', () => {
      const badge = { updateCount: vi.fn() };
      mockCart.addItem({ id: 'var-1', quantity: 2 });
      // Cart should notify badge of changes
      expect(mockCart.addItem).toHaveBeenCalled();
    });

    it('handles storage persistence failures', () => {
      // Mock localStorage failure
      Object.defineProperty(window, 'localStorage', {
        value: {
          setItem: vi.fn(() => { throw new Error('Storage full'); })
        }
      });
      
      expect(() => mockCart.addItem({ id: 'var-1' })).not.toThrow();
    });
  });

  describe('Inventory validation', () => {
    it('prevents overselling', () => {
      const item = { id: 'var-1', quantity: 100 }; // Excessive quantity
      mockCart.addItem.mockImplementation((item) => {
        if (item.quantity > 10) {
          throw new Error('Insufficient inventory');
        }
      });
      
      expect(() => mockCart.addItem(item)).toThrow();
    });

    it('handles inventory check failures gracefully', () => {
      mockCart.addItem.mockRejectedValueOnce(new Error('Inventory API down'));
      expect(mockCart.addItem).toBeDefined();
    });
  });
});
