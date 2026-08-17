import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/square/client', () => ({
  squareClient: {
    catalog: {
      batchGet: vi.fn(),
    },
  },
}));

vi.mock('@/lib/square/catalogUtils', () => ({
  extractSaleInfo: vi.fn(),
}));

import { POST } from '../sale-info';
import { squareClient } from '@/lib/square/client';
import { extractSaleInfo } from '@/lib/square/catalogUtils';

const batchGetMock = squareClient.catalog.batchGet as unknown as ReturnType<
  typeof vi.fn
>;

function makeContext(body: unknown) {
  return {
    request: { json: async () => body },
  } as unknown as Parameters<typeof POST>[0];
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/sale-info', () => {
  it('returns 400 when variationIds is not a non-empty array', async () => {
    const res = await POST(makeContext({ variationIds: [] }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({
      success: false,
      error: 'Invalid variation IDs array',
    });
    expect(batchGetMock).not.toHaveBeenCalled();
  });

  it('returns 400 when more than 50 variation ids are requested', async () => {
    const variationIds = Array.from({ length: 51 }, (_, i) => `v${i}`);
    const res = await POST(makeContext({ variationIds }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Too many variation IDs');
  });

  it('sets null sale info for a variation not found or not an ITEM_VARIATION', async () => {
    batchGetMock.mockResolvedValue({ objects: [] });
    const res = await POST(makeContext({ variationIds: ['v1'] }));
    const body = await res.json();
    expect(body).toEqual({ success: true, saleInfo: { v1: null } });
    expect(extractSaleInfo).not.toHaveBeenCalled();
  });

  it('computes regular price from money amount (cents to dollars) and calls extractSaleInfo', async () => {
    batchGetMock.mockResolvedValue({
      objects: [
        {
          id: 'v1',
          type: 'ITEM_VARIATION',
          itemVariationData: { priceMoney: { amount: 2599 } },
          customAttributeValues: { foo: 'bar' },
        },
      ],
    });
    vi.mocked(extractSaleInfo).mockReturnValue({
      isOnSale: true,
      salePrice: 20,
      regularPrice: 25.99,
    } as never);

    const res = await POST(makeContext({ variationIds: ['v1'] }));
    expect(extractSaleInfo).toHaveBeenCalledWith({ foo: 'bar' }, 25.99);
    const body = await res.json();
    expect(body.saleInfo.v1).toEqual({
      isOnSale: true,
      salePrice: 20,
      regularPrice: 25.99,
    });
  });

  it('treats a missing priceMoney as a $0 regular price', async () => {
    batchGetMock.mockResolvedValue({
      objects: [{ id: 'v1', type: 'ITEM_VARIATION', itemVariationData: {} }],
    });
    vi.mocked(extractSaleInfo).mockReturnValue(null);

    await POST(makeContext({ variationIds: ['v1'] }));
    expect(extractSaleInfo).toHaveBeenCalledWith(undefined, 0);
  });

  it('sets cache headers on success', async () => {
    batchGetMock.mockResolvedValue({ objects: [] });
    const res = await POST(makeContext({ variationIds: ['v1'] }));
    expect(res.headers.get('Netlify-Cache-Tag')).toBe('sale-info,products');
  });

  it('returns 500 when squareClient.catalog.batchGet throws', async () => {
    batchGetMock.mockRejectedValue(new Error('Square down'));
    const res = await POST(makeContext({ variationIds: ['v1'] }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({
      success: false,
      error: 'Failed to fetch sale info',
    });
  });
});
