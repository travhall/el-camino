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
          if (category.name.includes("Tees") || category.name.includes("Hats") || 
              category.name.includes("Bottoms") || category.name.includes("Accessories")) {
            console.log(`[CategoryFetch] ${category.name}:`, {
              id: category.id,
              isTopLevel: category.isTopLevel,
              parentCategoryId: category.parentCategoryId,
              rootCategoryId: category.rootCategoryId,
              slug: category.slug,
            });
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

        // DEBUG: Log subcategory matching for Apparel specifically
        if (topCat.name === "Apparel") {
          console.log(`[CategoryHierarchy] Apparel (${topCat.id}) subcategories:`);
          subcategories.forEach(sub => {
            console.log(`  - ${sub.name} (ID: ${sub.id}, slug: ${sub.slug})`);
          });
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
      console.log(`[Square API] Searching for products with categoryId: ${categoryId}`);
      
      // Use searchCatalogItems with retry logic to handle intermittent bug
      // The cache validation layer prevents poisoning if empty results occur
      let retryCount = 0;
      const maxRetries = 3;
      let result: any = null;
      
      while (retryCount <= maxRetries) {
        const searchRequest: any = {
          categoryIds: [categoryId],
          limit: Math.min(limit, 100),
        };

        if (cursor) {
          searchRequest.cursor = cursor;
        }

        const response = await squareClient.catalogApi.searchCatalogItems(
          searchRequest
        );
        
        result = response.result;
        
        // If we got results, break out of retry loop
        if (result?.items?.length > 0) {
          console.log(`[Square API] Success: ${result.items.length} items for category ${categoryId}`);
          break;
        }
        
        // If this is the last retry, log warning
        if (retryCount === maxRetries) {
          console.warn(
            `[Square API] Empty results after ${maxRetries} retries for category ${categoryId}. ` +
            `This may be a legitimate empty category or the known Square API bug.`
          );
          break;
        }
        
        // Increment retry and wait before next attempt
        retryCount++;
        console.warn(
          `[Square API] Empty result (attempt ${retryCount}/${maxRetries}) for category ${categoryId}. Retrying...`
        );
        await new Promise(resolve => setTimeout(resolve, 100 * retryCount)); // Exponential backoff
      }
      
      console.log(`[Square API] Final result: ${result?.items?.length || 0} items for category ${categoryId}`);

      if (!result?.items?.length) {
        return {
          products: [],
          hasMore: false,
        };
      }

      // Type guard: at this point we know result.items exists and has items
      const items = result.items as Array<any>;

      // Parallel processing for performance
      const imageIds = items
        .map((item: any) => item.itemData?.imageIds?.[0])
        .filter((id: any): id is string => Boolean(id));

      const measurementUnitIds = items
        .map(
          (item: any) =>
            item.itemData?.variations?.[0]?.itemVariationData?.measurementUnitId
        )
        .filter((id: any): id is string => Boolean(id));

      // Batch fetch images and units
      const [imageUrlMap, measurementUnitsMap] = await Promise.all([
        imageIds.length
          ? batchGetImageUrls(imageIds)
          : Promise.resolve({} as Record<string, string>),
        measurementUnitIds.length
          ? fetchMeasurementUnits(measurementUnitIds)
          : Promise.resolve({} as Record<string, string>),
      ]);

      const products = items.map((item: any) => {
        const variation = item.itemData?.variations?.[0];
        const priceMoney = variation?.itemVariationData?.priceMoney;
        const imageId = item.itemData?.imageIds?.[0];
        const measurementUnitId =
          variation?.itemVariationData?.measurementUnitId;

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
  ProductFilters,
} from "./types";
import { filterProductsWithCache, extractFilterOptions } from "./filterUtils";

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
