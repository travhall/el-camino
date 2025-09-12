// /src/lib/square/client.ts
import { Client, Environment } from "square/legacy";
import type { Product } from "./types";
import { getImageUrl, batchGetImageUrls } from "./imageUtils";
import { defaultCircuitBreaker, logApiError } from "./apiUtils";
import { processSquareError, logError } from "./errorUtils";
import {
  parseVariationName,
  buildAvailableAttributes,
} from "./variationParser";
import { createProductUrl } from "./slugUtils";
import { requestDeduplicator } from "./requestDeduplication";

// El Camino logo SVG as data URI for fallback images
const EL_CAMINO_LOGO_DATA_URI =
  "data:image/svg+xml,%3Csvg%20width%3D%2248%22%20height%3D%2244%22%20viewBox%3D%220%200%2048%2044%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Crect%20width%3D%2248%22%20height%3D%2244%22%20fill%3D%22white%22%20fill-opacity%3D%220.7%22%2F%3E%3Cpath%20fill-rule%3D%22evenodd%22%20clip-rule%3D%22evenodd%22%20d%3D%22M12.904%2039.9998L12.827%2040C10.7973%2040%209.28558%2039.5717%208.98823%2039.4875C7.2466%2038.9908%206.24507%2038.0664%206.05024%2037.8868C5.85673%2037.7041%204.86739%2036.7717%204.32907%2035.0827C3.79098%2033.393%204.06438%2031.424%204.10835%2031.1083C4.41789%2028.8789%205.18323%2027.5482%205.34541%2027.2665C6.28447%2025.6546%207.48735%2024.7851%207.72026%2024.617C7.95644%2024.4461%209.16912%2023.5682%2011.049%2023.0713C11.3683%2022.9875%2012.9403%2022.5746%2015.1546%2022.5746C16.5158%2022.5746%2017.3886%2022.6832%2017.5815%2022.7072C18.6588%2022.8396%2019.3555%2023.0028%2019.5075%2023.0382C20.3568%2023.2372%2020.8753%2023.4448%2020.9903%2023.4909L22.1355%2023.9657C21.9004%2025.6583%2021.6653%2027.3511%2021.4303%2029.0439H17.9585C17.4809%2028.2493%2016.9223%2027.9384%2016.8061%2027.8736C16.1433%2027.4983%2015.5003%2027.4983%2015.3821%2027.4983C15.2767%2027.4983%2014.7362%2027.4983%2014.0913%2027.7413C13.9885%2027.7807%2013.4576%2027.9843%2012.9203%2028.4478C12.8311%2028.5247%2012.3829%2028.9116%2012.0013%2029.5847C11.9369%2029.6968%2011.6208%2030.2474%2011.5013%2031.1083C11.478%2031.2752%2011.3041%2032.5284%2011.4628%2033.2133C11.6213%2033.8974%2011.9737%2034.2651%2012.0446%2034.3393C12.1158%2034.4118%2012.4791%2034.7808%2013.1537%2034.9906L13.9563%2035.1554L15.2175%2035.1904C15.4058%2035.1835%2016.431%2035.1461%2017.5641%2035.0065C22.2646%2034.2029%2023.3571%2029.7977%2023.9069%2028.6215L24.0171%2028.3595C24.5561%2027.1344%2025.2245%2026.3417%2025.3573%2026.1846L25.3606%2026.1806C25.5954%2025.8873%2026.8158%2024.3632%2029.2838%2023.4893L29.4298%2023.4357C29.6279%2023.3638%2030.6452%2022.994%2031.9888%2022.7844C32.2096%2022.7503%2033.3443%2022.5746%2034.7747%2022.5746H34.786C36.2098%2022.5754%2037.2871%2022.7496%2037.5022%2022.7844C38.7998%2022.9942%2039.7083%2023.3617%2039.8914%2023.4357C40.9837%2023.8774%2041.6851%2024.4495%2041.8228%2024.5618C41.9576%2024.6701%2042.6738%2025.2462%2043.2108%2026.1956C43.7088%2027.0762%2043.8808%2028.1905%2043.9086%2028.3705C43.9426%2028.5869%2044.1002%2029.5933%2043.9014%2031.1083C43.5843%2033.5256%2042.7306%2034.9081%2042.5479%2035.204C41.5044%2036.9042%2040.1994%2037.8105%2039.9469%2037.986C39.6973%2038.1595%2038.3898%2039.0678%2036.4452%2039.5317C36.1249%2039.6062%2034.4344%2040%2032.3546%2040C32.1384%2040%2031.0728%2040%2029.6578%2039.8188C28.3773%2039.6531%2027.4671%2039.2752%2027.2868%2039.2004C26.2078%2038.7479%2025.4973%2038.1557%2025.3599%2038.0412L24.6875%2037.3722C21.3547%2039.3369%2016.4519%2039.7748%2015.7077%2039.8414C15.4848%2039.8619%2014.0673%2039.9923%2012.9147%2039.9998H12.904ZM32.8021%2027.8074C32.2814%2027.9843%2031.9688%2028.2322%2031.9057%2028.2822C31.5413%2028.5803%2031.3528%2028.8947%2031.3163%2028.9555L30.9453%2029.7173L30.7488%2030.4681L30.6482%2031.1083L30.5709%2031.7486L30.5574%2032.5103L30.7153%2033.2832C30.7339%2033.3441%2030.8345%2033.6693%2031.1147%2033.9787C31.1649%2034.0297%2031.4077%2034.2766%2031.8776%2034.4643C31.9693%2034.4999%2032.3589%2034.652%2033.0973%2034.652C33.8354%2034.652%2034.2618%2034.4987%2034.3574%2034.4643C34.8907%2034.2768%2035.2028%2034.0295%2035.2671%2033.9787C35.6443%2033.6695%2035.8341%2033.3461%2035.8711%2033.2832C36.1097%2032.8959%2036.2213%2032.5748%2036.2438%2032.5103L36.4418%2031.7486L36.5538%2031.1083L36.6197%2030.4681L36.6317%2029.7173C36.6273%2029.6553%2036.6047%2029.3318%2036.4721%2028.9555C36.4528%2028.8957%2036.3511%2028.5801%2036.0581%2028.2822C36.0076%2028.2307%2035.7647%2027.984%2035.2818%2027.8074C35.1915%2027.7713%2034.8119%2027.6198%2034.074%2027.6198C33.3356%2027.6198%2032.8988%2027.7734%2032.8021%2027.8074ZM16.2243%2018.0371C19.1879%2018.0371%2020.8618%2017.0233%2021.2023%2016.5018H23.1817C22.9538%2018.1432%2022.7258%2019.7843%2022.4979%2021.4254H6.6506C6.87851%2019.7843%207.10642%2018.1432%207.33433%2016.5018L8.89093%2016.2182C9.2144%2013.8888%209.53787%2011.5593%209.86133%209.23003L8.38374%208.94627C8.61252%207.29765%208.84152%205.64882%209.07052%204H24.9178C24.6899%205.64133%2024.462%207.28244%2024.2341%208.92377H22.3258C22.0638%208.48625%2020.3852%207.38828%2017.7032%207.38828C17.5148%208.74334%2017.3268%2010.0984%2017.1385%2011.4535C18.3579%2011.2076%2019.5773%2010.962%2020.7968%2010.7161C20.6108%2012.0547%2020.425%2013.3934%2020.2391%2014.7322C19.088%2014.4863%2017.9368%2014.2404%2016.7857%2013.9947C16.5984%2015.3422%2016.4113%2016.6898%2016.2243%2018.0371ZM34.4142%2017.164C34.9358%2017.171%2039.3738%2017.2315%2040.7318%2015.617H42.7278C42.4589%2017.5531%2042.1901%2019.4892%2041.9213%2021.4254H23.6953C23.9233%2019.7843%2024.1512%2018.1432%2024.3791%2016.5018L25.9357%2016.2182C26.2592%2013.8888%2026.5826%2011.5593%2026.9061%209.23003L25.4316%208.92356C25.6594%207.28244%2025.8873%205.64133%2026.1153%204H37.7597C37.5318%205.64133%2037.3038%207.28244%2037.0759%208.92356L35.5161%209.23003C35.1488%2011.8745%2034.7814%2014.5192%2034.4142%2017.164Z%22%20fill%3D%22%2359564F%22%20fill-opacity%3D%220.7%22%2F%3E%3C%2Fsvg%3E";

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

        // Assemble final products with brand data, units, and SKUs
        const products = productsWithBasicInfo.map((p) => {
          // Get the variation data to extract SKU
          const item = response.result.objects?.find((obj) => obj.id === p.id);
          const variation = item?.itemData?.variations?.[0];
          const actualSku = variation?.itemVariationData?.sku || "";

          // Generate human-readable SKU for content creators
          const humanReadableSku = generateHumanReadableSku(
            p.title,
            p.brand,
            variation?.itemVariationData?.name || undefined
          );

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
          };
        });

        console.log(
          `[fetchProducts] Fetched ${products.length} products, ${
            products.filter((p) => p.brand).length
          } with brands, ${products.filter((p) => p.unit).length} with units, ${
            products.filter((p) => p.sku).length
          } with SKUs, ${products.length} with human-readable SKUs`
        );

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
        console.log(`[fetchProduct] Fetching product: ${id}`);

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

        // Process all variations with their data including proper measurement units
        const productVariations = await Promise.all(
          variations.map(async (v) => {
            const priceMoney = v.itemVariationData?.priceMoney;

            // Check for variation-specific images
            let variationImageUrl: string | undefined = undefined;
            if (v.itemVariationData?.imageIds?.[0]) {
              const imageId = v.itemVariationData.imageIds[0];
              variationImageUrl =
                variationImages[imageId as keyof typeof variationImages];
            }

            // FIXED: Properly fetch measurement unit data instead of hardcoding "each"
            let unit = "";
            if (v.itemVariationData?.measurementUnitId) {
              try {
                console.log(
                  `[fetchProduct] Fetching measurement unit: ${v.itemVariationData.measurementUnitId}`
                );

                const { result: measurementResult } =
                  await squareClient.catalogApi.retrieveCatalogObject(
                    v.itemVariationData.measurementUnitId
                  );

                if (measurementResult.object?.type === "MEASUREMENT_UNIT") {
                  const unitData = measurementResult.object.measurementUnitData;
                  console.log(
                    `[fetchProduct] Measurement unit data:`,
                    JSON.stringify(unitData, null, 2)
                  );

                  // Priority order: custom unit name > custom abbreviation > standard unit type
                  if (unitData?.measurementUnit?.customUnit?.name) {
                    unit = unitData.measurementUnit.customUnit.name;
                    console.log(
                      `[fetchProduct] Using custom unit name: ${unit}`
                    );
                  } else if (
                    unitData?.measurementUnit?.customUnit?.abbreviation
                  ) {
                    unit = unitData.measurementUnit.customUnit.abbreviation;
                    console.log(
                      `[fetchProduct] Using custom unit abbreviation: ${unit}`
                    );
                  } else if (unitData?.measurementUnit?.type) {
                    // Convert standard unit types to readable format
                    const unitType = unitData.measurementUnit.type;
                    unit = unitType.toLowerCase().replace(/_/g, " ");
                    console.log(
                      `[fetchProduct] Using standard unit type: ${unit}`
                    );
                  }
                }
              } catch (error) {
                logApiError(
                  `fetchProduct:measurementUnit:${v.itemVariationData.measurementUnitId}`,
                  error
                );
                // Don't fail the entire product fetch for unit errors - just leave unit empty
                console.warn(
                  `[fetchProduct] Failed to fetch measurement unit, using empty unit`
                );
              }
            }

            // Parse variation attributes from the name
            const attributes = parseVariationName(
              v.itemVariationData?.name || ""
            );

            return {
              id: v.id,
              variationId: v.id,
              name: v.itemVariationData?.name || "",
              price: priceMoney ? Number(priceMoney.amount) / 100 : 0,
              image: variationImageUrl,
              unit: unit || undefined, // Only include unit if it exists
              attributes: attributes, // Add parsed attributes
            };
          })
        );

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

        console.log(
          `[fetchProduct] Successfully fetched product: ${product.title}`,
          {
            variations: productVariations.length,
            hasUnit: !!product.unit,
            unit: product.unit,
            brand: product.brand,
            measurementUnitIds: variations
              .map((v) => v.itemVariationData?.measurementUnitId)
              .filter(Boolean),
          }
        );

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
