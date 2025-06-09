// src/lib/square/navigationCache.ts
import { Cache } from "./cacheUtils";
import { fetchNavigationData } from "./navigationUtils";
import type { NavigationConfig } from "./types";

/**
 * Navigation-specific cache with longer TTL for stable data
 */
class NavigationCache {
  private static readonly NAVIGATION_TTL = 15 * 60 * 1000; // 15 minutes vs 5 for categories
  private cache: Cache<NavigationConfig>;

  constructor() {
    // Create cache with longer TTL since navigation is more stable than individual categories
    this.cache = new Cache<NavigationConfig>("navigation", 900); // 15 minutes in seconds
  }

  async getNavigationStructure(): Promise<NavigationConfig | null> {
    return this.cache.getOrCompute("nav-structure-v2", async () => {
      // Leverages existing fetchNavigationData which uses existing category cache
      return await fetchNavigationData();
    });
  }

  /**
   * Preload navigation data for faster subsequent requests
   */
  async preloadNavigation(): Promise<void> {
    try {
      await this.getNavigationStructure();
    } catch (error) {
      // Silent fail for preload - using existing error patterns
      console.warn("Navigation preload failed:", error);
    }
  }

  /**
   * Invalidate navigation cache
   */
  invalidate(): void {
    this.cache.delete("nav-structure-v2");
  }

  /**
   * Clear all navigation cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): { hasCache: boolean; cacheAge?: number } {
    const cached = this.cache.get("nav-structure-v2");
    if (!cached) {
      return { hasCache: false };
    }

    return {
      hasCache: true,
      cacheAge: Date.now() - (cached as any).timestamp,
    };
  }

  /**
   * Warm cache if empty
   */
  async warmCache(): Promise<boolean> {
    const stats = this.getStats();
    if (!stats.hasCache) {
      try {
        await this.preloadNavigation();
        return true;
      } catch {
        return false;
      }
    }
    return true;
  }
}

// Export singleton instance
export const navigationCache = new NavigationCache();

/**
 * Navigation cache warming for build-time optimization
 */
export async function warmNavigationCache(): Promise<void> {
  console.log("[NavigationCache] Warming cache...");
  const success = await navigationCache.warmCache();
  console.log(
    `[NavigationCache] Cache warming ${success ? "succeeded" : "failed"}`
  );
}

/**
 * Navigation cache health check
 */
export function checkNavigationCacheHealth(): Promise<boolean> {
  return navigationCache.warmCache();
}
