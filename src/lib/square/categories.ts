// src/lib/square/categories.ts - WITH BRAND EXTRACTION
import { squareClient } from "./client";
import { batchGetImageUrls } from "./imageUtils";
import type {
  Category,
  CategoryHierarchy,
  Product,
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
      return rawObjects
        .filter((item) => item.type === "CATEGORY")
        .map((item) => ({
          id: item.id,
          name: item.categoryData?.name || "",
          slug: createSlug(item.categoryData?.name || ""),
          isTopLevel: item.categoryData?.isTopLevel || false,
          parentCategoryId: item.categoryData?.parentCategory?.id,
          rootCategoryId: item.categoryData?.rootCategory,
          apiIndex: rawObjects.indexOf(item),
          rawOrder:
            (item as any)?.ordinal ||
            (item as any)?.display_position ||
            (item as any)?.sort_order,
        }));
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

      let topLevelCategories = allCategories.filter((cat) => cat.isTopLevel);
      topLevelCategories.sort(
        (a, b) => getSortIndex(a.name) - getSortIndex(b.name)
      );

      return topLevelCategories.map((topCat) => {
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

      const { result } =
        await squareClient.catalogApi.searchCatalogItems(searchRequest);

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
            : "/images/placeholder.png";

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

      console.log(
        `[fetchProductsByCategory] Fetched ${products.length} products, ${products.filter((p) => p.brand).length} with brands`
      );

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
        const { result } =
          await squareClient.catalogApi.retrieveCatalogObject(unitId);

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
 * Fetch products with server-side filtering and page-based pagination
 */
export async function fetchProductsByCategoryWithPagination(
  categoryId: string,
  options: PaginationOptions = {}
): Promise<PaginatedProductsWithMeta> {
  const { page = 1, pageSize = 24, filters = { brands: [] }, cursor } = options;

  const cacheKey = `category-paginated-${categoryId}-${page}-${pageSize}-${JSON.stringify(filters)}`;

  return productCache.getOrCompute(cacheKey, async () => {
    try {
      // Fetch larger set from Square API, then filter and paginate
      const fetchLimit = Math.max(pageSize * page * 2, 100);

      const squareResult = await fetchProductsByCategory(categoryId, {
        limit: fetchLimit,
        cursor: cursor,
      });

      // Apply filters to the fetched products
      const filteredProducts = filterProducts(squareResult.products, filters);

      // Calculate pagination boundaries
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedProducts = filteredProducts.slice(startIndex, endIndex);

      // Determine if we have more pages
      const hasMoreFiltered = filteredProducts.length > endIndex;
      const hasMoreFromSquare = squareResult.hasMore;

      const estimatedHasMore =
        hasMoreFiltered ||
        (hasMoreFromSquare && filteredProducts.length < fetchLimit * 0.8);

      // Calculate pagination metadata
      const pagination = calculatePaginationMeta(
        page,
        pageSize,
        paginatedProducts.length,
        estimatedHasMore,
        filteredProducts.length > endIndex ? undefined : filteredProducts.length
      );

      // Get filter options from all fetched products
      const filterOptions = extractFilterOptions(squareResult.products);

      return {
        products: paginatedProducts,
        nextCursor: squareResult.nextCursor,
        hasMore: estimatedHasMore,
        pagination,
        appliedFilters: filters,
        filterOptions,
      };
    } catch (error) {
      const appError = processSquareError(
        error,
        `fetchProductsByCategoryWithPagination:${categoryId}`
      );

      return handleError<PaginatedProductsWithMeta>(appError, {
        products: [],
        hasMore: false,
        pagination: calculatePaginationMeta(page, pageSize, 0, false, 0),
        appliedFilters: filters,
        filterOptions: { brands: [] },
      });
    }
  });
}
