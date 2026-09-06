/**
 * categoryImages.ts unit tests
 *
 * Strategy: mock squareClient and imageCache so we can assert on batching and
 * caching behavior without hitting Square.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const { mockBatchGet, mockImageCacheGet, mockImageCacheSet } = vi.hoisted(
  () => ({
    mockBatchGet: vi.fn(),
    mockImageCacheGet: vi.fn(),
    mockImageCacheSet: vi.fn(),
  })
);

vi.mock('../client', () => ({
  squareClient: {
    catalog: {
      batchGet: mockBatchGet,
    },
  },
}));

vi.mock('@/lib/cache/blobCache', () => ({
  imageCache: {
    get: mockImageCacheGet,
    set: mockImageCacheSet,
  },
}));

import { getCategoryImageUrls } from '../categoryImages';

function catalogObject(id: string, imageIds: string[]) {
  return { id, type: 'CATEGORY', categoryData: { imageIds } };
}

function imageObject(id: string, url: string) {
  return { id, type: 'IMAGE', imageData: { url } };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockImageCacheSet.mockResolvedValue(undefined);
});

describe('getCategoryImageUrls', () => {
  it('returns cached URLs and makes zero Square calls when all IDs are cached', async () => {
    mockImageCacheGet.mockImplementation(
      async (id: string) => `https://cdn/${id}.png`
    );

    const result = await getCategoryImageUrls(['cat-1', 'cat-2']);

    expect(result).toEqual({
      'cat-1': 'https://cdn/cat-1.png',
      'cat-2': 'https://cdn/cat-2.png',
    });
    expect(mockBatchGet).not.toHaveBeenCalled();
  });

  it('makes exactly one batchGet call and caches results when all IDs are uncached', async () => {
    mockImageCacheGet.mockResolvedValue(undefined);
    mockBatchGet.mockResolvedValue({
      objects: [
        catalogObject('cat-1', ['img-1']),
        catalogObject('cat-2', ['img-2']),
      ],
      relatedObjects: [
        imageObject('img-1', 'https://cdn/cat-1.png'),
        imageObject('img-2', 'https://cdn/cat-2.png'),
      ],
    });

    const result = await getCategoryImageUrls(['cat-1', 'cat-2']);

    expect(mockBatchGet).toHaveBeenCalledTimes(1);
    expect(mockBatchGet).toHaveBeenCalledWith({
      objectIds: ['cat-1', 'cat-2'],
      includeRelatedObjects: true,
    });
    expect(result).toEqual({
      'cat-1': 'https://cdn/cat-1.png',
      'cat-2': 'https://cdn/cat-2.png',
    });
    expect(mockImageCacheSet).toHaveBeenCalledWith(
      'cat-1',
      'https://cdn/cat-1.png'
    );
    expect(mockImageCacheSet).toHaveBeenCalledWith(
      'cat-2',
      'https://cdn/cat-2.png'
    );
  });

  it('issues one batchGet containing only the missing IDs on a mixed hit/miss', async () => {
    mockImageCacheGet.mockImplementation(async (id: string) =>
      id === 'cat-1' ? 'https://cdn/cat-1.png' : undefined
    );
    mockBatchGet.mockResolvedValue({
      objects: [catalogObject('cat-2', ['img-2'])],
      relatedObjects: [imageObject('img-2', 'https://cdn/cat-2.png')],
    });

    const result = await getCategoryImageUrls(['cat-1', 'cat-2']);

    expect(mockBatchGet).toHaveBeenCalledTimes(1);
    expect(mockBatchGet).toHaveBeenCalledWith({
      objectIds: ['cat-2'],
      includeRelatedObjects: true,
    });
    expect(result).toEqual({
      'cat-1': 'https://cdn/cat-1.png',
      'cat-2': 'https://cdn/cat-2.png',
    });
  });

  it('omits a category from the map when it has no IMAGE in relatedObjects', async () => {
    mockImageCacheGet.mockResolvedValue(undefined);
    mockBatchGet.mockResolvedValue({
      objects: [catalogObject('cat-1', [])],
      relatedObjects: [],
    });

    const result = await getCategoryImageUrls(['cat-1']);

    expect(result).toEqual({});
    expect(mockImageCacheSet).not.toHaveBeenCalled();
  });

  it('returns the cached subset without throwing when Square errors', async () => {
    mockImageCacheGet.mockImplementation(async (id: string) =>
      id === 'cat-1' ? 'https://cdn/cat-1.png' : undefined
    );
    mockBatchGet.mockRejectedValue(new Error('Square is down'));
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const result = await getCategoryImageUrls(['cat-1', 'cat-2']);

    expect(result).toEqual({ 'cat-1': 'https://cdn/cat-1.png' });
    consoleErrorSpy.mockRestore();
  });

  it('chunks more than 200 IDs into multiple batchGet calls', async () => {
    mockImageCacheGet.mockResolvedValue(undefined);
    mockBatchGet.mockResolvedValue({ objects: [], relatedObjects: [] });

    const ids = Array.from({ length: 250 }, (_, i) => `cat-${i}`);
    await getCategoryImageUrls(ids);

    expect(mockBatchGet).toHaveBeenCalledTimes(2);
    expect(mockBatchGet.mock.calls[0][0].objectIds).toHaveLength(200);
    expect(mockBatchGet.mock.calls[1][0].objectIds).toHaveLength(50);
  });
});
