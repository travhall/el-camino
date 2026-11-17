// src/lib/square/batchCatalog.ts
// Chunked `catalog.batchGet` for callers that used to fan out one
// `catalog.object.get` per id (image URLs, measurement units; plan 222).
import type { CatalogObject } from 'square-legacy';
import { squareClient } from './client';

/**
 * Ids per `batchGet` call. Matches the chunk size `categoryImages.ts` already
 * uses: well under Square's per-call cap, and the whole Sandbox catalog (120
 * images) still fits in one call.
 */
export const CATALOG_BATCH_SIZE = 200;

export interface BatchCatalogResult {
  /** Objects Square returned, by id. Ids Square does not know are absent. */
  objects: Map<string, CatalogObject>;
  /** Ids from chunks whose call threw, so the caller can retry them one by one. */
  failedIds: string[];
}

/**
 * Retrieve catalog objects by id in as few calls as possible. Never throws:
 * a chunk that fails is reported in `failedIds` and the other chunks still
 * count. Chunks run in parallel (there are only ever a handful).
 */
export async function batchGetCatalogObjects(
  ids: string[]
): Promise<BatchCatalogResult> {
  const objects = new Map<string, CatalogObject>();
  const failedIds: string[] = [];

  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += CATALOG_BATCH_SIZE) {
    chunks.push(ids.slice(i, i + CATALOG_BATCH_SIZE));
  }

  await Promise.all(
    chunks.map(async (objectIds) => {
      try {
        const response = await squareClient.catalog.batchGet({ objectIds });
        for (const object of response.objects ?? []) {
          if (object.id) objects.set(object.id, object);
        }
      } catch (error) {
        console.error('Error batch fetching catalog objects:', error);
        failedIds.push(...objectIds);
      }
    })
  );

  return { objects, failedIds };
}
