// /src/lib/square/client.ts
import { Client, Environment } from "square/legacy";
import type { Product, SaleInfo } from "./types";
import { getImageUrl, batchGetImageUrls } from "./imageUtils";
import { defaultCircuitBreaker, logApiError } from "./apiUtils";
import { processSquareError, logError } from "./errorUtils";
import {
  parseVariationName,
  buildAvailableAttributes,
} from "./variationParser";
import { createProductUrl } from "./slugUtils";
import { requestDeduplicator } from "./requestDeduplication";
import { EL_CAMINO_LOGO_DATA_URI } from "@/lib/constants/assets";

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
  environment:
    import.meta.env.PUBLIC_SQUARE_ENVIRONMENT === "production"
      ? Environment.Production
      : Environment.Sandbox,
  squareVersion: "2024-02-28",
});

export const jsonStringifyReplacer = (_key: string, value: any) => {
  if (typeof value === "bigint") {
    return value.toString();
  }
  return value;
};

/**
 * Extract brand value from custom attributes
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

/**
 * Extract sale information from variation custom attributes
 * @param customAttributeValues - Variation-level custom attributes
 * @param regularPrice - Regular price from priceMoney (in dollars)
 * @returns SaleInfo object or null if no valid sale pricing
 */
export function extractSaleInfo(
  customAttributeValues: any,
  regularPrice: number
): SaleInfo | null {
  if (!customAttributeValues) return null;

  // Look for sale_price attribute
  const salePriceAttr = Object.values(customAttributeValues).find(
    (attr: any) =>
      attr?.name?.toLowerCase() === "sale price" ||
      attr?.key?.toLowerCase() === "sale_price"
  ) as any;

  if (!salePriceAttr || salePriceAttr.type !== "NUMBER") return null;

  // Parse sale price (Square stores as string)
  const salePrice = salePriceAttr.numberValue
    ? Number(salePriceAttr.numberValue)
    : null;

  if (!salePrice || salePrice <= 0 || salePrice >= regularPrice) return null;

  // Calculate discount percentage
  const discountPercent = Math.round(
    ((regularPrice - salePrice) / regularPrice) * 100
  );

  // Optional: Extract sale end date
  const saleEndDateAttr = Object.values(customAttributeValues).find(
    (attr: any) =>
      attr?.name?.toLowerCase() === "sale end date" ||
      attr?.key?.toLowerCase() === "sale_end_date"
  ) as any;

  const saleEndDate =
    saleEndDateAttr?.type === "STRING" && saleEndDateAttr.stringValue
      ? saleEndDateAttr.stringValue
      : undefined;

  const saleInfoResult = {
    salePrice,
    originalPrice: regularPrice,
    discountPercent,
    saleEndDate,
  };

  return saleInfoResult;
}

/**
 * Generate human-readable SKU from product data
 * Creates content-creator friendly identifiers like "SPITFIRE-CLASSIC-SOCKS"
 */
function generateHumanReadableSku(
  title: string,
  brand?: string,
  variationName?: string
): string {
  // Use brand if available, otherwise extract from title
  const brandPart = brand || extractBrandFromTitle(title);

  // Clean and format the main product name
  const titlePart = title
    .replace(new RegExp(`^${brandPart}\\s*`, "i"), "") // Remove brand from start
    .replace(/[^a-zA-Z0-9\s]/g, "") // Remove special chars
    .split(" ")
    .filter((word) => word.length > 0)
    .map((word) => word.toUpperCase())
    .slice(0, 3) // Limit to 3 words for readability
    .join("-");

  // Add variation details if present and meaningful
  const variationPart =
    variationName && variationName.trim() && variationName !== title
      ? `-${variationName
          .replace(/[^a-zA-Z0-9\s]/g, "")
          .split(" ")
          .slice(0, 2)
          .join("-")
          .toUpperCase()}`
      : "";

  return `${brandPart.toUpperCase()}-${titlePart}${variationPart}`;
}

/**
 * Extract likely brand name from product title
 */
function extractBrandFromTitle(title: string): string {
  // Common skate brands to detect
  const knownBrands = [
    "spitfire",
    "thrasher",
    "krooked",
    "real",
    "baker",
    "toy machine",
    "independent",
    "thunder",
    "ace",
    "venture",
    "bones",
    "girl",
    "chocolate",
    "anti-hero",
    "creature",
    "santa cruz",
    "powell peralta",
    "element",
    "plan b",
    "flip",
    "zero",
    "mystery",
    "blind",
    "world industries",
    "skeleton key",
    "jacuzzi unlimited",
    "sci-fi fantasy",
    "bronze",
    "slappy",
    "huf",
    "vans",
    "nike sb",
    "adidas",
    "converse",
  ];

  const titleLower = title.toLowerCase();

  for (const brand of knownBrands) {
    if (titleLower.startsWith(brand.toLowerCase())) {
      return brand.replace(/\s+/g, ""); // Remove spaces for SKU
    }
  }

  // Fallback: use first word
  return title.split(" ")[0] || "UNKNOWN";
}

export async function fetchProducts(): Promise<Product[]> {
  const cacheKey = "products:all";

  return requestDeduplicator.dedupe(cacheKey, () =>
    defaultCircuitBreaker.execute(async () => {
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

        // First, extract basic product info including brand from custom attributes
        const productsWithBasicInfo = response.result.objects
          .filter((item) => item.type === "ITEM")
          .map((item) => {
            const variation = item.itemData?.variations?.[0];
            const priceMoney = variation?.itemVariationData?.priceMoney;

            // Extract brand from custom attributes
            const brandValue = extractBrandValue(item.customAttributeValues);

            return {
              id: item.id,
              catalogObjectId: item.id,
              variationId: variation?.id || item.id,
              title: item.itemData?.name || "",
              description: item.itemData?.description || "",
              imageId: item.itemData?.imageIds?.[0] || null,
              measurementUnitId:
                variation?.itemVariationData?.measurementUnitId || null, // NEW: Extract measurement unit ID
              price: priceMoney ? Number(priceMoney.amount) / 100 : 0,
              brand: brandValue, // Add brand extraction
            };
          });

        // Extract unique IDs for batch fetching
        const imageIds = productsWithBasicInfo
          .map((p) => p.imageId)
          .filter(Boolean) as string[];

        const measurementUnitIds = productsWithBasicInfo
          .map((p) => p.measurementUnitId)
          .filter(Boolean) as string[];

        // Batch fetch images and measurement units in parallel
        const [imageUrlMap, measurementUnitsMap] = await Promise.all([
          imageIds.length > 0
            ? batchGetImageUrls(imageIds)
            : Promise.resolve({} as Record<string, string>),
          measurementUnitIds.length > 0
            ? fetchMeasurementUnits(measurementUnitIds)
            : Promise.resolve({} as Record<string, string>),
        ]);

        // Assemble final products with brand data, units, SKUs, and variations
        const products = productsWithBasicInfo.map((p) => {
          // Get the item data for variations
          const item = response.result.objects?.find((obj) => obj.id === p.id);
          const variations = item?.itemData?.variations || [];
          const variation = variations[0];
          const actualSku = variation?.itemVariationData?.sku || "";

          // Generate human-readable SKU for content creators
          const humanReadableSku = generateHumanReadableSku(
            p.title,
            p.brand,
            variation?.itemVariationData?.name || undefined
          );

          // Build variations array with sale info (same pattern as categories.ts)
          const productVariations = variations.map((v: any) => {
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
            id: p.id,
            catalogObjectId: p.catalogObjectId,
            variationId: p.variationId,
            title: p.title,
            description: p.description,
            image:
              p.imageId && imageUrlMap[p.imageId]
                ? imageUrlMap[p.imageId]
                : EL_CAMINO_LOGO_DATA_URI,
            price: p.price,
            url: createProductUrl({ title: p.title }),
            brand: p.brand || undefined, // Only include if brand exists
            unit: p.measurementUnitId
              ? measurementUnitsMap[p.measurementUnitId] || undefined
              : undefined, // NEW: Include unit
            sku: actualSku || undefined, // Square's actual SKU if present
            humanReadableSku: humanReadableSku, // Always generate for content creators
            variations: productVariations.length > 0 ? productVariations : undefined,
          };
        });

        // console.log(
        //   `[fetchProducts] Fetched ${products.length} products, ${
        //     products.filter((p) => p.brand).length
        //   } with brands, ${products.filter((p) => p.unit).length} with units, ${
        //     products.filter((p) => p.sku).length
        //   } with SKUs, ${products.length} with human-readable SKUs`
        // );

        return products;
      } catch (error) {
        logApiError("fetchProducts", error);
        return [];
      }
    })
  );
}

// Add the fetchMeasurementUnits function (copied from categories.ts)
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

export async function fetchProduct(id: string): Promise<Product | null> {
  const cacheKey = `product:${id}`;

  return requestDeduplicator.dedupe(cacheKey, () =>
    defaultCircuitBreaker.execute(async () => {
      try {
        // console.log(`[fetchProduct] Fetching product: ${id}`);

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
        const defaultPriceMoney =
          defaultVariation?.itemVariationData?.priceMoney;

        if (!defaultVariation || !defaultPriceMoney) return null;

        // Get image - we'll do this in parallel with variation processing
        let imageUrl = EL_CAMINO_LOGO_DATA_URI;
        let imagePromise: Promise<string | null> | null = null;

        if (item.itemData?.imageIds?.[0]) {
          imagePromise = getImageUrl(item.itemData.imageIds[0]);
        }

        // Get all variation IDs with images for batch fetching
        const variationImageIds = variations
          .filter((v) => v.itemVariationData?.imageIds?.[0])
          .map((v) => v.itemVariationData!.imageIds![0]);

        // Get all measurement unit IDs for batch fetching
        const measurementUnitIds = variations
          .map((v) => v.itemVariationData?.measurementUnitId)
          .filter(Boolean) as string[];

        // Fetch all variation images and measurement units in parallel
        const variationImagePromise =
          variationImageIds.length > 0
            ? batchGetImageUrls(variationImageIds)
            : Promise.resolve({} as Record<string, string>);

        const measurementUnitsPromise =
          measurementUnitIds.length > 0
            ? fetchMeasurementUnits(measurementUnitIds)
            : Promise.resolve({} as Record<string, string>);

        // Wait for all promises to resolve
        const [mainImage, variationImages, unitsMap] = await Promise.all([
          imagePromise,
          variationImagePromise,
          measurementUnitsPromise,
        ]);

        if (mainImage) {
          imageUrl = mainImage;
        }

        // Process all variations with their data including measurement units
        const productVariations = variations.map((v) => {
          const priceMoney = v.itemVariationData?.priceMoney;
          const regularPrice = priceMoney ? Number(priceMoney.amount) / 100 : 0;

          // Check for variation-specific images
          let variationImageUrl: string | undefined = undefined;
          if (v.itemVariationData?.imageIds?.[0]) {
            const imageId = v.itemVariationData.imageIds[0];
            variationImageUrl =
              variationImages[imageId as keyof typeof variationImages];
          }

          // Get measurement unit from batched results
          const unit = v.itemVariationData?.measurementUnitId
            ? unitsMap[v.itemVariationData.measurementUnitId] || ""
            : "";

          // Parse variation attributes from the name
          const attributes = parseVariationName(
            v.itemVariationData?.name || ""
          );

          // Extract sale information from variation custom attributes
          const saleInfo = extractSaleInfo(
            v.customAttributeValues,
            regularPrice
          );

          return {
            id: v.id,
            variationId: v.id,
            name: v.itemVariationData?.name || "",
            price: regularPrice,
            image: variationImageUrl,
            unit: unit || undefined, // Only include unit if it exists
            attributes: attributes, // Add parsed attributes
            saleInfo: saleInfo || undefined, // Add sale info if present
          };
        });

        // Build available attributes map
        const availableAttributes = buildAvailableAttributes(productVariations);

        // Extract brand using the same function as fetchProducts
        const brandValue = extractBrandValue(item.customAttributeValues);

        // Use default variation unit or first found unit
        const defaultUnit = productVariations[0]?.unit ?? "";

        const product = {
          id: item.id,
          catalogObjectId: item.id,
          variationId: defaultVariation.id,
          title: item.itemData?.name || "",
          description: item.itemData?.description || "",
          image: imageUrl,
          price: Number(defaultPriceMoney.amount) / 100,
          url: createProductUrl({ title: item.itemData?.name || "" }),
          variations: productVariations,
          selectedVariationId: defaultVariation.id,
          brand: brandValue || undefined, // Only include if brand exists
          unit: defaultUnit,
          availableAttributes: availableAttributes, // Add available attributes
        };

        // console.log(
        //   `[fetchProduct] Successfully fetched product: ${product.title}`,
        //   {
        //     variations: productVariations.length,
        //     hasUnit: !!product.unit,
        //     unit: product.unit,
        //     brand: product.brand,
        //     measurementUnitIds: variations
        //       .map((v) => v.itemVariationData?.measurementUnitId)
        //       .filter(Boolean),
        //   }
        // );

        return product;
      } catch (error) {
        // Use our new error handling utilities
        const appError = processSquareError(error, `fetchProduct:${id}`);
        logError(appError);

        // Always return null on error, never undefined
        return null;
      }
    })
  );
}

/**
 * Clean API state and caches
 */
export function cleanupClientState(): void {
  // Reset circuit breaker
  defaultCircuitBreaker.reset();
  // Clear request deduplication cache
  requestDeduplicator.clear();
}
