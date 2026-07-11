import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/square/pricing', () => ({
  getAuthoritativePricing: vi.fn(),
}));
vi.mock('@/lib/config/shipping', () => ({
  calculateShippingRate: vi.fn(() => 5),
}));
vi.mock('@/lib/square/client', () => ({
  squareClient: {
    orders: {
      calculate: vi.fn(),
    },
  },
}));

import { POST } from '../calculate-cart';
import { getAuthoritativePricing } from '@/lib/square/pricing';
import { squareClient } from '@/lib/square/client';
import { apiRetryClient } from '@/lib/square/apiRetry';
import type { CartItem } from '@/lib/cart/types';

const getAuthoritativePricingMock = getAuthoritativePricing as unknown as ReturnType<typeof vi.fn>;
const calculateOrderMock = squareClient.orders.calculate as unknown as ReturnType<typeof vi.fn>;

function makeRequest(body: unknown): Request {
  return new Request('https://example.com/api/calculate-cart', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
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

beforeEach(() => {
  vi.clearAllMocks();
  apiRetryClient.reset();
  getAuthoritativePricingMock.mockResolvedValue({});
  calculateOrderMock.mockResolvedValue({
    order: {
      totalTaxMoney: { amount: 82 },
      totalMoney: { amount: 1082 },
    },
  });
});

afterEach(() => {
  apiRetryClient.reset();
});

describe('POST /api/calculate-cart', () => {
  it('returns zeroed totals when items is empty', async () => {
    const res = await POST({
      request: makeRequest({ items: [], fulfillmentMethod: 'shipping' }),
    } as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.total).toBe(0);
  });

  it('returns calculated tax and total for a valid cart', async () => {
    const res = await POST({
      request: makeRequest({
        items: [makeItem()],
        fulfillmentMethod: 'shipping',
      }),
    } as any);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.tax).toBeCloseTo(0.82);
    expect(json.total).toBeCloseTo(10.82);
  });

  describe('retry protection for orders.calculate', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('recovers and returns calculated totals when orders.calculate fails once then succeeds', async () => {
      calculateOrderMock
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockResolvedValueOnce({
          order: {
            totalTaxMoney: { amount: 82 },
            totalMoney: { amount: 1082 },
          },
        });

      const promise = POST({
        request: makeRequest({
          items: [makeItem()],
          fulfillmentMethod: 'shipping',
        }),
      } as any);

      await vi.runAllTimersAsync();
      const res = await promise;

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.total).toBeCloseTo(10.82);
      expect(calculateOrderMock).toHaveBeenCalledTimes(2);
    });

    it('returns a 500 error when orders.calculate fails on every retry attempt', async () => {
      calculateOrderMock.mockRejectedValue(new Error('Persistent Square outage'));

      const promise = POST({
        request: makeRequest({
          items: [makeItem()],
          fulfillmentMethod: 'shipping',
        }),
      } as any);

      await vi.runAllTimersAsync();
      const res = await promise;

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Unable to calculate cart total. Please try again.');
      // maxRetries: 2 → 1 initial attempt + 2 retries = 3 calls total
      expect(calculateOrderMock).toHaveBeenCalledTimes(3);
    });
  });

  describe('authoritative pricing', () => {
    it('ignores a client-supplied sale price when the catalog reports no active sale', async () => {
      // Simulate a stale/tampered client cart: saleInfo claims a steep discount,
      // but the authoritative catalog lookup (mocked) confirms no active sale.
      getAuthoritativePricingMock.mockResolvedValue({
        'var-1': { regularPrice: 10, effectivePrice: 10 },
      });
      const items = [
        makeItem({
          variationId: 'var-1',
          price: 10,
          quantity: 2,
          saleInfo: { salePrice: 1, originalPrice: 10 } as any,
        }),
      ];

      const res = await POST({
        request: makeRequest({ items, fulfillmentMethod: 'pickup' }),
      } as any);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      // Regular price (10) * quantity (2), NOT the fake sale price (1) * 2.
      expect(json.subtotal).toBe(20);

      // The Square line item sent for calculation must not carry a price
      // override — Square applies its own catalog price.
      const calculateArgs = calculateOrderMock.mock.calls[0][0];
      const lineItem = calculateArgs.order.lineItems.find(
        (li: any) => li.catalogObjectId === 'var-1'
      );
      expect(lineItem.basePriceMoney).toBeUndefined();
    });

    it('uses the catalog sale price when the catalog confirms an active sale', async () => {
      getAuthoritativePricingMock.mockResolvedValue({
        'var-1': { regularPrice: 10, salePrice: 7, effectivePrice: 7 },
      });
      const items = [makeItem({ variationId: 'var-1', price: 10, quantity: 3 })];

      const res = await POST({
        request: makeRequest({ items, fulfillmentMethod: 'pickup' }),
      } as any);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      // Sale price (7) * quantity (3) confirmed by the catalog.
      expect(json.subtotal).toBe(21);

      const calculateArgs = calculateOrderMock.mock.calls[0][0];
      const lineItem = calculateArgs.order.lineItems.find(
        (li: any) => li.catalogObjectId === 'var-1'
      );
      expect(lineItem.basePriceMoney.amount).toBe(BigInt(700));
    });

    it('falls back to item.price for gift cards, which have no catalog-fixed price', async () => {
      // getAuthoritativePricing is only called for non-gift-card variation IDs.
      getAuthoritativePricingMock.mockResolvedValue({});
      const items = [makeItem({ variationId: 'gc-1', isGiftCard: true, price: 25, quantity: 1 })];

      const res = await POST({
        request: makeRequest({ items, fulfillmentMethod: 'pickup' }),
      } as any);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.subtotal).toBe(25);
      expect(getAuthoritativePricingMock).toHaveBeenCalledWith([]);
    });
  });
});
