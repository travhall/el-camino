import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/square/inventory', () => ({
  checkItemInventory: vi.fn(),
}));

import { GET } from '../check-inventory';
import { checkItemInventory } from '@/lib/square/inventory';

function makeContext(query: string) {
  return {
    url: new URL(`https://example.com/api/check-inventory${query}`),
  } as unknown as Parameters<typeof GET>[0];
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/check-inventory', () => {
  it('returns 400 when variationId param is missing', async () => {
    const res = await GET(makeContext(''));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({
      success: false,
      error: 'Missing variationId parameter',
    });
  });

  it('returns quantity and inStock=true when quantity is positive', async () => {
    vi.mocked(checkItemInventory).mockResolvedValue(4);
    const res = await GET(makeContext('?variationId=v1'));
    expect(checkItemInventory).toHaveBeenCalledWith('v1');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.variationId).toBe('v1');
    expect(body.quantity).toBe(4);
    expect(body.inStock).toBe(true);
  });

  it('returns inStock=false when quantity is zero', async () => {
    vi.mocked(checkItemInventory).mockResolvedValue(0);
    const res = await GET(makeContext('?variationId=v1'));
    const body = await res.json();
    expect(body.inStock).toBe(false);
  });

  it('returns 500 without leaking error detail when checkItemInventory throws', async () => {
    vi.mocked(checkItemInventory).mockRejectedValue(
      new Error('internal detail')
    );
    const res = await GET(makeContext('?variationId=v1'));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({
      success: false,
      error: 'Failed to check inventory',
      timestamp: expect.any(String),
    });
  });
});
