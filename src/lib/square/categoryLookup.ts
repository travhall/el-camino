// src/lib/square/categoryLookup.ts - Optimized category lookup utilities

import { categoryCache } from './cacheUtils';
import { requestDeduplicator } from './requestDeduplication';
import type { Category, CategoryHierarchy } from './types';

/**
 * Get single category by slug (optimized lookup)
 * Follows imageUtils.ts single-item pattern
 * 
 * PERFORMANCE: Only fetches hierarchy once, then caches individual lookups
 * Expected improvement: -150ms per category page load
 */
export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  const cacheKey = `category-by-slug:${slug}`;
  
  return requestDeduplicator.dedupe(cacheKey, () =>
    categoryCache.getOrCompute(cacheKey, async () => {
      // Import here to avoid circular dependency
      const { fetchCategoryHierarchy } = await import('./categories');
      const hierarchy = await fetchCategoryHierarchy();
      
      // Search top-level categories
      for (const item of hierarchy) {
        if (item.category.slug === slug) {
          return item.category;
        }
        
        // Search subcategories
        const subcat = item.subcategories.find(sub => sub.slug === slug);
        if (subcat) {
          return subcat;
        }
      }
      
      return null;
    })
  );
}

/**
 * Get category with its immediate subcategories
 * 
 * PERFORMANCE: Cached separately from full hierarchy
 */
export async function getCategoryWithSubcategories(
  categoryId: string
): Promise<CategoryHierarchy | null> {
  const cacheKey = `category-hierarchy:${categoryId}`;
  
  return categoryCache.getOrCompute(cacheKey, async () => {
    const { fetchCategoryHierarchy } = await import('./categories');
    const hierarchy = await fetchCategoryHierarchy();
    
    // Find in top-level hierarchy
    const item = hierarchy.find(h => h.category.id === categoryId);
    if (item) return item;
    
    // Check if it's a subcategory
    for (const parent of hierarchy) {
      const subcat = parent.subcategories.find(s => s.id === categoryId);
      if (subcat) {
        return {
          category: subcat,
          subcategories: [] // Subcategories don't have subcategories
        };
      }
    }
    
    return null;
  });
}

/**
 * Resolve slug path to category and parent
 * Handles both top-level and nested category URLs
 * 
 * @param slugPath - URL slug like "skateboard-decks" or "skateboard-decks/mini-cruisers"
 * @returns { category, parentCategory, subcategories }
 */
export async function resolveCategoryPath(slugPath: string): Promise<{
  category: Category | null;
  parentCategory: Category | null;
  subcategories: Category[];
}> {
  const slugParts = slugPath.split('/');
  
  // Single slug (top-level category)
  if (slugParts.length === 1) {
    const category = await getCategoryBySlug(slugParts[0]);
    if (!category) {
      return { category: null, parentCategory: null, subcategories: [] };
    }
    
    // Get subcategories if this is a top-level category
    const hierarchy = await getCategoryWithSubcategories(category.id);
    const subcategories = hierarchy?.subcategories || [];
    
    return {
      category,
      parentCategory: null,
      subcategories
    };
  }
  
  // Nested slug (parent/child)
  const parentSlug = slugParts[0];
  const categorySlug = slugParts[1];
  
  const [parentCategory, category] = await Promise.all([
    getCategoryBySlug(parentSlug),
    getCategoryBySlug(categorySlug)
  ]);
  
  if (!category) {
    return { category: null, parentCategory: null, subcategories: [] };
  }
  
  return {
    category,
    parentCategory,
    subcategories: [] // Child categories don't have subcategories
  };
}
