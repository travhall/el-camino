import { describe, it, expect } from 'vitest';
import { buildLineItems } from '../lineItems';
import type { CartItem } from '@/lib/cart/types';
import type { AuthoritativePrice } from '@/lib/square/pricing';

function makeItem(overrides: Partial<CartItem> = {}): CartItem {
  return {
    variationId: 'var-1',
    quantity: 2,
    ...overrides,
  } as CartItem;
}

function makePrice(
  overrides: Partial<AuthoritativePrice> = {}
): AuthoritativePrice {
  return {
    regularPrice: 20,
    salePrice: undefined,
    ...overrides,
  } as AuthoritativePrice;
}

describe('buildLineItems', () => {
  it('sets quantity, catalogObjectId, and itemType for each cart item', () => {
    const items = [makeItem({ variationId: 'var-1', quantity: 3 })];
    const result = buildLineItems(items, {}, 0, 'pickup');

    expect(result).toEqual([
      { quantity: '3', catalogObjectId: 'var-1', itemType: 'ITEM' },
    ]);
  });

  it('applies the sale price in cents when the catalog confirms an active sale', () => {
    const items = [makeItem({ variationId: 'var-1' })];
    const pricing = { 'var-1': makePrice({ salePrice: 15.5 }) };
    const result = buildLineItems(items, pricing, 0, 'pickup');

    expect(result[0].basePriceMoney).toEqual({
      amount: BigInt(1550),
      currency: 'USD',
    });
  });

  // Security-relevant fail-safe (lineItems.ts:22-27): when there is no
  // catalog-confirmed sale price, basePriceMoney is omitted entirely so
  // Square falls back to its own catalog price. This is what prevents a
  // client-supplied price from ever reaching the order.
  it('omits basePriceMoney when there is no catalog price for the item, so Square charges its own catalog price', () => {
    const items = [makeItem({ variationId: 'var-1' })];
    const result = buildLineItems(items, {}, 0, 'pickup');

    expect(result[0]).not.toHaveProperty('basePriceMoney');
  });

  it('omits basePriceMoney when the pricing lookup has no salePrice set', () => {
    const items = [makeItem({ variationId: 'var-1' })];
    const pricing = { 'var-1': makePrice({ salePrice: undefined }) };
    const result = buildLineItems(items, pricing, 0, 'pickup');

    expect(result[0]).not.toHaveProperty('basePriceMoney');
  });

  it('adds shipping as a custom line item when fulfillment is shipping and rate is positive', () => {
    const items = [makeItem()];
    const result = buildLineItems(items, {}, 5.99, 'shipping');

    expect(result).toHaveLength(2);
    expect(result[1]).toEqual({
      quantity: '1',
      itemType: 'ITEM',
      name: 'Shipping',
      basePriceMoney: { amount: BigInt(599), currency: 'USD' },
    });
  });

  it('omits the shipping line item when the rate is 0 (free shipping)', () => {
    const items = [makeItem()];
    const result = buildLineItems(items, {}, 0, 'shipping');

    expect(result).toHaveLength(1);
  });

  it('omits the shipping line item for pickup fulfillment even if a rate is passed', () => {
    const items = [makeItem()];
    const result = buildLineItems(items, {}, 5.99, 'pickup');

    expect(result).toHaveLength(1);
  });
});
