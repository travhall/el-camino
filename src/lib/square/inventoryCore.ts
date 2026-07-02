// src/lib/square/inventoryCore.ts
//
// Single source of truth for fetching bulk inventory quantities from Square.
//
// Both bulk-inventory entry points build on this:
//   - checkBulkInventory()           (inventory.ts)      → Record<id, number>
//   - getBatchInventoryStatus()      (batchInventory.ts) → Map<id, InventoryStatus>
//
// The core reports WHAT IT COULD NOT DETERMINE (`failed`) rather than inventing
// a quantity, so each caller can apply its own failure policy:
//   - checkout fails CONSERVATIVE (unknown → 0 → block the sale; never oversell)
//   - display fails OPTIMISTIC   (unknown → keep the product visible; never hide
//     stock over a transient hiccup)
import { squareClient } from "./client";
import { apiRetryClient } from "./apiRetry";
import { logError } from "./errorUtils";
import { processSquareError } from "./serverErrorUtils";
import { requestDeduplicator } from "./requestDeduplication";
import { inventoryCache } from "./cacheUtils";

// Square's batchGetCounts accepts up to 1000 IDs, but smaller chunks keep each
// request fast and limit blast radius when one call fails.
const MAX_BATCH_SIZE = 50;

export interface InventoryFetchResult {
  /** Quantities for every variation whose stock we could determine (incl. known-zero). */
  counts: Record<string, number>;
  /** Variations we could NOT resolve due to API/circuit failure — deliberately not cached. */
  failed: Set<string>;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Parse the IN_STOCK quantity from a Square counts array (string → number). */
function inStockQty(counts: any[]): number {
  const c = counts.find((x: any) => x.state === "IN_STOCK");
  return c?.quantity ? parseInt(c.quantity, 10) : 0;
}

/**
 * Resolve one chunk's quantities. Tries the batch endpoint first (one API call),
 * then falls back to individual lookups if the batch call — or the circuit
 * breaker guarding it — fails, so a single throttled call doesn't blank out the
 * whole chunk. IDs that cannot be resolved at all are returned in `failed`.
 */
async function fetchChunk(
  ids: string[]
): Promise<{ counts: Record<string, number>; failed: Set<string> }> {
  const counts: Record<string, number> = {};
  const failed = new Set<string>();
  const locationId = import.meta.env.PUBLIC_SQUARE_LOCATION_ID;

  try {
    const page = await apiRetryClient.executeWithRetry(
      () =>
        squareClient.inventory.batchGetCounts({
          catalogObjectIds: ids,
          locationIds: [locationId],
          states: ["IN_STOCK"], // only in-stock quantities matter
          limit: 100,
        }),
      "fetchInventoryCounts:batchGetCounts"
    );

    const data = page.data || [];
    for (const count of data) {
      const id = count.catalogObjectId;
      if (!id) continue;
      // We request IN_STOCK only, but guard defensively against any other state
      // slipping through so a non-IN_STOCK row never sets a quantity.
      if (count.state && count.state !== "IN_STOCK") continue;
      counts[id] = count.quantity ? parseInt(count.quantity, 10) : 0;
    }
    // IDs absent from an IN_STOCK response are genuinely out of stock / untracked.
    for (const id of ids) if (!(id in counts)) counts[id] = 0;
    return { counts, failed };
  } catch (batchErr) {
    // Batch failed (error or open circuit) — try each ID individually.
    await Promise.all(
      ids.map(async (id) => {
        try {
          const page = await squareClient.inventory.get({ catalogObjectId: id });
          counts[id] = inStockQty(page.data || []);
        } catch {
          failed.add(id);
        }
      })
    );
    // Log once if the whole chunk was unresolved (signals a real outage rather
    // than a one-off bad ID).
    if (failed.size === ids.length) {
      logError(processSquareError(batchErr, "fetchInventoryCounts"));
    }
    return { counts, failed };
  }
}

/**
 * Fetch IN_STOCK quantities for the given variation IDs, reading through the
 * shared `inventoryCache` and de-duplicating concurrent identical requests.
 * Freshly fetched quantities are cached; failed lookups are not.
 */
export async function fetchInventoryCounts(
  variationIds: string[]
): Promise<InventoryFetchResult> {
  const unique = [...new Set(variationIds.filter(Boolean))];
  if (unique.length === 0) return { counts: {}, failed: new Set() };

  const cacheKey = `inv-counts:${[...unique].sort().join(",")}`;
  return requestDeduplicator.dedupe(cacheKey, async () => {
    const counts: Record<string, number> = {};
    const uncached: string[] = [];

    await Promise.all(
      unique.map(async (id) => {
        const cached = await inventoryCache.get(id);
        if (cached !== undefined) counts[id] = cached;
        else uncached.push(id);
      })
    );

    const failed = new Set<string>();
    if (uncached.length === 0) return { counts, failed };

    const chunkResults = await Promise.all(
      chunk(uncached, MAX_BATCH_SIZE).map((c) => fetchChunk(c))
    );

    const cacheWrites: Promise<void>[] = [];
    for (const r of chunkResults) {
      for (const [id, qty] of Object.entries(r.counts)) {
        counts[id] = qty;
        cacheWrites.push(inventoryCache.set(id, qty)); // cache freshly fetched values
      }
      for (const id of r.failed) failed.add(id);
    }
    await Promise.all(cacheWrites);

    return { counts, failed };
  });
}
