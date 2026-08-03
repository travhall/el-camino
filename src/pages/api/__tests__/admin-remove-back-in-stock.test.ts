import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockIsAdmin } = vi.hoisted(() => ({ mockIsAdmin: vi.fn() }));

vi.mock('@/lib/admin/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/admin/auth')>();
  return { ...actual, isAdminAuthenticated: mockIsAdmin };
});

vi.mock('@/lib/backInStock', () => ({
  removeAllSubscriptionsForProduct: vi.fn().mockResolvedValue([]),
}));

import { POST } from '../admin/remove-back-in-stock';
import { removeAllSubscriptionsForProduct } from '@/lib/backInStock';

function makeContext(
  opts: {
    formData?: Record<string, string>;
    acceptJson?: boolean;
  } = {}
) {
  const { formData, acceptJson = false } = opts;
  const headers = new Headers({ origin: 'https://example.com' });
  if (acceptJson) headers.set('accept', 'application/json');

  const request = {
    url: 'https://example.com/api/admin/remove-back-in-stock',
    method: 'POST',
    headers,
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

const REMOVED = [
  {
    email: 'a@example.com',
    productId: 'prod-1',
    productTitle: 'Baker Deck',
    productUrl: '/products/baker',
  },
];

describe('POST /api/admin/remove-back-in-stock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAdmin.mockReturnValue(true);
    (
      removeAllSubscriptionsForProduct as ReturnType<typeof vi.fn>
    ).mockResolvedValue([]);
  });

  it('redirects to login when unauthenticated (form request)', async () => {
    mockIsAdmin.mockReturnValue(false);
    const res = await POST(makeContext({ formData: { productId: 'prod-1' } }));
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toContain('/admin/login');
  });

  it('returns 401 JSON when unauthenticated and accept is application/json', async () => {
    mockIsAdmin.mockReturnValue(false);
    const res = await POST(
      makeContext({ formData: { productId: 'prod-1' }, acceptJson: true })
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 400 when productId is missing', async () => {
    const res = await POST(makeContext({ formData: {} }));
    expect(res.status).toBe(400);
  });

  it('removes all subscribers and redirects with removed count (form request)', async () => {
    (
      removeAllSubscriptionsForProduct as ReturnType<typeof vi.fn>
    ).mockResolvedValue(REMOVED);
    const res = await POST(makeContext({ formData: { productId: 'prod-1' } }));
    expect(removeAllSubscriptionsForProduct).toHaveBeenCalledWith('prod-1');
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toContain('removed=1');
  });

  it('returns JSON with removed list when accept is application/json', async () => {
    (
      removeAllSubscriptionsForProduct as ReturnType<typeof vi.fn>
    ).mockResolvedValue(REMOVED);
    const res = await POST(
      makeContext({ formData: { productId: 'prod-1' }, acceptJson: true })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.removed).toEqual(REMOVED);
  });
});
