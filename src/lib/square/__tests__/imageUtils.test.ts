/**
 * imageUtils.ts unit tests (plan 222)
 *
 * A cold render used to issue one `catalog.object.get` per image id, all at
 * once. These tests pin the batched behavior: uncached ids resolve through
 * `catalog.batchGet` in chunks, results match the old per-id map, and a failed
 * batch falls back to per-id lookups for that chunk only.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const { mockBatchGet, mockObjectGet, mockCacheGet, mockCacheSet } = vi.hoisted(
  () => ({
    mockBatchGet: vi.fn(),
    mockObjectGet: vi.fn(),
    mockCacheGet: vi.fn(),
    mockCacheSet: vi.fn(),
  })
);

vi.mock('../client', () => ({
  squareClient: {
    catalog: {
      batchGet: mockBatchGet,
      object: { get: mockObjectGet },
    },
  },
}));

vi.mock('@/lib/cache/blobCache', () => ({
  imageCache: { get: mockCacheGet, set: mockCacheSet },
}));

import { batchGetImageUrls, getImageUrl } from '../imageUtils';

const image = (id: string, url: string | null = `https://cdn/${id}.webp`) => ({
  id,
  type: 'IMAGE',
  imageData: url === null ? {} : { url },
});

const ids = (n: number, prefix = 'img') =>
  Array.from({ length: n }, (_, i) => `${prefix}-${i}`);

/** batchGet that answers every requested id with an IMAGE object. */
function answerAllImages() {
  mockBatchGet.mockImplementation(
    async ({ objectIds }: { objectIds: string[] }) => ({
      objects: objectIds.map((id) => image(id)),
    })
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCacheGet.mockResolvedValue(undefined);
  mockCacheSet.mockResolvedValue(undefined);
});

describe('batchGetImageUrls', () => {
  it('resolves 120 uncached ids with one batchGet and no per-id GETs', async () => {
    answerAllImages();
    const wanted = ids(120);

    const result = await batchGetImageUrls(wanted);

    expect(mockBatchGet).toHaveBeenCalledTimes(1);
    expect(mockBatchGet).toHaveBeenCalledWith({ objectIds: wanted });
    expect(mockObjectGet).not.toHaveBeenCalled();
    expect(Object.keys(result)).toHaveLength(120);
    expect(result['img-7']).toBe('https://cdn/img-7.webp');
  });

  it('splits into ceil(N / 200) batchGet calls for large sets', async () => {
    answerAllImages();

    const result = await batchGetImageUrls(ids(450));

    expect(mockBatchGet).toHaveBeenCalledTimes(3);
    expect(mockObjectGet).not.toHaveBeenCalled();
    expect(Object.keys(result)).toHaveLength(450);
  });

  it('only asks Square for ids that are not cached, and dedupes', async () => {
    mockCacheGet.mockImplementation(async (id: string) =>
      id === 'img-0' ? 'https://cdn/cached.webp' : undefined
    );
    answerAllImages();

    const result = await batchGetImageUrls(['img-0', 'img-1', 'img-1', '']);

    expect(mockBatchGet).toHaveBeenCalledWith({ objectIds: ['img-1'] });
    expect(result).toEqual({
      'img-0': 'https://cdn/cached.webp',
      'img-1': 'https://cdn/img-1.webp',
    });
  });

  it('makes no Square call when everything is cached', async () => {
    mockCacheGet.mockResolvedValue('https://cdn/cached.webp');

    const result = await batchGetImageUrls(ids(5));

    expect(mockBatchGet).not.toHaveBeenCalled();
    expect(mockObjectGet).not.toHaveBeenCalled();
    expect(Object.keys(result)).toHaveLength(5);
  });

  it('writes each resolved URL to the cache once', async () => {
    answerAllImages();

    await batchGetImageUrls(ids(3));

    expect(mockCacheSet).toHaveBeenCalledTimes(3);
    expect(mockCacheSet).toHaveBeenCalledWith(
      'img-2',
      'https://cdn/img-2.webp'
    );
  });

  it('omits ids Square did not return, without a per-id retry', async () => {
    mockBatchGet.mockResolvedValue({
      objects: [
        image('img-0'),
        { id: 'img-1', type: 'ITEM' },
        image('img-2', null),
      ],
    });

    const result = await batchGetImageUrls([
      'img-0',
      'img-1',
      'img-2',
      'img-3',
    ]);

    expect(result).toEqual({ 'img-0': 'https://cdn/img-0.webp' });
    expect(mockObjectGet).not.toHaveBeenCalled();
    expect(mockCacheSet).toHaveBeenCalledTimes(1);
  });

  it('falls back to per-id lookups for a chunk whose batch call fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockBatchGet.mockRejectedValue(new Error('429'));
    mockObjectGet.mockImplementation(
      async ({ objectId }: { objectId: string }) => ({
        object: image(objectId),
      })
    );

    const result = await batchGetImageUrls(['img-0', 'img-1']);

    expect(mockObjectGet).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      'img-0': 'https://cdn/img-0.webp',
      'img-1': 'https://cdn/img-1.webp',
    });
  });

  it('keeps the good chunks when one of several batches fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockBatchGet
      .mockRejectedValueOnce(new Error('boom'))
      .mockImplementation(async ({ objectIds }: { objectIds: string[] }) => ({
        objects: objectIds.map((id) => image(id)),
      }));
    mockObjectGet.mockImplementation(
      async ({ objectId }: { objectId: string }) => ({
        object: image(objectId),
      })
    );

    const result = await batchGetImageUrls(ids(250));

    expect(mockBatchGet).toHaveBeenCalledTimes(2);
    expect(mockObjectGet).toHaveBeenCalledTimes(200);
    expect(Object.keys(result)).toHaveLength(250);
  });
});

describe('getImageUrl', () => {
  it('returns the cached URL without calling Square', async () => {
    mockCacheGet.mockResolvedValue('https://cdn/c.webp');

    expect(await getImageUrl('img-9')).toBe('https://cdn/c.webp');
    expect(mockObjectGet).not.toHaveBeenCalled();
  });

  it('fetches, caches and returns an IMAGE url on a miss', async () => {
    mockObjectGet.mockResolvedValue({ object: image('img-9') });

    expect(await getImageUrl('img-9')).toBe('https://cdn/img-9.webp');
    expect(mockCacheSet).toHaveBeenCalledWith(
      'img-9',
      'https://cdn/img-9.webp'
    );
  });

  it('returns null for a non-image object, and on error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockObjectGet.mockResolvedValueOnce({ object: { id: 'x', type: 'ITEM' } });
    expect(await getImageUrl('x')).toBeNull();

    mockObjectGet.mockRejectedValueOnce(new Error('nope'));
    expect(await getImageUrl('y')).toBeNull();
  });
});
