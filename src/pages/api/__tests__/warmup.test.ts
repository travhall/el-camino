import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/square/client', () => ({
  fetchProducts: vi.fn(),
}));

vi.mock('@/lib/square/filterUtils', () => ({
  filterProductsWithCache: vi.fn().mockResolvedValue(undefined),
  extractFilterOptions: vi.fn(),
}));

vi.mock('@/lib/square/batchInventory', () => ({
  batchInventoryService: {
    getBatchInventoryStatus: vi.fn().mockResolvedValue(new Map()),
  },
}));

import { GET } from '../warmup';
import { fetchProducts } from '@/lib/square/client';
import { extractFilterOptions } from '@/lib/square/filterUtils';

function makeContext(secretHeader?: string) {
  const headers = new Headers();
  if (secretHeader !== undefined) headers.set('x-warmup-secret', secretHeader);
  return {
    request: { headers },
  } as unknown as Parameters<typeof GET>[0];
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('WARMUP_SECRET', 'test-secret');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('GET /api/warmup', () => {
  it('returns 401 when no secret is configured', async () => {
    vi.stubEnv('WARMUP_SECRET', '');
    const res = await GET(makeContext('anything'));
    expect(res.status).toBe(401);
  });

  it('returns 401 when the header does not match the configured secret', async () => {
    const res = await GET(makeContext('wrong-secret'));
    expect(res.status).toBe(401);
    expect(fetchProducts).not.toHaveBeenCalled();
  });

  it('warms product/inventory/filter caches and returns status "warm"', async () => {
    vi.mocked(fetchProducts).mockResolvedValue([
      { variationId: 'v1' },
      { variationId: 'v2' },
    ] as never);
    vi.mocked(extractFilterOptions).mockResolvedValue({
      brands: [{ name: 'BrandA' }, { name: 'BrandB' }],
    } as never);

    const res = await GET(makeContext('test-secret'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('warm');
    expect(body.caches).toEqual(
      expect.arrayContaining([expect.stringContaining('products (2 items)')])
    );
  });

  it('returns status "partial" and includes an error when the warmup step throws', async () => {
    vi.mocked(fetchProducts).mockRejectedValue(new Error('Square down'));
    const res = await GET(makeContext('test-secret'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('partial');
    expect(body.message).toContain('1 errors');
  });
});
