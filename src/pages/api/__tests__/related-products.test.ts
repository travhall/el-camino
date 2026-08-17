import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/square/client', () => ({
  fetchProducts: vi.fn(),
}));

vi.mock('@/lib/product/relatedProducts', () => ({
  getRelatedProducts: vi.fn(),
}));

import { GET } from '../related-products';
import { fetchProducts } from '@/lib/square/client';
import { getRelatedProducts } from '@/lib/product/relatedProducts';

function makeContext(query: string) {
  return {
    request: { url: `https://example.com/api/related-products${query}` },
  } as unknown as Parameters<typeof GET>[0];
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/related-products', () => {
  it('returns 400 when productId is missing', async () => {
    const res = await GET(makeContext(''));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ error: 'Missing productId parameter' });
    expect(fetchProducts).not.toHaveBeenCalled();
  });

  it('returns 404 when the source product is not in the catalog', async () => {
    vi.mocked(fetchProducts).mockResolvedValue([{ id: 'other' }] as never);
    const res = await GET(makeContext('?productId=p1'));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toEqual({ error: 'Product not found' });
  });

  it('passes maxResults through and returns related products with cache headers', async () => {
    const allProducts = [{ id: 'p1' }, { id: 'p2' }];
    vi.mocked(fetchProducts).mockResolvedValue(allProducts as never);
    vi.mocked(getRelatedProducts).mockResolvedValue({
      products: [{ id: 'p2' }],
    } as never);

    const res = await GET(makeContext('?productId=p1&maxResults=3'));
    expect(getRelatedProducts).toHaveBeenCalledWith({ id: 'p1' }, allProducts, {
      maxResults: 3,
      excludeOutOfStock: false,
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('Netlify-Cache-Tag')).toBe(
      'related-products,products'
    );
    const body = await res.json();
    expect(body).toEqual({ products: [{ id: 'p2' }] });
  });

  it('defaults maxResults to 6 when not provided', async () => {
    vi.mocked(fetchProducts).mockResolvedValue([{ id: 'p1' }] as never);
    vi.mocked(getRelatedProducts).mockResolvedValue({ products: [] } as never);

    await GET(makeContext('?productId=p1'));
    expect(getRelatedProducts).toHaveBeenCalledWith(
      { id: 'p1' },
      [{ id: 'p1' }],
      { maxResults: 6, excludeOutOfStock: false }
    );
  });

  it('returns 500 when fetchProducts throws', async () => {
    vi.mocked(fetchProducts).mockRejectedValue(new Error('boom'));
    const res = await GET(makeContext('?productId=p1'));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: 'Internal server error' });
  });
});
