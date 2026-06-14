// src/lib/square/pricing.ts
//
// Server-authoritative pricing.
//
// The client cart lives in localStorage and is fully attacker-controlled — its
// prices and `saleInfo` must NEVER be trusted when charging a customer. This
// module re-derives every price directly from the Square catalog so checkout
// can override line-item prices with values the server vouches for.
import { squareClient, extractSaleInfo } from "./client";
import { logApiError } from "./apiUtils";

export interface AuthoritativePrice {
  /** Catalog regular price, in dollars. */
  regularPrice: number;
  /** Active sale price in dollars, only when the catalog confirms a valid sale. */
  salePrice?: number;
  /** salePrice when a sale is active, otherwise regularPrice. */
  effectivePrice: number;
}

/**
 * Fetch server-authoritative pricing for the given variation IDs straight from
 * the Square catalog. Sale prices are derived from the variation's custom
 * attributes via {@link extractSaleInfo} — identical to how the storefront
 * computes them — so the price a customer is charged always matches what the
 * catalog advertises.
 *
 * Returns a map keyed by variation ID. Variations the catalog does not return
 * (deleted, invalid, or variable-price gift cards with no `priceMoney`) are
 * omitted; callers MUST treat a missing entry as "no trusted price" and fall
 * back to the catalog's regular price rather than any client-supplied value.
 *
 * On any API failure this resolves to an empty map: callers then apply no
 * price override and Square charges the catalog regular price. This fails safe
 * toward the merchant — never toward an attacker-supplied discount.
 */
export async function getAuthoritativePricing(
  variationIds: string[]
): Promise<Record<string, AuthoritativePrice>> {
  const uniqueIds = [...new Set(variationIds.filter(Boolean))];
  if (uniqueIds.length === 0) return {};

  try {
    const response = await squareClient.catalog.batchGet({
      objectIds: uniqueIds,
    });

    const result: Record<string, AuthoritativePrice> = {};
    for (const obj of (response as any).objects ?? []) {
      if (obj?.type !== "ITEM_VARIATION") continue;

      const priceMoney = obj.itemVariationData?.priceMoney;
      // Skip variable-price variations (no fixed amount) — there is nothing to
      // vouch for, so the caller falls back to Square's own pricing.
      if (priceMoney?.amount == null) continue;

      const regularPrice = Number(priceMoney.amount) / 100;
      const saleInfo = extractSaleInfo(obj.customAttributeValues, regularPrice);
      const salePrice = saleInfo?.salePrice;

      result[obj.id] = {
        regularPrice,
        salePrice,
        effectivePrice: salePrice ?? regularPrice,
      };
    }
    return result;
  } catch (error) {
    logApiError("getAuthoritativePricing", error);
    return {};
  }
}
