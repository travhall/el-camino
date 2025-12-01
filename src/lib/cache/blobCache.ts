// src/lib/cache/blobCache.ts
/**
 * Netlify Blobs-based cache for sharing state across serverless functions
 * Replaces in-memory cache to solve function-per-route memory isolation
 */
import { getStore } from "@netlify/blobs";

interface CacheEntry<T> {
  value: T;
  timestamp: number;
  ttl: number;
}

/**
 * Blob-backed cache that persists across function instances and cold starts
 */
export class BlobCache<T> {
  private storeName: string;
  private ttl: number;
  private name: string;
  private isDevelopment: boolean = false;

  // Fallback in-memory cache for when Netlify Blobs fails
  private fallbackCache = new Map<string, CacheEntry<T>>();

  // Circuit breaker state
  private failureCount = 0;
  private lastFailureTime = 0;
  private circuitBreakerThreshold = 5; // Disable after 5 consecutive failures
  private circuitBreakerTimeout = 60000; // 1 minute timeout
  private blobOperationsDisabled = false;

  /**
   * Create a new blob-backed cache
   * @param name Name for logging purposes
   * @param ttlSeconds TTL in seconds (default: 60)
   * @param storeName Netlify Blobs store name (default: 'square-cache')
   */
  constructor(name: string, ttlSeconds = 60, storeName = "square-cache") {
    // CACHE VERSION: Increment this to invalidate all caches after env changes
    const CACHE_VERSION = "v3-prod"; // Changed to force fresh Production cache
    this.name = `${CACHE_VERSION}:${name}`;
    this.ttl = ttlSeconds * 1000; // Convert to ms
    this.storeName = storeName;

    // Check if we're in a browser environment (client-side)
    const isBrowser = typeof window !== "undefined";

    if (isBrowser) {
      // Always disable in browser - environment variables not available client-side
      this.blobOperationsDisabled = true;
      console.info(
        `[BlobCache:${this.name}] Browser environment - using fallback cache only`
      );
      return;
    }

    // Debug: Log environment variables for troubleshooting (server-side only)
    console.log(`[BlobCache:${this.name}] Environment debug:`);
    console.log(`  NODE_ENV: ${process.env.NODE_ENV}`);
    console.log(`  ASTRO_NODE_ENV: ${process.env.ASTRO_NODE_ENV}`);
    console.log(
      `  NETLIFY_BLOBS_STORE_ID: ${process.env.NETLIFY_BLOBS_STORE_ID}`
    );

    // Simple development detection - disable blobs in development
    const nodeEnvDev = process.env.NODE_ENV === "development";
    const astroEnvDev = process.env.ASTRO_NODE_ENV === "development";

    // Only treat as development if explicitly in dev environment
    this.isDevelopment = nodeEnvDev || astroEnvDev;

    console.log(`  nodeEnvDev: ${nodeEnvDev}`);
    console.log(`  astroEnvDev: ${astroEnvDev}`);
    console.log(
      `  NETLIFY_BLOBS_STORE_ID configured: ${!!process.env.NETLIFY_BLOBS_STORE_ID}`
    );

    if (this.isDevelopment) {
      this.blobOperationsDisabled = true;
      console.warn(
        `[BlobCache:${this.name}] DEVELOPMENT MODE DETECTED - using fallback cache only`
      );
    } else {
      console.info(
        `[BlobCache:${this.name}] PRODUCTION MODE - Netlify Blobs enabled`
      );
    }

    // Set up periodic cleanup of fallback cache (every 5 minutes)
    setInterval(() => {
      this.cleanupFallbackCache();
    }, 300000);
  }

  /**
   * Get store instance (lazy initialization)
   */
  private getStore() {
    // Always return null in development - Netlify Blobs doesn't work locally
    if (this.isDevelopment) {
      return null;
    }

    try {
      return getStore(this.storeName);
    } catch (error) {
      console.warn(
        `[BlobCache:${this.name}] Failed to get store, falling back to no-op:`,
        error
      );
      return null;
    }
  }

  /**
   * Handle failures and implement circuit breaker logic
   */
  private handleFailure(operation: string, error: any) {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    console.warn(
      `[BlobCache:${this.name}] ${operation} failed (${this.failureCount}/${this.circuitBreakerThreshold}):`,
      error
    );

    // Disable blob operations after threshold reached
    if (this.failureCount >= this.circuitBreakerThreshold) {
      this.blobOperationsDisabled = true;
      console.warn(
        `[BlobCache:${this.name}] Circuit breaker activated - disabling blob operations for ${this.circuitBreakerTimeout / 1000}s`
      );

      // Re-enable after timeout
      setTimeout(() => {
        this.blobOperationsDisabled = false;
        this.failureCount = 0;
        console.info(
          `[BlobCache:${this.name}] Circuit breaker reset - re-enabling blob operations`
        );
      }, this.circuitBreakerTimeout);
    }
  }

  /**
   * Reset failure count on successful operation
   */
  private handleSuccess() {
    if (this.failureCount > 0) {
      this.failureCount = Math.max(0, this.failureCount - 1);
    }
  }

  /**
   * Generate cache key with namespace
   */
  private getCacheKey(key: string): string {
    return `${this.name}:${key}`;
  }

  /**
   * Get an item from cache
   * @param key Cache key
   * @returns The cached value or undefined if not in cache or expired
   */
  async get(key: string): Promise<T | undefined> {
    const store = this.getStore();
    if (!store) return undefined;

    try {
      const cacheKey = this.getCacheKey(key);
      const cached = await store.get(cacheKey, {
        consistency: "strong", // Edge-cached globally
        type: "text", // Get as text, not ArrayBuffer
      });

      if (!cached) {
        return undefined;
      }

      const entry: CacheEntry<T> = JSON.parse(cached as string);
      const now = Date.now();

      // Check if expired
      if (now - entry.timestamp > entry.ttl) {
        // Expired - delete asynchronously
        store.delete(cacheKey).catch(() => {});
        return undefined;
      }

      return entry.value;
    } catch (error) {
      console.warn(
        `[BlobCache:${this.name}] Get failed for key ${key}:`,
        error
      );
      return undefined;
    }
  }

  /**
   * Set an item in cache
   * @param key Cache key
   * @param value Value to store
   */
  async set(key: string, value: T): Promise<void> {
    const store = this.getStore();
    if (!store) return;

    try {
      const entry: CacheEntry<T> = {
        value,
        timestamp: Date.now(),
        ttl: this.ttl,
      };

      const cacheKey = this.getCacheKey(key);
      await store.set(cacheKey, JSON.stringify(entry), {
        metadata: {
          cacheName: this.name,
          expires: Date.now() + this.ttl,
        },
      });
    } catch (error) {
      console.warn(
        `[BlobCache:${this.name}] Set failed for key ${key}:`,
        error
      );
    }
  }

  /**
   * Check if an entry exists and is not expired
   * @param key Cache key
   * @returns True if a valid entry exists
   */
  async has(key: string): Promise<boolean> {
    return (await this.get(key)) !== undefined;
  }

  /**
   * Delete an entry from the cache
   * @param key Cache key
   */
  async delete(key: string): Promise<void> {
    const store = this.getStore();
    if (!store) return;

    try {
      const cacheKey = this.getCacheKey(key);
      await store.delete(cacheKey);
    } catch (error) {
      console.warn(
        `[BlobCache:${this.name}] Delete failed for key ${key}:`,
        error
      );
    }
  }

  /**
   * Clear all entries (not implemented for Blobs - too expensive)
   */
  async clear(): Promise<void> {
    console.warn(
      `[BlobCache:${this.name}] Clear operation not supported for blob-backed cache`
    );
  }

  /**
   * Clean up expired entries from fallback cache
   * Call this periodically to prevent memory leaks
   */
  cleanupFallbackCache(): number {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, entry] of this.fallbackCache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.fallbackCache.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(
        `[BlobCache:${this.name}] Cleaned ${cleanedCount} expired entries from fallback cache`
      );
    }

    return cleanedCount;
  }

  /**
   * Remove expired entries (not needed for Blobs - auto-expires)
   * Kept for API compatibility with old Cache class
   * Returns 0 immediately (sync) since Blobs handles expiration automatically
   */
  prune(): number {
    // Blobs handles expiration automatically via TTL metadata
    // No-op for compatibility - return 0 to indicate no entries pruned
    return 0;
  }

  /**
   * Get cache statistics (simplified for Blobs)
   */
  getStats() {
    return {
      name: this.name,
      ttl: this.ttl,
      type: "netlify-blobs",
      // Blobs doesn't provide size/count metrics easily
      size: "N/A",
      count: "N/A",
    };
  }

  /**
   * Get a cached value or compute and cache it if missing
   * @param key Cache key
   * @param compute Function to compute the value if not cached
   * @returns The cached or computed value
   */
  async getOrCompute(key: string, compute: () => Promise<T>): Promise<T> {
    const cacheKey = this.getCacheKey(key);

    // Try fallback cache first (fastest)
    const fallbackEntry = this.fallbackCache.get(cacheKey);
    if (fallbackEntry) {
      const now = Date.now();
      if (now - fallbackEntry.timestamp <= fallbackEntry.ttl) {
        return fallbackEntry.value;
      } else {
        // Remove expired fallback entry
        this.fallbackCache.delete(cacheKey);
      }
    }

    // Try blob cache
    const store = this.getStore();
    let cachedValue: T | undefined = undefined;

    if (store) {
      try {
        const cached = await store.get(cacheKey, {
          consistency: "strong",
          type: "text",
        });

        if (cached) {
          const entry: CacheEntry<T> = JSON.parse(cached as string);
          const now = Date.now();

          // Check if expired
          if (now - entry.timestamp <= entry.ttl) {
            // Update fallback cache with fresh data
            this.fallbackCache.set(cacheKey, entry);
            this.handleSuccess();
            return entry.value;
          }
        }
      } catch (error) {
        this.handleFailure("get", error);
        // Continue to compute function
      }
    }

    // Cache miss or expired - compute new value
    try {
      const value = await compute();

      // DEFENSE: Prevent caching empty arrays that might indicate API failures
      // Legitimate empty results should be handled explicitly in calling code
      if (Array.isArray(value) && value.length === 0) {
        console.warn(
          `[BlobCache:${this.name}] Empty array result for key "${key}" - not caching to prevent poisoning`
        );
        return value; // Return the empty array but don't cache it
      }

      // ALWAYS store in fallback cache first
      const entry: CacheEntry<T> = {
        value,
        timestamp: Date.now(),
        ttl: this.ttl,
      };
      this.fallbackCache.set(cacheKey, entry);

      // Try to store in blob cache (don't wait for it)
      if (store) {
        store
          .set(cacheKey, JSON.stringify(entry), {
            metadata: {
              cacheName: this.name,
              expires: Date.now() + this.ttl,
            },
          })
          .then(() => {
            this.handleSuccess();
          })
          .catch((error) => {
            this.handleFailure("set", error);
          });
      }

      return value;
    } catch (error) {
      console.error(
        `[BlobCache:${this.name}] Error computing value for ${key}:`,
        error
      );
      throw error;
    }
  }
}

/**
 * Export standard cache instances using Netlify Blobs
 * These replace the in-memory caches to fix function-per-route isolation
 */
// UPDATED: Longer TTLs since catalog data changes infrequently
export const inventoryCache = new BlobCache<number>("inventory", 900); // 15 minutes
export const categoryCache = new BlobCache<any>("category", 3600); // 1 hour (was 10 min)
export const productCache = new BlobCache<any>("product", 3600); // 1 hour (was 15 min)
export const imageCache = new BlobCache<string>("image", 3600); // 1 hour
export const wordpressCache = new BlobCache<any>("wordpress", 300); // 5 minutes
export const filterCache = new BlobCache<any>("filter", 900); // 15 minutes
export const navigationCache = new BlobCache<any>("navigation", 3600); // 1 hour
export const slugCache = new BlobCache<Record<string, string>>(
  "slug-map",
  3600
); // 1 hour
