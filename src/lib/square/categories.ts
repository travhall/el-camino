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
import { EL_CAMINO_LOGO_DATA_URI } from "@/lib/constants/assets";

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

          // DEBUG: Log Apparel subcategories to diagnose assignment issue
          if (
            category.name.includes("Tees") ||
            category.name.includes("Hats") ||
            category.name.includes("Bottoms") ||
            category.name.includes("Accessories")
          ) {
            // console.log(`[CategoryFetch] ${category.name}:`, {
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

/**
 * Fetch ALL catalog items once and cache them
 * Avoids the buggy searchCatalogItems(categoryIds) endpoint entirely
 * This is more reliable and faster for most use cases
 */
async function fetchAllCatalogItems(): Promise<any[]> {
  const cacheKey = "all-catalog-items";

  return productCache.getOrCompute(cacheKey, async () => {
    try {
      // console.log(`[Square API] Fetching ALL catalog items (avoiding buggy categoryIds endpoint)`);

      const allItems: any[] = [];
      let cursor: string | undefined = undefined;
      let requestCount = 0;
      const maxRequests = 20; // Safety limit

      do {
        requestCount++;
        if (requestCount > maxRequests) {
          console.warn(
            `[Square API] Hit max requests limit (${maxRequests}) when fetching all items`
          );
          break;
        }

        const { result } = await squareClient.catalogApi.listCatalog(
          cursor,
          "ITEM"
        );

        if (result.objects?.length) {
          // Convert BigInt values to strings to avoid serialization errors
          const sanitizedObjects = result.objects.map((obj: any) => {
            // Deep clone and convert BigInts
            return JSON.parse(
              JSON.stringify(obj, (key, value) =>
                typeof value === "bigint" ? value.toString() : value
              )
            );
          });
          allItems.push(...sanitizedObjects);
        }

        cursor = result.cursor;
      } while (cursor);

      // console.log(`[Square API] Successfully fetched ${allItems.length} total catalog items in ${requestCount} requests`);
      return allItems;
    } catch (error) {
      console.error(`[Square API] Error fetching all catalog items:`, error);
      throw error;
    }
  });
}

/**
 * Check if an item belongs to a category (handles both direct and subcategory matches)
 */
function itemMatchesCategory(
  item: any,
  categoryId: string,
  allCategories: Category[]
): boolean {
  if (!item?.itemData) {
    return false;
  }

  const itemData = item.itemData;

  // Items can have multiple categories in an array
  const itemCategories = itemData.categories || [];

  // Check direct match in categories array
  const hasDirectMatch = itemCategories.some(
    (cat: any) => cat.id === categoryId
  );
  if (hasDirectMatch) {
    return true;
  }

  // Check reporting category (primary category)
  if (itemData.reportingCategory?.id === categoryId) {
    return true;
  }

  // Check if any of the item's categories is a subcategory of the target category
  for (const itemCat of itemCategories) {
    const categoryDetails = allCategories.find((c) => c.id === itemCat.id);
    if (!categoryDetails) continue;

    // Check if this category's parent or root is the target category
    if (categoryDetails.rootCategoryId === categoryId) {
      return true;
    }
    if (categoryDetails.parentCategoryId === categoryId) {
      return true;
    }
  }

  return false;
}

export async function fetchProductsByCategory(
  categoryId: string,
  options?: ProductLoadingOptions
): Promise<PaginatedProducts> {
  const startTime = Date.now(); // Performance tracking
  const { limit = 24, cursor } = options || {};

  // NOTE: We don't use cursor-based pagination with this approach
  // Instead we fetch all items and paginate in-memory
  // This avoids the buggy searchCatalogItems(categoryIds) endpoint

  try {
    // console.log(`[Perf] Fetching products for category: ${categoryId}`);

    // Fetch ALL items and categories (both are cached)
    const fetchStart = Date.now();
    const [allItems, allCategories] = await Promise.all([
      fetchAllCatalogItems(),
      fetchCategories(),
    ]);
    // console.log(`[Perf] Data fetch: ${Date.now() - fetchStart}ms`);

    // Filter items by category in-memory
    const filterStart = Date.now();
    const matchingItems = allItems.filter((item) =>
      itemMatchesCategory(item, categoryId, allCategories)
    );
    // console.log(
    //   `[Perf] Filtering: ${Date.now() - filterStart}ms (${matchingItems.length} items)`
    // );

    if (!matchingItems.length) {
      // console.log(`[Perf] Total: ${Date.now() - startTime}ms (no results)`);
      return {
        products: [],
        hasMore: false,
      };
    }

    // Parallel processing for performance
    const extractStart = Date.now();
    const imageIds = matchingItems
      .map((item: any) => item.itemData?.imageIds?.[0])
      .filter((id: any): id is string => Boolean(id));

    const measurementUnitIds = matchingItems
      .map(
        (item: any) =>
          item.itemData?.variations?.[0]?.itemVariationData?.measurementUnitId
      )
      .filter((id: any): id is string => Boolean(id));
    // console.log(`[Perf] Extract IDs: ${Date.now() - extractStart}ms`);

    // Batch fetch images and units
    const batchStart = Date.now();
    const [imageUrlMap, measurementUnitsMap] = await Promise.all([
      imageIds.length
        ? batchGetImageUrls(imageIds)
        : Promise.resolve({} as Record<string, string>),
      measurementUnitIds.length
        ? fetchMeasurementUnits(measurementUnitIds)
        : Promise.resolve({} as Record<string, string>),
    ]);
    // console.log(
    //   `[Perf] Batch fetch (images + units): ${Date.now() - batchStart}ms`
    // );

    const transformStart = Date.now();
    const products = matchingItems.map((item: any) => {
      const variation = item.itemData?.variations?.[0];
      const priceMoney = variation?.itemVariationData?.priceMoney;
      const imageId = item.itemData?.imageIds?.[0];
      const measurementUnitId = variation?.itemVariationData?.measurementUnitId;

      const imageUrl =
        imageId && imageUrlMap[imageId]
          ? imageUrlMap[imageId]
          : EL_CAMINO_LOGO_DATA_URI;

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
    // console.log(`[Perf] Transform: ${Date.now() - transformStart}ms`);

    const totalTime = Date.now() - startTime;
    // console.log(`[Perf] TOTAL fetchProductsByCategory: ${totalTime}ms`);

    // Alert if slow
    if (totalTime > 1000) {
      // console.warn(
      //   `[Perf] ⚠️ Slow category fetch: ${totalTime}ms for ${categoryId}`
      // );
    }

    return {
      products,
      nextCursor: undefined, // No cursor-based pagination with in-memory filtering
      hasMore: false, // All results returned at once
    };
  } catch (error) {
    // console.error(`[Perf] Error after ${Date.now() - startTime}ms:`, error);
    const appError = processSquareError(
      error,
      `fetchProductsByCategory:${categoryId}`
    );
    return handleError<PaginatedProducts>(appError, {
      products: [],
      hasMore: false,
    });
  }
}

// In-memory cache for measurement units (simple, works in dev and prod)
const measurementUnitCache = new Map<
  string,
  { value: Record<string, string>; timestamp: number }
>();
const MEASUREMENT_UNIT_TTL = 3600000; // 1 hour in ms

// Optimized measurement unit fetching with in-memory caching
async function fetchMeasurementUnits(
  unitIds: string[]
): Promise<Record<string, string>> {
  if (!unitIds.length) return {};

  // Deduplicate and sort IDs for cache key
  const uniqueIds = [...new Set(unitIds)];
  const cacheKey = uniqueIds.sort().join(",");

  // Check in-memory cache
  const cached = measurementUnitCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < MEASUREMENT_UNIT_TTL) {
    return cached.value;
  }

  // console.log(
  //   `[Cache] Fetching ${uniqueIds.length} measurement units from Square API`
  // );

  const results = await Promise.allSettled(
    uniqueIds.map(async (unitId) => {
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

  // Store in cache
  measurementUnitCache.set(cacheKey, {
    value: unitMap,
    timestamp: Date.now(),
  });

  // console.log(
  //   `[Cache] Cached ${Object.keys(unitMap).length} measurement units`
  // );
  return unitMap;
}

export function clearCategoryCache(): void {
  categoryCache.clear();
  productCache.clear();
}

/**
 * Fetch ALL products from category, then filter and paginate
 */
async function _fetchAllProductsFromCategory(
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
