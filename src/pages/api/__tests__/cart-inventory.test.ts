import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/square/inventory', () => ({
  checkBulkInventory: vi.fn(),
}));

import { POST } from '../cart-inventory';
import { checkBulkInventory } from '@/lib/square/inventory';

function makeContext(body: unknown) {
  return {
    request: {
      json: async () => body,
    },
  } as unknown as Parameters<typeof POST>[0];
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/cart-inventory', () => {
  it('returns 400 when variationIds is missing', async () => {
    const res = await POST(makeContext({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid variationIds array required');
  });

  it('returns 400 when variationIds is not an array', async () => {
    const res = await POST(makeContext({ variationIds: 'not-an-array' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when more than 50 variation ids are requested', async () => {
    const variationIds = Array.from({ length: 51 }, (_, i) => `id${i}`);
    const res = await POST(makeContext({ variationIds }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ error: 'Too many variation IDs', success: false });
    expect(checkBulkInventory).not.toHaveBeenCalled();
  });

  it('returns inventory data for a valid request', async () => {
    vi.mocked(checkBulkInventory).mockResolvedValue({ v1: 3 });
    const res = await POST(makeContext({ variationIds: ['v1'] }));
    expect(checkBulkInventory).toHaveBeenCalledWith(['v1']);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true, inventory: { v1: 3 } });
  });

  it('returns 500 when the request body is not valid JSON', async () => {
    const context = {
      request: {
        json: async () => {
          throw new Error('bad json');
        },
      },
    } as unknown as Parameters<typeof POST>[0];
    const res = await POST(context);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({
      error: 'Failed to fetch inventory data',
      success: false,
    });
  });

  it('returns 500 when checkBulkInventory throws', async () => {
    vi.mocked(checkBulkInventory).mockRejectedValue(new Error('Square down'));
    const res = await POST(makeContext({ variationIds: ['v1'] }));
    expect(res.status).toBe(500);
  });
});
