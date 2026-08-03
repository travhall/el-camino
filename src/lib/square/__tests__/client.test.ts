/**
 * Tests for src/lib/square/client.ts
 *
 * Strategy: mock Square SDK, productCache, requestDeduplicator, catalogRetryClient,
 * and all utility helpers so every path in fetchProducts and fetchProduct is
 * exercised with controlled inputs rather than live API calls.
 *
 * Plan 081 note: fetchProducts is now wrapped in productCache.getOrCompute — the
 * cache-hit test verifies that Square is not called a second time when the
 * cache is populated.
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

// ── Hoist mock fn declarations so vi.mock factories can reference them ────────

const {
  mockCatalogList,
  mockCatalogObjectGet,
  mockProductCacheGetOrCompute,
  mockProductCacheGet,
  mockProductCacheSet,
  mockBatchGetImageUrls,
  mockFetchMeasurementUnits,
  mockCreateProductUrl,
  mockExtractBrandValue,
  mockExtractIsGiftCard,
  mockExtractSaleInfo,
  mockBuildAvailableAttributes,
  mockLogApiError,
  mockLogError,
  mockProcessSquareError,
} = vi.hoisted(() => ({
  mockCatalogList: vi.fn(),
  mockCatalogObjectGet: vi.fn(),
  mockProductCacheGetOrCompute: vi.fn(),
  mockProductCacheGet: vi.fn(),
  mockProductCacheSet: vi.fn(),
  mockBatchGetImageUrls: vi.fn(),
  mockFetchMeasurementUnits: vi.fn(),
  mockCreateProductUrl: vi.fn(),
  mockExtractBrandValue: vi.fn(),
  mockExtractIsGiftCard: vi.fn(),
  mockExtractSaleInfo: vi.fn(),
  mockBuildAvailableAttributes: vi.fn(),
  mockLogApiError: vi.fn(),
  mockLogError: vi.fn(),
  mockProcessSquareError: vi.fn(),
}));

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('square-legacy', () => ({
  SquareClient: vi.fn().mockImplementation(function () {
    return {
      catalog: {
        list: mockCatalogList,
        object: { get: mockCatalogObjectGet },
      },
    };
  }),
  SquareEnvironment: {
    Production: 'production',
    Sandbox: 'sandbox',
  },
}));

vi.mock('@/lib/cache/blobCache', () => ({
  productCache: {
    getOrCompute: mockProductCacheGetOrCompute,
    get: mockProductCacheGet,
    set: mockProductCacheSet,
  },
}));

// Deduplicator passes through transparently so the real logic runs.
vi.mock('../requestDeduplication', () => ({
  requestDeduplicator: {
    dedupe: vi.fn((_key: string, fn: () => unknown) => fn()),
  },
}));

// Retry client passes through transparently.
vi.mock('../apiRetry', () => ({
  catalogRetryClient: {
    executeWithRetry: vi.fn((_fn: () => unknown) => _fn()),
  },
}));

vi.mock('../imageUtils', () => ({
  batchGetImageUrls: mockBatchGetImageUrls,
}));

vi.mock('../productUtils', () => ({
  fetchMeasurementUnits: mockFetchMeasurementUnits,
}));

vi.mock('../slugUtils', () => ({
  createProductUrl: mockCreateProductUrl,
}));

vi.mock('../catalogUtils', () => ({
  extractBrandValue: mockExtractBrandValue,
  extractIsGiftCard: mockExtractIsGiftCard,
  extractSaleInfo: mockExtractSaleInfo,
}));

vi.mock('../variationParser', () => ({
  buildAvailableAttributes: mockBuildAvailableAttributes,
}));

vi.mock('../apiUtils', () => ({
  logApiError: mockLogApiError,
}));

vi.mock('../errorUtils', () => ({
  logError: mockLogError,
}));

vi.mock('../serverErrorUtils', () => ({
  processSquareError: mockProcessSquareError,
}));

vi.mock('@/lib/constants/assets', () => ({
  EL_CAMINO_LOGO_DATA_URI: 'data:placeholder',
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

// ── Import under test (after mocks) ──────────────────────────────────────────

import { fetchProducts, fetchProduct } from '../client';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build a minimal Square ITEM catalog object. */
function makeCatalogItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'item-1',
    type: 'ITEM',
    itemData: {
      name: 'Test Deck',
      description: 'A skateboard deck',
      imageIds: ['img-1'],
      variations: [
        {
          id: 'var-1',
          type: 'ITEM_VARIATION',
          itemVariationData: {
            name: 'One Size',
            priceMoney: { amount: 5000, currency: 'USD' },
            ordinal: 0,
          },
        },
      ],
      categories: [],
    },
    customAttributeValues: {},
    ...overrides,
  };
}

/** Make productCache.getOrCompute simulate a cache miss (calls compute fn). */
function useCacheMiss() {
  mockProductCacheGetOrCompute.mockImplementation(
    (_key: string, fn: () => unknown) => fn()
  );
}

// ── Tests: fetchProducts ──────────────────────────────────────────────────────

describe('fetchProducts', () => {
  beforeAll(() => {
    // Satisfy validateEnvironment() before the first call
    process.env.SQUARE_ACCESS_TOKEN = 'test-token';
    (import.meta.env as Record<string, unknown>).PUBLIC_SQUARE_LOCATION_ID =
      'test-loc';
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: cache miss → compute fn runs
    useCacheMiss();
    // Default utility mocks
    mockBatchGetImageUrls.mockResolvedValue({});
    mockFetchMeasurementUnits.mockResolvedValue({});
    mockCreateProductUrl.mockReturnValue('/products/test-deck');
    mockExtractBrandValue.mockReturnValue(undefined);
    mockExtractIsGiftCard.mockReturnValue(false);
    mockExtractSaleInfo.mockReturnValue(undefined);
  });

  it('returns an empty array when catalog returns no objects', async () => {
    mockCatalogList.mockResolvedValue({
      data: [],
      response: { cursor: undefined },
    });

    const products = await fetchProducts();

    expect(products).toEqual([]);
    expect(mockCatalogList).toHaveBeenCalledTimes(1);
  });

  it('maps a catalog ITEM to the Product shape', async () => {
    const item = makeCatalogItem();
    mockCatalogList.mockResolvedValue({
      data: [item],
      response: { cursor: undefined },
    });

    const products = await fetchProducts();

    expect(products).toHaveLength(1);
    expect(products[0]).toMatchObject({
      id: 'item-1',
      title: 'Test Deck',
      price: 50, // 5000 cents / 100
      variationId: 'var-1',
      url: '/products/test-deck',
    });
  });

  it('paginates through all pages until cursor is undefined', async () => {
    const item1 = makeCatalogItem({ id: 'item-1' });
    const item2 = {
      ...makeCatalogItem({ id: 'item-2' }),
      itemData: {
        name: 'Board 2',
        description: '',
        imageIds: [],
        categories: [],
        variations: [
          {
            id: 'var-2',
            type: 'ITEM_VARIATION',
            itemVariationData: {
              name: 'One Size',
              priceMoney: { amount: 4000, currency: 'USD' },
              ordinal: 0,
            },
          },
        ],
      },
    };

    mockCatalogList
      .mockResolvedValueOnce({ data: [item1], response: { cursor: 'page-2' } })
      .mockResolvedValueOnce({
        data: [item2],
        response: { cursor: undefined },
      });

    const products = await fetchProducts();

    expect(products).toHaveLength(2);
    expect(mockCatalogList).toHaveBeenCalledTimes(2);
    expect(mockCatalogList).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ cursor: 'page-2' })
    );
  });

  it('returns cached result from productCache without calling Square', async () => {
    const cachedProducts = [
      { id: 'cached-1', title: 'Cached Deck', price: 30 },
    ];
    // Simulate cache hit: getOrCompute returns the cached value without running compute
    mockProductCacheGetOrCompute.mockResolvedValue(cachedProducts);

    const products = await fetchProducts();

    expect(products).toEqual(cachedProducts);
    // Square must not have been touched
    expect(mockCatalogList).not.toHaveBeenCalled();
  });

  it('includes image URL when batchGetImageUrls resolves it', async () => {
    const item = makeCatalogItem();
    mockCatalogList.mockResolvedValue({
      data: [item],
      response: { cursor: undefined },
    });
    mockBatchGetImageUrls.mockResolvedValue({
      'img-1': 'https://cdn.example.com/img-1.jpg',
    });

    const products = await fetchProducts();

    expect(products[0].image).toBe('https://cdn.example.com/img-1.jpg');
  });
});

// ── Tests: fetchProduct ───────────────────────────────────────────────────────

describe('fetchProduct', () => {
  beforeAll(() => {
    process.env.SQUARE_ACCESS_TOKEN = 'test-token';
    (import.meta.env as Record<string, unknown>).PUBLIC_SQUARE_LOCATION_ID =
      'test-loc';
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no cached product
    mockProductCacheGet.mockResolvedValue(undefined);
    mockProductCacheSet.mockResolvedValue(undefined);
    // Default utility mocks
    mockBatchGetImageUrls.mockResolvedValue({});
    mockFetchMeasurementUnits.mockResolvedValue({});
    mockCreateProductUrl.mockReturnValue('/products/test-deck');
    mockExtractBrandValue.mockReturnValue(undefined);
    mockExtractIsGiftCard.mockReturnValue(false);
    mockExtractSaleInfo.mockReturnValue(undefined);
    mockBuildAvailableAttributes.mockReturnValue({});
    mockProcessSquareError.mockReturnValue({ message: 'sq-error' });
    mockLogError.mockReturnValue(undefined);
  });

  it('returns null when the object is not found (null object)', async () => {
    mockCatalogObjectGet.mockResolvedValue({ object: null });

    const result = await fetchProduct('item-missing');

    expect(result).toBeNull();
  });

  it('returns null when the object type is not ITEM', async () => {
    mockCatalogObjectGet.mockResolvedValue({
      object: { id: 'img-1', type: 'IMAGE' },
    });

    const result = await fetchProduct('img-1');

    expect(result).toBeNull();
  });

  it('returns null when the item has no variations', async () => {
    mockCatalogObjectGet.mockResolvedValue({
      object: {
        id: 'item-novars',
        type: 'ITEM',
        itemData: { name: 'No Vars', variations: [], categories: [] },
        customAttributeValues: {},
      },
    });

    const result = await fetchProduct('item-novars');

    expect(result).toBeNull();
  });

  it('returns a Product when Square returns a valid ITEM', async () => {
    mockCatalogObjectGet.mockResolvedValue({
      object: {
        id: 'item-1',
        type: 'ITEM',
        itemData: {
          name: 'Test Deck',
          description: 'A skateboard deck',
          imageIds: ['img-1'],
          variations: [
            {
              id: 'var-1',
              type: 'ITEM_VARIATION',
              itemVariationData: {
                name: 'One Size',
                priceMoney: { amount: 5000, currency: 'USD' },
                ordinal: 0,
              },
            },
          ],
          categories: [],
        },
        customAttributeValues: {},
      },
    });

    const product = await fetchProduct('item-1');

    expect(product).not.toBeNull();
    expect(product).toMatchObject({
      id: 'item-1',
      title: 'Test Deck',
      price: 50,
      variationId: 'var-1',
      url: '/products/test-deck',
    });
  });

  it('returns cached product from productCache without calling Square', async () => {
    const cached = { id: 'item-x', title: 'Cached', price: 20 };
    mockProductCacheGet.mockResolvedValue(cached);

    const product = await fetchProduct('item-x');

    expect(product).toEqual(cached);
    expect(mockCatalogObjectGet).not.toHaveBeenCalled();
  });

  it('returns null and calls processSquareError when Square throws', async () => {
    mockCatalogObjectGet.mockRejectedValue(new Error('network error'));

    const result = await fetchProduct('item-err');

    expect(result).toBeNull();
    expect(mockProcessSquareError).toHaveBeenCalled();
    expect(mockLogError).toHaveBeenCalled();
  });
});
