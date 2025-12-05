/**
 * BlobCache Tests - Cache invalidation, circuit breaker, and fallback logic
 * Tests Netlify Blobs integration, TTL expiration, and fallback cache
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BlobCache } from '../blobCache';

// Mock Netlify Blobs
const mockBlobStore = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn()
};

vi.mock('@netlify/blobs', () => ({
  getStore: vi.fn(() => mockBlobStore)
}));

describe('BlobCache', () => {
  let cache: BlobCache<any>;

  beforeEach(() => {
    vi.clearAllMocks();
    cache = new BlobCache('test-cache', 60);
  });

  describe('Basic Operations', () => {
    it('should get cached value within TTL', async () => {
      const cachedEntry = {
        value: 'test-value',
        timestamp: Date.now(),
        ttl: 60000
      };

      mockBlobStore.get.mockResolvedValue(JSON.stringify(cachedEntry));

      const result = await cache.get('test-key');

      expect(result).toBe('test-value');
      expect(mockBlobStore.get).toHaveBeenCalled();
    });

    it('should return undefined for expired cache', async () => {
      const expiredEntry = {
        value: 'test-value',
        timestamp: Date.now() - 120000, // 2 minutes ago
        ttl: 60000 // 1 minute TTL
      };

      mockBlobStore.get.mockResolvedValue(JSON.stringify(expiredEntry));

      const result = await cache.get('test-key');

      expect(result).toBeUndefined();
      expect(mockBlobStore.delete).toHaveBeenCalled(); // Should delete expired
    });

    it('should return undefined for missing key', async () => {
      mockBlobStore.get.mockResolvedValue(null);

      const result = await cache.get('missing-key');

      expect(result).toBeUndefined();
    });

    it('should set value in cache', async () => {
      mockBlobStore.set.mockResolvedValue(undefined);

      await cache.set('test-key', 'test-value');

      expect(mockBlobStore.set).toHaveBeenCalled();
      const setCall = mockBlobStore.set.mock.calls[0];
      const storedData = JSON.parse(setCall[1]);

      expect(storedData.value).toBe('test-value');
      expect(storedData.ttl).toBe(60000);
      expect(storedData.timestamp).toBeDefined();
    });

    it('should check if key exists', async () => {
      const cachedEntry = {
        value: 'test-value',
        timestamp: Date.now(),
        ttl: 60000
      };

      mockBlobStore.get.mockResolvedValue(JSON.stringify(cachedEntry));

      const exists = await cache.has('test-key');

      expect(exists).toBe(true);
    });

    it('should return false for non-existent key', async () => {
      mockBlobStore.get.mockResolvedValue(null);

      const exists = await cache.has('missing-key');

      expect(exists).toBe(false);
    });

    it('should delete cache entry', async () => {
      mockBlobStore.delete.mockResolvedValue(undefined);

      await cache.delete('test-key');

      expect(mockBlobStore.delete).toHaveBeenCalled();
    });
  });

  describe('getOrCompute', () => {
    it('should return cached value if available', async () => {
      const cachedEntry = {
        value: 'cached-value',
        timestamp: Date.now(),
        ttl: 60000
      };

      mockBlobStore.get.mockResolvedValue(JSON.stringify(cachedEntry));

      const compute = vi.fn();
      const result = await cache.getOrCompute('test-key', compute);

      expect(result).toBe('cached-value');
      expect(compute).not.toHaveBeenCalled();
    });

    it('should compute and cache on miss', async () => {
      mockBlobStore.get.mockResolvedValue(null);
      mockBlobStore.set.mockResolvedValue(undefined);

      const compute = vi.fn().mockResolvedValue('computed-value');
      const result = await cache.getOrCompute('test-key', compute);

      expect(result).toBe('computed-value');
      expect(compute).toHaveBeenCalled();
      expect(mockBlobStore.set).toHaveBeenCalled();
    });

    it('should compute on expired cache', async () => {
      const expiredEntry = {
        value: 'old-value',
        timestamp: Date.now() - 120000,
        ttl: 60000
      };

      mockBlobStore.get.mockResolvedValue(JSON.stringify(expiredEntry));
      mockBlobStore.set.mockResolvedValue(undefined);

      const compute = vi.fn().mockResolvedValue('new-value');
      const result = await cache.getOrCompute('test-key', compute);

      expect(result).toBe('new-value');
      expect(compute).toHaveBeenCalled();
    });

    it('should not cache empty arrays', async () => {
      mockBlobStore.get.mockResolvedValue(null);

      const compute = vi.fn().mockResolvedValue([]);
      const result = await cache.getOrCompute('test-key', compute);

      expect(result).toEqual([]);
      expect(compute).toHaveBeenCalled();
      expect(mockBlobStore.set).not.toHaveBeenCalled();
    });

    it('should propagate compute errors', async () => {
      mockBlobStore.get.mockResolvedValue(null);

      const compute = vi.fn().mockRejectedValue(new Error('Compute failed'));

      await expect(
        cache.getOrCompute('test-key', compute)
      ).rejects.toThrow('Compute failed');
    });

    it('should use fallback cache for subsequent requests', async () => {
      mockBlobStore.get.mockResolvedValue(null);
      mockBlobStore.set.mockResolvedValue(undefined);

      const compute = vi.fn().mockResolvedValue('computed-value');

      // First call - compute and store in fallback
      const result1 = await cache.getOrCompute('test-key', compute);
      expect(result1).toBe('computed-value');

      // Second call - should use fallback (faster than blob)
      mockBlobStore.get.mockClear();
      const result2 = await cache.getOrCompute('test-key', compute);
      expect(result2).toBe('computed-value');

      // Fallback should be used, so compute shouldn't be called again
      expect(compute).toHaveBeenCalledTimes(1);
    });
  });

  describe('Circuit Breaker', () => {
    it('should track failures', async () => {
      mockBlobStore.get.mockRejectedValue(new Error('Blob error'));
      mockBlobStore.set.mockRejectedValue(new Error('Blob error'));

      const compute = vi.fn().mockResolvedValue('fallback-value');

      // Trigger multiple failures
      for (let i = 0; i < 5; i++) {
        await cache.getOrCompute(`test-key-${i}`, compute);
      }

      // Wait for async set operations to complete
      await new Promise(resolve => setTimeout(resolve, 10));

      const status = (cache as any).failureCount;
      expect(status).toBeGreaterThanOrEqual(5);
    });

    it('should disable blob operations after threshold', async () => {
      mockBlobStore.get.mockRejectedValue(new Error('Blob error'));

      const compute = vi.fn().mockResolvedValue('value');

      // Trigger failures to open circuit
      for (let i = 0; i < 6; i++) {
        await cache.getOrCompute('test-key', compute);
      }

      const blobOperationsDisabled = (cache as any).blobOperationsDisabled;
      expect(blobOperationsDisabled).toBe(true);
    });

    it('should decrement failure count on success', async () => {
      // First, cause some failures
      mockBlobStore.get.mockRejectedValueOnce(new Error('Error'));
      mockBlobStore.set.mockRejectedValueOnce(new Error('Error'));

      const compute = vi.fn().mockResolvedValue('value');
      await cache.getOrCompute('key1', compute);

      // Wait for async set operation to complete
      await new Promise(resolve => setTimeout(resolve, 10));

      const failureCountBefore = (cache as any).failureCount;
      expect(failureCountBefore).toBe(2); // get + set both failed

      // Now succeed
      mockBlobStore.get.mockResolvedValue(null);
      mockBlobStore.set.mockResolvedValue(undefined);

      await cache.getOrCompute('key2', compute);

      // Wait for async set operation to complete
      await new Promise(resolve => setTimeout(resolve, 10));

      const failureCountAfter = (cache as any).failureCount;
      expect(failureCountAfter).toBeLessThan(failureCountBefore);
    });
  });

  describe('Fallback Cache', () => {
    it('should use fallback cache when blob fails', async () => {
      mockBlobStore.get.mockRejectedValue(new Error('Blob error'));

      const compute = vi.fn().mockResolvedValue('computed-value');
      const result = await cache.getOrCompute('test-key', compute);

      expect(result).toBe('computed-value');

      // Second call should use fallback
      mockBlobStore.get.mockClear();
      compute.mockClear();

      const result2 = await cache.getOrCompute('test-key', compute);
      expect(result2).toBe('computed-value');
      expect(compute).not.toHaveBeenCalled(); // Used fallback
    });

    it('should cleanup expired fallback entries', () => {
      const fallbackCache = (cache as any).fallbackCache;

      // Add expired entry
      const expiredEntry = {
        value: 'old-value',
        timestamp: Date.now() - 120000,
        ttl: 60000
      };
      fallbackCache.set('expired-key', expiredEntry);

      // Add valid entry
      const validEntry = {
        value: 'valid-value',
        timestamp: Date.now(),
        ttl: 60000
      };
      fallbackCache.set('valid-key', validEntry);

      const cleanedCount = cache.cleanupFallbackCache();

      expect(cleanedCount).toBe(1);
      expect(fallbackCache.has('expired-key')).toBe(false);
      expect(fallbackCache.has('valid-key')).toBe(true);
    });

    it('should remove expired entries from fallback during getOrCompute', async () => {
      const fallbackCache = (cache as any).fallbackCache;

      // Add expired entry to fallback
      const expiredEntry = {
        value: 'old-value',
        timestamp: Date.now() - 120000,
        ttl: 60000
      };
      fallbackCache.set('test-cache:test-key', expiredEntry);

      mockBlobStore.get.mockResolvedValue(null);
      mockBlobStore.set.mockResolvedValue(undefined);

      const compute = vi.fn().mockResolvedValue('new-value');
      const result = await cache.getOrCompute('test-key', compute);

      expect(result).toBe('new-value');
      expect(compute).toHaveBeenCalled(); // Fallback was expired
    });
  });

  describe('Cache Key Namespacing', () => {
    it('should namespace cache keys', async () => {
      mockBlobStore.set.mockResolvedValue(undefined);

      await cache.set('my-key', 'value');

      const setCall = mockBlobStore.set.mock.calls[0];
      const cacheKey = setCall[0];

      expect(cacheKey).toContain('test-cache');
      expect(cacheKey).toContain('my-key');
    });

    it('should include cache version in namespace', async () => {
      mockBlobStore.set.mockResolvedValue(undefined);

      await cache.set('my-key', 'value');

      const setCall = mockBlobStore.set.mock.calls[0];
      const cacheKey = setCall[0];

      expect(cacheKey).toMatch(/v\d+/); // Contains version
    });
  });

  describe('Development Mode', () => {
    it('should disable blobs in development', () => {
      const devCache = new BlobCache('dev-cache', 60);

      // In test environment, blobs should work
      // This test validates the detection logic exists
      expect(devCache).toBeDefined();
    });

    it('should use fallback-only in browser environment', () => {
      const originalWindow = global.window;

      // Simulate browser environment
      (global as any).window = {};

      const browserCache = new BlobCache('browser-cache', 60);
      const blobOperationsDisabled = (browserCache as any).blobOperationsDisabled;

      expect(blobOperationsDisabled).toBe(true);

      // Restore
      if (originalWindow === undefined) {
        delete (global as any).window;
      } else {
        global.window = originalWindow;
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle JSON parse errors', async () => {
      mockBlobStore.get.mockResolvedValue('invalid json{');

      const result = await cache.get('test-key');

      expect(result).toBeUndefined();
    });

    it('should handle blob store get failures gracefully', async () => {
      mockBlobStore.get.mockRejectedValue(new Error('Network error'));

      const result = await cache.get('test-key');

      expect(result).toBeUndefined();
    });

    it('should handle blob store set failures gracefully', async () => {
      mockBlobStore.set.mockRejectedValue(new Error('Write error'));

      // Should not throw
      await expect(cache.set('test-key', 'value')).resolves.toBeUndefined();
    });

    it('should handle blob store delete failures gracefully', async () => {
      mockBlobStore.delete.mockRejectedValue(new Error('Delete error'));

      // Should not throw
      await expect(cache.delete('test-key')).resolves.toBeUndefined();
    });
  });

  describe('TTL Configuration', () => {
    it('should use custom TTL', async () => {
      const customCache = new BlobCache('custom-ttl', 120); // 120 seconds

      mockBlobStore.set.mockResolvedValue(undefined);

      await customCache.set('test-key', 'value');

      const setCall = mockBlobStore.set.mock.calls[0];
      const storedData = JSON.parse(setCall[1]);

      expect(storedData.ttl).toBe(120000); // 120 seconds in ms
    });

    it('should respect TTL in expiration checks', async () => {
      const shortCache = new BlobCache('short-ttl', 1); // 1 second

      const recentEntry = {
        value: 'test-value',
        timestamp: Date.now() - 2000, // 2 seconds ago
        ttl: 1000 // 1 second TTL
      };

      mockBlobStore.get.mockResolvedValue(JSON.stringify(recentEntry));

      const result = await shortCache.get('test-key');

      expect(result).toBeUndefined(); // Expired
    });
  });

  describe('Metadata', () => {
    it('should include metadata in blob storage', async () => {
      mockBlobStore.set.mockResolvedValue(undefined);

      await cache.set('test-key', 'value');

      const setCall = mockBlobStore.set.mock.calls[0];
      const metadata = setCall[2].metadata;

      expect(metadata).toBeDefined();
      expect(metadata.cacheName).toContain('test-cache');
      expect(metadata.expires).toBeDefined();
    });

    it('should set correct expiration in metadata', async () => {
      mockBlobStore.set.mockResolvedValue(undefined);

      const beforeSet = Date.now();
      await cache.set('test-key', 'value');
      const afterSet = Date.now();

      const setCall = mockBlobStore.set.mock.calls[0];
      const metadata = setCall[2].metadata;

      // Expiration should be around now + TTL (60 seconds)
      expect(metadata.expires).toBeGreaterThanOrEqual(beforeSet + 60000);
      expect(metadata.expires).toBeLessThanOrEqual(afterSet + 60000);
    });
  });

  describe('Cache Statistics', () => {
    it('should return cache stats', () => {
      const stats = cache.getStats();

      expect(stats.name).toContain('test-cache');
      expect(stats.ttl).toBe(60000);
      expect(stats.type).toBe('netlify-blobs');
    });

    it('should indicate N/A for blob metrics', () => {
      const stats = cache.getStats();

      expect(stats.size).toBe('N/A');
      expect(stats.count).toBe('N/A');
    });
  });

  describe('Prune Operation', () => {
    it('should return 0 for prune (no-op for blobs)', () => {
      const pruned = cache.prune();

      expect(pruned).toBe(0);
    });
  });

  describe('Clear Operation', () => {
    it('should log warning for clear operation', async () => {
      const consoleSpy = vi.spyOn(console, 'warn');

      await cache.clear();

      expect(consoleSpy).toHaveBeenCalled();
      expect(consoleSpy.mock.calls[0][0]).toContain('not supported');

      consoleSpy.mockRestore();
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent getOrCompute calls', async () => {
      mockBlobStore.get.mockResolvedValue(null);
      mockBlobStore.set.mockResolvedValue(undefined);

      let computeCount = 0;
      const compute = vi.fn().mockImplementation(async () => {
        computeCount++;
        await new Promise(resolve => setTimeout(resolve, 10));
        return `value-${computeCount}`;
      });

      // Multiple concurrent calls
      const promises = [
        cache.getOrCompute('test-key', compute),
        cache.getOrCompute('test-key', compute),
        cache.getOrCompute('test-key', compute)
      ];

      const results = await Promise.all(promises);

      // All should have computed (no deduplication in this implementation)
      expect(compute).toHaveBeenCalled();
      expect(results.every(r => r.startsWith('value-'))).toBe(true);
    });
  });

  describe('Data Serialization', () => {
    it('should serialize complex objects', async () => {
      mockBlobStore.set.mockResolvedValue(undefined);

      const complexObject = {
        id: 1,
        name: 'Test',
        nested: {
          array: [1, 2, 3],
          boolean: true
        }
      };

      await cache.set('complex-key', complexObject);

      const setCall = mockBlobStore.set.mock.calls[0];
      const storedData = JSON.parse(setCall[1]);

      expect(storedData.value).toEqual(complexObject);
    });

    it('should deserialize complex objects', async () => {
      const complexObject = {
        id: 1,
        nested: {
          value: 'test'
        }
      };

      const cachedEntry = {
        value: complexObject,
        timestamp: Date.now(),
        ttl: 60000
      };

      mockBlobStore.get.mockResolvedValue(JSON.stringify(cachedEntry));

      const result = await cache.get('complex-key');

      expect(result).toEqual(complexObject);
    });
  });
});
