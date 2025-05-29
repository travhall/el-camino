// src/lib/square/categories.ts
import { squareClient } from "./client";
import { batchGetImageUrls } from "./imageUtils";
import type { Category, CategoryHierarchy, Product } from "./types";
import { categoryCache, productCache } from "./cacheUtils";
import { processSquareError, logError, handleError } from "./errorUtils";
import { createProductUrl } from "@/utils/slugUtils";

/**
 * Converts a category name to a URL-friendly slug
 */
function createSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Returns the index for sorting based on Square Admin order
 */
function getSortIndex(name: string): number {
  const orderMap: Record<string, number> = {
    Skateboards: 0,
    Apparel: 1,
    Footwear: 2,
    "Gift Cards & More": 3,
  };

  return orderMap[name] ?? 999;
}

/**
 * Fetches all categories from Square catalog with caching
 */
export async function fetchCategories(): Promise<Category[]> {
  return categoryCache.getOrCompute("all-categories", async () => {
    try {
      // Use listCatalog to get raw catalog objects
      const response = await squareClient.catalogApi.listCatalog(
        undefined,
        "CATEGORY"
      );

      if (!response.result || !response.result.objects?.length) {
        console.log("No categories found in catalog");
        return [];
      }

      // Process categories, preserving raw API fields
      const rawObjects = response.result.objects;
      return rawObjects
        .filter((item) => item.type === "CATEGORY")
        .map((item) => {
          // Attempt to extract any properties that might relate to ordering
          const rawOrder =
            (item as any)?.ordinal ||
            (item as any)?.display_position ||
            (item as any)?.sort_order;

          return {
            id: item.id,
            name: item.categoryData?.name || "",
            slug: createSlug(item.categoryData?.name || ""),
            isTopLevel: item.categoryData?.isTopLevel || false,
            parentCategoryId: item.categoryData?.parentCategory?.id,
            rootCategoryId: item.categoryData?.rootCategory,
            // Store original position in array and any potential ordering fields
            apiIndex: rawObjects.indexOf(item),
            rawOrder: rawOrder,
          };
        });
    } catch (error) {
      const appError = processSquareError(error, "fetchCategories");
      return handleError<Category[]>(appError, []);
    }
  });
}

/**
 * Organizes categories into a hierarchical structure
 * Uses explicit sort order to match Square Admin with caching
 */
export async function fetchCategoryHierarchy(): Promise<CategoryHierarchy[]> {
  return categoryCache.getOrCompute("hierarchy", async () => {
    try {
      // Get categories (this will use the cache if available)
      const allCategories = await fetchCategories();

      if (!allCategories.length) {
        return [];
      }

      // Find top-level categories
      let topLevelCategories = allCategories.filter((cat) => cat.isTopLevel);

      // Sort according to Square Admin order
      topLevelCategories.sort(
        (a, b) => getSortIndex(a.name) - getSortIndex(b.name)
      );

      // Create hierarchy
      return topLevelCategories.map((topCat) => {
        // Find subcategories based on rootCategoryId
        const subcategories = allCategories.filter(
          (subCat) => subCat.rootCategoryId === topCat.id && !subCat.isTopLevel
        );

        return {
          category: topCat,
          subcategories,
        };
      });
    } catch (error) {
      const appError = processSquareError(error, "fetchCategoryHierarchy");
      return handleError<CategoryHierarchy[]>(appError, []);
    }
  });
}

/**
 * Fetch products by category ID using Square's searchCatalogItems endpoint
 * with caching and parallel image fetching
 */
export async function fetchProductsByCategory(
  categoryId: string
): Promise<Product[]> {
  return productCache.getOrCompute(`category-${categoryId}`, async () => {
    try {
      // Use Square's searchCatalogItems endpoint to find items by category
      const { result } = await squareClient.catalogApi.searchCatalogItems({
        categoryIds: [categoryId],
      });

      if (!result?.items?.length) {
        console.log(`No products found for category ID: ${categoryId}`);
        return [];
      }

      // First collect all image IDs to fetch them in parallel
      const imageIds: string[] = [];
      const measurementUnitIds: string[] = [];

      result.items.forEach((item) => {
        if (item.itemData?.imageIds?.[0]) {
          imageIds.push(item.itemData.imageIds[0]);
        }

        // Collect measurement unit IDs for batch fetching
        const variation = item.itemData?.variations?.[0];
        if (variation?.itemVariationData?.measurementUnitId) {
          measurementUnitIds.push(
            variation.itemVariationData.measurementUnitId
          );
        }
      });

      // Fetch all images in parallel using the imported utility function
      const imageUrlMap: Record<string, string> = {};
      if (imageIds.length > 0) {
        const batchedImages = await batchGetImageUrls(imageIds);
        Object.assign(imageUrlMap, batchedImages);
      }

      // Fetch all measurement units in parallel
      const measurementUnitsMap: Record<string, string> = {};
      if (measurementUnitIds.length > 0) {
        console.log(
          `[fetchProductsByCategory] Fetching ${measurementUnitIds.length} measurement units`
        );

        // Use Promise.allSettled to handle individual failures gracefully
        const measurementResults = await Promise.allSettled(
          measurementUnitIds.map(async (unitId) => {
            try {
              const { result: measurementResult } =
                await squareClient.catalogApi.retrieveCatalogObject(unitId);

              if (measurementResult.object?.type === "MEASUREMENT_UNIT") {
                const unitData = measurementResult.object.measurementUnitData;

                let unitName = "";
                // Priority order: custom unit name > custom abbreviation > standard unit type
                if (unitData?.measurementUnit?.customUnit?.name) {
                  unitName = unitData.measurementUnit.customUnit.name;
                } else if (
                  unitData?.measurementUnit?.customUnit?.abbreviation
                ) {
                  unitName = unitData.measurementUnit.customUnit.abbreviation;
                } else if (unitData?.measurementUnit?.type) {
                  unitName = unitData.measurementUnit.type
                    .toLowerCase()
                    .replace(/_/g, " ");
                }

                return { unitId, unitName };
              }
              return { unitId, unitName: "" };
            } catch (error) {
              console.warn(
                `Failed to fetch measurement unit ${unitId}:`,
                error
              );
              return { unitId, unitName: "" };
            }
          })
        );

        // Process results
        measurementResults.forEach((result) => {
          if (result.status === "fulfilled" && result.value.unitName) {
            measurementUnitsMap[result.value.unitId] = result.value.unitName;
          }
        });

        console.log(
          `[fetchProductsByCategory] Fetched measurement units:`,
          measurementUnitsMap
        );
      }

      // Process items with the fetched images and measurement units
      const products = result.items.map((item) => {
        const variation = item.itemData?.variations?.[0];
        const priceMoney = variation?.itemVariationData?.priceMoney;
        const imageId = item.itemData?.imageIds?.[0];
        const measurementUnitId =
          variation?.itemVariationData?.measurementUnitId;

        const imageUrl =
          imageId && imageUrlMap[imageId]
            ? imageUrlMap[imageId]
            : "/images/placeholder.png";

        // Get the unit name from our fetched measurement units
        const unit = measurementUnitId
          ? measurementUnitsMap[measurementUnitId] || undefined
          : undefined;

        return {
          id: item.id,
          catalogObjectId: item.id,
          variationId: variation?.id || item.id,
          title: item.itemData?.name || "",
          description: item.itemData?.description || "",
          image: imageUrl,
          price: priceMoney ? Number(priceMoney.amount) / 100 : 0,
          url: createProductUrl({ title: item.itemData?.name || "" }),
          unit: unit, // Now properly includes measurement unit
        };
      });

      console.log(
        `[fetchProductsByCategory] Fetched ${products.length} products for category ${categoryId}`,
        {
          withUnits: products.filter((p) => p.unit).length,
          units: [...new Set(products.map((p) => p.unit).filter(Boolean))],
        }
      );

      return products;
    } catch (error) {
      const appError = processSquareError(
        error,
        `fetchProductsByCategory:${categoryId}`
      );
      return handleError<Product[]>(appError, []);
    }
  });
}

/**
 * Clear category cache
 */
export function clearCategoryCache(): void {
  categoryCache.clear();
  productCache.clear();
}
