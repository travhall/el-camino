/**
 * batchCatalog.ts unit tests (plan 222): chunking and failure reporting.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const { mockBatchGet } = vi.hoisted(() => ({ mockBatchGet: vi.fn() }));

vi.mock('../client', () => ({
  squareClient: { catalog: { batchGet: mockBatchGet } },
}));

import { batchGetCatalogObjects, CATALOG_BATCH_SIZE } from '../batchCatalog';

const ids = (n: number) => Array.from({ length: n }, (_, i) => `id-${i}`);

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('batchGetCatalogObjects', () => {
  it('returns nothing and calls nothing for no ids', async () => {
    const out = await batchGetCatalogObjects([]);
    expect(out.objects.size).toBe(0);
    expect(out.failedIds).toEqual([]);
    expect(mockBatchGet).not.toHaveBeenCalled();
  });

  it('chunks at CATALOG_BATCH_SIZE and indexes objects by id', async () => {
    mockBatchGet.mockImplementation(
      async ({ objectIds }: { objectIds: string[] }) => ({
        objects: objectIds.map((id) => ({ id, type: 'IMAGE' })),
      })
    );

    const out = await batchGetCatalogObjects(ids(CATALOG_BATCH_SIZE * 2 + 1));

    expect(mockBatchGet).toHaveBeenCalledTimes(3);
    expect(out.objects.size).toBe(CATALOG_BATCH_SIZE * 2 + 1);
    expect(out.failedIds).toEqual([]);
  });

  it('reports the ids of a failed chunk and keeps the rest', async () => {
    mockBatchGet
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValue({ objects: [{ id: 'id-200', type: 'IMAGE' }] });

    const out = await batchGetCatalogObjects(ids(201));

    expect(out.failedIds).toEqual(ids(CATALOG_BATCH_SIZE));
    expect([...out.objects.keys()]).toEqual(['id-200']);
  });
});
