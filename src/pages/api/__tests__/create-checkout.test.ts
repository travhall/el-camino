import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/shopHours', () => ({
  getShopHoursRaw: vi.fn(),
}));
vi.mock('@/lib/square/inventory', () => ({
  checkBulkInventory: vi.fn(),
}));
vi.mock('@/lib/square/pricing', () => ({
  getAuthoritativePricing: vi.fn(),
}));
vi.mock('@/lib/config/shipping', () => ({
  calculateShippingRate: vi.fn(() => 5),
  getPickupLocation: vi.fn(),
}));
vi.mock('@/lib/email/pendingOrders', () => ({
  storePendingOrder: vi.fn(),
}));
vi.mock('@/lib/cache/blobCache', () => ({
  inventoryCache: { delete: vi.fn() },
  productCache: { delete: vi.fn() },
}));
vi.mock('@/lib/square/client', () => ({
  squareClient: {
    checkout: {
      paymentLinks: {
        create: vi.fn(),
      },
    },
  },
}));

import { POST, nextPickupTime, storeTimeOf } from '../create-checkout';
import { checkBulkInventory } from '@/lib/square/inventory';
import { getAuthoritativePricing } from '@/lib/square/pricing';
import { squareClient } from '@/lib/square/client';
import { checkoutRetryClient } from '@/lib/square/apiRetry';
import { getShopHoursRaw } from '@/lib/shopHours';
import type { CartItem } from '@/lib/cart/types';
import type { ShopHoursEntry } from '@/lib/shopHours';

const getShopHoursRawMock = getShopHoursRaw as unknown as ReturnType<typeof vi.fn>;
const checkBulkInventoryMock = checkBulkInventory as unknown as ReturnType<typeof vi.fn>;
const getAuthoritativePricingMock = getAuthoritativePricing as unknown as ReturnType<typeof vi.fn>;
const createPaymentLinkMock = squareClient.checkout.paymentLinks.create as unknown as ReturnType<typeof vi.fn>;

let ipCounter = 0;
function nextIp(): string {
  ipCounter += 1;
  return `10.1.0.${ipCounter}`;
}

function makeRequest(body: unknown, ip = nextIp()): Request {
  return new Request('https://example.com/api/create-checkout', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  });
}

function makeItem(overrides: Partial<CartItem> = {}): CartItem {
  return {
    id: 'item-1',
    catalogObjectId: 'cat-1',
    variationId: 'var-1',
    title: 'Test Item',
    price: 10,
    quantity: 1,
    ...overrides,
  };
}

const SHIPPING_ADDRESS = {
  name: 'Test Customer',
  email: 'test@example.com',
  phone: '5555555555',
  street1: '123 Main St',
  city: 'Austin',
  state: 'TX',
  zip: '78701',
};

beforeEach(() => {
  vi.clearAllMocks();
  checkoutRetryClient.reset();
  getAuthoritativePricingMock.mockResolvedValue({});
  createPaymentLinkMock.mockResolvedValue({
    paymentLink: { url: 'https://square.link/checkout/abc', orderId: 'order-123' },
  });
});

afterEach(() => {
  checkoutRetryClient.reset();
});

// ── Helpers for nextPickupTime tests ─────────────────────────────────────────

/**
 * Build a 7-entry ShopHoursEntry array (Mon–Sun) with a custom Saturday entry.
 * All other days use the supplied defaultOpen/defaultClose.
 */
function buildMockHoursData(opts: {
  defaultOpen: string;
  defaultClose: string;
  satOpen: string;
  satClose: string;
}): ShopHoursEntry[] {
  // DAYS_OF_WEEK order: Mon(0) Tue(1) Wed(2) Thu(3) Fri(4) Sat(5) Sun(6)
  const normal = (day: string): ShopHoursEntry => ({
    day,
    isOpen: true,
    open: opts.defaultOpen,
    close: opts.defaultClose,
  });
  return [
    normal('Monday'),
    normal('Tuesday'),
    normal('Wednesday'),
    normal('Thursday'),
    normal('Friday'),
    { day: 'Saturday', isOpen: true, open: opts.satOpen, close: opts.satClose },
    normal('Sunday'),
  ];
}

// ── nextPickupTime tests ──────────────────────────────────────────────────────

describe('nextPickupTime', () => {
  it('skips a pickup candidate that falls before store open on the next day', async () => {
    // Scenario: Saturday closes at 23:00 CST, Sunday opens at 10:00 CST.
    // The loop finds a candidate during Saturday hours (e.g. 22:00 CST) and
    // computes pickupCandidate = candidate + 2h = 00:00 Sunday CST.
    // BUG: 0 < 17 passes, returning midnight as a pickup slot.
    // FIX: 0 >= 10 fails, so the loop keeps going until Sunday 10:00 CST.
    const hoursData = buildMockHoursData({
      defaultOpen: '10:00',
      defaultClose: '17:00',
      satOpen: '22:00',
      satClose: '23:00',
    });
    getShopHoursRawMock.mockResolvedValue(hoursData);

    // Jan 3 2026 is a Saturday. 2026-01-04T00:00:00Z = Saturday 18:00 CST.
    // from + 2h = Saturday 20:00 CST — before Saturday's 22:00 open, so
    // the fast path is skipped and the loop must find the correct slot.
    const from = new Date('2026-01-04T00:00:00Z');
    const result = await nextPickupTime(from);

    const { hour } = storeTimeOf(result);
    expect(hour).toBeGreaterThanOrEqual(10); // must be within open hours, not before store opens
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/create-checkout', () => {
  it('returns 400 when items is empty', async () => {
    const res = await POST({ request: makeRequest({ items: [], shippingAddress: SHIPPING_ADDRESS }) } as any);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('No items provided');
  });

  it('returns 400 when shipping method has no shippingAddress', async () => {
    const res = await POST({
      request: makeRequest({ items: [makeItem()], fulfillmentMethod: 'shipping' }),
    } as any);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Shipping address required');
  });

  it('returns 400 when pickup method has no pickupContact', async () => {
    const res = await POST({
      request: makeRequest({ items: [makeItem()], fulfillmentMethod: 'pickup' }),
    } as any);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Pick up contact required');
  });

  it('removes out-of-stock items and clamps over-quantity items', async () => {
    checkBulkInventoryMock.mockResolvedValue({ 'var-1': 0, 'var-2': 5 });
    const items = [
      makeItem({ variationId: 'var-1', title: 'Out of Stock', quantity: 2 }),
      makeItem({ variationId: 'var-2', title: 'Clamped Item', quantity: 10 }),
    ];
    const res = await POST({
      request: makeRequest({ items, fulfillmentMethod: 'shipping', shippingAddress: SHIPPING_ADDRESS }),
    } as any);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.cartUpdated).toBe(true);
    expect(json.stockMessage).toContain('Out of Stock');
    expect(json.stockMessage).toContain('Clamped Item');
    expect(json.stockMessage).toContain('10 → 5');

    // Confirm the order actually sent to Square only contains the clamped quantity
    const createArgs = createPaymentLinkMock.mock.calls[0][0];
    const lineItems = createArgs.order.lineItems;
    expect(lineItems.find((li: any) => li.catalogObjectId === 'var-1')).toBeUndefined();
    const clamped = lineItems.find((li: any) => li.catalogObjectId === 'var-2');
    expect(clamped.quantity).toBe('5');
  });

  it('lets gift card items bypass inventory checks entirely', async () => {
    checkBulkInventoryMock.mockResolvedValue({});
    const items = [makeItem({ variationId: 'gc-1', isGiftCard: true, quantity: 1 })];
    const res = await POST({
      request: makeRequest({ items, fulfillmentMethod: 'shipping', shippingAddress: SHIPPING_ADDRESS }),
    } as any);

    expect(res.status).toBe(200);
    // checkBulkInventory should not even be called with the gift card's variationId
    expect(checkBulkInventoryMock).not.toHaveBeenCalledWith(['gc-1']);
    const createArgs = createPaymentLinkMock.mock.calls[0][0];
    expect(createArgs.order.lineItems.some((li: any) => li.catalogObjectId === 'gc-1')).toBe(true);
  });

  it('rate-limits after 10 requests from the same IP, returning 429 on the 11th', async () => {
    checkBulkInventoryMock.mockResolvedValue({ 'var-1': 5 });
    const ip = '203.0.113.50';
    let lastRes: Response | undefined;
    for (let i = 0; i < 11; i++) {
      lastRes = await POST({
        request: makeRequest(
          { items: [makeItem()], fulfillmentMethod: 'shipping', shippingAddress: SHIPPING_ADDRESS },
          ip
        ),
      } as any);
    }
    expect(lastRes!.status).toBe(429);
  });

  describe('retry protection for paymentLinks.create', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('recovers and returns a checkout URL when paymentLinks.create fails once then succeeds', async () => {
      checkBulkInventoryMock.mockResolvedValue({ 'var-1': 5 });
      createPaymentLinkMock
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockResolvedValueOnce({
          paymentLink: { url: 'https://square.link/checkout/recovered', orderId: 'order-456' },
        });

      const promise = POST({
        request: makeRequest({
          items: [makeItem()],
          fulfillmentMethod: 'shipping',
          shippingAddress: SHIPPING_ADDRESS,
        }),
      } as any);

      await vi.runAllTimersAsync();
      const res = await promise;

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.checkoutUrl).toBe('https://square.link/checkout/recovered');
      expect(createPaymentLinkMock).toHaveBeenCalledTimes(2);
    });

    it('returns a 500 error when paymentLinks.create fails on every retry attempt', async () => {
      checkBulkInventoryMock.mockResolvedValue({ 'var-1': 5 });
      createPaymentLinkMock.mockRejectedValue(new Error('Persistent Square outage'));

      const promise = POST({
        request: makeRequest({
          items: [makeItem()],
          fulfillmentMethod: 'shipping',
          shippingAddress: SHIPPING_ADDRESS,
        }),
      } as any);

      await vi.runAllTimersAsync();
      const res = await promise;

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Checkout creation failed. Please try again.');
      // maxRetries: 2 → 1 initial attempt + 2 retries = 3 calls total
      expect(createPaymentLinkMock).toHaveBeenCalledTimes(3);
    });
  });
});
