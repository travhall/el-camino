import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/config/shipping', () => ({
  calculateShippingRate: vi.fn(() => ({ id: 'standard', rate: 5, freeThreshold: 0 })),
}));
vi.mock('@/lib/square/client', () => ({
  squareClient: {
    orders: {
      calculate: vi.fn(),
    },
  },
}));

import { POST } from '../calculate-cart';
import { squareClient } from '@/lib/square/client';
import { apiRetryClient } from '@/lib/square/apiRetry';
import type { CartItem } from '@/lib/cart/types';

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
});
