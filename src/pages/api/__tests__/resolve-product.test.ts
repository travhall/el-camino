import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/square/slugResolver', () => ({
  slugResolver: { resolve: vi.fn() },
}));

vi.mock('@/lib/square/client', () => ({
  fetchProducts: vi.fn(),
}));

vi.mock('@/lib/square/slugUtils', () => ({
  createSlugMapping: vi.fn(),
}));

import { GET } from '../resolve-product';
import { slugResolver } from '@/lib/square/slugResolver';
import { fetchProducts } from '@/lib/square/client';
import { createSlugMapping } from '@/lib/square/slugUtils';

function makeContext(query: string) {
  return {
    request: { url: `https://example.com/api/resolve-product${query}` },
  } as unknown as Parameters<typeof GET>[0];
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/resolve-product', () => {
  it('returns 400 when slug is missing', async () => {
    const res = await GET(makeContext(''));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ error: 'Missing slug parameter' });
  });

  it('resolves via the fast-path slugResolver without falling back', async () => {
    vi.mocked(slugResolver.resolve).mockResolvedValue('p1');
    const res = await GET(makeContext('?slug=deck-a'));
    expect(fetchProducts).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ id: 'p1' });
    expect(res.headers.get('Netlify-Cache-Tag')).toBe('product-slugs,products');
  });

  it('falls back to fetchProducts + createSlugMapping when the resolver misses', async () => {
    vi.mocked(slugResolver.resolve).mockResolvedValue(null);
    vi.mocked(fetchProducts).mockResolvedValue([{ id: 'p2' }] as never);
    vi.mocked(createSlugMapping).mockReturnValue(new Map([['deck-b', 'p2']]));

    const res = await GET(makeContext('?slug=deck-b'));
    expect(fetchProducts).toHaveBeenCalled();
    const body = await res.json();
    expect(body).toEqual({ id: 'p2' });
  });

  it('returns 404 when neither path resolves the slug', async () => {
    vi.mocked(slugResolver.resolve).mockResolvedValue(null);
    vi.mocked(fetchProducts).mockResolvedValue([] as never);
    vi.mocked(createSlugMapping).mockReturnValue(new Map());

    const res = await GET(makeContext('?slug=unknown'));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toEqual({ error: 'Product not found' });
  });

  it('sets no-cache browser headers', async () => {
    vi.mocked(slugResolver.resolve).mockResolvedValue('p1');
    const res = await GET(makeContext('?slug=deck-a'));
    expect(res.headers.get('Cache-Control')).toBe(
      'no-cache, no-store, must-revalidate'
    );
  });

  it('returns 500 when slugResolver.resolve throws', async () => {
    vi.mocked(slugResolver.resolve).mockRejectedValue(new Error('boom'));
    const res = await GET(makeContext('?slug=deck-a'));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: 'Internal server error' });
  });
});
