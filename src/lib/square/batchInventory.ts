import { squareClient } from "./client";
import { defaultCircuitBreaker } from "./apiUtils";
import { logError } from "./errorUtils";
import { processSquareError } from "./serverErrorUtils";
import { requestDeduplicator } from "./requestDeduplication";
import { inventoryCache } from "@/lib/cache/blobCache";
import type { InventoryStatus } from "./types";

export interface BatchInventoryOptions {
  maxBatchSize?: number;
  timeoutMs?: number;
  useCache?: boolean;
  cacheTTL?: number;
}

export class BatchInventoryService {
  private readonly MAX_BATCH_SIZE = 50; // Square API limit
  private readonly USE_TRUE_BATCH_API = true;

  /**
   * Get inventory status for multiple products in batches
   */
  async getBatchInventoryStatus(
    variationIds: string[],
    options: BatchInventoryOptions = {}
  ): Promise<Map<string, InventoryStatus>> {
    if (variationIds.length === 0) {
      // console.log("[BatchInventory] No variation IDs provided");
      return new Map();
    }

    // CREATE: Deterministic cache key for request deduplication
    const sortedIds = [...variationIds].sort();
    const cacheKey = `batch-inventory:${sortedIds.join(",")}:${JSON.stringify(
      options
    )}`;

    // USE: Existing request deduplication pattern
    return requestDeduplicator.dedupe(cacheKey, () =>
      this.performBatchInventoryCheck(variationIds, options)
    );
  }

  /**
   * Perform the actual batch inventory check (internal method)
   */
  private async performBatchInventoryCheck(
    variationIds: string[],
    options: BatchInventoryOptions
  ): Promise<Map<string, InventoryStatus>> {
    // console.log(
    //   `[BatchInventory] Starting batch check for ${variationIds.length} products`
    // );

    const {
      maxBatchSize = this.MAX_BATCH_SIZE,
      useCache = true,
    } = options;

    const results = new Map<string, InventoryStatus>();
    const uncachedIds: string[] = [];

    // Check shared blob cache first
    if (useCache) {
      await Promise.all(
        variationIds.map(async (id) => {
          const quantity = await inventoryCache.get(id);
          if (quantity !== undefined) {
            results.set(id, {
              isOutOfStock: quantity <= 0,
              hasLimitedOptions: quantity > 0 && quantity <= 3,
              totalQuantity: quantity,
              error: false,
            });
          } else {
            uncachedIds.push(id);
          }
        })
      );
    } else {
      uncachedIds.push(...variationIds);
    }

    if (uncachedIds.length === 0) {
      // console.log(
      //   `[BatchInventory] All ${variationIds.length} items served from cache`
      // );
      return results;
    }

    // Process in batches
    const batches = this.chunkArray(uncachedIds, maxBatchSize);
    // console.log(
    //   `[BatchInventory] Processing ${batches.length} batches for ${uncachedIds.length} uncached items`
    // );
    const batchPromises = batches.map((batch) => this.processBatch(batch));

    try {
      const batchResults = await Promise.all(batchPromises);

      // Merge results and update shared blob cache (only for successful, non-error results)
      const cacheWrites: Promise<void>[] = [];
      batchResults.forEach((batchResult) => {
        batchResult.forEach((status, id) => {
          results.set(id, status);
          // Never cache error results — a 0-quantity from an API failure would
          // poison the cache and make in-stock items appear sold-out.
          if (useCache && !status.error) {
            cacheWrites.push(inventoryCache.set(id, status.totalQuantity ?? 0));
          }
        });
      });
      await Promise.all(cacheWrites);

      // console.log(
      //   `[BatchInventory] Successfully processed ${results.size} items`
      // );
      return results;
    } catch (error) {
      const appError = processSquareError(error, "getBatchInventoryStatus");
      logError(appError);

      // Return partial results with error status for failed items
      uncachedIds.forEach((id) => {
        if (!results.has(id)) {
          // console.log(
          //   `[BatchInventory] Setting fallback status for ${id} due to error`
          // );
          results.set(id, {
            isOutOfStock: false, // Fail safe - assume in stock
            hasLimitedOptions: false,
            totalQuantity: 0,
            error: true,
          });
        }
      });

      return results;
    }
  }

  /**
   * Process a single batch of inventory checks using TRUE batch API
   * OPTIMIZED: Uses Square's batchGetCounts endpoint (1 API call per 50-100 items)
   * instead of individual calls (1 API call per item)
   */
  private async processBatch(
    variationIds: string[]
  ): Promise<Map<string, InventoryStatus>> {
    // Feature flag: Use true batch API or fallback to individual calls
    if (!this.USE_TRUE_BATCH_API) {
      // console.log('[BatchInventory] Using FALLBACK individual calls (feature flag disabled)');
      return this.processBatchFallback(variationIds);
    }

    return defaultCircuitBreaker.execute(async () => {
      try {
        // Get location ID from environment
        const locationId = import.meta.env.PUBLIC_SQUARE_LOCATION_ID;
        if (!locationId) {
          // console.warn(
          //   "[BatchInventory] No location ID found, falling back to individual calls"
          // );
          return this.processBatchFallback(variationIds);
        }

        // TRUE BATCH API CALL
        // variationIds work directly as catalogObjectIds (confirmed by research)
        const batchPage =
          await squareClient.inventory.batchGetCounts({
            catalogObjectIds: variationIds,
            locationIds: [locationId],
            states: ["IN_STOCK"], // Only fetch in-stock quantities
            limit: 100, // Square's maximum per batch
          });

        const batchResults = new Map<string, InventoryStatus>();
        let processedCount = 0;

        // Process response from new SDK
        // Response structure: Page<InventoryCount>
        const counts = batchPage.data || [];

        for (const count of counts) {
          const variationId = count.catalogObjectId;
          if (!variationId) continue;

          const quantity = count.quantity ? parseInt(count.quantity, 10) : 0;

          batchResults.set(variationId, {
            isOutOfStock: quantity <= 0,
            hasLimitedOptions: quantity > 0 && quantity <= 3,
            totalQuantity: quantity,
            error: false,
          });

          processedCount++;
        }

        // Handle variations not in response (out of stock or not tracked)
        variationIds.forEach((id) => {
          if (!batchResults.has(id)) {
            batchResults.set(id, {
              isOutOfStock: true, // Not tracked or truly out of stock
              hasLimitedOptions: false,
              totalQuantity: 0,
              error: false,
            });
          }
        });

        return batchResults;
      } catch (error) {
        // console.error(
        //   "[BatchInventory] TRUE batch API failed, falling back to individual calls:",
        //   error
        // );
        // Fallback to individual calls if batch fails
        return this.processBatchFallback(variationIds);
      }
    });
  }

  /**
   * FALLBACK: Process batch using individual API calls (current implementation)
   * Only used when TRUE batch API is disabled or fails
   * PERFORMANCE: Makes N individual API calls (1 per item)
   */
  private async processBatchFallback(
    variationIds: string[]
  ): Promise<Map<string, InventoryStatus>> {
    return defaultCircuitBreaker.execute(async () => {
      try {
        // Use individual inventory calls in parallel
        const inventoryPromises = variationIds.map(async (variationId) => {
          try {
            const inventoryPage =
              await squareClient.inventory.get({
                catalogObjectId: variationId,
              });

            // Process the response similar to individual inventory check
            const counts = inventoryPage.data || [];
            const inStockCount = counts.find(
              (count: any) => count.state === "IN_STOCK"
            );
            const quantity = inStockCount?.quantity
              ? parseInt(inStockCount.quantity, 10)
              : 0;

            const isOutOfStock = quantity <= 0;
            const hasLimitedOptions = quantity > 0 && quantity <= 3;

            return {
              variationId,
              status: {
                isOutOfStock,
                hasLimitedOptions,
                totalQuantity: quantity,
                error: false,
              },
            };
          } catch (error) {
            // console.error(
            //   `[BatchInventory] Error checking inventory for ${variationId}:`,
            //   error
            // );
            return {
              variationId,
              status: {
                isOutOfStock: false, // Fail safe
                hasLimitedOptions: false,
                totalQuantity: 0,
                error: true,
              },
            };
          }
        });

        const results = await Promise.all(inventoryPromises);
        const batchResults = new Map<string, InventoryStatus>();

        results.forEach(({ variationId, status }) => {
          batchResults.set(variationId, status);
        });

        return batchResults;
      } catch (error) {
        const appError = processSquareError(error, "processBatchFallback");
        logError(appError);

        // Return error status for all items
        const batchResults = new Map<string, InventoryStatus>();
        variationIds.forEach((variationId) => {
          batchResults.set(variationId, {
            isOutOfStock: false, // Fail safe
            hasLimitedOptions: false,
            totalQuantity: 0,
            error: true,
          });
        });

        return batchResults;
      }
    });
  }

  /**
   * Split array into chunks of specified size
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Invalidate cached inventory for specific variation IDs.
   *
   * This service and the bulk-inventory helpers in `inventory.ts` read and write
   * the SAME shared `inventoryCache`, so callers should invalidate by calling
   * `inventoryCache.delete(id)` directly rather than going through the service.
   * No targeted invalidation method is exposed here to avoid implying a separate
   * cache that needs its own clearing step.
   */
}

// Global instance
export const batchInventoryService = new BatchInventoryService();
