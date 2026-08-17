import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/shopHours', () => ({
  getShopHours: vi.fn(),
}));

import { GET } from '../hours';
import { getShopHours } from '@/lib/shopHours';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/hours', () => {
  it('returns the shop hours with a no-store cache header', async () => {
    vi.mocked(getShopHours).mockResolvedValue([
      { day: 'Monday', open: '10:00', close: '18:00' },
    ] as never);

    const res = await GET({} as unknown as Parameters<typeof GET>[0]);
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    const body = await res.json();
    expect(body).toEqual([{ day: 'Monday', open: '10:00', close: '18:00' }]);
  });

  it('fails open with an empty array when getShopHours throws', async () => {
    vi.mocked(getShopHours).mockRejectedValue(new Error('blob store down'));
    const res = await GET({} as unknown as Parameters<typeof GET>[0]);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });
});
