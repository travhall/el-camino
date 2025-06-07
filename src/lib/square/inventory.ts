// src/lib/square/inventory.ts
import { squareClient } from "./client";
import type { Product, ProductVariation } from "./types";
import { inventoryCache } from "./cacheUtils";
import { processSquareError, logError, handleError } from "./errorUtils";
import { requestDeduplicator } from './requestDeduplication';

/**
 * Check if a specific item is in stock - with caching
 * @param variationId The Square variation ID to check
 * @returns The quantity in stock
 */
export async function checkItemInventory(variationId: string): Promise<number> {
  return inventoryCache.getOrCompute(variationId, async () => {
    try {
      // Query Square API for current inventory count
      const { result } = await squareClient.inventoryApi.retrieveInventoryCount(
        variationId
      );

      // Get the counts and find IN_STOCK state
      const counts = result.counts || [];
      const inStockCount = counts.find((count) => count.state === "IN_STOCK");

      // Parse quantity as number (Square returns string)
      const quantity = inStockCount?.quantity
        ? parseInt(inStockCount.quantity, 10)
        : 0;

      return quantity;
    } catch (error) {
      const appError = processSquareError(
        error,
        `checkItemInventory:${variationId}`
      );
      return handleError<number>(appError, 0);
    }
  });
}

/**
 * Check if an item is in stock (1 or more available)
 * @param variationId The Square variation ID to check
 * @returns True if the item is in stock
 */
export async function isItemInStock(variationId: string): Promise<boolean> {
  const quantity = await checkItemInventory(variationId);
  return quantity > 0;
}

/**
 * Check inventory for multiple items at once with caching and batching
 * @param variationIds Array of Square variation IDs to check
 * @returns Object mapping variation IDs to their quantities
 */
export async function checkBulkInventory(
  variationIds: string[]
): Promise<Record<string, number>> {
  const cacheKey = `bulk:${variationIds.sort().join(',')}`;
  
  return requestDeduplicator.dedupe(cacheKey, async () => {
    // Deduplicate IDs
    const uniqueIds = [...new Set(variationIds)];

    if (uniqueIds.length === 0) {
      return {};
    }

    // Process cache hits and identify items that need fetching
    const resultMap: Record<string, number> = {};
    const idsToFetch: string[] = [];

    uniqueIds.forEach((id) => {
      const cached = inventoryCache.get(id);
      if (cached !== undefined) {
        resultMap[id] = cached;
      } else {
        idsToFetch.push(id);
      }
    });

    // If all items were cached, return early
    if (idsToFetch.length === 0) return resultMap;

    // For a single item to fetch, use the simpler endpoint
    if (idsToFetch.length === 1) {
      const quantity = await checkItemInventory(idsToFetch[0]);
      resultMap[idsToFetch[0]] = quantity;
      return resultMap;
    }

    try {
      // Batch API requests (Square API can handle up to 100 items per request)
      const BATCH_SIZE = 100;
      const batches = [];

      for (let i = 0; i < idsToFetch.length; i += BATCH_SIZE) {
        const batchIds = idsToFetch.slice(i, i + BATCH_SIZE);
        batches.push(batchIds);
      }

      // Process all batches in parallel
      const batchResults = await Promise.all(
        batches.map(async (batchIds) => {
          const { result } =
            await squareClient.inventoryApi.batchRetrieveInventoryCounts({
              catalogObjectIds: batchIds,
            });
          return result.counts || [];
        })
      );

      // Flatten and process all counts
      const allCounts = batchResults.flat();

      // Process API results - only consider IN_STOCK state
      allCounts.forEach((count) => {
        if (count.state === "IN_STOCK" && count.catalogObjectId) {
          const quantity = parseInt(count.quantity || "0", 10);
          resultMap[count.catalogObjectId] = quantity;

          // Update cache
          inventoryCache.set(count.catalogObjectId, quantity);
        }
      });

      // Set zero quantities for requested items that weren't found in IN_STOCK state
      idsToFetch.forEach((id) => {
        if (resultMap[id] === undefined) {
          resultMap[id] = 0;
          // Cache zero results too
          inventoryCache.set(id, 0);
        }
      });

      return resultMap;
    } catch (error) {
      const appError = processSquareError(error, "checkBulkInventory");
      return handleError<Record<string, number>>(
        appError,
        {}
        // Optional retry function could be implemented here
      );
    }
  });
}

/**
 * Enhanced variation inventory checker that handles special cases with proper typing
 * @param product The product object with variations to check
 * @returns Object with flags for stock status
 */
export async function getProductStockStatus(product: Product): Promise<{
  isOutOfStock: boolean;
  hasLimitedOptions: boolean;
}> {
  // Default state: in stock with all options
  const result = {
    isOutOfStock: false,
    hasLimitedOptions: false,
  };

  try {
    // Handle products with variations
    if (product.variations && product.variations.length > 0) {
      // Extract valid variation IDs
      const variationIds = product.variations
        .filter((v: ProductVariation) => v && v.variationId)
        .map((v: ProductVariation) => v.variationId);

      if (variationIds.length === 0) {
        return result; // No valid variations
      }

      // Use existing bulk inventory check
      const inventoryData = await checkBulkInventory(variationIds);

      // Count how many variations are in stock
      const totalVariations = variationIds.length;
      const inStockCount = Object.values(inventoryData).filter(
        (qty) => qty > 0
      ).length;

      if (inStockCount === 0) {
        // All variations out of stock
        result.isOutOfStock = true;
        result.hasLimitedOptions = false;
      } else if (inStockCount < totalVariations) {
        // Some variations out of stock, some in stock
        result.isOutOfStock = false;
        result.hasLimitedOptions = true;
      }
      // else defaults apply (all in stock)
    } else if (product.variationId) {
      // Single variation product
      const inStock = await isItemInStock(product.variationId);
      result.isOutOfStock = !inStock;
      // Limited options doesn't apply to single variation
    }
  } catch (error) {
    const appError = processSquareError(
      error,
      `getProductStockStatus:${product.id}`
    );
    logError(appError);
    // Default to in-stock on errors for better user experience
  }

  return result;
}

/**
 * Clear inventory cache entries older than the TTL
 * Call this periodically to prevent unbounded cache growth
 */
export function pruneInventoryCache(): number {
  return inventoryCache.prune();
}
