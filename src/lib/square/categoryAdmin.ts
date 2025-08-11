// src/lib/square/categoryAdmin.ts - Admin utilities for category management

import { clearCategoryProductCache, fetchCategoryHierarchyWithProducts } from "./categoryUtils";
import { categoryCache } from "./cacheUtils";

/**
 * Force refresh category cache and return updated hierarchy
 * Useful for testing and admin operations
 */
export async function refreshCategoryCache(): Promise<{
  success: boolean;
  message: string;
  categoriesShown: number;
  categoriesHidden: number;
}> {
  try {
    // Clear all category-related caches
    clearCategoryProductCache();
    categoryCache.clear();
    
    // Fetch fresh data
    const { fetchCategoryHierarchy } = await import("./categories");
    const fullHierarchy = await fetchCategoryHierarchy();
    const filteredHierarchy = await fetchCategoryHierarchyWithProducts();
    
    const categoriesShown = filteredHierarchy.length;
    const categoriesHidden = fullHierarchy.length - categoriesShown;
    
    return {
      success: true,
      message: `Cache refreshed successfully`,
      categoriesShown,
      categoriesHidden,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to refresh cache: ${error}`,
      categoriesShown: 0,
      categoriesHidden: 0,
    };
  }
}

/**
 * Get category status report for debugging
 */
export async function getCategoryStatusReport(): Promise<{
  allCategories: Array<{ name: string; id: string; hasProducts: boolean }>;
  visibleCategories: string[];
  hiddenCategories: string[];
}> {
  try {
    const { fetchCategoryHierarchy } = await import("./categories");
    const { batchCheckCategoriesHaveProducts } = await import("./categoryUtils");
    
    const fullHierarchy = await fetchCategoryHierarchy();
    const allCategoryIds = fullHierarchy.map(item => item.category.id);
    const productMap = await batchCheckCategoriesHaveProducts(allCategoryIds);
    
    const allCategories = fullHierarchy.map(item => ({
      name: item.category.name,
      id: item.category.id,
      hasProducts: productMap[item.category.id] || false,
    }));
    
    const visibleCategories = allCategories
      .filter(cat => cat.hasProducts)
      .map(cat => cat.name);
      
    const hiddenCategories = allCategories
      .filter(cat => !cat.hasProducts)
      .map(cat => cat.name);
    
    return {
      allCategories,
      visibleCategories,
      hiddenCategories,
    };
  } catch (error) {
    console.error("Failed to generate category status report:", error);
    return {
      allCategories: [],
      visibleCategories: [],
      hiddenCategories: [],
    };
  }
}
