import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockIsAdmin, mockOrdersGet, mockOrdersUpdate, mockSendShipping } =
  vi.hoisted(() => ({
    mockIsAdmin: vi.fn(),
    mockOrdersGet: vi.fn(),
    mockOrdersUpdate: vi.fn(),
    mockSendShipping: vi.fn(),
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

vi.mock('@/lib/email/sender', () => ({
  sendShippingConfirmation: mockSendShipping,
}));

import { POST } from '../admin/mark-shipped';

const SHIPMENT_FULFILLMENT = {
  uid: 'ful-1',
  type: 'SHIPMENT',
  state: 'PROPOSED',
  shipmentDetails: {
    recipient: {
      emailAddress: 'customer@example.com',
      displayName: 'Test Customer',
    },
  },
};

const SHIP_ORDER = {
  locationId: 'loc-1',
  version: 1,
  fulfillments: [SHIPMENT_FULFILLMENT],
};

function makeContext(formData?: Record<string, string>) {
  const request = {
    url: 'https://example.com/api/admin/mark-shipped',
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

describe('POST /api/admin/mark-shipped', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAdmin.mockReturnValue(true);
    mockOrdersGet.mockResolvedValue({ order: SHIP_ORDER });
    mockOrdersUpdate.mockResolvedValue({});
    mockSendShipping.mockResolvedValue(undefined);
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
    expect(res.headers.get('Location')).toContain('error=fetch');
  });

  it('redirects with error=fetch when no active SHIPMENT fulfillment exists', async () => {
    mockOrdersGet.mockResolvedValue({
      order: {
        locationId: 'loc-1',
        version: 1,
        fulfillments: [{ uid: 'ful-1', type: 'SHIPMENT', state: 'COMPLETED' }],
      },
    });
    const res = await POST(makeContext({ orderId: 'order-1' }));
    expect(res.headers.get('Location')).toContain('error=fetch');
  });

  it('redirects with error=no-email when recipient has no email', async () => {
    mockOrdersGet.mockResolvedValue({
      order: {
        locationId: 'loc-1',
        version: 1,
        fulfillments: [
          {
            uid: 'ful-1',
            type: 'SHIPMENT',
            state: 'PROPOSED',
            shipmentDetails: { recipient: { displayName: 'No Email' } },
          },
        ],
      },
    });
    const res = await POST(makeContext({ orderId: 'order-1' }));
    expect(res.headers.get('Location')).toContain('error=no-email');
  });

  it('walks state machine to COMPLETED and sends shipping confirmation', async () => {
    // PROPOSED → RESERVED → COMPLETED requires 2 update calls
    let version = 1;
    mockOrdersGet.mockImplementation(async () => ({
      order: { ...SHIP_ORDER, version: version++ },
    }));

    const res = await POST(
      makeContext({
        orderId: 'order-1',
        trackingNumber: '1Z999',
        carrier: 'UPS',
      })
    );
    expect(mockOrdersUpdate).toHaveBeenCalledTimes(2);
    expect(mockSendShipping).toHaveBeenCalled();
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toContain('shipped=1');
  });

  it('redirects with error=update when Square update throws', async () => {
    let callCount = 0;
    mockOrdersGet.mockImplementation(async () => {
      callCount++;
      return { order: { ...SHIP_ORDER, version: callCount } };
    });
    mockOrdersUpdate.mockRejectedValue(new Error('Square error'));

    const res = await POST(makeContext({ orderId: 'order-1' }));
    expect(res.headers.get('Location')).toContain('error=update');
  });

  it('redirects with error=email when sending confirmation fails', async () => {
    let version = 1;
    mockOrdersGet.mockImplementation(async () => ({
      order: { ...SHIP_ORDER, version: version++ },
    }));
    mockSendShipping.mockRejectedValue(new Error('Resend error'));

    const res = await POST(makeContext({ orderId: 'order-1' }));
    expect(res.headers.get('Location')).toContain('error=email');
  });
});
