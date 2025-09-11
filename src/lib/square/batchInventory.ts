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
    catalogObjectIds: string[],
    options: BatchInventoryOptions = {}
  ): Promise<Map<string, InventoryStatus>> {
    if (catalogObjectIds.length === 0) {
      // console.log("[BatchInventory] No catalog object IDs provided");
      return new Map();
    }

    // CREATE: Deterministic cache key for request deduplication
    const sortedIds = [...catalogObjectIds].sort();
    const cacheKey = `batch-inventory:${sortedIds.join(",")}:${JSON.stringify(
      options
    )}`;

    // USE: Existing request deduplication pattern
    return requestDeduplicator.dedupe(cacheKey, () =>
      this.performBatchInventoryCheck(catalogObjectIds, options)
    );
  }

  /**
   * Perform the actual batch inventory check (internal method)
   */
  private async performBatchInventoryCheck(
    catalogObjectIds: string[],
    options: BatchInventoryOptions
  ): Promise<Map<string, InventoryStatus>> {
    // console.log(
    //   `[BatchInventory] Starting batch check for ${catalogObjectIds.length} products`
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
      catalogObjectIds.forEach((id) => {
        const cached = this.cache.get(id);
        if (cached && cached.expires > now) {
          results.set(id, cached.data);
        } else {
          uncachedIds.push(id);
        }
      });
    } else {
      uncachedIds.push(...catalogObjectIds);
    }

    if (uncachedIds.length === 0) {
      // console.log(
      //   `[BatchInventory] All ${catalogObjectIds.length} items served from cache`
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
    catalogObjectIds: string[]
  ): Promise<Map<string, InventoryStatus>> {
    return defaultCircuitBreaker.execute(async () => {
      // console.log(
      //   `[BatchInventory] Making Square API call for batch of ${catalogObjectIds.length} items`
      // );

      try {
        const response =
          await squareClient.inventoryApi.batchRetrieveInventoryCounts({
            catalogObjectIds,
          });

        // console.log(`[BatchInventory] API response received successfully`);
        const batchResults = new Map<string, InventoryStatus>();

        // Handle legacy API response format
        const result = response.result || response;
        const counts = result.counts || [];
        // console.log(
        //   `[BatchInventory] Processing ${counts.length} inventory counts from API`
        // );

        // Process successful responses - ONLY count IN_STOCK items like individual inventory check
        if (counts && counts.length > 0) {
          // Group counts by catalogObjectId to handle multiple states per item
          const itemCounts = new Map<string, number>();

          counts.forEach((count: any) => {
            if (count.catalogObjectId && count.state === "IN_STOCK") {
              const quantity = parseInt(count.quantity || "0", 10);
              itemCounts.set(count.catalogObjectId, quantity);
              // console.log(
              //   `[BatchInventory] Item ${count.catalogObjectId}: IN_STOCK qty=${quantity}`
              // );
            } else if (count.catalogObjectId) {
              // console.log(
              //   `[BatchInventory] Item ${count.catalogObjectId}: state=${count.state}, qty=${count.quantity} (ignored - not IN_STOCK)`
              // );
            }
          });

          // Set inventory status for items found in IN_STOCK state
          itemCounts.forEach((quantity, catalogObjectId) => {
            const isOutOfStock = quantity <= 0;
            const hasLimitedOptions = quantity > 0 && quantity <= 3;

            batchResults.set(catalogObjectId, {
              isOutOfStock,
              hasLimitedOptions,
              totalQuantity: quantity,
              error: false,
            });
          });
        }

        // Handle items not in response - set to out of stock like individual inventory check
        catalogObjectIds.forEach((id) => {
          if (!batchResults.has(id)) {
            // console.log(
            //   `[BatchInventory] Item ${id} not found in IN_STOCK state, marking as out of stock`
            // );
            batchResults.set(id, {
              isOutOfStock: true,
              hasLimitedOptions: false,
              totalQuantity: 0,
              error: false,
            });
          }
        });

        return batchResults;
      } catch (error) {
        console.error("BatchInventory API call failed:", error);
        const appError = processSquareError(error, "batchInventoryCheck");
        logError(appError);
        throw appError;
      }
    });
  }

  /**
   * Chunk array into smaller batches
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
