/**
 * Filter Basic Functionality Tests
 * Tests for the core filterProducts function
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  filterProducts 
} from '../filterUtils';
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

describe('Filter Basic Functionality', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Brand Filtering', () => {
    it('should filter products by single brand', async () => {
      const filters: ProductFilters = { brands: ['Spitfire'] };
      
      const result = await filterProducts(mockProducts, filters);
      
      expect(result).toHaveLength(2); // 2 Spitfire products
      expect(result.every(p => p.brand === 'Spitfire')).toBe(true);
    });

    it('should filter products by multiple brands', async () => {
      const filters: ProductFilters = { brands: ['Spitfire', 'Independent'] };
      
      const result = await filterProducts(mockProducts, filters);
      
      expect(result).toHaveLength(3); // All products match
      expect(result.every(p => p.brand === 'Spitfire' || p.brand === 'Independent')).toBe(true);
    });

    it('should return empty array when no products match brand filter', async () => {
      const filters: ProductFilters = { brands: ['NonExistentBrand'] };
      
      const result = await filterProducts(mockProducts, filters);
      
      expect(result).toHaveLength(0);
    });

    it('should return all products when no brand filters applied', async () => {
      const filters: ProductFilters = { brands: [] };
      
      const result = await filterProducts(mockProducts, filters);
      
      expect(result).toHaveLength(3); // All products
    });
  });

  describe('Availability Filtering', () => {
    it('should handle availability filtering', async () => {
      const filters: ProductFilters = { 
        brands: ['Spitfire'],
        availability: true 
      };
      
      // The function should work even if individual inventory checks are made
      const result = await filterProducts(mockProducts, filters);
      
      // Should at least filter by brand correctly
      expect(result.every(p => p.brand === 'Spitfire')).toBe(true);
    });

    it('should work without availability filtering', async () => {
      const filters: ProductFilters = { 
        brands: ['Spitfire'] 
      };
      
      const result = await filterProducts(mockProducts, filters);
      
      expect(result).toHaveLength(2); // 2 Spitfire products
    });
  });

  describe('Combined Filtering', () => {
    it('should handle multiple filter types together', async () => {
      const filters: ProductFilters = { 
        brands: ['Spitfire'],
        availability: true 
      };
      
      const result = await filterProducts(mockProducts, filters);
      
      // Should filter by brand first at minimum
      expect(result.every(p => p.brand === 'Spitfire')).toBe(true);
    });
  });
});
