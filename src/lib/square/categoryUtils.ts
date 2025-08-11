// src/lib/square/categoryUtils.ts - Category filtering and product count utilities

import { squareClient } from "./client";
import { categoryCache } from "./cacheUtils";
import type { Category, CategoryHierarchy } from "./types";
import { processSquareError, handleError } from "./errorUtils";
import { requestDeduplicator } from './requestDeduplication';

/**
 * Check if a category has any products (regardless of stock status)
 * Uses caching and request deduplication for performance
 */
export async function categoryHasProducts(categoryId: string): Promise<boolean> {
  const cacheKey = `category-has-products:${categoryId}`;
  
  return requestDeduplicator.dedupe(cacheKey, () =>
    categoryCache.getOrCompute(cacheKey, async () => {
      try {
        // Use Square's search API to check for products in this category
        const { result } = await squareClient.catalogApi.searchCatalogItems({
          categoryIds: [categoryId],
          limit: 1, // We only need to know if ANY exist
        });

        // Return true if we found any items
        return !!(result?.items?.length);
      } catch (error) {
        const appError = processSquareError(
          error,
          `categoryHasProducts:${categoryId}`
        );
        // On error, default to showing the category (fail gracefully)
        return handleError<boolean>(appError, true);
      }
    })
  );
}

/**
 * Batch check multiple categories for products
 * More efficient than individual calls for navigation
 */
export async function batchCheckCategoriesHaveProducts(
  categoryIds: string[]
): Promise<Record<string, boolean>> {
  const cacheKey = `batch-category-check:${categoryIds.sort().join(',')}`;
  
  return requestDeduplicator.dedupe(cacheKey, async () => {
    const result: Record<string, boolean> = {};
    const idsToCheck: string[] = [];

    // Check cache first
    for (const categoryId of categoryIds) {
      const cached = categoryCache.get(`category-has-products:${categoryId}`);
      if (cached !== undefined) {
        result[categoryId] = cached;
      } else {
        idsToCheck.push(categoryId);
      }
    }

    // Batch check remaining categories
    if (idsToCheck.length > 0) {
      try {
        // Process in parallel but limit concurrency for API stability
        const batchSize = 5;
        const batches = [];
        
        for (let i = 0; i < idsToCheck.length; i += batchSize) {
          const batchIds = idsToCheck.slice(i, i + batchSize);
          batches.push(batchIds);
        }

        const batchResults = await Promise.all(
          batches.map(async (batchIds) => {
            const batchResult: Record<string, boolean> = {};
            
            // Check each category in the batch
            await Promise.all(
              batchIds.map(async (categoryId) => {
                try {
                  const { result: searchResult } = await squareClient.catalogApi.searchCatalogItems({
                    categoryIds: [categoryId],
                    limit: 1,
                  });
                  
                  const hasProducts = !!(searchResult?.items?.length);
                  batchResult[categoryId] = hasProducts;
                  
                  // Cache individual results
                  categoryCache.set(`category-has-products:${categoryId}`, hasProducts);
                } catch (error) {
                  // On error, default to showing category
                  batchResult[categoryId] = true;
                  categoryCache.set(`category-has-products:${categoryId}`, true);
                }
              })
            );
            
            return batchResult;
          })
        );

        // Merge batch results
        for (const batchResult of batchResults) {
          Object.assign(result, batchResult);
        }
      } catch (error) {
        const appError = processSquareError(error, "batchCheckCategoriesHaveProducts");
        handleError(appError, null);
        
        // On batch error, default all remaining to true
        for (const categoryId of idsToCheck) {
          result[categoryId] = true;
        }
      }
    }

    return result;
  });
}

/**
 * Filter category hierarchy to only show categories with products
 * Maintains Square's ordinal ordering
 */
export async function filterCategoryHierarchyWithProducts(
  hierarchy: CategoryHierarchy[]
): Promise<CategoryHierarchy[]> {
  if (!hierarchy.length) return [];

  // Extract all category IDs for batch checking
  const allCategoryIds = new Set<string>();
  
  hierarchy.forEach(item => {
    allCategoryIds.add(item.category.id);
    item.subcategories.forEach(sub => allCategoryIds.add(sub.id));
  });

  // Batch check all categories
  const categoryProductMap = await batchCheckCategoriesHaveProducts(
    Array.from(allCategoryIds)
  );

  // Filter hierarchy maintaining structure
  const filteredHierarchy: CategoryHierarchy[] = [];

  for (const item of hierarchy) {
    // Check if main category or any subcategories have products
    const mainCategoryHasProducts = categoryProductMap[item.category.id];
    const subcategoriesWithProducts = item.subcategories.filter(
      sub => categoryProductMap[sub.id]
    );

    // Include category if:
    // 1. Main category has products, OR
    // 2. Any subcategory has products
    if (mainCategoryHasProducts || subcategoriesWithProducts.length > 0) {
      filteredHierarchy.push({
        category: item.category,
        subcategories: subcategoriesWithProducts, // Only include subcategories with products
      });
    }
  }

  // Debug logging
  if (import.meta.env.DEV) {
    const removedCategories = hierarchy.length - filteredHierarchy.length;
    if (removedCategories > 0) {
      console.log(`[CategoryFilter] Filtered out ${removedCategories} empty categories`);
    }
  }

  return filteredHierarchy;
}

/**
 * Enhanced category hierarchy fetch with product filtering
 * For use in navigation components
 */
export async function fetchCategoryHierarchyWithProducts(): Promise<CategoryHierarchy[]> {
  return categoryCache.getOrCompute("hierarchy-with-products", async () => {
    try {
      // Import here to avoid circular dependency
      const { fetchCategoryHierarchy } = await import("./categories");
      
      // Get full hierarchy first
      const fullHierarchy = await fetchCategoryHierarchy();
      
      // Filter to only categories with products
      const filteredHierarchy = await filterCategoryHierarchyWithProducts(fullHierarchy);
      
      // Sort by Square's ordinal system (maintained from original fetch)
      // The original hierarchy is already sorted by ordinals, so we preserve that order
      
      console.log(
        `[CategoryFilter] Showing ${filteredHierarchy.length} categories with products`
      );
      
      return filteredHierarchy;
    } catch (error) {
      const appError = processSquareError(error, "fetchCategoryHierarchyWithProducts");
      return handleError<CategoryHierarchy[]>(appError, []);
    }
  });
}

/**
 * Clear category product count cache
 * Call when inventory changes significantly
 */
export function clearCategoryProductCache(): void {
  // Clear all category-related cache entries
  const cache = categoryCache as any;
  if (cache.cache) {
    const keysToDelete = [];
    for (const key of cache.cache.keys()) {
      if (key.includes('category-has-products') || 
          key.includes('batch-category-check') || 
          key === 'hierarchy-with-products') {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => cache.cache.delete(key));
  }
  
  console.log('[CategoryFilter] Cleared category product cache');
}

/**
 * Get categories for sidebar with products and optimal sorting
 * Includes fallback sorting strategies
 */
export async function getCategoriesForSidebar(): Promise<Array<{
  category: string;
  url: string;
  src: string;
  id: string;
}>> {
  try {
    const hierarchyWithProducts = await fetchCategoryHierarchyWithProducts();
    
    // Transform to sidebar format
    const categoriesWithImages = hierarchyWithProducts.map((item) => ({
      category: item.category.name,
      url: `/category/${item.category.slug}`,
      src: `/images/category-${item.category.slug}.png`, // Will be enhanced by existing image logic
      id: item.category.id,
      rawOrder: (item.category as any).rawOrder || 999, // For sorting fallback
    }));

    // Sort by Square's ordinal order, fallback to alphabetical
    categoriesWithImages.sort((a, b) => {
      const orderA = a.rawOrder;
      const orderB = b.rawOrder;

      // If ordinals are the same or missing, use alphabetical
      if (orderA === orderB) {
        return a.category.localeCompare(b.category);
      }

      return orderA - orderB;
    });

    // Remove rawOrder from final result
    return categoriesWithImages.map(({ rawOrder, ...item }) => item);
  } catch (error) {
    const appError = processSquareError(error, "getCategoriesForSidebar");
    return handleError<Array<{
      category: string;
      url: string;
      src: string;
      id: string;
    }>>(appError, []);
  }
}