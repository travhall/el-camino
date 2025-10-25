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
  }

  /**
   * Get store instance (lazy initialization)
   */
  private getStore() {
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
    const cached = await this.get(key);
    if (cached !== undefined) {
      return cached;
    }

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
      
      await this.set(key, value);
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
export const inventoryCache = new BlobCache<number>("inventory", 900); // 15 minutes
export const categoryCache = new BlobCache<any>("category", 600); // 10 minutes (reduced from 30 for faster consistency)
export const productCache = new BlobCache<any>("product", 900); // 15 minutes
export const imageCache = new BlobCache<string>("image", 3600); // 1 hour
export const wordpressCache = new BlobCache<any>("wordpress", 300); // 5 minutes
export const filterCache = new BlobCache<any>("filter", 900); // 15 minutes
export const navigationCache = new BlobCache<any>("navigation", 3600); // 1 hour
