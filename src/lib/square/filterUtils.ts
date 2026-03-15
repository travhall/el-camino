// src/lib/square/filterUtils.ts - Enhanced with batch inventory optimization
import type {
  Product,
  ProductFilters,
  FilterOptions,
  BrandOption,
  CategoryFilterOption,
  CategoryFilterSubOption,
} from "./types";
import { createFilterSlug } from "./types";
import { getProductStockStatus } from "./inventory"; // Import individual inventory checking (fallback)
import { batchInventoryService } from "./batchInventory"; // Import batch inventory service
import { filterCache } from "./cacheUtils"; // Import filter cache
import { fetchCategoryHierarchy } from "./categories";

/**
 * Extract filter options from product array
 * Follows existing patterns from categories.ts
 */
export async function extractFilterOptions(products: Product[]): Promise<FilterOptions> {
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

  // Fetch category hierarchy and build filter options
  let categories: CategoryFilterOption[] = [];
  try {
    const hierarchy = await fetchCategoryHierarchy();

    // Build a set of all category IDs present in current product set
    const productCategoryIds = new Set<string>();
    products.forEach((p) => {
      p.categories?.forEach((id) => productCategoryIds.add(id));
    });

    categories = hierarchy
      .map((h) => {
        const subcategoryIds = new Set(h.subcategories.map((s) => s.id));

        const subcategoryOptions: CategoryFilterSubOption[] = h.subcategories
          .map((sub) => {
            const count = products.filter((p) =>
              p.categories?.includes(sub.id)
            ).length;
            return { id: sub.id, name: sub.name, slug: sub.slug, count };
          })
          .filter((s) => s.count > 0)
          .sort((a, b) => b.count - a.count);

        // Use a Set to deduplicate — products in Square are typically tagged to
        // both the parent category AND a subcategory, so a naive sum double-counts.
        const matchingIds = new Set<string>();
        products.forEach((p) => {
          if (
            p.categories?.includes(h.category.id) ||
            p.categories?.some((id) => subcategoryIds.has(id))
          ) {
            matchingIds.add(p.id);
          }
        });
        const totalCount = matchingIds.size;

        return {
          id: h.category.id,
          name: h.category.name,
          slug: h.category.slug,
          count: totalCount,
          subcategories: subcategoryOptions,
        };
      })
      .filter((c) => c.count > 0 || c.subcategories.length > 0);
  } catch (error) {
    console.warn("[filterUtils] Could not fetch category hierarchy:", error);
    // Graceful degradation — return brands only
  }

  return { brands, categories };
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

  // Category filtering
  if (filters.categories.length > 0) {
    filteredProducts = filteredProducts.filter((product) => {
      if (!product.categories?.length) return false;
      // Product matches if it belongs to ANY of the selected category IDs
      return filters.categories.some((catId) => product.categories!.includes(catId));
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
      const inventoryMap =
        await batchInventoryService.getBatchInventoryStatus(variationIds);

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
  const productFingerprint = `${products.length}-${products[0]?.id || ""}-${products[products.length - 1]?.id || ""}`;
  const filterKey = `${categoryId || "all"}-${JSON.stringify(filters)}-${productFingerprint}`;

  return filterCache.getOrCompute(filterKey, async () => {
    const startTime = performance.now();

    // Use the optimized filterProducts function (now with batch inventory)
    const result = await filterProducts(products, filters);

    const duration = performance.now() - startTime;

    return result;
  });
}

/**
 * Parse filters from URL search params
 */
export function parseFiltersFromURL(
  searchParams: URLSearchParams
): ProductFilters {
  // Use getAll() to handle multiple brand parameters: ?brands=A&brands=B
  const brands = searchParams.getAll("brands").filter(Boolean);

  // Category IDs
  const categories = searchParams.getAll("categories").filter(Boolean);

  // Parse availability parameter
  const availability = searchParams.get("availability") === "true";

  return {
    brands,
    categories,
    availability,
  };
}

/**
 * Convert filters to URL search params
 */
export function filtersToURLParams(filters: ProductFilters): URLSearchParams {
  const params = new URLSearchParams();

  // Use append() to create multiple parameters: ?brands=A&brands=B
  if (filters.brands.length > 0) {
    filters.brands.forEach((brand) => {
      params.append("brands", brand);
    });
  }

  if (filters.categories.length > 0) {
    filters.categories.forEach((id) => params.append("categories", id));
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
 * ENHANCED: Now includes categories and availability filter
 */
export function getActiveFiltersCount(filters: ProductFilters): number {
  return (
    filters.brands.length +
    filters.categories.length +
    (filters.availability ? 1 : 0)
  );
}

/**
 * Check if any filters are active
 * ENHANCED: Now includes categories and availability filter
 */
export function hasActiveFilters(filters: ProductFilters): boolean {
  return (
    filters.brands.length > 0 ||
    filters.categories.length > 0 ||
    filters.availability === true
  );
}

/**
 * Clear all filters
 */
export function clearAllFilters(): ProductFilters {
  return { brands: [], categories: [], availability: false };
}

/**
 * Filter products to only those with sale pricing
 * Returns products where ANY variation has saleInfo
 */
export function filterSaleProducts(products: Product[]): Product[] {
  return products.filter((product) => {
    // Check if any variation has sale pricing
    if (product.variations && product.variations.length > 0) {
      return product.variations.some((variation) => variation.saleInfo);
    }
    return false;
  });
}
