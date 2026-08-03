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
  unauthorizedResponse: () =>
    new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    }),
}));

vi.mock('@/lib/square/client', () => ({
  squareClient: {
    orders: {
      get: vi.fn(),
    },
  },
}));

vi.mock('@/lib/email/sender', () => ({
  sendPickupReminderEmail: vi.fn(),
}));

import { POST } from '../send-pickup-reminder';
import { isAdminAuthenticated } from '@/lib/admin/auth';
import { squareClient } from '@/lib/square/client';
import { sendPickupReminderEmail } from '@/lib/email/sender';

const URL_BASE = 'https://example.com/api/admin/send-pickup-reminder';

type Context = Parameters<typeof POST>[0];
type GetOrderResult = Awaited<ReturnType<typeof squareClient.orders.get>>;

function makeContext(fields: Record<string, string>): Context {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) formData.set(key, value);
  const request = new Request(URL_BASE, { method: 'POST', body: formData });
  return { request, cookies: {} } as unknown as Context;
}

const orderWithPickup = (overrides: Record<string, unknown> = {}) => ({
  order: {
    id: 'order-1',
    lineItems: [{ catalogObjectId: 'cat-1', name: 'Deck', quantity: '1' }],
    fulfillments: [
      {
        type: 'PICKUP',
        state: 'PROPOSED',
        pickupDetails: {
          pickupAt: '2026-08-10T14:00:00Z',
          recipient: {
            emailAddress: 'customer@example.com',
            displayName: 'Test Customer',
          },
          ...overrides,
        },
      },
    ],
  },
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isAdminAuthenticated).mockReturnValue(true);
});

describe('POST /api/admin/send-pickup-reminder', () => {
  it('returns 401 when not authenticated', async () => {
    vi.mocked(isAdminAuthenticated).mockReturnValue(false);
    const res = await POST(makeContext({ orderId: 'order-1' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 when orderId is missing', async () => {
    const res = await POST(makeContext({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('missing_order_id');
  });

  it('returns 500 when the Square order fetch fails', async () => {
    vi.mocked(squareClient.orders.get).mockRejectedValue(
      new Error('Square down')
    );
    const res = await POST(makeContext({ orderId: 'order-1' }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('send_failed');
  });

  it('returns 422 when there is no active pickup fulfillment', async () => {
    vi.mocked(squareClient.orders.get).mockResolvedValue({
      order: {
        id: 'order-1',
        fulfillments: [{ type: 'PICKUP', state: 'COMPLETED' }],
      },
    } as unknown as GetOrderResult);
    const res = await POST(makeContext({ orderId: 'order-1' }));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe('no_active_pickup');
  });

  it('returns 422 when the fulfillment recipient has no email', async () => {
    vi.mocked(squareClient.orders.get).mockResolvedValue(
      orderWithPickup({
        recipient: { displayName: 'No Email' },
      }) as unknown as GetOrderResult
    );
    const res = await POST(makeContext({ orderId: 'order-1' }));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe('no_email');
  });

  it('sends the reminder email and returns ok=true on success', async () => {
    vi.mocked(squareClient.orders.get).mockResolvedValue(
      orderWithPickup() as unknown as GetOrderResult
    );
    vi.mocked(sendPickupReminderEmail).mockResolvedValue(undefined);

    const res = await POST(makeContext({ orderId: 'order-1' }));
    expect(sendPickupReminderEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'customer@example.com',
        customerName: 'Test Customer',
        orderId: 'order-1',
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});
