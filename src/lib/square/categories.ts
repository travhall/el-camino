import { squareClient, extractSaleInfo } from "./client";
import { extractBrandValue, extractIsGiftCard, fetchMeasurementUnits } from "./productUtils";
import { batchGetImageUrls } from "./imageUtils";
import type {
  Category,
  CategoryHierarchy,
  PaginatedProducts,
  ProductLoadingOptions,
  SaleInfo,
} from "./types";
import { categoryCache, productCache } from "./cacheUtils";
import { handleError } from "./errorUtils";
import { processSquareError } from "./serverErrorUtils";
import { createProductUrl } from "@/lib/square/slugUtils";
import { EL_CAMINO_LOGO_DATA_URI } from "@/lib/constants/assets";

function createSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function fetchCategories(): Promise<Category[]> {
  return categoryCache.getOrCompute("all-categories", async () => {
    try {
      const categoryPage = await squareClient.catalog.list({ types: "CATEGORY" });

      if (!categoryPage.data?.length) {
        return [];
      }

      const rawObjects = categoryPage.data;
      const categories = rawObjects
        .filter((item: any) => item.type === "CATEGORY")
        .map((item: any) => {
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
            rawOrder: orderValue,
          };

          return category;
        });

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

      // Sort by Square's ordinal instead of hardcoded order
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
  // Cache key with version to bust old cached object format
  const cacheKey = "all-catalog-items-v3";

  return productCache.getOrCompute(cacheKey, async () => {
    try {
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

        const page = await squareClient.catalog.list({ types: "ITEM", cursor });

        if (page.data?.length) {
          // Convert BigInt values to strings to avoid serialization errors
          const sanitizedObjects = page.data.map((obj: any) => {
            // Deep clone and convert BigInts
            return JSON.parse(
              JSON.stringify(obj, (key, value) =>
                typeof value === "bigint" ? value.toString() : value
              )
            );
          });
          allItems.push(...sanitizedObjects);
        }

        cursor = (page.response as any).cursor;
      } while (cursor);

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
  const { limit = 24, cursor } = options || {};

  // NOTE: We don't use cursor-based pagination with this approach
  // Instead we fetch all items and paginate in-memory
  // This avoids the buggy searchCatalogItems(categoryIds) endpoint

  try {
    // Fetch ALL items and categories (both are cached)
    const [allItems, allCategories] = await Promise.all([
      fetchAllCatalogItems(),
      fetchCategories(),
    ]);

    // Filter items by category in-memory
    const matchingItems = allItems.filter((item) =>
      itemMatchesCategory(item, categoryId, allCategories)
    );

    if (!matchingItems.length) {
      return {
        products: [],
        hasMore: false,
      };
    }

    // Parallel processing for performance
    const imageIds = matchingItems
      .map((item: any) => item.itemData?.imageIds?.[0])
      .filter((id: any): id is string => Boolean(id));

    const measurementUnitIds = matchingItems
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

    const products = matchingItems.map((item: any) => {
      const variations = item.itemData?.variations || [];
      const defaultVariation = variations[0];
      const priceMoney = defaultVariation?.itemVariationData?.priceMoney;
      const imageId = item.itemData?.imageIds?.[0];
      const measurementUnitId = defaultVariation?.itemVariationData?.measurementUnitId;

      const imageUrl =
        imageId && imageUrlMap[imageId]
          ? imageUrlMap[imageId]
          : EL_CAMINO_LOGO_DATA_URI;

      const unit = measurementUnitId
        ? measurementUnitsMap[measurementUnitId] || undefined
        : undefined;

      // Extract brand from custom attributes
      const brandValue = extractBrandValue(item.customAttributeValues);
      const isGiftCard = extractIsGiftCard(item.customAttributeValues);

      // Build variations array with sale info, sorted by Square ordinal
      const productVariations = variations
        .slice()
        .sort((a: any, b: any) => {
          const ordA = a.itemVariationData?.ordinal ?? 0;
          const ordB = b.itemVariationData?.ordinal ?? 0;
          return ordA - ordB;
        })
        .map((v: any) => {
        const variationPrice = v.itemVariationData?.priceMoney;
        const regularPrice = variationPrice ? Number(variationPrice.amount) / 100 : 0;
        
        // Extract sale info from variation custom attributes
        const saleInfo = extractSaleInfo(v.customAttributeValues, regularPrice);

        return {
          id: v.id,
          variationId: v.id,
          name: v.itemVariationData?.name || "",
          price: regularPrice,
          saleInfo: saleInfo || undefined,
        };
      });

      return {
        id: item.id,
        catalogObjectId: item.id,
        variationId: defaultVariation?.id || item.id,
        title: item.itemData?.name || "",
        description: item.itemData?.description || "",
        image: imageUrl,
        price: priceMoney ? Number(priceMoney.amount) / 100 : 0,
        url: createProductUrl({ title: item.itemData?.name || "" }),
        unit: unit,
        brand: brandValue || undefined,
        isGiftCard: isGiftCard || undefined,
        variations: productVariations.length > 0 ? productVariations : undefined,
      };
    });
    // Sort products alphabetically by brand (case-insensitive), unbranded fall to end
    products.sort((a, b) => {
      const brandA = a.brand?.toLowerCase() ?? "\uffff";
      const brandB = b.brand?.toLowerCase() ?? "\uffff";
      return brandA.localeCompare(brandB);
    });
    return {
      products,
      nextCursor: undefined, // No cursor-based pagination with in-memory filtering
      hasMore: false, // All results returned at once
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
