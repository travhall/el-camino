// src/lib/square/filterUtils.ts - Enhanced with availability filtering
import type {
  Product,
  ProductFilters,
  FilterOptions,
  BrandOption,
} from "./types";
import { createFilterSlug } from "./types";
import { getProductStockStatus } from "./inventory"; // Import inventory checking
import { getNavigationManager } from "@/lib/navigation/NavigationManager";

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

/**
 * Update URL with new filters
 * Follows existing navigation patterns with NavigationManager coordination
 */
export function updateURLWithFilters(filters: ProductFilters): void {
  const params = filtersToURLParams(filters);
  const newURL = `${window.location.pathname}${
    params.toString() ? "?" + params.toString() : ""
  }`;

  // Use navigation manager for coordinated URL updates
  const navManager = getNavigationManager();
  if (navManager?.isEnabled()) {
    navManager.updateURL(newURL, false);
  } else {
    // Fallback to direct pushState when navigation manager unavailable
    window.history.pushState({}, "", newURL);
  }
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

/**
 * Navigate to page 1 when filters change (standard UX pattern)
 * Uses NavigationManager for coordinated navigation
 */
export function updateURLWithFiltersResetPage(filters: ProductFilters): void {
  const currentParams = new URLSearchParams(window.location.search);
  const pageSize = parseInt(currentParams.get("pageSize") || "24", 10);

  const newURL = buildPaginatedURL(
    window.location.pathname,
    filters,
    1, // Always reset to page 1 when filters change
    pageSize
  );

  // Use navigation manager for coordinated URL updates
  const navManager = getNavigationManager();
  if (navManager?.isEnabled()) {
    navManager.updateURL(newURL, false);
  } else {
    // Fallback to direct pushState when navigation manager unavailable
    window.history.pushState({}, "", newURL);
  }
}
