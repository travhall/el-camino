// src/lib/square/cacheUtils.ts
/**
 * Generic cache entry with TTL
 */
export interface CacheEntry<T> {
  value: T;
  timestamp: number;
}

/**
 * Cached item manager with standardized TTL handling
 */
export class Cache<T> {
  private cache: Record<string, CacheEntry<T>> = {};
  private ttl: number;
  private name: string;

  /**
   * Create a new cache
   * @param name Name for logging purposes
   * @param ttlSeconds TTL in seconds (default: 60)
   */
  constructor(name: string, ttlSeconds = 60) {
    this.ttl = ttlSeconds * 1000; // Convert to ms
    this.name = name;
  }

  /**
   * Get an item from cache
   * @param key Cache key
   * @returns The cached value or undefined if not in cache or expired
   */
  get(key: string): T | undefined {
    const now = Date.now();
    const entry = this.cache[key];

    if (!entry) {
      return undefined;
    }

    if (now - entry.timestamp > this.ttl) {
      // Cache expired
      return undefined;
    }

    return entry.value;
  }

  /**
   * Set an item in cache
   * @param key Cache key
   * @param value Value to store
   */
  set(key: string, value: T): void {
    this.cache[key] = {
      value,
      timestamp: Date.now(),
    };
  }

  /**
   * Check if an entry exists and is not expired
   * @param key Cache key
   * @returns True if a valid entry exists
   */
  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  /**
   * Delete an entry from the cache
   * @param key Cache key
   */
  delete(key: string): void {
    delete this.cache[key];
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.cache = {};
    console.log(`[Cache] Cleared ${this.name}`);
  }

  /**
   * Remove expired entries
   * @returns Number of entries pruned
   */
  prune(): number {
    const now = Date.now();
    let count = 0;

    Object.keys(this.cache).forEach((key) => {
      if (now - this.cache[key].timestamp > this.ttl) {
        delete this.cache[key];
        count++;
      }
    });

    if (count > 0) {
      console.log(`[Cache] Pruned ${count} expired entries from ${this.name}`);
    }

    return count;
  }

  /**
   * Get a cached value or compute and cache it if missing
   * @param key Cache key
   * @param compute Function to compute the value if not cached
   * @returns The cached or computed value
   */
  async getOrCompute(key: string, compute: () => Promise<T>): Promise<T> {
    const cached = this.get(key);
    if (cached !== undefined) {
      return cached;
    }

    try {
      const value = await compute();
      this.set(key, value);
      return value;
    } catch (error) {
      console.error(
        `[Cache] Error computing value for ${key} in ${this.name}:`,
        error
      );
      throw error;
    }
  }
}

// Export standard cache instances
export const inventoryCache = new Cache<number>("inventory", 60); // 1 minute
export const categoryCache = new Cache<any>("category", 900); // 15 minutes
export const productCache = new Cache<any>("product", 300); // 5 minutes
export const imageCache = new Cache<string>("image", 3600); // 1 hour
export const wordpressCache = new Cache<any>("wordpress", 300);

// Filter result caching - Phase 1 optimization
export const filterCache = new Cache<any>("filter", 300); // 5 minutes
