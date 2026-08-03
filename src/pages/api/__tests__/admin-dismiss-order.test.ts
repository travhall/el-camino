import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockIsAdmin } = vi.hoisted(() => ({ mockIsAdmin: vi.fn() }));

vi.mock('@/lib/admin/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/admin/auth')>();
  return { ...actual, isAdminAuthenticated: mockIsAdmin };
});

vi.mock('@/lib/admin/dismissedOrders', () => ({
  dismissOrder: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from '../admin/dismiss-order';
import { dismissOrder } from '@/lib/admin/dismissedOrders';

function makeContext(formData?: Record<string, string>) {
  const request = {
    url: 'https://example.com/api/admin/dismiss-order',
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

describe('POST /api/admin/dismiss-order', () => {
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

  it('returns 400 when orderId is missing', async () => {
    const res = await POST(makeContext({ from: '/admin/orders/pickups' }));
    expect(res.status).toBe(400);
  });

  it('calls dismissOrder and redirects with dismissed=1 on success', async () => {
    const res = await POST(
      makeContext({ orderId: 'order-abc', from: '/admin/orders/pickups' })
    );
    expect(dismissOrder).toHaveBeenCalledWith('order-abc');
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toContain('dismissed=1');
  });

  it('falls back to /admin/orders/pickups when `from` is not under /admin/orders/', async () => {
    const res = await POST(
      makeContext({ orderId: 'order-xyz', from: 'https://evil.com' })
    );
    expect(res.headers.get('Location')).toContain('/admin/orders/pickups');
  });

  it('uses provided from path when it starts with /admin/orders/', async () => {
    const res = await POST(
      makeContext({ orderId: 'order-xyz', from: '/admin/orders/shipping' })
    );
    expect(res.headers.get('Location')).toContain('/admin/orders/shipping');
  });
});
