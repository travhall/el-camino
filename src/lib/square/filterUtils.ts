// src/lib/square/filterUtils.ts - Enhanced with availability filtering
import type {
  Product,
  ProductFilters,
  FilterOptions,
  BrandOption,
} from "./types";
import { createFilterSlug } from "./types";
import { getProductStockStatus } from "./inventory"; // Import inventory checking
import { filterCache } from "./cacheUtils"; // Phase 1: Import filter cache
import { batchInventoryService } from "./batchInventory"; // Phase 2: Import batch inventory
import { requestDeduplicator } from "./requestDeduplication"; // Phase 3: Import deduplication

/**
 * Extract filter options from product array
 * Follows existing patterns from categories.ts
 */
export function extractFilterOptions(products: Product[]): FilterOptions {
  const brandCounts = new Map<string, number>();

  // Count brands, following existing data processing patterns
  products.forEach((product) => {
    if (product.brand) {
      brandCounts.set(product.brand, (brandCounts.get(product.brand) || 0) + 1);
    }
  });

  // Convert to sorted brand options
  const brands: BrandOption[] = Array.from(brandCounts.entries())
    .map(([name, count]) => ({
      name,
      count,
      slug: createFilterSlug(name),
    }))
    .sort((a, b) => b.count - a.count); // Sort by popularity

  return { brands };
}

/**
 * Filter products based on active filters
 * ENHANCED: Now includes availability filtering
 */
export async function filterProducts(
  products: Product[],
  filters: ProductFilters
): Promise<Product[]> {
  let filteredProducts = products;

  // Brand filtering
  if (filters.brands.length > 0) {
    filteredProducts = filteredProducts.filter((product) => {
      if (!product.brand) return false;
      return filters.brands.includes(product.brand);
    });
  }

  // Availability filtering - NEW
  if (filters.availability === true) {
    // Use Promise.all to check stock status for all products in parallel
    const stockChecks = await Promise.all(
      filteredProducts.map(async (product) => {
        try {
          const stockStatus = await getProductStockStatus(product);
          return {
            product,
            isInStock: !stockStatus.isOutOfStock,
          };
        } catch (error) {
          // If stock check fails, assume in stock to avoid hiding products unnecessarily
          return {
            product,
            isInStock: true,
          };
        }
      })
    );

    // Filter to only in-stock products
    filteredProducts = stockChecks
      .filter(({ isInStock }) => isInStock)
      .map(({ product }) => product);
  }

  return filteredProducts;
}

/**
 * Enhanced filter products with caching and batch inventory
 * PHASE 1: Cached filter results to eliminate repeated database queries
 * PHASE 2: Batch inventory service integration for availability filtering
 * PHASE 3: Request deduplication for concurrent users
 */
export async function filterProductsCached(
  products: Product[],
  filters: ProductFilters,
  categoryId?: string
): Promise<Product[]> {
  // Create deterministic cache key
  const filterKey = `${categoryId || 'all'}-${JSON.stringify(filters)}`;
  
  return filterCache.getOrCompute(filterKey, async () => {
    console.log(`[FilterCache] Computing filter result for: ${filterKey}`);
    const startTime = performance.now();
    
    // Use enhanced filtering with batch inventory
    const result = await filterProductsWithBatchInventory(products, filters);
    
    const duration = performance.now() - startTime;
    console.log(`[FilterCache] Filtered ${products.length} → ${result.length} products in ${duration.toFixed(2)}ms`);
    
    return result;
  });
}

/**
 * Enhanced filter products using batch inventory service
 * PHASE 2: Replaces individual inventory calls with efficient batching
 */
export async function filterProductsWithBatchInventory(
  products: Product[],
  filters: ProductFilters
): Promise<Product[]> {
  let filteredProducts = products;

  // Brand filtering (fast, no API calls)
  if (filters.brands.length > 0) {
    filteredProducts = filteredProducts.filter((product) => {
      if (!product.brand) return false;
      return filters.brands.includes(product.brand);
    });
  }

  // Availability filtering using existing batch service
  if (filters.availability === true) {
    const catalogObjectIds = filteredProducts.map(p => p.catalogObjectId);
    
    if (catalogObjectIds.length > 0) {
      try {
        // Use existing batchInventoryService with request deduplication
        const inventoryMap = await batchInventoryService.getBatchInventoryStatus(catalogObjectIds);
        
        filteredProducts = filteredProducts.filter(product => {
          const status = inventoryMap.get(product.catalogObjectId);
          return status && !status.isOutOfStock;
        });
        
        console.log(`[FilterBatch] Batch inventory check: ${catalogObjectIds.length} → ${filteredProducts.length} in stock`);
      } catch (error) {
        console.error('[FilterBatch] Batch inventory failed, falling back to individual checks:', error);
        // Fallback to original individual inventory checks
        return filterProducts(products, filters);
      }
    }
  }

  return filteredProducts;
}

/**
 * Filter products with request deduplication for concurrent users
 * PHASE 3: Prevents duplicate filter operations when multiple users filter simultaneously
 */
export async function filterProductsDeduped(
  products: Product[],
  filters: ProductFilters,
  categoryId?: string
): Promise<Product[]> {
  // Create deterministic key for deduplication
  const dedupeKey = `filter-${categoryId || 'all'}-${JSON.stringify(filters)}`;
  
  return requestDeduplicator.dedupe(dedupeKey, () => 
    filterProductsCached(products, filters, categoryId)
  );
}

/**
 * Parse filters from URL search params
 * ENHANCED: Now handles availability parameter
 */
export function parseFiltersFromURL(
  searchParams: URLSearchParams
): ProductFilters {
  // Use getAll() to handle multiple brand parameters: ?brands=A&brands=B
  const brands = searchParams.getAll("brands").filter(Boolean);

  // Parse availability parameter
  const availability = searchParams.get("availability") === "true";

  return {
    brands,
    availability: availability || undefined, // Only include if true
  };
}

/**
 * Convert filters to URL search params
 * ENHANCED: Now includes availability parameter
 */
export function filtersToURLParams(filters: ProductFilters): URLSearchParams {
  const params = new URLSearchParams();

  // Use append() to create multiple parameters: ?brands=A&brands=B
  if (filters.brands.length > 0) {
    filters.brands.forEach((brand) => {
      params.append("brands", brand);
    });
  }

  // Add availability parameter
  if (filters.availability === true) {
    params.set("availability", "true");
  }

  return params;
}

export function updateURLWithFilters(filters: ProductFilters): void {
  const params = filtersToURLParams(filters);
  const newURL = `${window.location.pathname}${
    params.toString() ? "?" + params.toString() : ""
  }`;
  window.history.pushState({}, "", newURL);
}

/**
 * Get active filters count for UI badges
 * ENHANCED: Now includes availability filter
 */
export function getActiveFiltersCount(filters: ProductFilters): number {
  return filters.brands.length + (filters.availability ? 1 : 0);
}

/**
 * Check if any filters are active
 * ENHANCED: Now includes availability filter
 */
export function hasActiveFilters(filters: ProductFilters): boolean {
  return filters.brands.length > 0 || filters.availability === true;
}

/**
 * Clear all filters
 */
export function clearAllFilters(): ProductFilters {
  return { brands: [] };
}

/**
 * Add brand to active filters
 */
export function addBrandFilter(
  filters: ProductFilters,
  brand: string
): ProductFilters {
  if (filters.brands.includes(brand)) return filters;

  return {
    ...filters,
    brands: [...filters.brands, brand].sort(),
  };
}

/**
 * Remove brand from active filters
 */
export function removeBrandFilter(
  filters: ProductFilters,
  brand: string
): ProductFilters {
  return {
    ...filters,
    brands: filters.brands.filter((b) => b !== brand),
  };
}

/**
 * Toggle brand filter on/off
 */
export function toggleBrandFilter(
  filters: ProductFilters,
  brand: string
): ProductFilters {
  return filters.brands.includes(brand)
    ? removeBrandFilter(filters, brand)
    : addBrandFilter(filters, brand);
}

import type { ParsedURLParams } from "./types";

/**
 * Parse both pagination and filter parameters from URL
 */
export function parseURLParams(searchParams: URLSearchParams): ParsedURLParams {
  const filters = parseFiltersFromURL(searchParams);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSize = Math.max(
    12,
    Math.min(96, parseInt(searchParams.get("pageSize") || "24", 10))
  );

  return {
    filters,
    page,
    pageSize,
  };
}

/**
 * Build URL with pagination and filter parameters
 * ENHANCED: Now includes availability parameter
 */
export function buildPaginatedURL(
  basePath: string,
  filters: ProductFilters,
  page: number,
  pageSize: number = 24
): string {
  const params = new URLSearchParams();

  // Add filter parameters using append() for multiple brands: ?brands=A&brands=B
  if (filters.brands.length > 0) {
    filters.brands.forEach((brand) => {
      params.append("brands", brand);
    });
  }

  // Add availability parameter
  if (filters.availability === true) {
    params.set("availability", "true");
  }

  // Add pagination parameters
  if (page > 1) {
    params.set("page", page.toString());
  }

  if (pageSize !== 24) {
    params.set("pageSize", pageSize.toString());
  }

  const queryString = params.toString();
  return `${basePath}${queryString ? "?" + queryString : ""}`;
}

export function updateURLWithFiltersResetPage(filters: ProductFilters): void {
  const currentParams = new URLSearchParams(window.location.search);
  const pageSize = parseInt(currentParams.get("pageSize") || "24", 10);

  const newURL = buildPaginatedURL(
    window.location.pathname,
    filters,
    1,
    pageSize
  );
  window.history.pushState({}, "", newURL);
}
