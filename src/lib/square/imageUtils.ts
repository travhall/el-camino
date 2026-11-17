// src/lib/square/imageUtils.ts
import { squareClient } from './client';
import { imageCache } from '@/lib/cache/blobCache';
import { batchGetCatalogObjects } from './batchCatalog';

/**
 * Get image URL with caching
 * @param imageId Square image ID
 * @returns URL of the image or null if not found
 */
export async function getImageUrl(imageId: string): Promise<string | null> {
  // Handle the computation separately from getOrCompute to fix type issues
  const cachedUrl = await imageCache.get(imageId);
  if (cachedUrl !== undefined) {
    return cachedUrl;
  }

  try {
    const result = await squareClient.catalog.object.get({ objectId: imageId });
    if (result.object?.type === 'IMAGE') {
      const url = result.object.imageData?.url || null;
      if (url) {
        // Cache the URL (now async)
        await imageCache.set(imageId, url);
        return url;
      }
    }
    return null;
  } catch (error) {
    console.error('Error fetching image:', error);
    return null;
  }
}

/**
 * Batch fetch multiple image URLs (cache first, then `catalog.batchGet`)
 * @param imageIds Array of Square image IDs
 * @returns Map of image IDs to their URLs
 */
export async function batchGetImageUrls(
  imageIds: string[]
): Promise<Record<string, string>> {
  const uniqueIds = [...new Set(imageIds.filter(Boolean))];
  const resultMap: Record<string, string> = {};

  // First check cache for all IDs (now async)
  const cacheChecks = await Promise.all(
    uniqueIds.map(async (id) => ({
      id,
      cached: await imageCache.get(id),
    }))
  );

  // Add cached results to the map and collect uncached IDs
  const uncachedIds: string[] = [];
  cacheChecks.forEach(({ id, cached }) => {
    if (cached) {
      resultMap[id] = cached;
    } else {
      uncachedIds.push(id);
    }
  });

  // If everything was cached, return early
  if (uncachedIds.length === 0) {
    return resultMap;
  }

  // Resolve every uncached id through batched `catalog.batchGet` calls (one
  // for a typical catalog) instead of one `catalog.object.get` per image.
  const { objects, failedIds } = await batchGetCatalogObjects(uncachedIds);

  const writes: Promise<unknown>[] = [];
  for (const [id, object] of objects) {
    const url = object.type === 'IMAGE' ? object.imageData?.url : undefined;
    if (url) {
      resultMap[id] = url;
      writes.push(imageCache.set(id, url));
    }
  }

  // A failed batch call must not lose images: retry just those ids one by one.
  if (failedIds.length > 0) {
    const urls = await Promise.all(failedIds.map((id) => getImageUrl(id)));
    failedIds.forEach((id, index) => {
      const url = urls[index];
      if (url) resultMap[id] = url;
    });
  }

  await Promise.all(writes);
  return resultMap;
}
