import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/admin/auth', () => ({
  isAdminAuthenticated: vi.fn().mockReturnValue(true),
}));

vi.mock('@/lib/backInStock', () => ({
  addSubscription: vi.fn(),
}));

import { POST } from '../restore-back-in-stock';
import { isAdminAuthenticated } from '@/lib/admin/auth';
import { addSubscription, type BisSubscription } from '@/lib/backInStock';

const URL_BASE = 'https://example.com/api/admin/restore-back-in-stock';

type Context = Parameters<typeof POST>[0];

function makeContext(body: unknown): Context {
  const request = new Request(URL_BASE, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
  return { request, cookies: {} } as unknown as Context;
}

const subs: BisSubscription[] = [
  {
    productId: 'prod-1',
    email: 'a@example.com',
    productTitle: 'Deck',
    productUrl: '/products/deck',
    variationId: 'var-1',
    submittedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    productId: 'prod-1',
    email: 'b@example.com',
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

describe('POST /api/admin/restore-back-in-stock', () => {
  it('returns 401 when not authenticated', async () => {
    vi.mocked(isAdminAuthenticated).mockReturnValue(false);
    const res = await POST(makeContext({ subscriptions: subs }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 400 when subscriptions array is empty', async () => {
    const res = await POST(makeContext({ subscriptions: [] }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when body is not valid JSON', async () => {
    const request = new Request(URL_BASE, {
      method: 'POST',
      body: 'not json',
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST({ request, cookies: {} } as unknown as Context);
    expect(res.status).toBe(400);
  });

  it('calls addSubscription for each entry and returns restored count', async () => {
    vi.mocked(addSubscription).mockResolvedValue(undefined);
    const res = await POST(makeContext({ subscriptions: subs }));
    expect(addSubscription).toHaveBeenCalledTimes(2);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ restored: 2 });
  });
});
