// src/lib/square/cacheUtils.ts
/**
 * Generic cache entry with TTL
 * @deprecated Use BlobCache from ../cache/blobCache.ts for serverless persistence
 */
export interface CacheEntry<T> {
  value: T;
  timestamp: number;
}

// Export standard cache instances
// All caches now use Netlify Blobs for shared state across serverless functions
// This fixes the function-per-route memory isolation issue
export {
  inventoryCache,
  categoryCache,
  productCache,
  imageCache,
  wordpressCache,
  filterCache,
  navigationCache,
  slugCache
} from "../cache/blobCache";
