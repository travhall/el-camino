// src/lib/square/inventory.ts
import { squareClient } from "./client";

/**
 * Check if a specific item is in stock - direct API call without caching
 * @param variationId The Square variation ID to check
 * @returns The quantity in stock
 */
export async function checkItemInventory(variationId: string): Promise<number> {
  try {
    // console.log(`[Inventory] Checking inventory for ${variationId}`);

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

    // console.log(`[Inventory] Item ${variationId}: ${quantity} in stock`);
    return quantity;
  } catch (error) {
    console.error(
      `[Inventory] Error checking inventory for ${variationId}:`,
      error
    );
    return 0; // Assume out of stock if there's an error
  }
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
 * Check inventory for multiple items at once
 * @param variationIds Array of Square variation IDs to check
 * @returns Object mapping variation IDs to their quantities
 */
export async function checkBulkInventory(
  variationIds: string[]
): Promise<Record<string, number>> {
  // Deduplicate IDs
  const uniqueIds = [...new Set(variationIds)];

  if (uniqueIds.length === 0) {
    return {};
  }

  // For a single item, use the simpler endpoint
  if (uniqueIds.length === 1) {
    const quantity = await checkItemInventory(uniqueIds[0]);
    return { [uniqueIds[0]]: quantity };
  }

  try {
    // console.log(`[Inventory] Checking inventory for ${uniqueIds.length} items`);

    // Fetch items from Square API
    const { result } =
      await squareClient.inventoryApi.batchRetrieveInventoryCounts({
        catalogObjectIds: uniqueIds,
      });

    const counts = result.counts || [];
    const inventoryResults: Record<string, number> = {};

    // Process API results - only consider IN_STOCK state
    counts.forEach((count) => {
      if (count.state === "IN_STOCK" && count.catalogObjectId) {
        const quantity = parseInt(count.quantity || "0", 10);
        inventoryResults[count.catalogObjectId] = quantity;
      }
    });

    // Set zero quantities for requested items that weren't found in IN_STOCK state
    uniqueIds.forEach((id) => {
      if (inventoryResults[id] === undefined) {
        inventoryResults[id] = 0;
      }
    });

    return inventoryResults;
  } catch (error) {
    console.error("[Inventory] Error checking bulk inventory:", error);

    // Return zeros for all requested IDs on error
    return uniqueIds.reduce((acc, id) => {
      acc[id] = 0;
      return acc;
    }, {} as Record<string, number>);
  }
}

// Add this new function to src/lib/square/inventory.ts
// Leave all existing functions untouched

/**
 * Enhanced variation inventory checker that handles special cases
 * @param product The product object with variations to check
 * @returns Object with flags for stock status
 */
export async function getProductStockStatus(product: any): Promise<{
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
        .filter((v: any) => v && v.variationId)
        .map((v: any) => v.variationId);

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
    console.error("[Inventory] Error checking product stock status:", error);
    // Default to in-stock on errors
  }

  return result;
}
