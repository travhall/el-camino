import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/square/client', () => ({
  fetchProduct: vi.fn(),
}));

vi.mock('@/lib/square/inventory', () => ({
  checkBulkInventory: vi.fn(),
}));

import { GET } from '../quick-view-product';
import { fetchProduct } from '@/lib/square/client';
import { checkBulkInventory } from '@/lib/square/inventory';

function makeContext(query: string) {
  return {
    url: new URL(`https://example.com/api/quick-view-product${query}`),
  } as unknown as Parameters<typeof GET>[0];
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/quick-view-product', () => {
  it('returns 400 when id param is missing', async () => {
    const res = await GET(makeContext(''));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ error: 'Product ID is required' });
  });

  it('returns 404 when the product is not found', async () => {
    vi.mocked(fetchProduct).mockResolvedValue(null as never);
    const res = await GET(makeContext('?id=p1'));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toEqual({ error: 'Product not found' });
  });

  it('marks gift cards always in stock without checking inventory', async () => {
    vi.mocked(fetchProduct).mockResolvedValue({
      id: 'p1',
      isGiftCard: true,
      variations: [{ variationId: 'v1' }],
    } as never);

    const res = await GET(makeContext('?id=p1'));
    expect(checkBulkInventory).not.toHaveBeenCalled();
    const body = await res.json();
    expect(body.variations[0]).toMatchObject({ inStock: true, quantity: 99 });
  });

  it('annotates variations with live inventory for non-gift-card products', async () => {
    vi.mocked(fetchProduct).mockResolvedValue({
      id: 'p1',
      isGiftCard: false,
      variations: [{ variationId: 'v1' }, { variationId: 'v2' }],
    } as never);
    vi.mocked(checkBulkInventory).mockResolvedValue({ v1: 3, v2: 0 });

    const res = await GET(makeContext('?id=p1'));
    const body = await res.json();
    expect(body.variations).toEqual([
      { variationId: 'v1', inStock: true, quantity: 3 },
      { variationId: 'v2', inStock: false, quantity: 0 },
    ]);
  });

  it('fails closed (out of stock) on all variations when the inventory check throws', async () => {
    vi.mocked(fetchProduct).mockResolvedValue({
      id: 'p1',
      isGiftCard: false,
      variations: [{ variationId: 'v1' }],
    } as never);
    vi.mocked(checkBulkInventory).mockRejectedValue(new Error('Square down'));

    const res = await GET(makeContext('?id=p1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.variations).toEqual([
      { variationId: 'v1', inStock: false, quantity: 0 },
    ]);
  });

  it('sets no-cache response headers with a product-specific cache tag', async () => {
    vi.mocked(fetchProduct).mockResolvedValue({
      id: 'p1',
      isGiftCard: false,
      variations: [],
    } as never);

    const res = await GET(makeContext('?id=p1'));
    expect(res.headers.get('Cache-Control')).toBe('public, no-cache');
    expect(res.headers.get('Netlify-Cache-Tag')).toBe(
      'product-p1,products,quick-view'
    );
  });

  it('returns 500 when fetchProduct throws', async () => {
    vi.mocked(fetchProduct).mockRejectedValue(new Error('network error'));
    const res = await GET(makeContext('?id=p1'));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: 'Failed to fetch product' });
  });
});
