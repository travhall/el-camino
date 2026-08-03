import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockIsAdmin, mockOrdersGet, mockOrdersUpdate } = vi.hoisted(() => ({
  mockIsAdmin: vi.fn(),
  mockOrdersGet: vi.fn(),
  mockOrdersUpdate: vi.fn(),
}));

vi.mock('@/lib/admin/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/admin/auth')>();
  return { ...actual, isAdminAuthenticated: mockIsAdmin };
});

vi.mock('@/lib/square/client', () => ({
  squareClient: {
    orders: {
      get: mockOrdersGet,
      update: mockOrdersUpdate,
    },
  },
}));

import { POST } from '../admin/mark-pickedup';

function makeContext(formData?: Record<string, string>) {
  const request = {
    url: 'https://example.com/api/admin/mark-pickedup',
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

const PICKUP_ORDER = {
  locationId: 'loc-1',
  version: 1,
  fulfillments: [{ uid: 'ful-1', type: 'PICKUP', state: 'PROPOSED' }],
};

describe('POST /api/admin/mark-pickedup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAdmin.mockReturnValue(true);
    mockOrdersGet.mockResolvedValue({ order: PICKUP_ORDER });
    mockOrdersUpdate.mockResolvedValue({});
  });

  it('redirects to login when unauthenticated', async () => {
    mockIsAdmin.mockReturnValue(false);
    const res = await POST(makeContext());
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toContain('/admin/login');
  });

  it('returns 400 when orderId is missing', async () => {
    const res = await POST(makeContext({}));
    expect(res.status).toBe(400);
  });

  it('redirects with error=fetch when Square returns no order', async () => {
    mockOrdersGet.mockResolvedValue({ order: null });
    const res = await POST(makeContext({ orderId: 'order-1' }));
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toContain('error=fetch');
  });

  it('redirects with error=fetch when no active PICKUP fulfillment exists', async () => {
    mockOrdersGet.mockResolvedValue({
      order: {
        locationId: 'loc-1',
        version: 1,
        fulfillments: [{ uid: 'ful-1', type: 'PICKUP', state: 'COMPLETED' }],
      },
    });
    const res = await POST(makeContext({ orderId: 'order-1' }));
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toContain('error=fetch');
  });

  it('walks state machine to COMPLETED and redirects with completed=1', async () => {
    // PROPOSED needs three transitions: RESERVED, PREPARED, COMPLETED
    let version = 1;
    mockOrdersGet.mockImplementation(async () => ({
      order: { ...PICKUP_ORDER, version: version++ },
    }));

    const res = await POST(makeContext({ orderId: 'order-1' }));
    expect(mockOrdersUpdate).toHaveBeenCalledTimes(3);
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toContain('completed=1');
  });

  it('redirects with error=update when Square update throws', async () => {
    mockOrdersGet.mockResolvedValue({ order: { ...PICKUP_ORDER, version: 2 } });
    mockOrdersUpdate.mockRejectedValue(new Error('Square error'));

    const res = await POST(makeContext({ orderId: 'order-1' }));
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toContain('error=update');
  });
});

// cSpell:ignore pickedup
