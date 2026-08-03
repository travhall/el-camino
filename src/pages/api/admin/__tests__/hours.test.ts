import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/admin/auth', () => ({
  isAdminAuthenticated: vi.fn().mockReturnValue(true),
  parseAdminFormData: vi.fn(async (request: Request) => {
    try {
      return await request.formData();
    } catch {
      return null;
    }
  }),
}));

vi.mock('@/lib/shopHours', () => ({
  DAYS_OF_WEEK: [
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
  ],
  saveShopHours: vi.fn(),
}));

import { POST } from '../hours';
import { isAdminAuthenticated } from '@/lib/admin/auth';
import { saveShopHours, type ShopHoursEntry } from '@/lib/shopHours';

const URL_BASE = 'https://example.com/api/admin/hours';

type Context = Parameters<typeof POST>[0];

function makeContext(fields: Record<string, string>): Context {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) formData.set(key, value);
  const request = new Request(URL_BASE, { method: 'POST', body: formData });
  return {
    request,
    cookies: {},
    redirect: (url: string) =>
      new Response(null, { status: 302, headers: { Location: url } }),
  } as unknown as Context;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isAdminAuthenticated).mockReturnValue(true);
});

describe('POST /api/admin/hours', () => {
  it('redirects to login when not authenticated', async () => {
    vi.mocked(isAdminAuthenticated).mockReturnValue(false);
    const res = await POST(makeContext({}));
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toContain('/admin/login');
  });

  it('saves hours and redirects with saved=1 on success', async () => {
    vi.mocked(saveShopHours).mockResolvedValue(undefined);
    const res = await POST(
      makeContext({
        isOpen_monday: 'on',
        open_monday: '09:00',
        close_monday: '17:00',
      })
    );
    expect(saveShopHours).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          day: 'monday',
          isOpen: true,
          open: '09:00',
          close: '17:00',
        }),
      ])
    );
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toContain('saved=1');
  });

  it('marks a day as closed when the isOpen checkbox is absent', async () => {
    vi.mocked(saveShopHours).mockResolvedValue(undefined);
    await POST(makeContext({}));
    const [entries] = vi.mocked(saveShopHours).mock.calls[0]!;
    const monday = entries.find((e: ShopHoursEntry) => e.day === 'monday');
    expect(monday?.isOpen).toBe(false);
  });

  it('treats a day as closed when times have invalid format even if isOpen is on', async () => {
    vi.mocked(saveShopHours).mockResolvedValue(undefined);
    await POST(
      makeContext({
        isOpen_tuesday: 'on',
        open_tuesday: '9am',
        close_tuesday: '5pm',
      })
    );
    const [entries] = vi.mocked(saveShopHours).mock.calls[0]!;
    const tuesday = entries.find((e: ShopHoursEntry) => e.day === 'tuesday');
    expect(tuesday?.isOpen).toBe(false);
  });
});
