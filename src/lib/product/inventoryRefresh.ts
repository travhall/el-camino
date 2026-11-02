// src/lib/product/inventoryRefresh.ts
//
// Refreshing a product page's stock after load.
//
// The PDP is cached at the CDN, and Square's inventory webhook clears only the
// blob-level inventory cache (nothing purges the page), so the "N available"
// count, the stepper maximum, and the in-stock/sold-out state it was rendered
// with can be stale by the time a shopper sees them. /api/cart-inventory reads
// the webhook-invalidated cache, so asking it after load gets near-real-time
// numbers.
import type { ProductVariation } from '@/lib/square/types';

export interface FreshInventory {
  inventory: Record<string, number>;
  /**
   * IDs the server could not determine. It reports these as 0 in `inventory`
   * (the right call when validating a cart), so a 0 for one of these is "could
   * not check", not "sold out", and must not change what the page shows.
   */
  unknown: ReadonlySet<string>;
}

/**
 * Ask the server for current stock. Returns null for any failure, so the
 * caller leaves the page as it was rendered.
 */
export async function fetchFreshInventory(
  variationIds: string[]
): Promise<FreshInventory | null> {
  try {
    const response = await fetch('/api/cart-inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ variationIds }),
    });
    if (!response.ok) return null;

    const data = await response.json();
    // `unknown` is what separates a real 0 from "could not check". A response
    // without it (an older server, mid-deploy) can't be trusted for display.
    if (
      !data?.success ||
      typeof data.inventory !== 'object' ||
      data.inventory === null ||
      !Array.isArray(data.unknown)
    ) {
      return null;
    }
    return { inventory: data.inventory, unknown: new Set(data.unknown) };
  } catch {
    return null;
  }
}

/**
 * Write fresh stock into the variations, in place (the controller, the event
 * manager and the add-to-cart check all hold the same objects). Variations the
 * server couldn't determine, or didn't mention, are left alone.
 *
 * @returns the IDs of the variations whose quantity or stock state changed
 */
export function applyFreshInventory(
  variations: ProductVariation[],
  fresh: FreshInventory
): string[] {
  const changed: string[] = [];

  for (const variation of variations) {
    if (fresh.unknown.has(variation.variationId)) continue;

    const quantity = fresh.inventory[variation.variationId];
    if (typeof quantity !== 'number') continue;

    const inStock = quantity > 0;
    if (variation.quantity !== quantity || variation.inStock !== inStock) {
      variation.quantity = quantity;
      variation.inStock = inStock;
      changed.push(variation.variationId);
    }
  }

  return changed;
}
