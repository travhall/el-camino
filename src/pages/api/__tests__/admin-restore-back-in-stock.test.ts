import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockIsAdmin } = vi.hoisted(() => ({ mockIsAdmin: vi.fn() }));

vi.mock('@/lib/admin/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/admin/auth')>();
  return { ...actual, isAdminAuthenticated: mockIsAdmin };
});

vi.mock('@/lib/backInStock', () => ({
  addSubscription: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from '../admin/restore-back-in-stock';
import { addSubscription } from '@/lib/backInStock';

const SUBS = [
  {
    email: 'a@example.com',
    productId: 'prod-1',
    productTitle: 'Baker Deck',
    productUrl: '/products/baker',
  },
  {
    email: 'b@example.com',
    productId: 'prod-1',
    productTitle: 'Baker Deck',
    productUrl: '/products/baker',
  },
];

function makeContext(jsonBody?: unknown) {
  const request = {
    url: 'https://example.com/api/admin/restore-back-in-stock',
    method: 'POST',
    headers: new Headers({ origin: 'https://example.com' }),
    json: async () => jsonBody,
  } as unknown as Request;
  const cookies = { get: vi.fn(), set: vi.fn() };
  return { request, cookies } as unknown as Parameters<typeof POST>[0];
}

describe('POST /api/admin/restore-back-in-stock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAdmin.mockReturnValue(true);
  });

  it('returns 401 when unauthenticated', async () => {
    mockIsAdmin.mockReturnValue(false);
    const res = await POST(makeContext({ subscriptions: SUBS }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 400 when subscriptions array is empty', async () => {
    const res = await POST(makeContext({ subscriptions: [] }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when subscriptions is not an array', async () => {
    const res = await POST(makeContext({ subscriptions: 'bad' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when body is invalid JSON', async () => {
    const request = {
      url: 'https://example.com/api/admin/restore-back-in-stock',
      method: 'POST',
      headers: new Headers({ origin: 'https://example.com' }),
      json: async () => {
        throw new SyntaxError('bad json');
      },
    } as unknown as Request;
    const res = await POST({
      request,
      cookies: { get: vi.fn(), set: vi.fn() },
    } as unknown as Parameters<typeof POST>[0]);
    expect(res.status).toBe(400);
  });

  it('restores all subscriptions and returns restored count', async () => {
    const res = await POST(makeContext({ subscriptions: SUBS }));
    expect(addSubscription).toHaveBeenCalledTimes(2);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.restored).toBe(2);
  });
});
