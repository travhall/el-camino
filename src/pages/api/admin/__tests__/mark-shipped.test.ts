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

vi.mock('@/lib/square/client', () => ({
  squareClient: {
    orders: {
      get: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@/lib/email/sender', () => ({
  sendShippingConfirmation: vi.fn(),
}));

vi.mock('@/lib/email/failedEmails', () => ({
  storeFailedEmail: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from '../mark-shipped';
import { isAdminAuthenticated } from '@/lib/admin/auth';
import { squareClient } from '@/lib/square/client';
import { sendShippingConfirmation } from '@/lib/email/sender';
import { storeFailedEmail } from '@/lib/email/failedEmails';

const URL_BASE = 'https://example.com/api/admin/mark-shipped';

type Context = Parameters<typeof POST>[0];
type GetOrderResult = Awaited<ReturnType<typeof squareClient.orders.get>>;
type UpdateOrderResult = Awaited<ReturnType<typeof squareClient.orders.update>>;

function makeContext(fields: Record<string, string>): Context {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) formData.set(key, value);
  const request = new Request(URL_BASE, { method: 'POST', body: formData });
  return {
    request,
    cookies: {},
    redirect: (url: string) =>
      new Response(null, { status: 302, headers: { Location: url } }),
  } as unknown as Context;
}

const orderWithFulfillment = (
  state: string,
  overrides: Record<string, unknown> = {}
) => ({
  order: {
    locationId: 'LOC1',
    version: 3,
    fulfillments: [
      {
        uid: 'fulfillment-1',
        type: 'SHIPMENT',
        state,
        shipmentDetails: {
          recipient: {
            emailAddress: 'customer@example.com',
            displayName: 'Test Customer',
          },
        },
        ...overrides,
      },
    ],
  },
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isAdminAuthenticated).mockReturnValue(true);
});

describe('POST /api/admin/mark-shipped', () => {
  it('redirects to login when not authenticated', async () => {
    vi.mocked(isAdminAuthenticated).mockReturnValue(false);
    const res = await POST(makeContext({ orderId: 'order-1' }));
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toContain('/admin/login');
  });

  it('returns 400 when orderId is missing', async () => {
    const res = await POST(makeContext({}));
    expect(res.status).toBe(400);
  });

  it('redirects with a no-email error when the recipient has no email address', async () => {
    vi.mocked(squareClient.orders.get).mockResolvedValue(
      orderWithFulfillment('PROPOSED', {
        shipmentDetails: {},
      }) as unknown as GetOrderResult
    );
    const res = await POST(makeContext({ orderId: 'order-1' }));
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toContain('error=no-email');
  });

  it("redirects with a fetch error when the order can't be retrieved", async () => {
    vi.mocked(squareClient.orders.get).mockRejectedValue(
      new Error('not found')
    );
    const res = await POST(makeContext({ orderId: 'order-1' }));
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toContain('error=fetch');
  });

  it('redirects with a fetch error when Square returns no order', async () => {
    vi.mocked(squareClient.orders.get).mockResolvedValue({
      order: null,
    } as unknown as GetOrderResult);
    const res = await POST(makeContext({ orderId: 'order-1' }));
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toContain('error=fetch');
  });

  it('redirects with a fetch error when no active SHIPMENT fulfillment exists', async () => {
    vi.mocked(squareClient.orders.get).mockResolvedValue(
      orderWithFulfillment('CANCELED') as unknown as GetOrderResult
    );
    const res = await POST(makeContext({ orderId: 'order-1' }));
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toContain('error=fetch');
  });

  it('walks PROPOSED -> RESERVED -> COMPLETED, attaches tracking only on the final step, sends confirmation, and redirects', async () => {
    vi.mocked(squareClient.orders.get).mockResolvedValue(
      orderWithFulfillment('PROPOSED') as unknown as GetOrderResult
    );
    vi.mocked(squareClient.orders.update).mockResolvedValue(
      {} as unknown as UpdateOrderResult
    );
    vi.mocked(sendShippingConfirmation).mockResolvedValue(undefined);

    const res = await POST(
      makeContext({
        orderId: 'order-1',
        trackingNumber: '1Z999',
        carrier: 'UPS',
      })
    );

    expect(squareClient.orders.update).toHaveBeenCalledTimes(2);
    const calls = vi.mocked(squareClient.orders.update).mock.calls;
    const [firstCall] = calls[0]!;
    const [secondCall] = calls[1]!;
    const firstFulfillment = firstCall.order!.fulfillments![0]!;
    const secondFulfillment = secondCall.order!.fulfillments![0]!;
    expect(firstFulfillment.state).toBe('RESERVED');
    expect(firstFulfillment.shipmentDetails).toBeUndefined();
    expect(secondFulfillment.state).toBe('COMPLETED');
    expect(secondFulfillment.shipmentDetails).toEqual({
      trackingNumber: '1Z999',
      carrier: 'UPS',
    });

    expect(sendShippingConfirmation).toHaveBeenCalledWith(
      expect.objectContaining({
        contact: {
          email: 'customer@example.com',
          name: 'Test Customer',
          fulfillmentMethod: 'shipping',
        },
        trackingNumber: '1Z999',
        carrier: 'UPS',
      })
    );
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toContain('shipped=1');
  });

  it('redirects with an update error when Square rejects the state transition', async () => {
    vi.mocked(squareClient.orders.get).mockResolvedValue(
      orderWithFulfillment('PROPOSED') as unknown as GetOrderResult
    );
    vi.mocked(squareClient.orders.update).mockRejectedValue(
      new Error('Square update failed')
    );

    const res = await POST(makeContext({ orderId: 'order-1' }));
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toContain('error=update');
  });

  it('redirects with an email error when the Square update succeeds but the confirmation email fails', async () => {
    // RESERVED has exactly one remaining step (-> COMPLETED); the fulfillment
    // lookup itself excludes already-COMPLETED orders, so that state can't be
    // used to reach the email-sending path with zero update() calls.
    vi.mocked(squareClient.orders.get).mockResolvedValue(
      orderWithFulfillment('RESERVED') as unknown as GetOrderResult
    );
    vi.mocked(squareClient.orders.update).mockResolvedValue(
      {} as unknown as UpdateOrderResult
    );
    vi.mocked(sendShippingConfirmation).mockRejectedValue(
      new Error('Resend down')
    );

    const res = await POST(
      makeContext({
        orderId: 'order-1',
        trackingNumber: '1Z999',
        carrier: 'UPS',
      })
    );
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toContain('error=email');

    expect(storeFailedEmail).toHaveBeenCalledWith(
      'order-1',
      expect.anything(),
      expect.objectContaining({
        email: 'customer@example.com',
        name: 'Test Customer',
        fulfillmentMethod: 'shipping',
      }),
      expect.any(Error),
      {
        emailType: 'shipping-confirmation',
        trackingNumber: '1Z999',
        carrier: 'UPS',
      }
    );
  });

  describe('amend path (correcting tracking on an already-shipped order)', () => {
    it('finds a COMPLETED SHIPMENT fulfillment instead of throwing, and does not send a confirmation email', async () => {
      vi.mocked(squareClient.orders.get).mockResolvedValue(
        orderWithFulfillment('COMPLETED', {
          shipmentDetails: {
            recipient: {
              emailAddress: 'customer@example.com',
              displayName: 'Test Customer',
            },
            trackingNumber: 'AAA',
          },
        }) as unknown as GetOrderResult
      );
      vi.mocked(squareClient.orders.update).mockResolvedValue(
        {} as unknown as UpdateOrderResult
      );

      const res = await POST(
        makeContext({ orderId: 'order-1', trackingNumber: 'BBB' })
      );

      expect(squareClient.orders.update).toHaveBeenCalledTimes(1);
      const [call] = vi.mocked(squareClient.orders.update).mock.calls[0]!;
      expect(call.order!.fulfillments![0]!.state).toBe('COMPLETED');
      expect(call.order!.fulfillments![0]!.shipmentDetails).toEqual({
        trackingNumber: 'BBB',
      });
      expect(sendShippingConfirmation).not.toHaveBeenCalled();
      expect(res.status).toBe(302);
      expect(res.headers.get('Location')).toContain('shipped=1');
    });

    it('produces a different idempotency key for a different tracking number', async () => {
      vi.mocked(squareClient.orders.get).mockResolvedValue(
        orderWithFulfillment('COMPLETED') as unknown as GetOrderResult
      );
      vi.mocked(squareClient.orders.update).mockResolvedValue(
        {} as unknown as UpdateOrderResult
      );

      await POST(makeContext({ orderId: 'order-1', trackingNumber: 'AAA' }));
      await POST(makeContext({ orderId: 'order-1', trackingNumber: 'BBB' }));

      const calls = vi.mocked(squareClient.orders.update).mock.calls;
      const [firstCall] = calls[0]!;
      const [secondCall] = calls[1]!;
      expect(firstCall.idempotencyKey).not.toBe(secondCall.idempotencyKey);
    });

    it('produces the same idempotency key when the same tracking number is submitted twice', async () => {
      vi.mocked(squareClient.orders.get).mockResolvedValue(
        orderWithFulfillment('COMPLETED') as unknown as GetOrderResult
      );
      vi.mocked(squareClient.orders.update).mockResolvedValue(
        {} as unknown as UpdateOrderResult
      );

      await POST(makeContext({ orderId: 'order-1', trackingNumber: 'AAA' }));
      await POST(makeContext({ orderId: 'order-1', trackingNumber: 'AAA' }));

      const calls = vi.mocked(squareClient.orders.update).mock.calls;
      const [firstCall] = calls[0]!;
      const [secondCall] = calls[1]!;
      expect(firstCall.idempotencyKey).toBe(secondCall.idempotencyKey);
    });

    it("the amend path's key never collides with the state-walk path's key", async () => {
      vi.mocked(squareClient.orders.get).mockResolvedValue(
        orderWithFulfillment('COMPLETED') as unknown as GetOrderResult
      );
      vi.mocked(squareClient.orders.update).mockResolvedValue(
        {} as unknown as UpdateOrderResult
      );

      await POST(makeContext({ orderId: 'order-1', trackingNumber: 'AAA' }));

      const [call] = vi.mocked(squareClient.orders.update).mock.calls[0]!;
      expect(call.idempotencyKey).not.toBe('shipped-order-1-COMPLETED');
      expect(call.idempotencyKey).toMatch(/^amend-/);
    });

    it('redirects with an update error when Square rejects the amend', async () => {
      vi.mocked(squareClient.orders.get).mockResolvedValue(
        orderWithFulfillment('COMPLETED') as unknown as GetOrderResult
      );
      vi.mocked(squareClient.orders.update).mockRejectedValue(
        new Error('Square update failed')
      );

      const res = await POST(
        makeContext({ orderId: 'order-1', trackingNumber: 'BBB' })
      );
      expect(res.status).toBe(302);
      expect(res.headers.get('Location')).toContain('error=update');
    });
  });

  it('the normal state walk still uses the stable shipped-${orderId}-${targetState} key (regression)', async () => {
    vi.mocked(squareClient.orders.get).mockResolvedValue(
      orderWithFulfillment('PROPOSED') as unknown as GetOrderResult
    );
    vi.mocked(squareClient.orders.update).mockResolvedValue(
      {} as unknown as UpdateOrderResult
    );
    vi.mocked(sendShippingConfirmation).mockResolvedValue(undefined);

    await POST(
      makeContext({
        orderId: 'order-1',
        trackingNumber: '1Z999',
        carrier: 'UPS',
      })
    );

    const calls = vi.mocked(squareClient.orders.update).mock.calls;
    expect(calls[0]![0].idempotencyKey).toBe('shipped-order-1-RESERVED');
    expect(calls[1]![0].idempotencyKey).toBe('shipped-order-1-COMPLETED');
  });
});
