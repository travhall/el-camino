import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../client', () => ({
  squareClient: {
    inventory: {
      batchGetCounts: vi.fn(),
      get: vi.fn(),
    },
  },
}));

vi.mock('../apiRetry', () => ({
  // Pass-through: call the wrapped function once, let errors propagate —
  // the retry/backoff/circuit-breaker behavior itself is covered by
  // apiRetry.test.ts, not re-tested here.
  catalogRetryClient: {
    executeWithRetry: (fn: () => Promise<unknown>) => fn(),
  },
}));

const mockInventoryCacheGet = vi.fn();
const mockInventoryCacheSet = vi.fn();
vi.mock('@/lib/cache/blobCache', () => ({
  inventoryCache: {
    get: (...args: unknown[]) => mockInventoryCacheGet(...args),
    set: (...args: unknown[]) => mockInventoryCacheSet(...args),
  },
}));

import { fetchInventoryCounts } from '../inventoryCore';
import { squareClient } from '../client';
import { requestDeduplicator } from '../requestDeduplication';
import type { InventoryCount } from 'square-legacy';

// squareClient.inventory.{batchGetCounts,get} resolve to Square SDK `Page`
// objects, which carry pagination internals the mocks below don't need.
// These helpers build just the `{ data }` shape the code under test reads,
// cast through `unknown` since a literal can't satisfy the full `Page` type.
type BatchGetCountsResult = Awaited<
  ReturnType<typeof squareClient.inventory.batchGetCounts>
>;
type GetResult = Awaited<ReturnType<typeof squareClient.inventory.get>>;

function batchResult(data: InventoryCount[]): BatchGetCountsResult {
  return { data } as unknown as BatchGetCountsResult;
}

function getResult(data: InventoryCount[]): GetResult {
  return { data } as unknown as GetResult;
}

beforeEach(() => {
  vi.clearAllMocks();
  requestDeduplicator.clear();
  mockInventoryCacheGet.mockResolvedValue(undefined); // default: cache miss
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('fetchInventoryCounts', () => {
  it('returns empty results for an empty ID list without calling Square', async () => {
    const result = await fetchInventoryCounts([]);
    expect(result).toEqual({ counts: {}, failed: new Set() });
    expect(squareClient.inventory.batchGetCounts).not.toHaveBeenCalled();
  });

  it('serves already-cached IDs from the cache without calling Square', async () => {
    mockInventoryCacheGet.mockImplementation(async (id: string) =>
      id === 'v1' ? 5 : undefined
    );
    vi.mocked(squareClient.inventory.batchGetCounts).mockResolvedValue(
      batchResult([{ catalogObjectId: 'v2', state: 'IN_STOCK', quantity: '3' }])
    );

    const result = await fetchInventoryCounts(['v1', 'v2']);

    expect(result.counts).toEqual({ v1: 5, v2: 3 });
    expect(squareClient.inventory.batchGetCounts).toHaveBeenCalledWith(
      expect.objectContaining({ catalogObjectIds: ['v2'] })
    );
  });

  it('resolves via the batch endpoint and defaults IDs absent from the response to 0', async () => {
    vi.mocked(squareClient.inventory.batchGetCounts).mockResolvedValue(
      batchResult([
        { catalogObjectId: 'v1', state: 'IN_STOCK', quantity: '10' },
      ])
    );

    const result = await fetchInventoryCounts(['v1', 'v2']);

    expect(result.counts).toEqual({ v1: 10, v2: 0 });
    expect(result.failed.size).toBe(0);
  });

  it('caches freshly-fetched batch quantities', async () => {
    vi.mocked(squareClient.inventory.batchGetCounts).mockResolvedValue(
      batchResult([
        { catalogObjectId: 'v1', state: 'IN_STOCK', quantity: '10' },
      ])
    );

    await fetchInventoryCounts(['v1']);

    expect(mockInventoryCacheSet).toHaveBeenCalledWith('v1', 10);
  });

  it('falls back to individual lookups when the batch call fails, and reports only the truly-unresolvable IDs as failed', async () => {
    vi.mocked(squareClient.inventory.batchGetCounts).mockRejectedValue(
      new Error('batch endpoint down')
    );
    vi.mocked(squareClient.inventory.get).mockImplementation(
      async ({ catalogObjectId }) => {
        if (catalogObjectId === 'v1') {
          return getResult([{ state: 'IN_STOCK', quantity: '7' }]);
        }
        throw new Error('individual lookup failed too');
      }
    );

    const result = await fetchInventoryCounts(['v1', 'v2']);

    expect(result.counts).toEqual({ v1: 7 });
    expect(result.failed).toEqual(new Set(['v2']));
  });

  it('does not cache IDs that could not be resolved at all', async () => {
    vi.mocked(squareClient.inventory.batchGetCounts).mockRejectedValue(
      new Error('down')
    );
    vi.mocked(squareClient.inventory.get).mockRejectedValue(
      new Error('also down')
    );

    const result = await fetchInventoryCounts(['v1']);

    expect(result.failed).toEqual(new Set(['v1']));
    expect(mockInventoryCacheSet).not.toHaveBeenCalled();
  });

  it('treats a whole chunk failing individual fallback as fully failed, not a crash', async () => {
    vi.mocked(squareClient.inventory.batchGetCounts).mockRejectedValue(
      new Error('down')
    );
    vi.mocked(squareClient.inventory.get).mockRejectedValue(
      new Error('down too')
    );

    const result = await fetchInventoryCounts(['v1', 'v2', 'v3']);

    expect(result.counts).toEqual({});
    expect(result.failed).toEqual(new Set(['v1', 'v2', 'v3']));
  });

  it('deduplicates identical concurrent requests for the same ID set', async () => {
    vi.mocked(squareClient.inventory.batchGetCounts).mockResolvedValue(
      batchResult([
        { catalogObjectId: 'v1', state: 'IN_STOCK', quantity: '10' },
      ])
    );

    await Promise.all([
      fetchInventoryCounts(['v1']),
      fetchInventoryCounts(['v1']),
    ]);

    expect(squareClient.inventory.batchGetCounts).toHaveBeenCalledTimes(1);
  });
});
