// src/lib/square/slugResolver.ts
import { squareClient } from "./client";
import { createSlug } from "./slugUtils";
import { Cache } from "./cacheUtils";

/**
 * Lightweight slug-to-ID resolver
 * Maintains ONLY slug mappings, not full product data
 */
class SlugResolver {
  private cache = new Cache<Map<string, string>>("slug-map", 3600); // 1 hour TTL
  private CACHE_KEY = "slug-to-id-map";
  private initializing = false;
  private initPromise: Promise<Map<string, string>> | null = null;

  /**
   * Resolve a slug to a Square catalog ID
   */
  async resolve(slug: string): Promise<string | null> {
    const map = await this.getOrBuildMap();
    return map.get(slug) || null;
  }

  /**
   * Get the slug map, building it if necessary
   */
  private async getOrBuildMap(): Promise<Map<string, string>> {
    // Check cache first
    const cached = this.cache.get(this.CACHE_KEY);
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
  private async buildSlugMap(): Promise<Map<string, string>> {
    // console.log("[SlugResolver] Building slug map...");
    const startTime = Date.now();

    try {
      // Fetch only ITEM objects with minimal data
      const response = await squareClient.catalogApi.listCatalog(
        undefined,
        "ITEM"
      );

      const map = new Map<string, string>();

      if (response.result?.objects) {
        for (const item of response.result.objects) {
          if (item.type === "ITEM" && item.itemData?.name) {
            const slug = createSlug(item.itemData.name);
            map.set(slug, item.id);
          }
        }
      }

      // Cache the map
      this.cache.set(this.CACHE_KEY, map);

      const duration = Date.now() - startTime;
      // console.log(
      //   `[SlugResolver] Built map with ${map.size} slugs in ${duration}ms`
      // );

      return map;
    } catch (error) {
      // console.error("[SlugResolver] Failed to build slug map:", error);
      // Return empty map on error - fallback will handle it
      return new Map();
    }
  }

  /**
   * Manually refresh the slug map (e.g., after webhook)
   */
  async refresh(): Promise<void> {
    // console.log("[SlugResolver] Refreshing slug map...");
    this.cache.delete(this.CACHE_KEY);
    await this.buildSlugMap();
  }

  /**
   * Clear the cache
   */
  clear(): void {
    this.cache.clear();
  }
}

// Export singleton instance
export const slugResolver = new SlugResolver();
