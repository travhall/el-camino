import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockIsAdmin } = vi.hoisted(() => ({ mockIsAdmin: vi.fn() }));

vi.mock('@/lib/admin/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/admin/auth')>();
  return { ...actual, isAdminAuthenticated: mockIsAdmin };
});

vi.mock('@/lib/contactInfo', () => ({
  saveContactInfo: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from '../admin/contact';
import { saveContactInfo } from '@/lib/contactInfo';

function makeContext(formData?: Record<string, string>) {
  const request = {
    url: 'https://example.com/api/admin/contact',
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

describe('POST /api/admin/contact', () => {
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

  it('saves contact info and redirects with saved=1', async () => {
    const res = await POST(
      makeContext({
        name: 'El Camino',
        street: '123 Main St',
        city: 'Austin',
        state: 'TX',
        zip: '78701',
        phone: '(512) 555-1234',
        email: 'info@example.com',
      })
    );
    expect(saveContactInfo).toHaveBeenCalled();
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toContain('saved=1');
  });

  it('passes phoneRaw with + prefix when phone digits are present', async () => {
    await POST(makeContext({ phone: '(512) 555-9876' }));
    expect(saveContactInfo).toHaveBeenCalledWith(
      expect.objectContaining({ phoneRaw: '+5125559876' })
    );
  });

  it('passes empty phoneRaw when phone has no digits', async () => {
    await POST(makeContext({ phone: '' }));
    expect(saveContactInfo).toHaveBeenCalledWith(
      expect.objectContaining({ phoneRaw: '' })
    );
  });
});
