// src/lib/square/inventory.ts
import { squareClient } from "./client";
import type { Product, ProductVariation } from "./types";
import { inventoryCache } from "./cacheUtils";
import { logError, handleError } from "./errorUtils";
import { processSquareError } from "./serverErrorUtils";
import { requestDeduplicator } from './requestDeduplication';
import { fetchInventoryCounts } from './inventoryCore';

/**
 * Check if a specific item is in stock - with caching and deduplication
 * @param variationId The Square variation ID to check
 * @returns The quantity in stock
 */
export async function checkItemInventory(variationId: string): Promise<number> {
  const cacheKey = `inventory:${variationId}`;
  
  return requestDeduplicator.dedupe(cacheKey, () =>
    inventoryCache.getOrCompute(variationId, async () => {
      try {
        // Query Square API for current inventory count
        const inventoryPage = await squareClient.inventory.get({
          catalogObjectId: variationId,
          locationIds: import.meta.env.PUBLIC_SQUARE_LOCATION_ID,
        });

        // Get the counts and find IN_STOCK state
        const counts = inventoryPage.data || [];
        const inStockCount = counts.find((count: any) => count.state === "IN_STOCK");

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
    })
  );
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
  const { counts, failed } = await fetchInventoryCounts(variationIds);

  // Conservative failure policy: anything we could not determine counts as 0 so
  // checkout never sells stock it cannot confirm. Every requested ID is present
  // in the result.
  const result: Record<string, number> = { ...counts };
  for (const id of failed) result[id] = 0;
  for (const id of variationIds) {
    if (result[id] === undefined) result[id] = 0;
  }
  return result;
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
