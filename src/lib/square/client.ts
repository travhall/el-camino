// /src/lib/square/client.ts
export { squareClient, validateEnvironment } from "./squareInstance";

import type { Product } from "./types";
import { batchGetImageUrls } from "./imageUtils";
import { logApiError } from "./apiUtils";
import { catalogRetryClient } from "./apiRetry";
import { logError } from "./errorUtils";
import { processSquareError } from "./serverErrorUtils";
import { fetchMeasurementUnits } from "./productUtils";
import { requestDeduplicator } from "./requestDeduplication";
import { validateEnvironment } from "./squareInstance";
import { fetchAllCatalogItems, fetchCatalogItemById } from "./catalogFetch";
import {
  collectBulkFetchIds,
  mapCatalogItemsToProducts,
  mapSingleCatalogItemToProduct,
} from "./productMapper";
import { EL_CAMINO_LOGO_DATA_URI } from "@/lib/constants/assets";
import { productCache } from "@/lib/cache/blobCache";
import { logger } from "@/lib/logger";

export async function fetchProducts(): Promise<Product[]> {
  const cacheKey = "products:all";

  validateEnvironment();
  return productCache.getOrCompute(cacheKey, () =>
    requestDeduplicator.dedupe(cacheKey, () =>
      catalogRetryClient.executeWithRetry(async () => {
        try {
          const allObjects = await fetchAllCatalogItems();

          if (!allObjects.length) {
            logger.debug("No products found in catalog");
            return [];
          }

          const { imageIds, measurementUnitIds } = collectBulkFetchIds(allObjects);

          const [imageUrlMap, measurementUnitsMap] = await Promise.all([
            imageIds.length > 0
              ? batchGetImageUrls(imageIds)
              : Promise.resolve({} as Record<string, string>),
            measurementUnitIds.length > 0
              ? fetchMeasurementUnits(measurementUnitIds)
              : Promise.resolve({} as Record<string, string>),
          ]);

          return mapCatalogItemsToProducts(allObjects, imageUrlMap, measurementUnitsMap);
        } catch (error) {
          logApiError("fetchProducts", error);
          return [];
        }
      }, "fetchProducts")
    )
  );
}

export async function fetchProduct(id: string): Promise<Product | null> {
  validateEnvironment();
  const cached = await productCache.get(id);
  if (cached) return cached;

  const cacheKey = `product:${id}`;

  return requestDeduplicator.dedupe(cacheKey, () =>
    catalogRetryClient.executeWithRetry(async () => {
      try {
        const catalogResult = await fetchCatalogItemById(id);

        if (!catalogResult.object || catalogResult.object.type !== "ITEM") return null;

        const item = catalogResult.object;
        const variations = item.itemData?.variations || [];

        if (!variations.length) return null;

        const allItemImageIds: string[] = item.itemData?.imageIds ?? [];
        const variationImageIds = variations.flatMap(
          (v: any) => v.itemVariationData?.imageIds ?? []
        );
        const measurementUnitIds = variations
          .map((v: any) => v.itemVariationData?.measurementUnitId)
          .filter(Boolean) as string[];

        const [allItemImages, variationImages, unitsMap] = await Promise.all([
          allItemImageIds.length > 0
            ? batchGetImageUrls(allItemImageIds)
            : Promise.resolve({} as Record<string, string>),
          variationImageIds.length > 0
            ? batchGetImageUrls(variationImageIds)
            : Promise.resolve({} as Record<string, string>),
          measurementUnitIds.length > 0
            ? fetchMeasurementUnits(measurementUnitIds)
            : Promise.resolve({} as Record<string, string>),
        ]);

        const primaryImageId = allItemImageIds[0];
        const imageUrl =
          (primaryImageId && allItemImages[primaryImageId]) || EL_CAMINO_LOGO_DATA_URI;

        const allImageUrls: string[] = allItemImageIds
          .map((imgId) => allItemImages[imgId])
          .filter(
            (url): url is string => !!url && url !== EL_CAMINO_LOGO_DATA_URI
          );

        const product = mapSingleCatalogItemToProduct(
          item,
          imageUrl,
          allImageUrls,
          variationImages,
          unitsMap
        );
        if (!product) return null;

        productCache.set(id, product).catch(() => {});

        return product;
      } catch (error) {
        const appError = processSquareError(error, `fetchProduct:${id}`);
        logError(appError);
        return null;
      }
    }, "fetchProduct")
  );
}
