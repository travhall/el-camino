// src/lib/square/batchInventory.ts
//
// Display-facing adapter over the shared inventory core. Returns rich
// InventoryStatus objects for product grids, filters, and related products.
//
// Failure policy is OPTIMISTIC: variations the core could not resolve are
// returned with `error: true` and `isOutOfStock: false`, so callers keep the
// product visible rather than hiding it over a transient API hiccup. (Checkout
// uses checkBulkInventory(), which applies the opposite, conservative policy.)
import { fetchInventoryCounts } from "./inventoryCore";
import type { InventoryStatus } from "./types";

function statusFromQuantity(quantity: number): InventoryStatus {
  return {
    isOutOfStock: quantity <= 0,
    hasLimitedOptions: quantity > 0 && quantity <= 3,
    totalQuantity: quantity,
    error: false,
  };
}

export class BatchInventoryService {
  /**
   * Get inventory status for multiple variations, reading through the shared
   * inventory cache and de-duplicating concurrent identical requests.
   */
  async getBatchInventoryStatus(
    variationIds: string[]
  ): Promise<Map<string, InventoryStatus>> {
    const map = new Map<string, InventoryStatus>();
    if (variationIds.length === 0) return map;

    const { counts, failed } = await fetchInventoryCounts(variationIds);

    for (const id of new Set(variationIds)) {
      if (id in counts) {
        map.set(id, statusFromQuantity(counts[id]));
      } else {
        // Unknown stock (failed lookup) → keep visible, flag as errored.
        map.set(id, {
          isOutOfStock: false,
          hasLimitedOptions: false,
          totalQuantity: 0,
          error: true,
        });
      }
    }
    return map;
  }
}

// Global instance
export const batchInventoryService = new BatchInventoryService();
