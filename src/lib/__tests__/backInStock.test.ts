/**
 * backInStock.ts — caching behavior for getAllProductSummaries()
 * Covers Plan 115: cache hit avoids re-reading the subscription store, and
 * each mutator invalidates the cache so the next read reflects the change.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { BisSubscription } from '../backInStock';

const mockSubStore = {
  get: vi.fn(),
  set: vi.fn(),
  setJSON: vi.fn(),
  delete: vi.fn(),
  list: vi.fn(),
};

const mockCacheStore = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
  list: vi.fn(),
};

vi.mock('@netlify/blobs', () => ({
  getStore: vi.fn((arg: string | { name: string }) => {
    const name = typeof arg === 'string' ? arg : arg.name;
    return name === 'back-in-stock-subscriptions' ? mockSubStore : mockCacheStore;
  }),
}));

function blobKey(productId: string, email: string) {
  return `${productId}/${email.toLowerCase().trim()}`;
}

const subA: BisSubscription = {
  email: 'a@example.com',
  productId: 'PROD1',
  productTitle: 'Baker Deck',
  variationId: 'VAR1',
  productUrl: '/product/baker-deck',
  submittedAt: '2026-01-01T00:00:00Z',
};

const subB: BisSubscription = {
  email: 'b@example.com',
  productId: 'PROD1',
  productTitle: 'Baker Deck',
  variationId: 'VAR1',
  productUrl: '/product/baker-deck',
  submittedAt: '2026-01-02T00:00:00Z',
};

// summariesCache is a module-level singleton with its own in-memory fallback
// cache — reset modules between tests so each test starts with a fresh cache.
async function loadBackInStock() {
  return await import('../backInStock');
}

describe('backInStock — getAllProductSummaries caching', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockCacheStore.get.mockResolvedValue(undefined);
    mockCacheStore.set.mockResolvedValue(undefined);
    mockCacheStore.delete.mockResolvedValue(undefined);
  });

  it('serves the second call from cache without re-reading the subscription store', async () => {
    const { getAllProductSummaries } = await loadBackInStock();

    mockSubStore.list.mockResolvedValue({ blobs: [{ key: blobKey(subA.productId, subA.email) }] });
    mockSubStore.get.mockResolvedValue(subA);

    const first = await getAllProductSummaries();
    const second = await getAllProductSummaries();

    expect(first).toEqual(second);
    expect(mockSubStore.list).toHaveBeenCalledTimes(1);
    expect(mockSubStore.get).toHaveBeenCalledTimes(1);
  });

  it('invalidates the cache on addSubscription so the next read reflects the new subscriber', async () => {
    const { addSubscription, getAllProductSummaries } = await loadBackInStock();

    mockSubStore.list.mockResolvedValueOnce({
      blobs: [{ key: blobKey(subA.productId, subA.email) }],
    });
    mockSubStore.get.mockResolvedValueOnce(subA);

    const first = await getAllProductSummaries();
    expect(first[0].count).toBe(1);

    mockSubStore.list.mockResolvedValueOnce({
      blobs: [
        { key: blobKey(subA.productId, subA.email) },
        { key: blobKey(subB.productId, subB.email) },
      ],
    });
    mockSubStore.get.mockResolvedValueOnce(subA).mockResolvedValueOnce(subB);

    await addSubscription(subB);

    const second = await getAllProductSummaries();
    expect(second[0].count).toBe(2);
  });

  it('invalidates the cache on removeSubscription so the next read reflects the removal', async () => {
    const { removeSubscription, getAllProductSummaries } = await loadBackInStock();

    mockSubStore.list.mockResolvedValueOnce({
      blobs: [
        { key: blobKey(subA.productId, subA.email) },
        { key: blobKey(subB.productId, subB.email) },
      ],
    });
    mockSubStore.get.mockResolvedValueOnce(subA).mockResolvedValueOnce(subB);

    const first = await getAllProductSummaries();
    expect(first[0].count).toBe(2);

    mockSubStore.list.mockResolvedValueOnce({
      blobs: [{ key: blobKey(subA.productId, subA.email) }],
    });
    mockSubStore.get.mockResolvedValueOnce(subA);

    await removeSubscription(subB.productId, subB.email);

    const second = await getAllProductSummaries();
    expect(second[0].count).toBe(1);
  });

  it('invalidates the cache on removeAllSubscriptionsForProduct so the next read is empty', async () => {
    const { removeAllSubscriptionsForProduct, getAllProductSummaries } = await loadBackInStock();

    mockSubStore.list.mockResolvedValueOnce({
      blobs: [{ key: blobKey(subA.productId, subA.email) }],
    });
    mockSubStore.get.mockResolvedValueOnce(subA);

    const first = await getAllProductSummaries();
    expect(first).toHaveLength(1);

    mockSubStore.list.mockResolvedValueOnce({
      blobs: [{ key: blobKey(subA.productId, subA.email) }],
    });
    mockSubStore.get.mockResolvedValueOnce(subA);
    mockSubStore.list.mockResolvedValueOnce({ blobs: [] });

    await removeAllSubscriptionsForProduct(subA.productId);

    const second = await getAllProductSummaries();
    expect(second).toHaveLength(0);
  });
});
