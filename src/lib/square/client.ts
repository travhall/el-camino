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

// Phase 4: Smart Cache Invalidation System
class SmartCacheManager {
  private cacheVersion = Date.now();
  private criticalEndpoints = ['/api/list-catalog', '/api/check-inventory', '/api/get-categories'];
  private lastInventoryUpdate = 0;
  private cacheStats = {
    invalidations: 0,
    lastInvalidation: 0,
    criticalUpdates: 0
  };

  /**
   * Invalidate cache when inventory changes significantly
   */
  async invalidateOnInventoryUpdate(): Promise<void> {
    try {
      // Clear browser caches for critical endpoints
      if ('caches' in window) {
        const cache = await caches.open('square-api');
        await Promise.all(
          this.criticalEndpoints.map(endpoint => 
            cache.delete(endpoint).catch(err => 
              console.warn(`[SmartCache] Failed to clear ${endpoint}:`, err)
            )
          )
        );
      }

      // Update cache version and stats
      this.cacheVersion = Date.now();
      this.lastInventoryUpdate = Date.now();
      this.cacheStats.invalidations++;
      this.cacheStats.lastInvalidation = Date.now();
      this.cacheStats.criticalUpdates++;

      console.log('[SmartCache] Invalidated critical endpoints', {
        endpoints: this.criticalEndpoints.length,
        newVersion: this.cacheVersion,
        totalInvalidations: this.cacheStats.invalidations
      });

      // Trigger performance tracking
      if (typeof window !== 'undefined' && (window as any).trackCachePerformance) {
        (window as any).trackCachePerformance('inventory-invalidation', false, 0);
      }

    } catch (error) {
      console.error('[SmartCache] Cache invalidation failed:', error);
    }
  }

  /**
   * Check if cache should be invalidated based on time or conditions
   */
  shouldInvalidateCache(lastUpdate: number, threshold: number = 300000): boolean {
    const timeSinceUpdate = Date.now() - lastUpdate;
    return timeSinceUpdate > threshold;
  }

  /**
   * Get current cache version for cache busting
   */
  getCacheVersion(): number {
    return this.cacheVersion;
  }

  /**
   * Get cache statistics for monitoring
   */
  getCacheStats() {
    return {
      ...this.cacheStats,
      cacheVersion: this.cacheVersion,
      lastInventoryUpdate: this.lastInventoryUpdate,
      timeSinceLastUpdate: Date.now() - this.lastInventoryUpdate
    };
  }

  /**
   * Force cache invalidation (for manual triggers)
   */
  async forceInvalidation(reason: string = 'manual'): Promise<void> {
    console.log(`[SmartCache] Force invalidation triggered: ${reason}`);
    await this.invalidateOnInventoryUpdate();
  }
}

// Export singleton instance
export const smartCacheManager = new SmartCacheManager();

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
                : "data:image/svg+xml,%3Csvg%20width%3D%2248%22%20height%3D%2244%22%20fill%3D%22%23374151%22%20viewBox%3D%220%200%2048%2044%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%20%3Cpath%20fill-rule%3D%22evenodd%22%20clip-rule%3D%22evenodd%22%20d%3D%22M10.6848%2043.9997L10.5924%2044C8.15681%2044%206.34269%2043.4765%205.98588%2043.3736C3.89592%2042.7665%202.69408%2041.6367%202.46029%2041.4172C2.22808%2041.1939%201.04087%2040.0543%200.394889%2037.99C-0.250828%2035.9248%200.0772527%2033.5182%200.130018%2033.1324C0.501462%2030.4075%201.41988%2028.7811%201.61449%2028.4368C2.74136%2026.4667%204.18482%2025.404%204.46431%2025.1986C4.74773%2024.9897%206.20294%2023.9167%208.45877%2023.3094C8.84197%2023.207%2010.7284%2022.7023%2013.3855%2022.7023C15.0189%2022.7023%2016.0663%2022.835%2016.2978%2022.8643C17.5905%2023.0262%2018.4266%2023.2256%2018.609%2023.2689C19.6282%2023.5121%2020.2504%2023.7659%2020.3883%2023.8222L21.7626%2024.4025C21.4805%2026.4713%2021.1984%2028.5402%2020.9163%2030.6092H16.7502C16.1771%2029.638%2015.5068%2029.258%2015.3673%2029.1789C14.5719%2028.7202%2013.8003%2028.7202%2013.6585%2028.7202C13.532%2028.7202%2012.8834%2028.7202%2012.1095%2029.0172C11.9862%2029.0653%2011.3491%2029.3141%2010.7044%2029.8806C10.5973%2029.9746%2010.0595%2030.4475%209.60157%2031.2702C9.52426%2031.4072%209.14498%2032.0802%209.00157%2033.1324C8.97362%2033.3364%208.76491%2034.8681%208.95534%2035.7051C9.1455%2036.5413%209.5684%2036.9907%209.65356%2037.0814C9.73897%2037.17%2010.1749%2037.621%2010.9844%2037.8774L11.9475%2038.0788L13.461%2038.1216C13.6869%2038.1132%2014.9172%2038.0674%2016.2769%2037.8968C21.9175%2036.9146%2023.2285%2031.5305%2023.8883%2030.093L24.0205%2029.7727C24.6673%2028.2754%2025.4694%2027.3065%2025.6288%2027.1145L25.6327%2027.1096C25.9145%2026.7511%2027.3789%2024.8884%2030.3405%2023.8202L30.5158%2023.7547C30.7535%2023.6669%2031.9742%2023.2149%2033.5866%2022.9587C33.8515%2022.917%2035.2132%2022.7023%2036.9296%2022.7023H36.9432C38.6518%2022.7033%2039.9445%2022.9162%2040.2026%2022.9587C41.7597%2023.2151%2042.85%2023.6643%2043.0697%2023.7547C44.3804%2024.2946%2045.2221%2024.9938%2045.3874%2025.1311C45.5491%2025.2635%2046.4085%2025.9676%2047.0529%2027.128C47.6505%2028.2043%2047.8569%2029.5662%2047.8903%2029.7862C47.9311%2030.0507%2048.1202%2031.2807%2047.8817%2033.1324C47.5011%2036.0868%2046.4767%2037.7766%2046.2575%2038.1382C45.0053%2040.2163%2043.4393%2041.324%2043.1363%2041.5384C42.8367%2041.7505%2041.2678%2042.8607%2038.9342%2043.4276C38.5499%2043.5187%2036.5213%2044%2034.0255%2044C33.7661%2044%2032.4874%2044%2030.7893%2043.7785C29.2528%2043.576%2028.1605%2043.1141%2027.9442%2043.0227C26.6493%2042.4696%2025.7967%2041.7459%2025.6319%2041.6059L24.825%2040.7882C20.8256%2043.1895%2014.9423%2043.7247%2014.0492%2043.8062C13.7818%2043.8312%2012.0807%2043.9906%2010.6976%2043.9997L10.6846%2044L10.6848%2043.9997ZM34.5625%2029.0979C33.9377%2029.3141%2033.5626%2029.6171%2033.4868%2029.6782C33.0496%2030.0426%2032.8233%2030.4269%2032.7795%2030.5012L32.3344%2031.4322L32.0985%2032.3499L31.9778%2033.1324L31.8851%2033.9149L31.8689%2034.8459L32.0583%2035.7906C32.0807%2035.865%2032.2014%2036.2625%2032.5376%2036.6406C32.5979%2036.703%2032.8892%2037.0047%2033.4531%2037.2342C33.5631%2037.2777%2034.0307%2037.4636%2034.9167%2037.4636C35.8025%2037.4636%2036.3142%2037.2762%2036.4289%2037.2342C37.0688%2037.005%2037.4434%2036.7027%2037.5205%2036.6406C37.9732%2036.2627%2038.2009%2035.8675%2038.2453%2035.7906C38.5316%2035.3172%2038.6656%2034.9248%2038.6925%2034.8459L38.9302%2033.9149L39.0645%2033.1324L39.1436%2032.3499L39.158%2031.4322C39.1528%2031.3565%2039.1256%2030.9611%2038.9665%2030.5012C38.9433%2030.4281%2038.8213%2030.0423%2038.4697%2029.6782C38.4091%2029.6153%2038.1176%2029.3138%2037.5382%2029.0979C37.4298%2029.0538%2036.9743%2028.8687%2036.0888%2028.8687C35.2027%2028.8687%2034.6785%2029.0564%2034.5625%2029.0979ZM14.6691%2017.1565C18.2255%2017.1565%2020.2342%2015.9174%2020.6428%2015.28H23.018C22.7445%2017.2861%2022.471%2019.2919%2022.1975%2021.2977H3.18072C3.45421%2019.2919%203.7277%2017.2861%204.00119%2015.28L5.86912%2014.9334C6.25728%2012.0863%206.64544%209.23915%207.0336%206.39226L5.26049%206.04544C5.53502%204.03046%205.80982%202.01523%206.08462%200H25.1014C24.8279%202.00607%2024.5544%204.01187%2024.2809%206.01794H21.9909C21.6766%205.48319%2019.6622%204.14123%2016.4438%204.14123C16.2178%205.79742%2015.9921%207.45361%2015.7662%209.1098C17.2295%208.80932%2018.6928%208.5091%2020.1561%208.20862C19.933%209.84469%2019.71%2011.4808%2019.4869%2013.1171C18.1056%2012.8166%2016.7241%2012.5161%2015.3428%2012.2157C15.1181%2013.8627%2014.8935%2015.5097%2014.6691%2017.1565ZM36.497%2016.0893C37.1229%2016.0979%2042.4485%2016.1718%2044.0782%2014.1986H46.4733C46.1507%2016.5649%2045.8281%2018.9313%2045.5055%2021.2977H23.6344C23.9079%2019.2919%2024.1814%2017.2861%2024.4549%2015.28L26.3228%2014.9334C26.711%2012.0863%2027.0991%209.23915%2027.4873%206.39226L25.7179%206.01769C25.9913%204.01187%2026.2648%202.00607%2026.5383%200H40.5116C40.2381%202.00607%2039.9646%204.01187%2039.6911%206.01769L37.8193%206.39226C37.3786%209.62443%2036.9377%2012.8568%2036.497%2016.0893Z%22%20%2F%3E%20%3C%2Fsvg%3E",
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
        const EL_CAMINO_ICON =
          "data:image/svg+xml,%3Csvg%20width%3D%2248%22%20height%3D%2244%22%20fill%3D%22%23374151%22%20viewBox%3D%220%200%2048%2044%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%20%3Cpath%20fill-rule%3D%22evenodd%22%20clip-rule%3D%22evenodd%22%20d%3D%22M10.6848%2043.9997L10.5924%2044C8.15681%2044%206.34269%2043.4765%205.98588%2043.3736C3.89592%2042.7665%202.69408%2041.6367%202.46029%2041.4172C2.22808%2041.1939%201.04087%2040.0543%200.394889%2037.99C-0.250828%2035.9248%200.0772527%2033.5182%200.130018%2033.1324C0.501462%2030.4075%201.41988%2028.7811%201.61449%2028.4368C2.74136%2026.4667%204.18482%2025.404%204.46431%2025.1986C4.74773%2024.9897%206.20294%2023.9167%208.45877%2023.3094C8.84197%2023.207%2010.7284%2022.7023%2013.3855%2022.7023C15.0189%2022.7023%2016.0663%2022.835%2016.2978%2022.8643C17.5905%2023.0262%2018.4266%2023.2256%2018.609%2023.2689C19.6282%2023.5121%2020.2504%2023.7659%2020.3883%2023.8222L21.7626%2024.4025C21.4805%2026.4713%2021.1984%2028.5402%2020.9163%2030.6092H16.7502C16.1771%2029.638%2015.5068%2029.258%2015.3673%2029.1789C14.5719%2028.7202%2013.8003%2028.7202%2013.6585%2028.7202C13.532%2028.7202%2012.8834%2028.7202%2012.1095%2029.0172C11.9862%2029.0653%2011.3491%2029.3141%2010.7044%2029.8806C10.5973%2029.9746%2010.0595%2030.4475%209.60157%2031.2702C9.52426%2031.4072%209.14498%2032.0802%209.00157%2033.1324C8.97362%2033.3364%208.76491%2034.8681%208.95534%2035.7051C9.1455%2036.5413%209.5684%2036.9907%209.65356%2037.0814C9.73897%2037.17%2010.1749%2037.621%2010.9844%2037.8774L11.9475%2038.0788L13.461%2038.1216C13.6869%2038.1132%2014.9172%2038.0674%2016.2769%2037.8968C21.9175%2036.9146%2023.2285%2031.5305%2023.8883%2030.093L24.0205%2029.7727C24.6673%2028.2754%2025.4694%2027.3065%2025.6288%2027.1145L25.6327%2027.1096C25.9145%2026.7511%2027.3789%2024.8884%2030.3405%2023.8202L30.5158%2023.7547C30.7535%2023.6669%2031.9742%2023.2149%2033.5866%2022.9587C33.8515%2022.917%2035.2132%2022.7023%2036.9296%2022.7023H36.9432C38.6518%2022.7033%2039.9445%2022.9162%2040.2026%2022.9587C41.7597%2023.2151%2042.85%2023.6643%2043.0697%2023.7547C44.3804%2024.2946%2045.2221%2024.9938%2045.3874%2025.1311C45.5491%2025.2635%2046.4085%2025.9676%2047.0529%2027.128C47.6505%2028.2043%2047.8569%2029.5662%2047.8903%2029.7862C47.9311%2030.0507%2048.1202%2031.2807%2047.8817%2033.1324C47.5011%2036.0868%2046.4767%2037.7766%2046.2575%2038.1382C45.0053%2040.2163%2043.4393%2041.324%2043.1363%2041.5384C42.8367%2041.7505%2041.2678%2042.8607%2038.9342%2043.4276C38.5499%2043.5187%2036.5213%2044%2034.0255%2044C33.7661%2044%2032.4874%2044%2030.7893%2043.7785C29.2528%2043.576%2028.1605%2043.1141%2027.9442%2043.0227C26.6493%2042.4696%2025.7967%2041.7459%2025.6319%2041.6059L24.825%2040.7882C20.8256%2043.1895%2014.9423%2043.7247%2014.0492%2043.8062C13.7818%2043.8312%2012.0807%2043.9906%2010.6976%2043.9997L10.6846%2044L10.6848%2043.9997ZM34.5625%2029.0979C33.9377%2029.3141%2033.5626%2029.6171%2033.4868%2029.6782C33.0496%2030.0426%2032.8233%2030.4269%2032.7795%2030.5012L32.3344%2031.4322L32.0985%2032.3499L31.9778%2033.1324L31.8851%2033.9149L31.8689%2034.8459L32.0583%2035.7906C32.0807%2035.865%2032.2014%2036.2625%2032.5376%2036.6406C32.5979%2036.703%2032.8892%2037.0047%2033.4531%2037.2342C33.5631%2037.2777%2034.0307%2037.4636%2034.9167%2037.4636C35.8025%2037.4636%2036.3142%2037.2762%2036.4289%2037.2342C37.0688%2037.005%2037.4434%2036.7027%2037.5205%2036.6406C37.9732%2036.2627%2038.2009%2035.8675%2038.2453%2035.7906C38.5316%2035.3172%2038.6656%2034.9248%2038.6925%2034.8459L38.9302%2033.9149L39.0645%2033.1324L39.1436%2032.3499L39.158%2031.4322C39.1528%2031.3565%2039.1256%2030.9611%2038.9665%2030.5012C38.9433%2030.4281%2038.8213%2030.0423%2038.4697%2029.6782C38.4091%2029.6153%2038.1176%2029.3138%2037.5382%2029.0979C37.4298%2029.0538%2036.9743%2028.8687%2036.0888%2028.8687C35.2027%2028.8687%2034.6785%2029.0564%2034.5625%2029.0979ZM14.6691%2017.1565C18.2255%2017.1565%2020.2342%2015.9174%2020.6428%2015.28H23.018C22.7445%2017.2861%2022.471%2019.2919%2022.1975%2021.2977H3.18072C3.45421%2019.2919%203.7277%2017.2861%204.00119%2015.28L5.86912%2014.9334C6.25728%2012.0863%206.64544%209.23915%207.0336%206.39226L5.26049%206.04544C5.53502%204.03046%205.80982%202.01523%206.08462%200H25.1014C24.8279%202.00607%2024.5544%204.01187%2024.2809%206.01794H21.9909C21.6766%205.48319%2019.6622%204.14123%2016.4438%204.14123C16.2178%205.79742%2015.9921%207.45361%2015.7662%209.1098C17.2295%208.80932%2018.6928%208.5091%2020.1561%208.20862C19.933%209.84469%2019.71%2011.4808%2019.4869%2013.1171C18.1056%2012.8166%2016.7241%2012.5161%2015.3428%2012.2157C15.1181%2013.8627%2014.8935%2015.5097%2014.6691%2017.1565ZM36.497%2016.0893C37.1229%2016.0979%2042.4485%2016.1718%2044.0782%2014.1986H46.4733C46.1507%2016.5649%2045.8281%2018.9313%2045.5055%2021.2977H23.6344C23.9079%2019.2919%2024.1814%2017.2861%2024.4549%2015.28L26.3228%2014.9334C26.711%2012.0863%2027.0991%209.23915%2027.4873%206.39226L25.7179%206.01769C25.9913%204.01187%2026.2648%202.00607%2026.5383%200H40.5116C40.2381%202.00607%2039.9646%204.01187%2039.6911%206.01769L37.8193%206.39226C37.3786%209.62443%2036.9377%2012.8568%2036.497%2016.0893Z%22%20%2F%3E%20%3C%2Fsvg%3E";
        let imageUrl = EL_CAMINO_ICON;
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
