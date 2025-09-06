/**
 * Filter Performance Optimization Tests
 * Phase 1: Verify caching implementation
 * Phase 2: Verify batch inventory integration  
 * Phase 3: Verify request deduplication
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  filterProductsCached, 
  filterProductsWithBatchInventory,
  filterProductsDeduped,
  filterProducts 
} from '../filterUtils';
import { filterCache } from '../cacheUtils';
import type { Product, ProductFilters } from '../types';

// Mock products for testing
const mockProducts: Product[] = [
  {
    id: 'prod1',
    catalogObjectId: 'cat1',
    variationId: 'var1',
    title: 'Test Product 1',
    brand: 'Spitfire',
    description: 'Test description',
    price: 2999, // $29.99 in cents
    image: 'test1.jpg',
    url: '/product/test-product-1',
    variations: []
  },
  {
    id: 'prod2', 
    catalogObjectId: 'cat2',
    variationId: 'var2',
    title: 'Test Product 2',
    brand: 'Independent',
    description: 'Test description',
    price: 3999, // $39.99 in cents
    image: 'test2.jpg',
    url: '/product/test-product-2',
    variations: []
  },
  {
    id: 'prod3',
    catalogObjectId: 'cat3',
    variationId: 'var3', 
    title: 'Test Product 3',
    brand: 'Spitfire',
    description: 'Test description',
    price: 1999, // $19.99 in cents
    image: 'test3.jpg',
    url: '/product/test-product-3',
    variations: []
  }
];

describe('Filter Performance Optimization', () => {
  beforeEach(() => {
    // Clear cache before each test
    filterCache.clear();
    vi.clearAllMocks();
  });

  describe('Phase 1: Filter Result Caching', () => {
    it('should cache filter results on first call', async () => {
      const filters: ProductFilters = { brands: ['Spitfire'] };
      
      // First call - should compute and cache
      const result1 = await filterProductsCached(mockProducts, filters, 'test-category');
      expect(result1).toHaveLength(2); // 2 Spitfire products
      
      // Second call - should return from cache
      const result2 = await filterProductsCached(mockProducts, filters, 'test-category');
      expect(result2).toHaveLength(2);
      expect(result1).toEqual(result2);
    });

    it('should create different cache keys for different filters', async () => {
      const spitfireFilter: ProductFilters = { brands: ['Spitfire'] };
      const independentFilter: ProductFilters = { brands: ['Independent'] };
      
      const result1 = await filterProductsCached(mockProducts, spitfireFilter);
      const result2 = await filterProductsCached(mockProducts, independentFilter);
      
      expect(result1).toHaveLength(2); // Spitfire products
      expect(result2).toHaveLength(1); // Independent products
    });

    it('should create different cache keys for different categories', async () => {
      const filters: ProductFilters = { brands: ['Spitfire'] };
      
      const result1 = await filterProductsCached(mockProducts, filters, 'wheels');
      const result2 = await filterProductsCached(mockProducts, filters, 'bearings');
      
      // Both should work independently even with same filters
      expect(result1).toHaveLength(2);
      expect(result2).toHaveLength(2);
    });
  });

  describe('Phase 2: Batch Inventory Integration', () => {
    it('should handle availability filtering without breaking', async () => {
      const filters: ProductFilters = { 
        brands: ['Spitfire'],
        availability: true 
      };
      
      // Mock the batch inventory service to return all items as in stock
      const { batchInventoryService } = await import('../batchInventory');
      const mockGetBatchInventoryStatus = vi.fn().mockResolvedValue(
        new Map([
          ['cat1', { isOutOfStock: false, hasLimitedOptions: false, totalQuantity: 5, error: false }],
          ['cat3', { isOutOfStock: false, hasLimitedOptions: false, totalQuantity: 3, error: false }]
        ])
      );
      batchInventoryService.getBatchInventoryStatus = mockGetBatchInventoryStatus;
      
      const result = await filterProductsWithBatchInventory(mockProducts, filters);
      
      expect(result).toHaveLength(2); // 2 in-stock Spitfire products
      expect(mockGetBatchInventoryStatus).toHaveBeenCalledWith(['cat1', 'cat3']);
    });

    it('should fallback gracefully on batch inventory errors', async () => {
      const filters: ProductFilters = { 
        brands: ['Spitfire'],
        availability: true 
      };
      
      // Mock batch inventory service to throw error
      const { batchInventoryService } = await import('../batchInventory');
      const mockGetBatchInventoryStatus = vi.fn().mockRejectedValue(new Error('API Error'));
      batchInventoryService.getBatchInventoryStatus = mockGetBatchInventoryStatus;
      
      // Should fallback to original filter logic
      const result = await filterProductsWithBatchInventory(mockProducts, filters);
      
      // Result should still work (fallback behavior)
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('Phase 3: Request Deduplication', () => {
    it('should deduplicate concurrent filter requests', async () => {
      const filters: ProductFilters = { brands: ['Spitfire'] };
      
      // Make multiple concurrent requests
      const promises = [
        filterProductsDeduped(mockProducts, filters, 'test'),
        filterProductsDeduped(mockProducts, filters, 'test'),
        filterProductsDeduped(mockProducts, filters, 'test')
      ];
      
      const results = await Promise.all(promises);
      
      // All should return same result
      results.forEach(result => {
        expect(result).toHaveLength(2);
      });
      
      // All should be identical references (deduplication worked)
      expect(results[0]).toBe(results[1]);
      expect(results[1]).toBe(results[2]);
    });
  });

  describe('Performance Comparison', () => {
    it('should show performance improvement with caching', async () => {
      const filters: ProductFilters = { brands: ['Spitfire'] };
      
      // Time original function
      const start1 = performance.now();
      await filterProducts(mockProducts, filters);
      const duration1 = performance.now() - start1;
      
      // Time cached function (first call - should be similar)
      const start2 = performance.now();
      await filterProductsCached(mockProducts, filters);
      const duration2 = performance.now() - start2;
      
      // Time cached function (second call - should be faster)
      const start3 = performance.now();
      await filterProductsCached(mockProducts, filters);
      const duration3 = performance.now() - start3;
      
      console.log(`Original: ${duration1.toFixed(2)}ms`);
      console.log(`Cached (1st): ${duration2.toFixed(2)}ms`);
      console.log(`Cached (2nd): ${duration3.toFixed(2)}ms`);
      
      // Second cached call should be significantly faster
      expect(duration3).toBeLessThan(duration1);
    });
  });
});
