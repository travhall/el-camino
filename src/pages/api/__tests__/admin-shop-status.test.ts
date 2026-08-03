import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockIsAdmin } = vi.hoisted(() => ({ mockIsAdmin: vi.fn() }));

vi.mock('@/lib/admin/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/admin/auth')>();
  return { ...actual, isAdminAuthenticated: mockIsAdmin };
});

vi.mock('@/lib/shopStatus', () => ({
  getShopStatusConfig: vi
    .fn()
    .mockResolvedValue({ mode: 'auto', until: undefined, holidays: [] }),
  saveShopStatusConfig: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from '../admin/shop-status';
import { getShopStatusConfig, saveShopStatusConfig } from '@/lib/shopStatus';

function makeContext(formData?: Record<string, string>) {
  const request = {
    url: 'https://example.com/api/admin/shop-status',
    method: 'POST',
    headers: new Headers({ origin: 'https://example.com' }),
    formData: async () => {
      const fd = new FormData();
      if (formData)
        for (const [k, v] of Object.entries(formData)) fd.append(k, v);
      return fd;
    },
  } as unknown as Request;
  const redirect = (location: string) =>
    new Response(null, { status: 302, headers: { Location: location } });
  const cookies = { get: vi.fn(), set: vi.fn() };
  return { request, cookies, redirect } as unknown as Parameters<
    typeof POST
  >[0];
}

describe('POST /api/admin/shop-status (admin)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAdmin.mockReturnValue(true);
    (getShopStatusConfig as ReturnType<typeof vi.fn>).mockResolvedValue({
      mode: 'auto',
      until: undefined,
      holidays: [],
    });
  });

  it('redirects to login when unauthenticated', async () => {
    mockIsAdmin.mockReturnValue(false);
    const res = await POST(makeContext());
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toContain('/admin/login');
  });

  it('returns 400 for unknown action', async () => {
    const res = await POST(makeContext({ action: 'unknown' }));
    expect(res.status).toBe(400);
  });

  describe('action=save-override', () => {
    it('saves mode and redirects with saved=override', async () => {
      const res = await POST(
        makeContext({ action: 'save-override', mode: 'closed' })
      );
      expect(saveShopStatusConfig).toHaveBeenCalledWith(
        expect.objectContaining({ mode: 'closed' })
      );
      expect(res.headers.get('Location')).toContain('saved=override');
    });

    it('returns 400 for invalid mode', async () => {
      const res = await POST(
        makeContext({ action: 'save-override', mode: 'maybe' })
      );
      expect(res.status).toBe(400);
    });

    it('clears until when mode is auto', async () => {
      (getShopStatusConfig as ReturnType<typeof vi.fn>).mockResolvedValue({
        mode: 'closed',
        until: '2026-09-01',
        holidays: [],
      });
      await POST(makeContext({ action: 'save-override', mode: 'auto' }));
      expect(saveShopStatusConfig).toHaveBeenCalledWith(
        expect.objectContaining({ until: undefined })
      );
    });
  });

  describe('action=add-holiday', () => {
    it('adds a one-time holiday and redirects with saved=holiday', async () => {
      const res = await POST(
        makeContext({
          action: 'add-holiday',
          label: 'Christmas',
          type: 'one-time',
          date: '2026-12-25',
        })
      );
      expect(saveShopStatusConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          holidays: expect.arrayContaining([
            expect.objectContaining({ label: 'Christmas' }),
          ]),
        })
      );
      expect(res.headers.get('Location')).toContain('saved=holiday');
    });

    it('redirects with error=missing-label when label is absent', async () => {
      const res = await POST(
        makeContext({
          action: 'add-holiday',
          type: 'one-time',
          date: '2026-12-25',
        })
      );
      expect(res.headers.get('Location')).toContain('error=missing-label');
    });

    it('redirects with error=invalid-date for invalid one-time date', async () => {
      const res = await POST(
        makeContext({
          action: 'add-holiday',
          label: 'Bad',
          type: 'one-time',
          date: 'not-a-date',
        })
      );
      expect(res.headers.get('Location')).toContain('error=invalid-date');
    });

    it('adds recurring holiday with MM-DD format', async () => {
      const res = await POST(
        makeContext({
          action: 'add-holiday',
          label: 'New Years',
          type: 'recurring',
          recurring: '01-01',
        })
      );
      expect(saveShopStatusConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          holidays: expect.arrayContaining([
            expect.objectContaining({ recurring: '01-01' }),
          ]),
        })
      );
      expect(res.headers.get('Location')).toContain('saved=holiday');
    });
  });

  describe('action=remove-holiday', () => {
    it('removes holiday by id and redirects with removed=holiday', async () => {
      (getShopStatusConfig as ReturnType<typeof vi.fn>).mockResolvedValue({
        mode: 'auto',
        holidays: [{ id: 'hol-1', label: 'Christmas', date: '2026-12-25' }],
      });
      const res = await POST(
        makeContext({ action: 'remove-holiday', id: 'hol-1' })
      );
      expect(saveShopStatusConfig).toHaveBeenCalledWith(
        expect.objectContaining({ holidays: [] })
      );
      expect(res.headers.get('Location')).toContain('removed=holiday');
    });

    it('returns 400 when id is missing', async () => {
      const res = await POST(makeContext({ action: 'remove-holiday' }));
      expect(res.status).toBe(400);
    });
  });
});
