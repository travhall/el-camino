import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/square/inventory', () => ({
  checkBulkInventory: vi.fn(),
}));

import { GET } from '../batch-inventory';
import { checkBulkInventory } from '@/lib/square/inventory';

function makeContext(query: string) {
  return {
    url: new URL(`https://example.com/api/batch-inventory${query}`),
  } as unknown as Parameters<typeof GET>[0];
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/batch-inventory', () => {
  it('returns 400 when variationIds param is missing', async () => {
    const res = await GET(makeContext(''));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({
      success: false,
      error: 'Missing variationIds parameter',
    });
  });

  it('returns 400 when variationIds resolves to no valid ids', async () => {
    const res = await GET(makeContext('?variationIds=,,'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('No valid variation IDs provided');
  });

  it('returns 400 when more than 50 variation ids are requested', async () => {
    const ids = Array.from({ length: 51 }, (_, i) => `id${i}`).join(',');
    const res = await GET(makeContext(`?variationIds=${ids}`));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Too many variation IDs');
    expect(checkBulkInventory).not.toHaveBeenCalled();
  });

  it('trims whitespace and drops empty entries before checking inventory', async () => {
    vi.mocked(checkBulkInventory).mockResolvedValue({ v1: 5, v2: 0 });
    const res = await GET(makeContext('?variationIds= v1 ,,v2'));
    expect(checkBulkInventory).toHaveBeenCalledWith(['v1', 'v2']);
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    const body = await res.json();
    expect(body).toEqual({ success: true, stockLevels: { v1: 5, v2: 0 } });
  });

  it('returns 500 when checkBulkInventory throws', async () => {
    vi.mocked(checkBulkInventory).mockRejectedValue(new Error('Square down'));
    const res = await GET(makeContext('?variationIds=v1'));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({
      success: false,
      error: 'Failed to check inventory',
    });
  });
});
