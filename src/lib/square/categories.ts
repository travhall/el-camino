import { squareClient, fetchProducts } from "./client";
import type {
  Category,
  CategoryHierarchy,
  PaginatedProducts,
  Product,
  ProductLoadingOptions,
} from "./types";
import { categoryCache, productCache } from "@/lib/cache/blobCache";
import { handleError } from "./errorUtils";
import { processSquareError } from "./serverErrorUtils";
import { createSlug } from "@/lib/square/slugUtils";

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
 * Check if a product belongs to a category (handles both direct and subcategory matches)
 */
function productMatchesCategory(
  product: Product,
  categoryId: string,
  allCategories: Category[]
): boolean {
  const productCategories = product.categories || [];

  // Check direct match in categories array
  if (productCategories.includes(categoryId)) {
    return true;
  }

  // Check reporting category (primary category)
  if (product.reportingCategoryId === categoryId) {
    return true;
  }

  // Check if any of the product's categories is a subcategory of the target category
  for (const productCatId of productCategories) {
    const categoryDetails = allCategories.find((c) => c.id === productCatId);
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
    // Fetch ALL products and categories (both are cached)
    const [allProducts, allCategories] = await Promise.all([
      fetchProducts(),
      fetchCategories(),
    ]);

    // Filter products by category in-memory
    const products = allProducts.filter((product) =>
      productMatchesCategory(product, categoryId, allCategories)
    );

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

