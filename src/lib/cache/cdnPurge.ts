// src/lib/cache/cdnPurge.ts
//
// Netlify CDN invalidation for product pages. The PDP and the quick-view API
// are cached at the edge (s-maxage=300, stale-while-revalidate on the PDP) and
// carry cache tags; when Square says stock or the catalog changed, the
// webhook purges those tags so the next request renders fresh data instead of
// waiting out the TTL.
//
// Tags are built here and nowhere else, so what the pages emit and what the
// webhook purges can't drift apart:
//   product-<itemId>       one product (Square item id)
//   variation-<id>         one variation. inventory.count.updated carries
//                          variation ids only, so each page also carries its
//                          variations' tags and no item lookup is needed.
//   products               every product page/API (catch-all)
import { purgeCache } from '@netlify/functions';

export const PRODUCTS_TAG = 'products';
export const productTag = (id: string) => `product-${id}`;
export const variationTag = (id: string) => `variation-${id}`;

/**
 * Tags a product response carries: its own, its variations', the catch-all,
 * plus any route-specific extras. Netlify allows 500 tags per response; Square
 * caps an item at 250 variations.
 */
export function productCacheTags(
  productId: string,
  variationIds: readonly string[] = [],
  extra: readonly string[] = []
): string[] {
  return [
    ...new Set([
      productTag(productId),
      PRODUCTS_TAG,
      ...extra,
      ...variationIds.filter(Boolean).map(variationTag),
    ]),
  ];
}

// Purge requests are batched so one huge catalog edit isn't one huge request
const PURGE_BATCH = 100;
// Past this many changed objects (a bulk import or re-price), purging by id
// costs more than it saves: purge every product page instead.
const BULK_THRESHOLD = 500;

export interface PurgeTargets {
  /** Square item ids whose product pages changed */
  productIds?: readonly string[];
  /** Square variation ids whose stock or details changed */
  variationIds?: readonly string[];
}

/**
 * Purge the cached pages for these products/variations. Never throws: a
 * failed purge must not fail the webhook (the TTL still catches up, and
 * Square would retry the whole delivery).
 *
 * Only works inside a deployed Netlify function (ambient credentials); in
 * dev and tests the call fails and is logged. Run it after the blob caches
 * are cleared so the re-render it triggers reads fresh data.
 */
export async function purgeProductPages(
  targets: PurgeTargets
): Promise<boolean> {
  const productIds = [...new Set((targets.productIds ?? []).filter(Boolean))];
  const variationIds = [
    ...new Set((targets.variationIds ?? []).filter(Boolean)),
  ];
  const count = productIds.length + variationIds.length;
  if (count === 0) return true;

  const tags =
    count > BULK_THRESHOLD
      ? [PRODUCTS_TAG]
      : [...productIds.map(productTag), ...variationIds.map(variationTag)];

  try {
    for (let i = 0; i < tags.length; i += PURGE_BATCH) {
      await purgeCache({ tags: tags.slice(i, i + PURGE_BATCH) });
    }
    console.info(
      `[CDN] Purged ${tags.length} cache tag(s):`,
      tags.slice(0, 20)
    );
    return true;
  } catch (error) {
    console.warn(
      '[CDN] Cache purge failed (TTL will expire the pages):',
      error
    );
    return false;
  }
}
