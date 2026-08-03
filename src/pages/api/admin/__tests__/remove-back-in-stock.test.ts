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

vi.mock('@/lib/backInStock', () => ({
  removeAllSubscriptionsForProduct: vi.fn(),
}));

import { POST } from '../remove-back-in-stock';
import { isAdminAuthenticated } from '@/lib/admin/auth';
import {
  removeAllSubscriptionsForProduct,
  type BisSubscription,
} from '@/lib/backInStock';

const URL_BASE = 'https://example.com/api/admin/remove-back-in-stock';

type Context = Parameters<typeof POST>[0];

function makeFormContext(
  fields: Record<string, string>,
  accept?: string
): Context {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) formData.set(key, value);
  const headers: Record<string, string> = {};
  if (accept) headers['accept'] = accept;
  const request = new Request(URL_BASE, {
    method: 'POST',
    body: formData,
    headers,
  });
  return {
    request,
    cookies: {},
    redirect: (url: string) =>
      new Response(null, { status: 302, headers: { Location: url } }),
  } as unknown as Context;
}

const removed: BisSubscription[] = [
  {
    productId: 'prod-1',
    email: 'a@example.com',
    productTitle: 'Deck',
    productUrl: '/products/deck',
    variationId: 'var-1',
    submittedAt: '2026-01-01T00:00:00.000Z',
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isAdminAuthenticated).mockReturnValue(true);
});

describe('POST /api/admin/remove-back-in-stock', () => {
  it('redirects to login when not authenticated (form request)', async () => {
    vi.mocked(isAdminAuthenticated).mockReturnValue(false);
    const res = await POST(makeFormContext({ productId: 'prod-1' }));
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toContain('/admin/login');
  });

  it('returns 401 JSON when not authenticated and accept is application/json', async () => {
    vi.mocked(isAdminAuthenticated).mockReturnValue(false);
    const res = await POST(
      makeFormContext({ productId: 'prod-1' }, 'application/json')
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 400 when productId is missing', async () => {
    const res = await POST(makeFormContext({}));
    expect(res.status).toBe(400);
  });

  it('removes subscriptions and redirects with removed count on form request', async () => {
    vi.mocked(removeAllSubscriptionsForProduct).mockResolvedValue(removed);
    const res = await POST(makeFormContext({ productId: 'prod-1' }));
    expect(removeAllSubscriptionsForProduct).toHaveBeenCalledWith('prod-1');
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toContain('removed=1');
  });

  it('returns JSON with removed list when accept is application/json', async () => {
    vi.mocked(removeAllSubscriptionsForProduct).mockResolvedValue(removed);
    const res = await POST(
      makeFormContext({ productId: 'prod-1' }, 'application/json')
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ removed });
  });
});
