/**
 * Inventory module tests
 *
 * Strategy: mock the Square client, cache, and deduplicator so every branch
 * in inventory.ts is exercised with controlled inputs rather than relying on
 * live API calls or error-path fallbacks.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Hoist mock fn declarations so vi.mock factories can reference them ────────
// vi.mock() calls are hoisted to the top of the file by Vitest's transformer,
// so any variables they reference must also be hoisted via vi.hoisted().

const {
  mockRetrieveInventoryCount,
  mockBatchRetrieveInventory,
  mockCacheGet,
  mockCacheSet,
  mockCacheGetOrCompute,
  mockCachePrune,
  mockProcessSquareError,
  mockHandleError,
  mockLogError,
} = vi.hoisted(() => ({
  mockRetrieveInventoryCount:   vi.fn(),
  mockBatchRetrieveInventory:   vi.fn(),
  mockCacheGet:                 vi.fn(),
  mockCacheSet:                 vi.fn(),
  mockCacheGetOrCompute:        vi.fn(),
  mockCachePrune:               vi.fn(),
  mockProcessSquareError:       vi.fn(),
  mockHandleError:              vi.fn(),
  mockLogError:                 vi.fn(),
}));

vi.mock('../client', () => ({
  squareClient: {
    inventory: {
      get:            mockRetrieveInventoryCount,
      batchGetCounts: mockBatchRetrieveInventory,
    },
  },
}));

vi.mock('../cacheUtils', () => ({
  inventoryCache: {
    get:          mockCacheGet,
    set:          mockCacheSet,
    getOrCompute: mockCacheGetOrCompute,
    prune:        mockCachePrune,
  },
}));

// Let the deduplicator run through transparently so the real function executes.
vi.mock('../requestDeduplication', () => ({
  requestDeduplicator: {
    dedupe: vi.fn((_key: string, fn: () => unknown) => fn()),
  },
}));

vi.mock('../serverErrorUtils', () => ({
  processSquareError: mockProcessSquareError,
}));

vi.mock('../errorUtils', () => ({
  logError:    mockLogError,
  handleError: mockHandleError,
}));

// ── Import after mocks are registered ───────────────────────────────────────

import {
  checkItemInventory,
  isItemInStock,
  checkBulkInventory,
  getProductStockStatus,
  pruneInventoryCache,
} from '../inventory';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Make getOrCompute always run the compute function (cache miss). */
function useCacheMiss() {
  mockCacheGetOrCompute.mockImplementation((_key: string, fn: () => unknown) => fn());
}

/** Make getOrCompute return a pre-cached value without calling compute. */
function useCacheHit(value: number) {
  mockCacheGetOrCompute.mockResolvedValue(value);
}

/** Build a minimal Square count object. */
function makeCount(catalogObjectId: string, quantity: string, state = 'IN_STOCK') {
  return { catalogObjectId, quantity, state };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('checkItemInventory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: Square returns no counts (empty catalog / unknown ID)
    mockRetrieveInventoryCount.mockResolvedValue({ data: [] });
    // Default error-path helpers
    mockProcessSquareError.mockReturnValue({ message: 'sq-error' });
    mockHandleError.mockImplementation((_err: unknown, defaultVal: unknown) => defaultVal);
  });

  it('returns the IN_STOCK quantity when Square has stock', async () => {
    useCacheMiss();
    mockRetrieveInventoryCount.mockResolvedValue({
      data: [makeCount('var-1', '7')],
    });

    const qty = await checkItemInventory('var-1');

    expect(qty).toBe(7);
    expect(mockRetrieveInventoryCount).toHaveBeenCalledWith(expect.objectContaining({ catalogObjectId: 'var-1' }));
  });

  it('returns 0 when counts array is empty', async () => {
    useCacheMiss();
    mockRetrieveInventoryCount.mockResolvedValue({ data: [] });

    const qty = await checkItemInventory('var-no-stock');
    expect(qty).toBe(0);
  });

  it('returns 0 when there are counts but none with IN_STOCK state', async () => {
    useCacheMiss();
    mockRetrieveInventoryCount.mockResolvedValue({
      data: [makeCount('var-1', '5', 'SOLD')],
    });

    const qty = await checkItemInventory('var-1');
    expect(qty).toBe(0);
  });

  it('returns the error-path default (0) when Square throws', async () => {
    useCacheMiss();
    mockRetrieveInventoryCount.mockRejectedValue(new Error('network error'));
    mockHandleError.mockReturnValue(0);

    const qty = await checkItemInventory('var-bad');
    expect(qty).toBe(0);
    expect(mockProcessSquareError).toHaveBeenCalled();
    expect(mockHandleError).toHaveBeenCalled();
  });

  it('returns the cached value without calling Square', async () => {
    useCacheHit(12);

    const qty = await checkItemInventory('var-cached');
    expect(qty).toBe(12);
    expect(mockRetrieveInventoryCount).not.toHaveBeenCalled();
  });
});

describe('isItemInStock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProcessSquareError.mockReturnValue({ message: 'sq-error' });
    mockHandleError.mockImplementation((_err: unknown, d: unknown) => d);
  });

  it('returns true when quantity is greater than zero', async () => {
    useCacheMiss();
    mockRetrieveInventoryCount.mockResolvedValue({
      data: [makeCount('var-1', '3')],
    });

    expect(await isItemInStock('var-1')).toBe(true);
  });

  it('returns false when quantity is zero', async () => {
    useCacheMiss();
    mockRetrieveInventoryCount.mockResolvedValue({ data: [] });

    expect(await isItemInStock('var-empty')).toBe(false);
  });
});

describe('checkBulkInventory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCacheGet.mockResolvedValue(undefined); // cache miss by default
    mockCacheSet.mockResolvedValue(undefined);
    mockProcessSquareError.mockReturnValue({ message: 'sq-error' });
    mockHandleError.mockImplementation((_err: unknown, d: unknown) => d);
  });

  it('returns an empty object immediately for an empty ID list', async () => {
    const result = await checkBulkInventory([]);
    expect(result).toEqual({});
    expect(mockBatchRetrieveInventory).not.toHaveBeenCalled();
  });

  it('returns cached values without calling Square when all IDs are cached', async () => {
    mockCacheGet.mockResolvedValue(5); // every ID hits cache

    const result = await checkBulkInventory(['var-1', 'var-2']);
    expect(result).toEqual({ 'var-1': 5, 'var-2': 5 });
    expect(mockBatchRetrieveInventory).not.toHaveBeenCalled();
  });

  it('deduplicates repeated IDs before fetching', async () => {
    // Single unique ID → delegates to checkItemInventory (single-fetch path)
    useCacheMiss();
    mockCacheGetOrCompute.mockImplementation((_k: string, fn: () => unknown) => fn());
    mockRetrieveInventoryCount.mockResolvedValue({
      data: [makeCount('var-1', '4')],
    });

    const result = await checkBulkInventory(['var-1', 'var-1', 'var-1']);
    expect(result['var-1']).toBe(4);
    // Deduplication means Square was called only once
    expect(mockRetrieveInventoryCount).toHaveBeenCalledTimes(1);
  });

  it('uses the single-item path when exactly one ID is uncached', async () => {
    // var-2 is in cache, var-1 is not → single-fetch path for var-1
    mockCacheGet.mockImplementation(async (id: string) =>
      id === 'var-2' ? 9 : undefined
    );
    useCacheMiss(); // fallback for getOrCompute calls inside checkItemInventory
    mockCacheGetOrCompute.mockImplementation((_k: string, fn: () => unknown) => fn());
    mockRetrieveInventoryCount.mockResolvedValue({
      data: [makeCount('var-1', '3')],
    });

    const result = await checkBulkInventory(['var-1', 'var-2']);
    expect(result['var-2']).toBe(9);
    expect(result['var-1']).toBe(3);
    expect(mockBatchRetrieveInventory).not.toHaveBeenCalled();
  });

  it('uses the batch API path for multiple uncached IDs', async () => {
    mockBatchRetrieveInventory.mockResolvedValue({
      data: [
        makeCount('var-1', '2'),
        makeCount('var-2', '8'),
      ],
    });

    const result = await checkBulkInventory(['var-1', 'var-2']);
    expect(result).toEqual({ 'var-1': 2, 'var-2': 8 });
    expect(mockBatchRetrieveInventory).toHaveBeenCalledTimes(1);
  });

  it('fills missing IDs with 0 when batch response omits them', async () => {
    // Square only returns var-1; var-2 is absent → should default to 0
    mockBatchRetrieveInventory.mockResolvedValue({
      data: [makeCount('var-1', '5')],
    });

    const result = await checkBulkInventory(['var-1', 'var-2']);
    expect(result['var-1']).toBe(5);
    expect(result['var-2']).toBe(0);
  });

  it('ignores counts that are not IN_STOCK state', async () => {
    mockBatchRetrieveInventory.mockResolvedValue({
      data: [makeCount('var-1', '3', 'SOLD')],
    });

    const result = await checkBulkInventory(['var-1', 'var-2']);
    // var-1 is SOLD (not IN_STOCK) → treated as 0
    expect(result['var-1']).toBe(0);
    expect(result['var-2']).toBe(0);
  });

  it('updates the cache for each fetched ID', async () => {
    mockBatchRetrieveInventory.mockResolvedValue({
      data: [makeCount('var-1', '6'), makeCount('var-2', '0')],
    });

    await checkBulkInventory(['var-1', 'var-2']);
    expect(mockCacheSet).toHaveBeenCalledWith('var-1', 6);
    // Zero quantities are also cached (prevent re-fetch)
    expect(mockCacheSet).toHaveBeenCalledWith('var-2', 0);
  });

  it('returns an empty object when the batch API throws', async () => {
    mockBatchRetrieveInventory.mockRejectedValue(new Error('timeout'));
    mockHandleError.mockReturnValue({});

    const result = await checkBulkInventory(['var-1', 'var-2']);
    expect(result).toEqual({});
    expect(mockHandleError).toHaveBeenCalled();
  });

  it('mixes cached and fetched values in the result', async () => {
    // var-1 cached at 7, var-2 and var-3 uncached
    mockCacheGet.mockImplementation(async (id: string) =>
      id === 'var-1' ? 7 : undefined
    );
    mockBatchRetrieveInventory.mockResolvedValue({
      data: [makeCount('var-2', '4'), makeCount('var-3', '0')],
    });

    const result = await checkBulkInventory(['var-1', 'var-2', 'var-3']);
    expect(result).toEqual({ 'var-1': 7, 'var-2': 4, 'var-3': 0 });
  });
});

describe('getProductStockStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCacheGet.mockResolvedValue(undefined);
    mockCacheSet.mockResolvedValue(undefined);
    mockProcessSquareError.mockReturnValue({ message: 'sq-error' });
    mockHandleError.mockImplementation((_e: unknown, d: unknown) => d);
    mockLogError.mockReturnValue(undefined);
  });

  function makeProduct(overrides: Partial<{
    variationId: string;
    variations: { variationId: string }[];
  }> = {}) {
    return {
      id: 'prod-1',
      catalogObjectId: 'prod-1',
      variationId: 'var-1',
      title: 'Test Product',
      image: '',
      price: 0,
      url: '/product/test',
      ...overrides,
    } as any;
  }

  it('returns not-out-of-stock when all variations are in stock', async () => {
    mockBatchRetrieveInventory.mockResolvedValue({
      data: [makeCount('var-1', '5'), makeCount('var-2', '3')],
    });

    const status = await getProductStockStatus(makeProduct({
      variations: [{ variationId: 'var-1' }, { variationId: 'var-2' }],
    }));

    expect(status.isOutOfStock).toBe(false);
    expect(status.hasLimitedOptions).toBe(false);
  });

  it('returns isOutOfStock when all variations are at zero', async () => {
    mockBatchRetrieveInventory.mockResolvedValue({ data: [] });

    const status = await getProductStockStatus(makeProduct({
      variations: [{ variationId: 'var-1' }, { variationId: 'var-2' }],
    }));

    expect(status.isOutOfStock).toBe(true);
    expect(status.hasLimitedOptions).toBe(false);
  });

  it('returns hasLimitedOptions when some variations are in stock', async () => {
    // var-1 in stock, var-2 not
    mockBatchRetrieveInventory.mockResolvedValue({
      data: [makeCount('var-1', '4')],
    });

    const status = await getProductStockStatus(makeProduct({
      variations: [{ variationId: 'var-1' }, { variationId: 'var-2' }],
    }));

    expect(status.isOutOfStock).toBe(false);
    expect(status.hasLimitedOptions).toBe(true);
  });

  it('handles a single-variation product that is in stock', async () => {
    useCacheMiss();
    mockCacheGetOrCompute.mockImplementation((_k: string, fn: () => unknown) => fn());
    mockRetrieveInventoryCount.mockResolvedValue({
      data: [makeCount('var-1', '2')],
    });

    const status = await getProductStockStatus(makeProduct({ variationId: 'var-1' }));
    expect(status.isOutOfStock).toBe(false);
  });

  it('handles a single-variation product that is out of stock', async () => {
    useCacheMiss();
    mockCacheGetOrCompute.mockImplementation((_k: string, fn: () => unknown) => fn());
    mockRetrieveInventoryCount.mockResolvedValue({ data: [] });

    const status = await getProductStockStatus(makeProduct({ variationId: 'var-1' }));
    expect(status.isOutOfStock).toBe(true);
  });

  it('returns default (in-stock) when the product has no variations and no variationId', async () => {
    const status = await getProductStockStatus(makeProduct({
      variations: [],
      variationId: '',
    }));
    expect(status.isOutOfStock).toBe(false);
    expect(status.hasLimitedOptions).toBe(false);
  });

  it('marks product as out-of-stock when the batch API throws', async () => {
    // Two uncached variations → takes the batch path inside checkBulkInventory.
    // The batch call rejects; checkBulkInventory catches it and returns {}.
    // getProductStockStatus then sees 0-stock for every variation → isOutOfStock.
    mockBatchRetrieveInventory.mockRejectedValue(new Error('api error'));
    mockHandleError.mockReturnValue({});

    const status = await getProductStockStatus(makeProduct({
      variations: [{ variationId: 'var-1' }, { variationId: 'var-2' }],
    }));

    expect(status.isOutOfStock).toBe(true);
    expect(mockProcessSquareError).toHaveBeenCalled();
  });
});

describe('pruneInventoryCache', () => {
  it('delegates to inventoryCache.prune() and returns its count', () => {
    mockCachePrune.mockReturnValue(5);
    expect(pruneInventoryCache()).toBe(5);
    expect(mockCachePrune).toHaveBeenCalledTimes(1);
  });

  it('returns 0 when nothing was pruned', () => {
    mockCachePrune.mockReturnValue(0);
    expect(pruneInventoryCache()).toBe(0);
  });
});
