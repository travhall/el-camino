// /src/lib/square/client.ts
import { Client, Environment } from "square";
import type { Product } from "./types";
import { getImageUrl, batchGetImageUrls } from "./imageUtils";
import { defaultCircuitBreaker, logApiError } from "./apiUtils";
import { processSquareError, logError } from "./errorUtils";

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

export async function fetchProducts(): Promise<Product[]> {
  return defaultCircuitBreaker.execute(async () => {
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

      if (!response.result.objects?.length) {
        console.log("No products found in catalog");
        return [];
      }

      // First, extract basic product info without async operations
      const productsWithBasicInfo = response.result.objects
        .filter((item) => item.type === "ITEM")
        .map((item) => {
          const variation = item.itemData?.variations?.[0];
          const priceMoney = variation?.itemVariationData?.priceMoney;

          return {
            id: item.id,
            catalogObjectId: item.id,
            variationId: variation?.id || item.id,
            title: item.itemData?.name || "",
            description: item.itemData?.description || "",
            imageId: item.itemData?.imageIds?.[0] || null,
            price: priceMoney ? Number(priceMoney.amount) / 100 : 0,
          };
        });

      // Then fetch all images in parallel
      const imageIds = productsWithBasicInfo
        .map((p) => p.imageId)
        .filter(Boolean) as string[];

      const imageUrlMap: Record<string, string> = {};
      if (imageIds.length > 0) {
        const batchedImages = await batchGetImageUrls(imageIds);
        Object.assign(imageUrlMap, batchedImages);
      }

      // Assemble final products
      const products = productsWithBasicInfo.map((p) => ({
        id: p.id,
        catalogObjectId: p.catalogObjectId,
        variationId: p.variationId,
        title: p.title,
        description: p.description,
        image:
          p.imageId && imageUrlMap[p.imageId]
            ? imageUrlMap[p.imageId]
            : "/images/placeholder.png",
        price: p.price,
        url: `/product/${p.id}`,
      }));

      return products;
    } catch (error) {
      logApiError("fetchProducts", error);
      return [];
    }
  });
}

export async function fetchProduct(id: string): Promise<Product | null> {
  return defaultCircuitBreaker.execute(async () => {
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

      // Get image - we'll do this in parallel with variation processing
      let imageUrl = "/images/placeholder.png";
      let imagePromise: Promise<string | null> | null = null;

      if (item.itemData?.imageIds?.[0]) {
        imagePromise = getImageUrl(item.itemData.imageIds[0]);
      }

      // Get all variation IDs with images for batch fetching
      const variationImageIds = variations
        .filter((v) => v.itemVariationData?.imageIds?.[0])
        .map((v) => v.itemVariationData!.imageIds![0]);

      // Fetch all variation images in parallel
      const variationImagePromise =
        variationImageIds.length > 0
          ? batchGetImageUrls(variationImageIds)
          : Promise.resolve({} as Record<string, string>);

      // Wait for both promises to resolve
      const [mainImage, variationImages] = await Promise.all([
        imagePromise,
        variationImagePromise,
      ]);

      if (mainImage) {
        imageUrl = mainImage;
      }

      // Process all variations with their data
      const productVariations = variations.map((v) => {
        const priceMoney = v.itemVariationData?.priceMoney;

        // Check for variation-specific images
        let variationImageUrl: string | undefined = undefined;
        if (v.itemVariationData?.imageIds?.[0]) {
          const imageId = v.itemVariationData.imageIds[0];
          variationImageUrl =
            variationImages[imageId as keyof typeof variationImages];
        }

        // For now, we'll use placeholder unit logic
        // A more advanced implementation would batch fetch measurement units
        let unit = "";
        if (v.itemVariationData?.measurementUnitId) {
          // Placeholder for measurement unit
          unit = "each";
        }

        return {
          id: v.id,
          variationId: v.id,
          name: v.itemVariationData?.name || "",
          price: priceMoney ? Number(priceMoney.amount) / 100 : 0,
          image: variationImageUrl,
          unit: unit,
        };
      });

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
      const defaultUnit = productVariations[0]?.unit ?? "";

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
      // Use our new error handling utilities
      const appError = processSquareError(error, `fetchProduct:${id}`);
      logError(appError);

      // Always return null on error, never undefined
      return null;
    }
  });
}

/**
 * Clean API state and caches
 */
export function cleanupClientState(): void {
  // Reset circuit breaker
  defaultCircuitBreaker.reset();
}
