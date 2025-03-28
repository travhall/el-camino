// src/lib/square/imageUtils.ts
import { squareClient } from "./client";
import { imageCache } from "./cacheUtils";

/**
 * Get image URL with caching
 * @param imageId Square image ID
 * @returns URL of the image or null if not found
 */
export async function getImageUrl(imageId: string): Promise<string | null> {
  // Handle the computation separately from getOrCompute to fix type issues
  const cachedUrl = imageCache.get(imageId);
  if (cachedUrl !== undefined) {
    return cachedUrl;
  }

  try {
    const { result } = await squareClient.catalogApi.retrieveCatalogObject(
      imageId
    );
    if (result.object?.type === "IMAGE") {
      const url = result.object.imageData?.url || null;
      if (url) {
        // Cache the URL
        imageCache.set(imageId, url);
        return url;
      }
    }
    return null;
  } catch (error) {
    console.error("Error fetching image:", error);
    return null;
  }
}

/**
 * Batch fetch multiple image URLs in parallel
 * @param imageIds Array of Square image IDs
 * @returns Map of image IDs to their URLs
 */
export async function batchGetImageUrls(
  imageIds: string[]
): Promise<Record<string, string>> {
  const uniqueIds = [...new Set(imageIds.filter(Boolean))];
  const resultMap: Record<string, string> = {};

  // First check cache for all IDs
  const uncachedIds = uniqueIds.filter((id) => !imageCache.has(id));

  // Add cached results to the map
  uniqueIds.forEach((id) => {
    const cachedUrl = imageCache.get(id);
    if (cachedUrl) {
      resultMap[id] = cachedUrl;
    }
  });

  // If everything was cached, return early
  if (uncachedIds.length === 0) {
    return resultMap;
  }

  // Fetch all uncached images in parallel
  const imagePromises = uncachedIds.map((id) => getImageUrl(id));
  const results = await Promise.all(imagePromises);

  // Process results
  uncachedIds.forEach((id, index) => {
    const url = results[index];
    if (url) {
      resultMap[id] = url;
      // Update cache
      imageCache.set(id, url);
    }
  });

  return resultMap;
}

/**
 * Clear image cache
 */
export function clearImageCache(): void {
  imageCache.clear();
}
