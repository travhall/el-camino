// src/lib/square/services/InventoryService.ts
import { BaseService } from "./BaseService";
import type { Client } from "square/legacy";
import type { CircuitBreaker } from "../apiUtils";
import type { Cache } from "../cacheUtils";
import type { Product, ProductVariation } from "../types";
import type { InventoryServiceOptions, BulkInventoryResult, InventoryUpdateEvent } from "../types/services";
import { processSquareError, handleError } from "../errorUtils";

/**
 * Service for inventory-related operations
 * Provides centralized access to inventory data with caching and webhook support
 */
export class InventoryService extends BaseService {
  private locationId: string;

  constructor(
    client: Client,
    circuitBreaker: CircuitBreaker,
    options: InventoryServiceOptions,
    cache?: Cache<number>
  ) {
    super(client, circuitBreaker, "InventoryService", cache);
    this.locationId = options.locationId;
  }

  /**
   * Check inventory for a single item
   */
  async checkInventory(variationId: string): Promise<number> {
    const cacheKey = variationId;

    return this.executeWithCache(cacheKey, async () => {
      const { result } = await this.client.inventoryApi.retrieveInventoryCount(
        variationId
      );

      const counts = result.counts || [];
      const inStockCount = counts.find((count) => count.state === "IN_STOCK");
      const quantity = inStockCount?.quantity
        ? parseInt(inStockCount.quantity, 10)
        : 0;

      console.log(
        `[InventoryService] Checked inventory for ${variationId}: ${quantity}`
      );

      return quantity;
    }, "checkInventory");
  }

  /**
   * Check if an item is in stock
   */
  async isInStock(variationId: string): Promise<boolean> {
    const quantity = await this.checkInventory(variationId);
    return quantity > 0;
  }

  /**
   * Check inventory for multiple items in bulk
   */
  async checkBulkInventory(
    variationIds: string[]
  ): Promise<BulkInventoryResult> {
    // Deduplicate IDs
    const uniqueIds = [...new Set(variationIds)];

    if (uniqueIds.length === 0) {
      return {};
    }

    // Check cache first
    const resultMap: BulkInventoryResult = {};
    const idsToFetch: string[] = [];

    uniqueIds.forEach((id) => {
      if (this.cache) {
        const cached = this.cache.get(id);
        if (cached !== undefined) {
          resultMap[id] = cached;
        } else {
          idsToFetch.push(id);
        }
      } else {
        idsToFetch.push(id);
      }
    });

    // If all cached, return early
    if (idsToFetch.length === 0) {
      console.log(
        `[InventoryService] All ${uniqueIds.length} items cached`
      );
      return resultMap;
    }

    // Fetch uncached items
    return this.execute(
      async () => {
        // Single item - use simple endpoint
        if (idsToFetch.length === 1) {
          const quantity = await this.checkInventory(idsToFetch[0]);
          resultMap[idsToFetch[0]] = quantity;
          return resultMap;
        }

        // Batch process multiple items
        const BATCH_SIZE = 100;
        const batches: string[][] = [];

        for (let i = 0; i < idsToFetch.length; i += BATCH_SIZE) {
          batches.push(idsToFetch.slice(i, i + BATCH_SIZE));
        }

        // Process batches in parallel
        const batchResults = await Promise.all(
          batches.map(async (batchIds) => {
            const { result } =
              await this.client.inventoryApi.batchRetrieveInventoryCounts({
                catalogObjectIds: batchIds,
              });
            return result.counts || [];
          })
        );

        // Process results
        const allCounts = batchResults.flat();

        allCounts.forEach((count) => {
          if (count.state === "IN_STOCK" && count.catalogObjectId) {
            const quantity = parseInt(count.quantity || "0", 10);
            resultMap[count.catalogObjectId] = quantity;

            // Update cache
            if (this.cache) {
              this.cache.set(count.catalogObjectId, quantity);
            }
          }
        });

        // Set zero for items not found
        idsToFetch.forEach((id) => {
          if (resultMap[id] === undefined) {
            resultMap[id] = 0;
            if (this.cache) {
              this.cache.set(id, 0);
            }
          }
        });

        console.log(
          `[InventoryService] Bulk check: ${uniqueIds.length} items, ${idsToFetch.length} fetched`
        );

        return resultMap;
      },
      "checkBulkInventory",
      () => ({}) // Fallback to empty object
    );
  }

  /**
   * Get product stock status with variation handling
   */
  async getProductStockStatus(product: Product): Promise<{
    isOutOfStock: boolean;
    hasLimitedOptions: boolean;
  }> {
    const result = {
      isOutOfStock: false,
      hasLimitedOptions: false,
    };

    try {
      // Handle products with variations
      if (product.variations && product.variations.length > 0) {
        const variationIds = product.variations
          .filter((v: ProductVariation) => v && v.variationId)
          .map((v: ProductVariation) => v.variationId);

        if (variationIds.length === 0) {
          return result;
        }

        const inventoryData = await this.checkBulkInventory(variationIds);

        const totalVariations = variationIds.length;
        const inStockCount = Object.values(inventoryData).filter(
          (qty) => qty > 0
        ).length;

        if (inStockCount === 0) {
          result.isOutOfStock = true;
          result.hasLimitedOptions = false;
        } else if (inStockCount < totalVariations) {
          result.isOutOfStock = false;
          result.hasLimitedOptions = true;
        }
      } else if (product.variationId) {
        // Single variation
        const inStock = await this.isInStock(product.variationId);
        result.isOutOfStock = !inStock;
      }
    } catch (error) {
      const appError = processSquareError(
        error,
        `getProductStockStatus:${product.id}`
      );
      console.error("[InventoryService] Error checking stock status:", appError);
      // Default to in-stock on error
    }

    return result;
  }

  /**
   * Webhook integration: Handle inventory update events
   * Called by webhook handler when inventory changes
   */
  onInventoryUpdate(event: InventoryUpdateEvent): void {
    console.log(
      `[InventoryService] Webhook: Inventory updated for ${event.catalogObjectId}: ${event.quantity}`
    );

    // Update cache immediately
    if (this.cache) {
      this.cache.set(event.catalogObjectId, event.quantity);
    }
  }

  /**
   * Clear inventory cache (useful for testing and forced refreshes)
   */
  clearInventoryCache(): void {
    console.log("[InventoryService] Clearing inventory cache");
    this.clearCache();
  }

  /**
   * Get service statistics for monitoring
   */
  getStats() {
    return {
      service: this.serviceName,
      locationId: this.locationId,
      cache: this.getCacheStats(),
    };
  }
}
