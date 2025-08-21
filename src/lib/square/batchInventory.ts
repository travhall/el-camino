import { squareClient } from './client';
import { processSquareError, logError } from './errorUtils';
import { requestDeduplicator } from './requestDeduplication';
import type { InventoryStatus } from './types';

export interface BatchInventoryOptions {
  maxBatchSize?: number;
  timeoutMs?: number;
  useCache?: boolean;
  cacheTTL?: number;
}

export class BatchInventoryService {
  private cache = new Map<string, { data: InventoryStatus; expires: number }>();
  private readonly MAX_BATCH_SIZE = 50; // Square API limit
  private readonly DEFAULT_CACHE_TTL = 60000; // 1 minute

  /**
   * Get inventory status for multiple products in batches
   */
  async getBatchInventoryStatus(
    catalogObjectIds: string[],
    options: BatchInventoryOptions = {}
  ): Promise<Map<string, InventoryStatus>> {
    // CREATE: Deterministic cache key for request deduplication
    const sortedIds = [...catalogObjectIds].sort();
    const cacheKey = `batch-inventory:${sortedIds.join(',')}:${JSON.stringify(options)}`;
    
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
    console.log(`[BatchInventory] Starting batch check for ${catalogObjectIds.length} products`);
    
    const {
      maxBatchSize = this.MAX_BATCH_SIZE,
      useCache = true,
      cacheTTL = this.DEFAULT_CACHE_TTL
    } = options;

    const results = new Map<string, InventoryStatus>();
    const uncachedIds: string[] = [];

    // Check cache first
    if (useCache) {
      const now = Date.now();
      catalogObjectIds.forEach(id => {
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
      return results;
    }

    // Process in batches
    const batches = this.chunkArray(uncachedIds, maxBatchSize);
    console.log(`[BatchInventory] Processing ${batches.length} batches for ${uncachedIds.length} uncached items`);
    const batchPromises = batches.map(batch => this.processBatch(batch));

    try {
      const batchResults = await Promise.all(batchPromises);
      
      // Merge results and update cache
      const now = Date.now();
      batchResults.forEach(batchResult => {
        batchResult.forEach((status, id) => {
          results.set(id, status);
          if (useCache) {
            this.cache.set(id, {
              data: status,
              expires: now + cacheTTL
            });
          }
        });
      });

      return results;
    } catch (error) {
      const appError = processSquareError(error, 'getBatchInventoryStatus');
      logError(appError);
      
      // Return partial results with error status for failed items
      uncachedIds.forEach(id => {
        if (!results.has(id)) {
          results.set(id, {
            isOutOfStock: false, // Fail safe - assume in stock
            hasLimitedOptions: false,
            totalQuantity: 0,
          });
        }
      });

      return results;
    }
  }

  /**
   * Process a single batch of inventory checks
   */
  private async processBatch(catalogObjectIds: string[]): Promise<Map<string, InventoryStatus>> {
    console.log(`[BatchInventory] Making Square API call for batch of ${catalogObjectIds.length} items`);
    try {
      // Use the correct legacy API method
      const response = await squareClient.inventoryApi.batchRetrieveInventoryCounts({
        catalogObjectIds,
        locationIds: [import.meta.env.PUBLIC_SQUARE_LOCATION_ID!]
      });

      console.log(`[BatchInventory] API response:`, response);
      const batchResults = new Map<string, InventoryStatus>();
      
      // Handle legacy API response format
      const result = response.result || response;
      const counts = result.counts || [];
      console.log(`[BatchInventory] Processing ${counts.length} inventory counts`);
      
      // Process successful responses
      if (counts && counts.length > 0) {
        counts.forEach((count: any) => {
          if (count.catalogObjectId) {
            const quantity = parseInt(count.quantity || '0', 10);
            batchResults.set(count.catalogObjectId, {
              isOutOfStock: quantity <= 0,
              hasLimitedOptions: quantity > 0 && quantity <= 3,
              totalQuantity: quantity,
            });
          }
        });
      }

      // Handle items not in response (assume in stock for safety)
      catalogObjectIds.forEach(id => {
        if (!batchResults.has(id)) {
          batchResults.set(id, {
            isOutOfStock: false,
            hasLimitedOptions: false,
            totalQuantity: 0,
          });
        }
      });

      return batchResults;
    } catch (error) {
      console.error('Batch inventory API call failed:', error);
      throw error;
    }
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
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; hitRate: number } {
    return {
      size: this.cache.size,
      hitRate: 0 // Calculate based on tracking hits/misses
    };
  }
}

// Global instance
export const batchInventoryService = new BatchInventoryService();
