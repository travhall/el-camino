// src/lib/square/categoryLookup.ts - Optimized category lookup utilities

import { categoryCache } from './cacheUtils';
import { requestDeduplicator } from './requestDeduplication';
import type { Category, CategoryHierarchy } from './types';

/**
 * Invalidate category-related cache entries
 * Used when encountering 404s due to eventual consistency
 */
async function invalidateCategoryCache(slug?: string): Promise<void> {
  if (slug) {
    const cacheKey = `category-by-slug:${slug}`;
    await (categoryCache as any).delete?.(cacheKey);
  }
  // Clear the main navigation cache to force fresh fetch
  await (categoryCache as any).delete?.('nav-hierarchy');
  await (categoryCache as any).delete?.('hierarchy-with-products');
}

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
      
      console.log(`[CategoryLookup] Searching for slug: "${slug}"`);
      
      // Search top-level categories
      for (const item of hierarchy) {
        if (item.category.slug === slug) {
          console.log(`[CategoryLookup] ✅ Found top-level category: ${item.category.name} (ID: ${item.category.id})`);
          return item.category;
        }
        
        // Search subcategories
        const subcat = item.subcategories.find(sub => sub.slug === slug);
        if (subcat) {
          console.log(`[CategoryLookup] ✅ Found subcategory: ${subcat.name} (ID: ${subcat.id}) under ${item.category.name}`);
          return subcat;
        }
      }
      
      console.warn(`[CategoryLookup] ❌ No category found for slug: "${slug}"`);
      console.log(`[CategoryLookup] Available slugs:`, 
        hierarchy.flatMap(h => [h.category.slug, ...h.subcategories.map(s => s.slug)]).join(', ')
      );
      
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


/**
 * Resolve category path with retry and cache invalidation
 * Handles Netlify Blobs eventual consistency by retrying with cache invalidation
 * 
 * @param slugPath - URL slug to resolve
 * @param maxRetries - Maximum retry attempts (default: 2)
 * @returns Category resolution result or null after retries
 */
export async function resolveCategoryPathWithRetry(
  slugPath: string,
  maxRetries: number = 2
): Promise<{
  category: Category | null;
  parentCategory: Category | null;
  subcategories: Category[];
}> {
  let attempt = 0;
  
  while (attempt <= maxRetries) {
    const result = await resolveCategoryPath(slugPath);
    
    // Success case - category found
    if (result.category) {
      if (attempt > 0) {
        console.log(`[CategoryLookup] ✅ Found category "${slugPath}" after ${attempt} retries`);
      }
      return result;
    }
    
    // Last attempt - give up
    if (attempt === maxRetries) {
      console.warn(`[CategoryLookup] ❌ Category "${slugPath}" not found after ${maxRetries} retries`);
      return result;
    }
    
    // Retry with cache invalidation
    attempt++;
    console.log(`[CategoryLookup] 🔄 Retry ${attempt}/${maxRetries} for "${slugPath}" - invalidating cache`);
    
    const slugParts = slugPath.split('/');
    await Promise.all(
      slugParts.map(slug => invalidateCategoryCache(slug))
    );
    
    // Brief delay to allow cache propagation
    await new Promise(resolve => setTimeout(resolve, 100 * attempt));
  }
  
  // Should never reach here, but TypeScript requires it
  return { category: null, parentCategory: null, subcategories: [] };
}
