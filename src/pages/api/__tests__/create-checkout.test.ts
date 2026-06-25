import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/square/inventory', () => ({
  checkBulkInventory: vi.fn(),
}));
vi.mock('@/lib/square/pricing', () => ({
  getAuthoritativePricing: vi.fn(),
}));
vi.mock('@/lib/config/shipping', () => ({
  calculateShippingRate: vi.fn(() => ({ id: 'standard', rate: 5, freeThreshold: 0 })),
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

import { POST } from '../create-checkout';
import { checkBulkInventory } from '@/lib/square/inventory';
import { getAuthoritativePricing } from '@/lib/square/pricing';
import { squareClient } from '@/lib/square/client';
import type { CartItem } from '@/lib/cart/types';

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
  getAuthoritativePricingMock.mockResolvedValue({});
  createPaymentLinkMock.mockResolvedValue({
    paymentLink: { url: 'https://square.link/checkout/abc', orderId: 'order-123' },
  });
});

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
});
