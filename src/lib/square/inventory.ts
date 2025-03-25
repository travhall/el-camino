// src/lib/square/inventory.ts
import { squareClient } from "./client";
import type { CartItem } from "../cart/types";

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
