// src/lib/square/categories.ts
import { squareClient } from "./client";
import type { Category, CategoryHierarchy, Product } from "./types";

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
 * Fetches all categories from Square catalog
 * Attempts to preserve any potential ordering information in the raw response
 */
export async function fetchCategories(): Promise<Category[]> {
  try {
    console.log("Fetching Square categories...");

    // Use listCatalog to get raw catalog objects
    const response = await squareClient.catalogApi.listCatalog(
      undefined,
      "CATEGORY"
    );

    if (!response.result || !response.result.objects?.length) {
      console.log("No categories found in catalog");
      return [];
    }

    // Log the raw category objects (may help identify ordering fields)
    const rawObjects = response.result.objects;
    console.log("Raw category objects:", rawObjects);

    // Process categories, preserving raw API fields
    const categories = rawObjects
      .filter((item) => item.type === "CATEGORY")
      .map((item) => {
        // Attempt to extract any properties that might relate to ordering
        // from the raw API response
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

    // Log information for debugging
    // console.log(`Processed ${categories.length} categories`);
    // console.log(
    //   "Categories with potential ordering info:",
    //   categories
    //     .map(
    //       (c: Category) =>
    //         `${c.name} (apiIndex: ${c.apiIndex}, rawOrder: ${c.rawOrder})`
    //     )
    //     .join(", ")
    // );

    return categories;
  } catch (error) {
    console.error("Error fetching Square categories:", error);
    if (error instanceof Error) {
      console.error("Error details:", error.message);
    }
    return [];
  }
}

/**
 * Organizes categories into a hierarchical structure
 * Uses explicit sort order to match Square Admin
 */
export async function fetchCategoryHierarchy(): Promise<CategoryHierarchy[]> {
  try {
    const allCategories = await fetchCategories();

    if (!allCategories.length) {
      return [];
    }

    // Find top-level categories
    let topLevelCategories = allCategories.filter((cat) => cat.isTopLevel);

    // Log pre-sorted categories
    // console.log(
    //   "Pre-sorted categories:",
    //   topLevelCategories.map((c) => c.name).join(", ")
    // );

    // Sort according to Square Admin order
    topLevelCategories.sort(
      (a, b) => getSortIndex(a.name) - getSortIndex(b.name)
    );

    // Log post-sorted categories
    // console.log(
    //   "Post-sorted categories:",
    //   topLevelCategories.map((c) => c.name).join(", ")
    // );

    // Create hierarchy
    const hierarchy: CategoryHierarchy[] = topLevelCategories.map((topCat) => {
      // Find subcategories based on rootCategoryId
      const subcategories = allCategories.filter(
        (subCat) => subCat.rootCategoryId === topCat.id && !subCat.isTopLevel
      );

      return {
        category: topCat,
        subcategories,
      };
    });

    return hierarchy;
  } catch (error) {
    console.error("Error organizing category hierarchy:", error);
    return [];
  }
}

/**
 * Fetch products by category ID using Square's searchCatalogItems endpoint
 */
export async function fetchProductsByCategory(
  categoryId: string
): Promise<Product[]> {
  try {
    console.log(`Fetching products for category ID: ${categoryId}`);

    // Use Square's searchCatalogItems endpoint to find items by category
    const { result } = await squareClient.catalogApi.searchCatalogItems({
      categoryIds: [categoryId],
    });

    if (!result?.items?.length) {
      console.log(`No products found for category ID: ${categoryId}`);
      return [];
    }

    // console.log(
    //   `Found ${result.items.length} products for category ${categoryId}`
    // );

    // Process items similar to the fetchProducts function
    const products = await Promise.all(
      result.items.map(async (item) => {
        const variation = item.itemData?.variations?.[0];
        const priceMoney = variation?.itemVariationData?.priceMoney;

        let imageUrl = "/images/placeholder.png";
        if (item.itemData?.imageIds?.[0]) {
          try {
            const { result } =
              await squareClient.catalogApi.retrieveCatalogObject(
                item.itemData.imageIds[0]
              );
            if (result.object?.type === "IMAGE") {
              imageUrl =
                result.object.imageData?.url || "/images/placeholder.png";
            }
          } catch (error) {
            console.error("Error fetching image for product:", item.id, error);
          }
        }

        return {
          id: item.id,
          catalogObjectId: item.id,
          variationId: variation?.id || item.id,
          title: item.itemData?.name || "",
          description: item.itemData?.description || "",
          image: imageUrl,
          price: priceMoney ? Number(priceMoney.amount) / 100 : 0,
          url: `/product/${item.id}`,
        };
      })
    );

    return products;
  } catch (error) {
    console.error(`Error fetching products for category ${categoryId}:`, error);
    return [];
  }
}
