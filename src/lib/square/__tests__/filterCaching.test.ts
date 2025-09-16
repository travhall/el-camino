import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  filterProducts,
  filterProductsWithCache 
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
    price: 2999,
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
    price: 3999,
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
    price: 1999,
    image: 'test3.jpg',
    url: '/product/test-product-3',
    variations: []
  }
];

describe('Cached Filter Functionality', () => {
  beforeEach(() => {
    // Clear cache before each test
    filterCache.clear();
    vi.clearAllMocks();
  });

  describe('Cache Performance', () => {
    it('should use cache on repeated calls with same parameters', async () => {
      const filters: ProductFilters = { brands: ['Spitfire'] };
      
      // First call - should compute and cache
      const result1 = await filterProductsWithCache(mockProducts, filters, 'test-category');
      expect(result1).toHaveLength(2); // 2 Spitfire products
      
      // Second call - should return from cache (faster)
      const start = performance.now();
      const result2 = await filterProductsWithCache(mockProducts, filters, 'test-category');
      const duration = performance.now() - start;
      
      expect(result2).toHaveLength(2);
      expect(result1).toEqual(result2);
      // Cache hit should be very fast (< 1ms)
      expect(duration).toBeLessThan(1);
    });

    it('should create different cache keys for different filters', async () => {
      const spitfireFilter: ProductFilters = { brands: ['Spitfire'] };
      const independentFilter: ProductFilters = { brands: ['Independent'] };
      
      const result1 = await filterProductsWithCache(mockProducts, spitfireFilter, 'wheels');
      const result2 = await filterProductsWithCache(mockProducts, independentFilter, 'wheels');
      
      expect(result1).toHaveLength(2); // Spitfire products
      expect(result2).toHaveLength(1); // Independent products
    });

    it('should create different cache keys for different categories', async () => {
      const filters: ProductFilters = { brands: ['Spitfire'] };
      
      const result1 = await filterProductsWithCache(mockProducts, filters, 'wheels');
      const result2 = await filterProductsWithCache(mockProducts, filters, 'bearings');
      
      // Both should work independently
      expect(result1).toHaveLength(2);
      expect(result2).toHaveLength(2);
    });
  });

  describe('Functional Equivalence', () => {
    it('should produce identical results to basic filterProducts', async () => {
      const filters: ProductFilters = { brands: ['Spitfire'] };
      
      const basicResult = await filterProducts(mockProducts, filters);
      const cachedResult = await filterProductsWithCache(mockProducts, filters);
      
      expect(cachedResult).toEqual(basicResult);
    });

    it('should handle empty filters correctly', async () => {
      const filters: ProductFilters = { brands: [] };
      
      const basicResult = await filterProducts(mockProducts, filters);
      const cachedResult = await filterProductsWithCache(mockProducts, filters);
      
      expect(cachedResult).toEqual(basicResult);
      expect(cachedResult).toHaveLength(3); // All products
    });

    it('should handle availability filtering', async () => {
      const filters: ProductFilters = { 
        brands: ['Spitfire'],
        availability: true 
      };
      
      const basicResult = await filterProducts(mockProducts, filters);
      const cachedResult = await filterProductsWithCache(mockProducts, filters);
      
      expect(cachedResult).toEqual(basicResult);
    });
  });
});
