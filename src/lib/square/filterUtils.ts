// src/lib/square/filterUtils.ts - Fixed pagination/filtering URL parameter handling
import type {
  Product,
  ProductFilters,
  FilterOptions,
  BrandOption,
} from "./types";
import { createFilterSlug } from "./types";

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
 * Pure function - no side effects
 */
export function filterProducts(
  products: Product[],
  filters: ProductFilters
): Product[] {
  return products.filter((product) => {
    // Brand filtering
    if (filters.brands.length > 0) {
      if (!product.brand) return false;
      return filters.brands.includes(product.brand);
    }

    return true;
  });
}

/**
 * Parse filters from URL search params
 * Updated to handle multiple brand parameters from HTML forms
 */
export function parseFiltersFromURL(
  searchParams: URLSearchParams
): ProductFilters {
  // Use getAll() to handle multiple brand parameters: ?brands=A&brands=B
  const brands = searchParams.getAll("brands").filter(Boolean);

  return { brands };
}

/**
 * Convert filters to URL search params
 * FIXED: Now creates multiple parameters instead of comma-separated
 */
export function filtersToURLParams(filters: ProductFilters): URLSearchParams {
  const params = new URLSearchParams();

  // Use append() to create multiple parameters: ?brands=A&brands=B
  if (filters.brands.length > 0) {
    filters.brands.forEach((brand) => {
      params.append("brands", brand);
    });
  }

  return params;
}

/**
 * Update URL with new filters
 * Follows existing navigation patterns
 */
export function updateURLWithFilters(filters: ProductFilters): void {
  const params = filtersToURLParams(filters);
  const newURL = `${window.location.pathname}${params.toString() ? "?" + params.toString() : ""}`;

  // Use pushState for bookmarkable URLs
  window.history.pushState({}, "", newURL);
}

/**
 * Get active filters count for UI badges
 */
export function getActiveFiltersCount(filters: ProductFilters): number {
  return filters.brands.length;
}

/**
 * Check if any filters are active
 */
export function hasActiveFilters(filters: ProductFilters): boolean {
  return filters.brands.length > 0;
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
 * FIXED: Now creates multiple brand parameters instead of comma-separated
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

  window.history.pushState({}, "", newURL);
}
