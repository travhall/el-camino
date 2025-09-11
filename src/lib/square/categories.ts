// src/lib/square/categories.ts - WITH COMPREHENSIVE DEBUGGING
import { squareClient } from "./client";
import { batchGetImageUrls } from "./imageUtils";
import type {
  Category,
  CategoryHierarchy,
  PaginatedProducts,
  ProductLoadingOptions,
} from "./types";
import { categoryCache, productCache } from "./cacheUtils";
import { processSquareError, handleError } from "./errorUtils";
import { createProductUrl } from "@/lib/square/slugUtils";

function createSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Extract brand value from custom attributes (same logic as client.ts)
 */
function extractBrandValue(customAttributeValues: any): string {
  if (!customAttributeValues) return "";

  // Look for any attribute with 'brand' in the key name (case insensitive)
  const brandAttribute = Object.values(customAttributeValues).find(
    (attr: any) =>
      attr?.name?.toLowerCase() === "brand" ||
      attr?.key?.toLowerCase() === "brand"
  ) as any;

  if (
    brandAttribute &&
    brandAttribute.type === "STRING" &&
    brandAttribute.stringValue
  ) {
    return brandAttribute.stringValue;
  }

  return "";
}

export async function fetchCategories(): Promise<Category[]> {
  return categoryCache.getOrCompute("all-categories", async () => {
    try {
      const response = await squareClient.catalogApi.listCatalog(
        undefined,
        "CATEGORY"
      );

      if (!response.result?.objects?.length) {
        return [];
      }

      const rawObjects = response.result.objects;
      const categories = rawObjects
        .filter((item) => item.type === "CATEGORY")
        .map((item, index) => {
          // Extract ordinal from parentCategory (BigInt)
          const parentOrdinal = item.categoryData?.parentCategory?.ordinal;
          const orderValue = parentOrdinal ? Number(parentOrdinal) : 999;

          // ENHANCED: Try multiple ways to get rootCategoryId
          let rootCategoryId = null;

          // Method 1: Standard camelCase
          if (item.categoryData?.rootCategory) {
            rootCategoryId = item.categoryData.rootCategory;
          }

          // Method 2: snake_case fallback
          if (!rootCategoryId && (item.categoryData as any)?.root_category) {
            rootCategoryId = (item.categoryData as any).root_category;
          }

          // Method 3: parent category ID fallback for subcategories
          if (
            !rootCategoryId &&
            item.categoryData?.parentCategory?.id &&
            !item.categoryData?.isTopLevel
          ) {
            rootCategoryId = item.categoryData.parentCategory.id;
          }

          const category = {
            id: item.id,
            name: item.categoryData?.name || "",
            slug: createSlug(item.categoryData?.name || ""),
            isTopLevel: item.categoryData?.isTopLevel || false,
            parentCategoryId: item.categoryData?.parentCategory?.id,
            rootCategoryId: rootCategoryId,
            apiIndex: rawObjects.indexOf(item),
            rawOrder: orderValue,
          };

          // DEBUG: Log problematic categories
          if (
            ["Trucks", "Bearings Bolts & More", "Bottoms", "Hats"].includes(
              category.name
            )
          ) {
            // console.log(`[DEBUG] Category ${category.name}:`, {
            //   id: category.id,
            //   isTopLevel: category.isTopLevel,
            //   parentCategoryId: category.parentCategoryId,
            //   rootCategoryId: category.rootCategoryId,
            //   slug: category.slug,
            // });
          }

          return category;
        });

      // console.log(`[DEBUG] Total categories processed: ${categories.length}`);
      return categories;
    } catch (error) {
      const appError = processSquareError(error, "fetchCategories");
      return handleError<Category[]>(appError, []);
    }
  });
}

export async function fetchCategoryHierarchy(): Promise<CategoryHierarchy[]> {
  return categoryCache.getOrCompute("hierarchy", async () => {
    try {
      const allCategories = await fetchCategories();
      if (!allCategories.length) return [];

      // Sort by Square's ordinal instead of hardcoded order
      let topLevelCategories = allCategories.filter((cat) => cat.isTopLevel);

      // console.log(
      //   `[DEBUG] Top level categories found: ${topLevelCategories
      //     .map((c) => c.name)
      //     .join(", ")}`
      // );

      // REMOVE hardcoded getSortIndex, use Square's ordering
      topLevelCategories.sort((a, b) => {
        const orderA = a.rawOrder ?? 999;
        const orderB = b.rawOrder ?? 999;

        // If ordinals are the same, fall back to alphabetical
        if (orderA === orderB) {
          return a.name.localeCompare(b.name);
        }

        return orderA - orderB;
      });

      const hierarchy = topLevelCategories.map((topCat) => {
        let subcategories = allCategories.filter(
          (subCat) => subCat.rootCategoryId === topCat.id && !subCat.isTopLevel
        );

        // DEBUG: Log subcategory matching for Skateboards and Apparel
        if (["Skateboards", "Apparel"].includes(topCat.name)) {
          // console.log(
          //   `[DEBUG] ${topCat.name} (${topCat.id}) subcategories:`,
          //   subcategories.map((sub) => `${sub.name} (${sub.id})`)
          // );
        }

        // Sort subcategories by ordinal too
        subcategories.sort((a, b) => {
          const orderA = a.rawOrder ?? 999;
          const orderB = b.rawOrder ?? 999;

          if (orderA === orderB) {
            return a.name.localeCompare(b.name);
          }

          return orderA - orderB;
        });

        return {
          category: topCat,
          subcategories,
        };
      });

      // console.log(
      //   `[DEBUG] Hierarchy built with ${hierarchy.length} top-level categories`
      // );
      return hierarchy;
    } catch (error) {
      const appError = processSquareError(error, "fetchCategoryHierarchy");
      return handleError<CategoryHierarchy[]>(appError, []);
    }
  });
}

export async function fetchProductsByCategory(
  categoryId: string,
  options?: ProductLoadingOptions
): Promise<PaginatedProducts> {
  const { limit = 24, cursor } = options || {};
  const cacheKey = `category-${categoryId}-${cursor || "initial"}-${limit}`;

  return productCache.getOrCompute(cacheKey, async () => {
    try {
      const searchRequest: any = {
        categoryIds: [categoryId],
        limit: Math.min(limit, 100),
      };

      if (cursor) {
        searchRequest.cursor = cursor;
      }

      const { result } = await squareClient.catalogApi.searchCatalogItems(
        searchRequest
      );

      if (!result?.items?.length) {
        return {
          products: [],
          hasMore: false,
        };
      }

      // Parallel processing for performance
      const imageIds = result.items
        .map((item) => item.itemData?.imageIds?.[0])
        .filter((id): id is string => Boolean(id));

      const measurementUnitIds = result.items
        .map(
          (item) =>
            item.itemData?.variations?.[0]?.itemVariationData?.measurementUnitId
        )
        .filter((id): id is string => Boolean(id));

      // Batch fetch images and units
      const [imageUrlMap, measurementUnitsMap] = await Promise.all([
        imageIds.length
          ? batchGetImageUrls(imageIds)
          : Promise.resolve({} as Record<string, string>),
        measurementUnitIds.length
          ? fetchMeasurementUnits(measurementUnitIds)
          : Promise.resolve({} as Record<string, string>),
      ]);

      const products = result.items.map((item) => {
        const variation = item.itemData?.variations?.[0];
        const priceMoney = variation?.itemVariationData?.priceMoney;
        const imageId = item.itemData?.imageIds?.[0];
        const measurementUnitId =
          variation?.itemVariationData?.measurementUnitId;

        const imageUrl =
          imageId && imageUrlMap[imageId]
            ? imageUrlMap[imageId]
            : "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjI2NyIgdmlld0JveD0iMCAwIDQwMCAyNjciIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjQwMCIgaGVpZ2h0PSIyNjciIGZpbGw9IiNmM2Y0ZjYiLz48cGF0aCBkPSJNMjAwIDEzMy41bC0yMC0yMGgtNDBsLTIwIDIwIDIwIDIwaDQwbDIwLTIweiIgZmlsbD0iIzllYTNhZSIvPjwvc3ZnPg==";

        const unit = measurementUnitId
          ? measurementUnitsMap[measurementUnitId] || undefined
          : undefined;

        // ADDED: Extract brand from custom attributes
        const brandValue = extractBrandValue(item.customAttributeValues);

        return {
          id: item.id,
          catalogObjectId: item.id,
          variationId: variation?.id || item.id,
          title: item.itemData?.name || "",
          description: item.itemData?.description || "",
          image: imageUrl,
          price: priceMoney ? Number(priceMoney.amount) / 100 : 0,
          url: createProductUrl({ title: item.itemData?.name || "" }),
          unit: unit,
          brand: brandValue || undefined, // ADDED: Include brand
        };
      });

      return {
        products,
        nextCursor: result.cursor,
        hasMore: !!result.cursor,
      };
    } catch (error) {
      const appError = processSquareError(
        error,
        `fetchProductsByCategory:${categoryId}`
      );
      return handleError<PaginatedProducts>(appError, {
        products: [],
        hasMore: false,
      });
    }
  });
}

// Optimized measurement unit fetching
async function fetchMeasurementUnits(
  unitIds: string[]
): Promise<Record<string, string>> {
  const results = await Promise.allSettled(
    unitIds.map(async (unitId) => {
      try {
        const { result } = await squareClient.catalogApi.retrieveCatalogObject(
          unitId
        );

        if (result.object?.type === "MEASUREMENT_UNIT") {
          const unitData = result.object.measurementUnitData;
          let unitName = "";

          if (unitData?.measurementUnit?.customUnit?.name) {
            unitName = unitData.measurementUnit.customUnit.name;
          } else if (unitData?.measurementUnit?.customUnit?.abbreviation) {
            unitName = unitData.measurementUnit.customUnit.abbreviation;
          } else if (unitData?.measurementUnit?.type) {
            unitName = unitData.measurementUnit.type
              .toLowerCase()
              .replace(/_/g, " ");
          }

          return { unitId, unitName };
        }
        return { unitId, unitName: "" };
      } catch {
        return { unitId, unitName: "" };
      }
    })
  );

  const unitMap: Record<string, string> = {};
  results.forEach((result) => {
    if (result.status === "fulfilled" && result.value.unitName) {
      unitMap[result.value.unitId] = result.value.unitName;
    }
  });

  return unitMap;
}

export function clearCategoryCache(): void {
  categoryCache.clear();
  productCache.clear();
}

import type {
  PaginationOptions,
  PaginatedProductsWithMeta,
  PaginationMeta,
  ProductFilters,
} from "./types";
import { calculatePaginationMeta } from "./types";
import { filterProducts, extractFilterOptions } from "./filterUtils";

/**
 * Fetch ALL products from category, then filter and paginate
 */
async function fetchAllProductsFromCategory(
  categoryId: string
): Promise<any[]> {
  const allProducts: any[] = [];
  let cursor: string | undefined = undefined;

  do {
    const batch = await fetchProductsByCategory(categoryId, {
      limit: 100,
      cursor,
    });

    allProducts.push(...batch.products);
    cursor = batch.nextCursor;
  } while (cursor);

  return allProducts;
}

/**
 * Fetch products with server-side filtering and page-based pagination
 */
export async function fetchProductsByCategoryWithPagination(
  categoryId: string,
  options: PaginationOptions = {}
): Promise<PaginatedProductsWithMeta> {
  const { page = 1, pageSize = 24, filters = { brands: [] } } = options;

  // Cache ALL products for the category
  const baseCacheKey = `category-all-products-${categoryId}`;

  return productCache
    .getOrCompute(baseCacheKey, async () => {
      try {
        // Fetch ALL products for category - this fixes the pagination bug
        return await fetchAllProductsFromCategory(categoryId);
      } catch (error) {
        return [];
      }
    })
    .then(async (allProducts) => {
      // UPDATED: Now async to handle availability filtering
      const filteredProducts = await filterProducts(allProducts, filters);
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedProducts = filteredProducts.slice(startIndex, endIndex);

      const totalPages = Math.ceil(filteredProducts.length / pageSize);

      const pagination = calculatePaginationMeta(
        page,
        pageSize,
        paginatedProducts.length,
        page < totalPages,
        filteredProducts.length
      );

      const filterOptions = extractFilterOptions(allProducts);

      return {
        products: paginatedProducts,
        hasMore: page < totalPages,
        pagination,
        appliedFilters: filters,
        filterOptions,
      };
    });
}
