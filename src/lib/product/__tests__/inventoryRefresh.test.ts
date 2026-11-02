import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  applyFreshInventory,
  fetchFreshInventory,
  type FreshInventory,
} from '../inventoryRefresh';
import type { ProductVariation } from '@/lib/square/types';

const variation = (
  variationId: string,
  quantity: number,
  inStock = quantity > 0
): ProductVariation => ({
  id: variationId,
  variationId,
  name: variationId,
  price: 10,
  quantity,
  inStock,
});

const fresh = (
  inventory: Record<string, number>,
  unknown: string[] = []
): FreshInventory => ({ inventory, unknown: new Set(unknown) });

describe('fetchFreshInventory', () => {
  afterEach(() => vi.restoreAllMocks());

  function mockResponse(init: {
    ok?: boolean;
    json?: () => Promise<unknown>;
  }): ReturnType<typeof vi.fn> {
    const fn = vi.fn(async () => ({
      ok: init.ok ?? true,
      json: init.json ?? (async () => ({})),
    }));
    global.fetch = fn as unknown as typeof fetch;
    return fn;
  }

  it('posts the variation IDs and returns inventory with the unknown IDs as a set', async () => {
    const fetchSpy = mockResponse({
      json: async () => ({
        success: true,
        inventory: { a: 3, b: 0 },
        unknown: ['b'],
      }),
    });

    const result = await fetchFreshInventory(['a', 'b']);

    const [url, init] = fetchSpy.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe('/api/cart-inventory');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      variationIds: ['a', 'b'],
    });
    expect(result?.inventory).toEqual({ a: 3, b: 0 });
    expect(result?.unknown.has('b')).toBe(true);
    expect(result?.unknown.has('a')).toBe(false);
  });

  it('returns null for a non-OK response', async () => {
    mockResponse({ ok: false });
    expect(await fetchFreshInventory(['a'])).toBeNull();
  });

  it('returns null when the server reports failure', async () => {
    mockResponse({ json: async () => ({ success: false, error: 'x' }) });
    expect(await fetchFreshInventory(['a'])).toBeNull();
  });

  it('returns null when the response has no `unknown` list (an older server)', async () => {
    // Without it a 0 can't be told from "could not check", so it is not safe to
    // show: a Square hiccup would read as everything sold out.
    mockResponse({
      json: async () => ({ success: true, inventory: { a: 0 } }),
    });
    expect(await fetchFreshInventory(['a'])).toBeNull();
  });

  it.each([
    ['no inventory', { success: true, unknown: [] }],
    ['a null inventory', { success: true, inventory: null, unknown: [] }],
    ['a non-array unknown', { success: true, inventory: {}, unknown: 'a' }],
  ])('returns null for a malformed response (%s)', async (_label, body) => {
    mockResponse({ json: async () => body });
    expect(await fetchFreshInventory(['a'])).toBeNull();
  });

  it('returns null when the request throws', async () => {
    global.fetch = vi.fn(async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;
    expect(await fetchFreshInventory(['a'])).toBeNull();
  });

  it('returns null when the body is not JSON', async () => {
    mockResponse({
      json: async () => {
        throw new Error('not json');
      },
    });
    expect(await fetchFreshInventory(['a'])).toBeNull();
  });
});

describe('applyFreshInventory', () => {
  it('updates quantity and stock state in place and reports what changed', () => {
    const a = variation('a', 5);
    const b = variation('b', 0);
    const c = variation('c', 2);

    const changed = applyFreshInventory([a, b, c], fresh({ a: 0, b: 4, c: 2 }));

    expect(changed).toEqual(['a', 'b']);
    expect(a).toMatchObject({ quantity: 0, inStock: false });
    expect(b).toMatchObject({ quantity: 4, inStock: true });
    expect(c).toMatchObject({ quantity: 2, inStock: true });
  });

  it('reports a change in quantity alone (still in stock, fewer left)', () => {
    const a = variation('a', 5);

    const changed = applyFreshInventory([a], fresh({ a: 2 }));

    expect(changed).toEqual(['a']);
    expect(a).toMatchObject({ quantity: 2, inStock: true });
  });

  it('reports nothing when stock is as rendered', () => {
    const a = variation('a', 5);
    expect(applyFreshInventory([a], fresh({ a: 5 }))).toEqual([]);
  });

  it('leaves an unknown variation alone even though the server reports it as 0', () => {
    const a = variation('a', 5);

    const changed = applyFreshInventory([a], fresh({ a: 0 }, ['a']));

    expect(changed).toEqual([]);
    expect(a).toMatchObject({ quantity: 5, inStock: true });
  });

  it('leaves a variation the server did not mention alone', () => {
    const a = variation('a', 5);
    expect(applyFreshInventory([a], fresh({}))).toEqual([]);
    expect(a.quantity).toBe(5);
  });

  it('sets stock state for a variation that had none recorded', () => {
    const bare: ProductVariation = {
      id: 'a',
      variationId: 'a',
      name: 'a',
      price: 1,
    };

    expect(applyFreshInventory([bare], fresh({ a: 3 }))).toEqual(['a']);
    expect(bare).toMatchObject({ quantity: 3, inStock: true });
  });
});
