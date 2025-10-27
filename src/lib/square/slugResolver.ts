// src/lib/square/slugResolver.ts
import { squareClient } from "./client";
import { createSlug } from "./slugUtils";
import { slugCache } from "../cache/blobCache";

/**
 * Lightweight slug-to-ID resolver
 * Maintains ONLY slug mappings, not full product data
 * Now uses BlobCache for serverless persistence
 */
class SlugResolver {
  private CACHE_KEY = "slug-to-id-map";
  private initializing = false;
  private initPromise: Promise<Record<string, string>> | null = null;

  /**
   * Resolve a slug to a Square catalog ID
   */
  async resolve(slug: string): Promise<string | null> {
    const map = await this.getOrBuildMap();
    return map[slug] || null;
  }

  /**
   * Get the slug map, building it if necessary
   */
  private async getOrBuildMap(): Promise<Record<string, string>> {
    // Check BlobCache first
    const cached = await slugCache.get(this.CACHE_KEY);
    if (cached) {
      return cached;
    }

    // If already initializing, wait for that promise
    if (this.initPromise) {
      return this.initPromise;
    }

    // Build the map
    this.initPromise = this.buildSlugMap();
    const map = await this.initPromise;
    this.initPromise = null;

    return map;
  }

  /**
   * Build slug→ID map from Square catalog
   * Only fetches minimal data needed for slug generation
   */
  private async buildSlugMap(): Promise<Record<string, string>> {
    console.log("[SlugResolver] Building slug map from Square API...");
    const startTime = Date.now();

    try {
      // Fetch only ITEM objects with minimal data
      const response = await squareClient.catalogApi.listCatalog(
        undefined,
        "ITEM"
      );

      const map: Record<string, string> = {};

      if (response.result?.objects) {
        for (const item of response.result.objects) {
          if (item.type === "ITEM" && item.itemData?.name) {
            const slug = createSlug(item.itemData.name);
            map[slug] = item.id;
          }
        }
      }

      // Cache the map in BlobCache
      await slugCache.set(this.CACHE_KEY, map);

      const duration = Date.now() - startTime;
      console.log(
        `[SlugResolver] Cached ${Object.keys(map).length} slug mappings in ${duration}ms`
      );

      return map;
    } catch (error) {
      console.error("[SlugResolver] Failed to build slug map:", error);
      // Return empty map on error - fallback will handle it
      return {};
    }
  }

  /**
   * Manually refresh the slug map (e.g., after webhook)
   */
  async refresh(): Promise<void> {
    console.log("[SlugResolver] Refreshing slug map...");
    await slugCache.delete(this.CACHE_KEY);
    await this.buildSlugMap();
  }

  /**
   * Clear the cache
   */
  async clear(): Promise<void> {
    await slugCache.delete(this.CACHE_KEY);
  }
}

// Export singleton instance
export const slugResolver = new SlugResolver();
