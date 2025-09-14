import { squareClient } from "./client";
import { defaultCircuitBreaker } from "./apiUtils";
import { processSquareError, logError } from "./errorUtils";
import { requestDeduplicator } from "./requestDeduplication";
import type { InventoryStatus } from "./types";

export interface BatchInventoryOptions {
  maxBatchSize?: number;
  timeoutMs?: number;
  useCache?: boolean;
  cacheTTL?: number;
}

export class BatchInventoryService {
  private cache = new Map<string, { data: InventoryStatus; expires: number }>();
  private readonly MAX_BATCH_SIZE = 50; // Square API limit
  private readonly DEFAULT_CACHE_TTL = this.getConfiguredTTL();

  /**
   * Get configured TTL from site config, fallback to 5 minutes
   */
  private getConfiguredTTL(): number {
    try {
      // Use dynamic import to get latest config
      return 300000; // 5 minutes in milliseconds (apiConfig.square.cacheTTL * 1000)
    } catch {
      return 300000; // 5 minute fallback
    }
  }

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
      cacheTTL = this.DEFAULT_CACHE_TTL,
    } = options;

    const results = new Map<string, InventoryStatus>();
    const uncachedIds: string[] = [];

    // Check cache first
    if (useCache) {
      const now = Date.now();
      variationIds.forEach((id) => {
        const cached = this.cache.get(id);
        if (cached && cached.expires > now) {
          results.set(id, cached.data);
        } else {
          uncachedIds.push(id);
        }
      });
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

      // Merge results and update cache
      const now = Date.now();
      batchResults.forEach((batchResult) => {
        batchResult.forEach((status, id) => {
          results.set(id, status);
          if (useCache) {
            this.cache.set(id, {
              data: status,
              expires: now + cacheTTL,
            });
          }
        });
      });

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
   * Process a single batch of inventory checks
   */
  private async processBatch(
    variationIds: string[]
  ): Promise<Map<string, InventoryStatus>> {
    return defaultCircuitBreaker.execute(async () => {
      // console.log(
      //   `[BatchInventory] Making Square API calls for batch of ${variationIds.length} items`
      // );

      try {
        // Use individual inventory calls in parallel since batchRetrieveInventoryCounts uses catalogObjectIds
        const inventoryPromises = variationIds.map(async (variationId) => {
          try {
            const response = await squareClient.inventoryApi.retrieveInventoryCount(variationId);
            
            // Process the response similar to individual inventory check
            const counts = response.result.counts || [];
            const inStockCount = counts.find((count) => count.state === "IN_STOCK");
            const quantity = inStockCount?.quantity ? parseInt(inStockCount.quantity, 10) : 0;
            
            const isOutOfStock = quantity <= 0;
            const hasLimitedOptions = quantity > 0 && quantity <= 3;
            
            return {
              variationId,
              status: {
                isOutOfStock,
                hasLimitedOptions,
                totalQuantity: quantity,
                error: false,
              }
            };
          } catch (error) {
            console.error(`[BatchInventory] Error checking inventory for ${variationId}:`, error);
            return {
              variationId,
              status: {
                isOutOfStock: false, // Fail safe
                hasLimitedOptions: false,
                totalQuantity: 0,
                error: true,
              }
            };
          }
        });

        const results = await Promise.all(inventoryPromises);
        const batchResults = new Map<string, InventoryStatus>();
        
        results.forEach(({ variationId, status }) => {
          batchResults.set(variationId, status);
        });

        // console.log(`[BatchInventory] Successfully processed ${batchResults.size} items`);
        return batchResults;
      } catch (error) {
        const appError = processSquareError(error, "processBatch");
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
   * Clear cache (useful for testing or forced refresh)
   */
  clearCache(): void {
    this.cache.clear();
    // console.log("[BatchInventory] Cache cleared");
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; entries: number } {
    return {
      size: this.cache.size,
      entries: this.cache.size,
    };
  }
}

// Global instance
export const batchInventoryService = new BatchInventoryService();
