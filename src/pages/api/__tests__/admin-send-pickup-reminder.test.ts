import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockIsAdmin, mockOrdersGet, mockSendReminder } = vi.hoisted(() => ({
  mockIsAdmin: vi.fn(),
  mockOrdersGet: vi.fn(),
  mockSendReminder: vi.fn(),
}));

vi.mock('@/lib/admin/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/admin/auth')>();
  return { ...actual, isAdminAuthenticated: mockIsAdmin };
});

vi.mock('@/lib/square/client', () => ({
  squareClient: { orders: { get: mockOrdersGet } },
}));

vi.mock('@/lib/email/sender', () => ({
  sendPickupReminderEmail: mockSendReminder,
}));

import { POST } from '../admin/send-pickup-reminder';

const PICKUP_FULFILLMENT = {
  type: 'PICKUP',
  state: 'RESERVED',
  pickupDetails: {
    recipient: {
      emailAddress: 'pickup@example.com',
      displayName: 'Pickup Customer',
    },
    pickupAt: '2026-08-10T14:00:00Z',
  },
};

const PICKUP_ORDER = {
  id: 'order-1',
  fulfillments: [PICKUP_FULFILLMENT],
  lineItems: [{ catalogObjectId: 'cat-1', name: 'Baker Deck', quantity: '1' }],
};

function makeContext(formData?: Record<string, string>) {
  const request = {
    url: 'https://example.com/api/admin/send-pickup-reminder',
    method: 'POST',
    headers: new Headers({ origin: 'https://example.com' }),
    formData: async () => {
      const fd = new FormData();
      if (formData)
        for (const [k, v] of Object.entries(formData)) fd.append(k, v);
      return fd;
    },
  } as unknown as Request;
  const cookies = { get: vi.fn(), set: vi.fn() };
  return { request, cookies } as unknown as Parameters<typeof POST>[0];
}

describe('POST /api/admin/send-pickup-reminder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAdmin.mockReturnValue(true);
    mockOrdersGet.mockResolvedValue({ order: PICKUP_ORDER });
    mockSendReminder.mockResolvedValue(undefined);
  });

  it('returns 401 when unauthenticated', async () => {
    mockIsAdmin.mockReturnValue(false);
    const res = await POST(makeContext({ orderId: 'order-1' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 when orderId is missing', async () => {
    const res = await POST(makeContext({}));
    expect(res.status).toBe(400);
  });

  it('returns 422 when no active PICKUP fulfillment exists', async () => {
    mockOrdersGet.mockResolvedValue({
      order: {
        fulfillments: [{ type: 'PICKUP', state: 'COMPLETED' }],
        lineItems: [],
      },
    });
    const res = await POST(makeContext({ orderId: 'order-1' }));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe('no_active_pickup');
  });

  it('returns 422 when fulfillment has no recipient email', async () => {
    mockOrdersGet.mockResolvedValue({
      order: {
        fulfillments: [
          {
            type: 'PICKUP',
            state: 'RESERVED',
            pickupDetails: { recipient: { displayName: 'No Email' } },
          },
        ],
        lineItems: [],
      },
    });
    const res = await POST(makeContext({ orderId: 'order-1' }));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe('no_email');
  });

  it('sends reminder email and returns 200 ok on success', async () => {
    const res = await POST(makeContext({ orderId: 'order-1' }));
    expect(mockSendReminder).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'pickup@example.com', orderId: 'order-1' })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it('returns 500 when sendPickupReminderEmail throws', async () => {
    mockSendReminder.mockRejectedValue(new Error('email error'));
    const res = await POST(makeContext({ orderId: 'order-1' }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('send_failed');
  });
});
