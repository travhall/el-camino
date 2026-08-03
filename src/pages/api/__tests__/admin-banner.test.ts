import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockIsAdmin } = vi.hoisted(() => ({ mockIsAdmin: vi.fn() }));

vi.mock('@/lib/admin/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/admin/auth')>();
  return { ...actual, isAdminAuthenticated: mockIsAdmin };
});

vi.mock('@/lib/announcementBanner', () => ({
  saveAnnouncementBanner: vi.fn().mockResolvedValue(undefined),
  sanitizeLinkUrl: (url: string) => url,
}));

import { POST } from '../admin/banner';
import { saveAnnouncementBanner } from '@/lib/announcementBanner';

function makeContext(formData?: Record<string, string>) {
  const request = {
    url: 'https://example.com/api/admin/banner',
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

describe('POST /api/admin/banner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAdmin.mockReturnValue(true);
  });

  it('redirects to login when unauthenticated', async () => {
    mockIsAdmin.mockReturnValue(false);
    const res = await POST(makeContext());
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toContain('/admin/login');
  });

  it('saves banner and redirects with saved=1 on success', async () => {
    const res = await POST(makeContext({ text: 'Summer Sale!', active: 'on' }));
    expect(saveAnnouncementBanner).toHaveBeenCalled();
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toContain('saved=1');
  });

  it('passes active=false when checkbox is absent', async () => {
    await POST(makeContext({ text: 'Inactive banner' }));
    expect(saveAnnouncementBanner).toHaveBeenCalledWith(
      expect.objectContaining({ active: false })
    );
  });

  it('passes null expiresAt when value is not a valid date', async () => {
    await POST(makeContext({ text: 'x', expiresAt: 'not-a-date' }));
    expect(saveAnnouncementBanner).toHaveBeenCalledWith(
      expect.objectContaining({ expiresAt: null })
    );
  });
});
