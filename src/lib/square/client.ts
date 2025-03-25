// /src/lib/square/client.ts
import { Client, Environment } from "square";
import type { Product } from "./types";

function validateEnvironment() {
  const missingVars = [];
  if (!import.meta.env.SQUARE_ACCESS_TOKEN) {
    missingVars.push("SQUARE_ACCESS_TOKEN");
  }
  if (!import.meta.env.PUBLIC_SQUARE_LOCATION_ID) {
    missingVars.push("PUBLIC_SQUARE_LOCATION_ID");
  }
  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(", ")}`
    );
  }
}

validateEnvironment();

export const squareClient = new Client({
  accessToken: import.meta.env.SQUARE_ACCESS_TOKEN!,
  environment: Environment.Sandbox,
  squareVersion: "2024-02-28",
});

export const jsonStringifyReplacer = (_key: string, value: any) => {
  if (typeof value === "bigint") {
    return value.toString();
  }
  return value;
};

async function getImageUrl(imageId: string): Promise<string | null> {
  try {
    const { result } = await squareClient.catalogApi.retrieveCatalogObject(
      imageId
    );
    if (result.object?.type === "IMAGE") {
      return result.object.imageData?.url || null;
    }
    return null;
  } catch (error) {
    console.error("Error fetching image:", error);
    return null;
  }
}

export async function fetchProducts(): Promise<Product[]> {
  try {
    console.log("Fetching Square products...");
    const response = await squareClient.catalogApi.listCatalog(
      undefined,
      "ITEM"
    );

    if (!response.result) {
      console.error("No result in Square response:", response);
      return [];
    }

    // console.log("Square API Response:", {
    //   success: !!response.result,
    //   objectCount: response.result.objects?.length || 0,
    // });

    if (!response.result.objects?.length) {
      console.log("No products found in catalog");
      return [];
    }

    const products = await Promise.all(
      response.result.objects
        .filter((item) => {
          if (item.type !== "ITEM") {
            console.log("Filtered out non-ITEM type:", item.type);
            return false;
          }
          return true;
        })
        .map(async (item) => {
          const variation = item.itemData?.variations?.[0];
          const priceMoney = variation?.itemVariationData?.priceMoney;

          if (!variation || !priceMoney) {
            console.log("Product missing variation or price:", item.id);
          }

          let imageUrl = "/images/placeholder.png";
          if (item.itemData?.imageIds?.[0]) {
            try {
              const fetchedUrl = await getImageUrl(item.itemData.imageIds[0]);
              if (fetchedUrl) {
                imageUrl = fetchedUrl;
              }
            } catch (error) {
              console.error(
                "Error fetching image for product:",
                item.id,
                error
              );
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

    // console.log("Processed products:", {
    //   count: products.length,
    //   firstProduct: products[0]
    //     ? {
    //         id: products[0].id,
    //         title: products[0].title,
    //       }
    //     : null,
    // });

    return products;
  } catch (error) {
    console.error("Error fetching Square products:", error);
    if (error instanceof Error) {
      console.error("Error details:", {
        message: error.message,
        name: error.name,
        stack: error.stack,
      });
    }
    return [];
  }
}

export async function fetchProduct(id: string): Promise<Product | null> {
  try {
    const { result } = await squareClient.catalogApi.retrieveCatalogObject(
      id,
      true
    ); // Pass true as second param

    if (!result.object || result.object.type !== "ITEM") return null;

    const item = result.object;
    const variations = item.itemData?.variations || [];

    if (!variations.length) return null;

    // Use first variation as default
    const defaultVariation = variations[0];
    const defaultPriceMoney = defaultVariation?.itemVariationData?.priceMoney;

    if (!defaultVariation || !defaultPriceMoney) return null;

    // Get image
    let imageUrl = "/images/placeholder.png";
    if (item.itemData?.imageIds?.[0]) {
      const fetchedUrl = await getImageUrl(item.itemData.imageIds[0]);
      if (fetchedUrl) {
        imageUrl = fetchedUrl;
      }
    }

    // Process all variations and their images
    const productVariations = await Promise.all(
      variations.map(async (v) => {
        const priceMoney = v.itemVariationData?.priceMoney;

        // Check for variation-specific images
        let variationImageUrl: string | undefined = undefined;
        if (v.itemVariationData?.imageIds?.[0]) {
          try {
            const fetchedUrl = await getImageUrl(
              v.itemVariationData.imageIds[0]
            );
            if (fetchedUrl) {
              variationImageUrl = fetchedUrl;
            }
          } catch (error) {
            console.error(`Error fetching image for variation ${v.id}:`, error);
          }
        }

        // Get measurement unit if available
        let unit = "";
        if (v.itemVariationData?.measurementUnitId) {
          // We would need to fetch the measurement unit separately
          // For now, we'll just use a placeholder approach
          try {
            const { result: measurementResult } =
              await squareClient.catalogApi.retrieveCatalogObject(
                v.itemVariationData.measurementUnitId
              );

            if (measurementResult.object?.type === "MEASUREMENT_UNIT") {
              const unitData = measurementResult.object.measurementUnitData;
              if (unitData?.measurementUnit?.customUnit?.name) {
                unit = unitData.measurementUnit.customUnit.name;
              } else if (unitData?.measurementUnit?.type) {
                unit = unitData.measurementUnit.type
                  .toLowerCase()
                  .replace("_", " ");
              }
            }
          } catch (error) {
            console.error(`Error fetching measurement unit: ${error}`);
          }
        }

        return {
          id: v.id,
          variationId: v.id,
          name: v.itemVariationData?.name || "",
          price: priceMoney ? Number(priceMoney.amount) / 100 : 0,
          image: variationImageUrl,
          unit: unit,
        };
      })
    );

    // Get custom attributes, specifically looking for 'Brand'
    let brandValue = "";
    if (item.customAttributeValues) {
      // Look for any attribute with 'brand' in the key name (case insensitive)
      const brandAttribute = Object.values(item.customAttributeValues).find(
        (attr) =>
          attr.name?.toLowerCase() === "brand" ||
          attr.key?.toLowerCase() === "brand"
      );

      if (
        brandAttribute &&
        brandAttribute.type === "STRING" &&
        brandAttribute.stringValue
      ) {
        brandValue = brandAttribute.stringValue;
      }
    }

    // Use default variation unit or first found unit
    const defaultUnit = productVariations[0]?.unit || "";

    return {
      id: item.id,
      catalogObjectId: item.id,
      variationId: defaultVariation.id,
      title: item.itemData?.name || "",
      description: item.itemData?.description || "",
      image: imageUrl,
      price: Number(defaultPriceMoney.amount) / 100,
      url: `/product/${item.id}`,
      variations: productVariations,
      selectedVariationId: defaultVariation.id,
      brand: brandValue,
      unit: defaultUnit,
    };
  } catch (error) {
    console.error("Error fetching product:", error);
    return null;
  }
}

import type { Category, CategoryHierarchy } from "./types";

/**
 * Fetches all categories from Square catalog
 */
export async function fetchCategories(): Promise<Category[]> {
  try {
    console.log("Fetching Square categories...");

    // Fetch all categories
    const response = await squareClient.catalogApi.listCatalog(
      undefined,
      "CATEGORY"
    );

    if (!response.result || !response.result.objects?.length) {
      console.log("No categories found in catalog");
      return [];
    }

    // Process categories
    const categories = response.result.objects
      .filter((item) => item.type === "CATEGORY")
      .map((item) => {
        // Create a URL-friendly slug from the category name
        const slug = item.categoryData?.name
          ? item.categoryData.name
              .toLowerCase()
              .replace(/[^\w\s-]/g, "")
              .replace(/[\s_-]+/g, "-")
              .replace(/^-+|-+$/g, "")
          : item.id;

        return {
          id: item.id,
          name: item.categoryData?.name || "",
          slug,
          isTopLevel: item.categoryData?.isTopLevel || false,
          parentCategoryId: item.categoryData?.parentCategory?.id,
          rootCategoryId: item.categoryData?.rootCategory,
        };
      });

    // console.log(`Processed ${categories.length} categories`);
    return categories;
  } catch (error) {
    console.error("Error fetching Square categories:", error);
    if (error instanceof Error) {
      console.error("Error details:", {
        message: error.message,
        name: error.name,
        stack: error.stack,
      });
    }
    return [];
  }
}

/**
 * Organizes categories into a hierarchical structure
 * NOTE: This is a placeholder implementation until we can analyze the actual data
 * to determine how Square represents reporting categories vs. subcategories
 */
export async function fetchCategoryHierarchy(): Promise<CategoryHierarchy[]> {
  try {
    const allCategories = await fetchCategories();

    // This is where we'll implement the logic to identify reporting categories
    // and their related subcategories after analyzing the actual data structure
    // For now, we'll return a flat structure

    return allCategories.map((category) => ({
      category,
      subcategories: [],
    }));
  } catch (error) {
    console.error("Error organizing category hierarchy:", error);
    return [];
  }
}

/**
 * Fetches products by category ID
 */
export async function fetchProductsByCategory(
  categoryId: string
): Promise<Product[]> {
  try {
    console.log(`Fetching products for category: ${categoryId}`);

    // Use the search endpoint to find items by category
    const { result } = await squareClient.catalogApi.searchCatalogItems({
      categoryIds: [categoryId],
    });

    if (!result.items?.length) {
      console.log(`No products found for category: ${categoryId}`);
      return [];
    }

    // Process items similar to the fetchProducts function
    const products = await Promise.all(
      result.items.map(async (item) => {
        const variation = item.itemData?.variations?.[0];
        const priceMoney = variation?.itemVariationData?.priceMoney;

        let imageUrl = "/images/placeholder.png";
        if (item.itemData?.imageIds?.[0]) {
          try {
            const fetchedUrl = await getImageUrl(item.itemData.imageIds[0]);
            if (fetchedUrl) {
              imageUrl = fetchedUrl;
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

    console.log(`Found ${products.length} products for category ${categoryId}`);
    return products;
  } catch (error) {
    console.error(`Error fetching products for category ${categoryId}:`, error);
    return [];
  }
}
