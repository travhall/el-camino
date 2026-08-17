import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/square/categories', () => ({
  fetchProductsByCategory: vi.fn(),
}));

vi.mock('@/lib/square/batchInventory', () => ({
  batchInventoryService: {
    getBatchInventoryStatus: vi.fn(),
  },
}));

import { POST } from '../load-more-products';
import { fetchProductsByCategory } from '@/lib/square/categories';
import { batchInventoryService } from '@/lib/square/batchInventory';

function makeContext(body: unknown) {
  return {
    request: { json: async () => body },
  } as unknown as Parameters<typeof POST>[0];
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/load-more-products', () => {
  it('returns 400 when categoryId is missing', async () => {
    const res = await POST(makeContext({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ success: false, error: 'Category ID required' });
    expect(fetchProductsByCategory).not.toHaveBeenCalled();
  });

  it('caps the requested limit at 100', async () => {
    vi.mocked(fetchProductsByCategory).mockResolvedValue({
      products: [],
      nextCursor: null,
      hasMore: false,
    } as never);

    await POST(makeContext({ categoryId: 'c1', limit: 500 }));
    expect(fetchProductsByCategory).toHaveBeenCalledWith('c1', {
      limit: 100,
      cursor: undefined,
    });
  });

  it('defaults limit to 24 when not provided', async () => {
    vi.mocked(fetchProductsByCategory).mockResolvedValue({
      products: [],
      nextCursor: null,
      hasMore: false,
    } as never);

    await POST(makeContext({ categoryId: 'c1' }));
    expect(fetchProductsByCategory).toHaveBeenCalledWith('c1', {
      limit: 24,
      cursor: undefined,
    });
  });

  it('attaches inventory status to each product and skips the lookup with no variation ids', async () => {
    vi.mocked(fetchProductsByCategory).mockResolvedValue({
      products: [{ id: 'p1' }],
      nextCursor: 'cursor2',
      hasMore: true,
    } as never);

    const res = await POST(makeContext({ categoryId: 'c1' }));
    expect(
      batchInventoryService.getBatchInventoryStatus
    ).not.toHaveBeenCalled();
    const body = await res.json();
    expect(body).toEqual({
      success: true,
      products: [
        {
          id: 'p1',
          inventoryStatus: {
            isOutOfStock: false,
            hasLimitedOptions: false,
            totalQuantity: 0,
          },
        },
      ],
      nextCursor: 'cursor2',
      hasMore: true,
    });
  });

  it('merges inventory status from the batch lookup for products with a variationId', async () => {
    vi.mocked(fetchProductsByCategory).mockResolvedValue({
      products: [{ id: 'p1', variationId: 'v1' }],
      nextCursor: null,
      hasMore: false,
    } as never);
    vi.mocked(batchInventoryService.getBatchInventoryStatus).mockResolvedValue(
      new Map([
        [
          'v1',
          { isOutOfStock: true, hasLimitedOptions: false, totalQuantity: 0 },
        ],
      ])
    );

    const res = await POST(makeContext({ categoryId: 'c1' }));
    expect(batchInventoryService.getBatchInventoryStatus).toHaveBeenCalledWith([
      'v1',
    ]);
    const body = await res.json();
    expect(body.products[0].inventoryStatus).toEqual({
      isOutOfStock: true,
      hasLimitedOptions: false,
      totalQuantity: 0,
    });
  });

  it('returns 500 when fetchProductsByCategory throws', async () => {
    vi.mocked(fetchProductsByCategory).mockRejectedValue(new Error('boom'));
    const res = await POST(makeContext({ categoryId: 'c1' }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ success: false, error: 'Failed to load products' });
  });
});
