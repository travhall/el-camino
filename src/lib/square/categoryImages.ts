// src/lib/square/categoryImages.ts
// Shared, cached, batched resolver for category image URLs.
// Replaces the per-category `catalog.object.get` fan-out that Sidebar.astro
// and CategoryStrip.astro used to run serially.
import { squareClient } from './client';
import { imageCache } from '@/lib/cache/blobCache';

// Square's batchGet has an upper bound on objectIds per call.
const BATCH_CHUNK_SIZE = 200;

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/**
 * Resolve category image URLs for a set of category IDs.
 * Checks `imageCache` first, then resolves any misses in as few
 * `catalog.batchGet` calls as possible (chunked at `BATCH_CHUNK_SIZE`).
 * Never throws — on a Square error, returns whatever was already resolved
 * so callers can fall back to their local placeholder image.
 */
export async function getCategoryImageUrls(
  categoryIds: string[]
): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  const misses: string[] = [];

  for (const id of categoryIds) {
    const cached = await imageCache.get(id);
    if (cached) {
      result[id] = cached;
    } else {
      misses.push(id);
    }
  }

  if (misses.length === 0) {
    return result;
  }

  for (const batchIds of chunk(misses, BATCH_CHUNK_SIZE)) {
    try {
      const batchResult = await squareClient.catalog.batchGet({
        objectIds: batchIds,
        includeRelatedObjects: true,
      });

      const imagesById: Record<string, any> = {};
      (batchResult.relatedObjects ?? []).forEach((obj: any) => {
        if (obj.type === 'IMAGE') {
          imagesById[obj.id] = obj;
        }
      });

      (batchResult.objects ?? []).forEach((catObject: any) => {
        // Each category names its own image IDs — required in batch mode
        // since relatedObjects is shared across every requested category,
        // unlike the per-ID catalog.object.get response.
        const imageIds: string[] = catObject.categoryData?.imageIds ?? [];
        const url = imageIds
          .map((id) => imagesById[id]?.imageData?.url)
          .find((u) => !!u);
        if (url) {
          result[catObject.id] = url;
        }
      });

      await Promise.all(
        batchIds
          .filter((id) => result[id])
          .map((id) => imageCache.set(id, result[id]))
      );
    } catch (error) {
      console.error('Error batch fetching category images:', error);
    }
  }

  return result;
}
