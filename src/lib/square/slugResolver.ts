// src/lib/square/slugResolver.ts
import { squareClient } from "./client";
import { createSlug } from "./slugUtils";
import { slugCache } from "../cache/blobCache";
import { logger } from "@/lib/logger";

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
    logger.debug("[SlugResolver] Building slug map from Square API...");
    const startTime = Date.now();

    try {
      // Fetch only ITEM objects with minimal data
      const response = await squareClient.catalog.list({ types: "ITEM" });

      const map: Record<string, string> = {};

      for (const item of response.data ?? []) {
        if (item.type === "ITEM" && (item as any).itemData?.name) {
          const slug = createSlug((item as any).itemData.name);
          map[slug] = item.id;
        }
      }

      // Cache the map in BlobCache
      await slugCache.set(this.CACHE_KEY, map);

      const duration = Date.now() - startTime;
      logger.debug(
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
    logger.debug("[SlugResolver] Refreshing slug map...");
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
