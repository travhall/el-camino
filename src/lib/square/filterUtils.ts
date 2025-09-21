// src/lib/square/filterUtils.ts - Enhanced with batch inventory optimization
import type {
  Product,
  ProductFilters,
  FilterOptions,
  BrandOption,
} from "./types";
import { createFilterSlug } from "./types";
import { getProductStockStatus } from "./inventory"; // Import individual inventory checking (fallback)
import { batchInventoryService } from "./batchInventory"; // Import batch inventory service
import { filterCache } from "./cacheUtils"; // Import filter cache

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
 * ENHANCED: Now includes batch inventory optimization for availability filtering
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

  // OPTIMIZED: Batch availability filtering
  if (filters.availability === true) {
    const startTime = performance.now();

    try {
      // Extract all variation IDs for batch processing
      const variationIds = filteredProducts
        .map((product) => product.variationId)
        .filter(Boolean); // Remove any undefined/null values

      if (variationIds.length === 0) {
        // No variation IDs to check, return filtered products as-is
        return filteredProducts;
      }

      // Single batch API call instead of individual calls
      const inventoryMap = await batchInventoryService.getBatchInventoryStatus(
        variationIds
      );

      // Filter products based on batch results
      filteredProducts = filteredProducts.filter((product) => {
        if (!product.variationId) {
          // No variation ID - assume in stock (fail-safe behavior)
          return true;
        }

        const inventoryStatus = inventoryMap.get(product.variationId);
        if (!inventoryStatus || inventoryStatus.error) {
          // No status or error - assume in stock (fail-safe behavior)
          return true;
        }

        // Filter out only products that are definitively out of stock
        return !inventoryStatus.isOutOfStock;
      });

      const duration = performance.now() - startTime;
      console.log(
        `[FilterBatch] Batch inventory filter: ${products.length} → ${
          filteredProducts.length
        } products in ${duration.toFixed(2)}ms`
      );
    } catch (error) {
      console.warn(
        "[FilterBatch] Batch inventory failed, falling back to individual checks:",
        error
      );

      // Fallback to individual inventory checks
      const stockChecks = await Promise.all(
        filteredProducts.map(async (product) => {
          try {
            const stockStatus = await getProductStockStatus(product);
            return {
              product,
              isInStock: !stockStatus.isOutOfStock,
            };
          } catch (error) {
            // If individual check fails, assume in stock to avoid hiding products unnecessarily
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
  }

  return filteredProducts;
}

/**
 * Enhanced filter products with caching
 * Phase 1: Cached filter results to eliminate repeated database queries
 * ENHANCED: Now uses batch inventory optimization when cache miss occurs
 */
export async function filterProductsWithCache(
  products: Product[],
  filters: ProductFilters,
  categoryId?: string
): Promise<Product[]> {
  // Create deterministic cache key based on products, filters, and category
  const productIds = products
    .map((p) => p.id)
    .sort()
    .join(",");
  const filterKey = `${categoryId || "all"}-${JSON.stringify(
    filters
  )}-${productIds.slice(0, 50)}`;

  return filterCache.getOrCompute(filterKey, async () => {
    console.log(
      `[FilterCache] Computing filter result for: ${filterKey.slice(0, 100)}...`
    );
    const startTime = performance.now();

    // Use the optimized filterProducts function (now with batch inventory)
    const result = await filterProducts(products, filters);

    const duration = performance.now() - startTime;
    console.log(
      `[FilterCache] Filtered ${products.length} → ${
        result.length
      } products in ${duration.toFixed(2)}ms`
    );

    return result;
  });
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
    availability: availability, // Always boolean (true/false)
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
