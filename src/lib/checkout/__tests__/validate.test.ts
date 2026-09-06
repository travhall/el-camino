import { describe, it, expect } from 'vitest';
import { validateCheckoutBody, MAX_CART_ITEMS } from '../validate';

function baseItem(overrides: Record<string, unknown> = {}) {
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

const PICKUP_CONTACT = {
  name: 'Test Customer',
  email: 'test@example.com',
  phone: '5555555555',
};

function shippingBody(overrides: Record<string, unknown> = {}) {
  return {
    items: [baseItem()],
    fulfillmentMethod: 'shipping',
    shippingAddress: SHIPPING_ADDRESS,
    ...overrides,
  };
}

function pickupBody(overrides: Record<string, unknown> = {}) {
  return {
    items: [baseItem()],
    fulfillmentMethod: 'pickup',
    pickupContact: PICKUP_CONTACT,
    ...overrides,
  };
}

describe('validateCheckoutBody', () => {
  it('accepts a valid shipping body', () => {
    const result = validateCheckoutBody(shippingBody());
    expect(result.ok).toBe(true);
  });

  it('accepts a valid pickup body', () => {
    const result = validateCheckoutBody(pickupBody());
    expect(result.ok).toBe(true);
  });

  describe('quantity', () => {
    it.each([0, -1, 1.5, 1e9, '3'])('rejects quantity %p', (quantity) => {
      const result = validateCheckoutBody(
        shippingBody({ items: [baseItem({ quantity })] })
      );
      expect(result.ok).toBe(false);
    });
  });

  describe('items array bounds', () => {
    it('rejects an empty items array', () => {
      const result = validateCheckoutBody(shippingBody({ items: [] }));
      expect(result.ok).toBe(false);
    });

    it(`rejects items.length above ${MAX_CART_ITEMS}`, () => {
      const items = Array.from({ length: MAX_CART_ITEMS + 1 }, (_, i) =>
        baseItem({ variationId: `var-${i}` })
      );
      const result = validateCheckoutBody(shippingBody({ items }));
      expect(result.ok).toBe(false);
    });

    it(`accepts items.length of exactly ${MAX_CART_ITEMS}`, () => {
      const items = Array.from({ length: MAX_CART_ITEMS }, (_, i) =>
        baseItem({ variationId: `var-${i}` })
      );
      const result = validateCheckoutBody(shippingBody({ items }));
      expect(result.ok).toBe(true);
    });
  });

  describe('email', () => {
    it.each(['a@', '@b.com', 'a b@c.com', 'a'.repeat(500) + '@example.com'])(
      'rejects malformed email %p',
      (email) => {
        const result = validateCheckoutBody(
          shippingBody({
            shippingAddress: { ...SHIPPING_ADDRESS, email },
          })
        );
        expect(result.ok).toBe(false);
      }
    );
  });

  describe('checkoutKey', () => {
    it.each(['../../etc', 'a'.repeat(10000)])(
      'rejects malformed checkoutKey %p',
      (checkoutKey) => {
        const result = validateCheckoutBody(shippingBody({ checkoutKey }));
        expect(result.ok).toBe(false);
      }
    );

    it('accepts a UUID-shaped checkoutKey', () => {
      const result = validateCheckoutBody(
        shippingBody({ checkoutKey: '123e4567-e89b-12d3-a456-426614174000' })
      );
      expect(result.ok).toBe(true);
    });

    it('accepts an absent checkoutKey', () => {
      const result = validateCheckoutBody(shippingBody());
      expect(result.ok).toBe(true);
    });
  });

  describe('shippingAddress', () => {
    it('rejects a missing shippingAddress when fulfillmentMethod is shipping', () => {
      const result = validateCheckoutBody(
        shippingBody({ shippingAddress: undefined })
      );
      expect(result.ok).toBe(false);
    });

    it.each(['name', 'street1', 'city', 'state', 'zip'])(
      'rejects an over-long %s field',
      (field) => {
        const result = validateCheckoutBody(
          shippingBody({
            shippingAddress: { ...SHIPPING_ADDRESS, [field]: 'x'.repeat(500) },
          })
        );
        expect(result.ok).toBe(false);
      }
    );
  });

  describe('pickupContact', () => {
    it('rejects a missing pickupContact when fulfillmentMethod is pickup', () => {
      const result = validateCheckoutBody(
        pickupBody({ pickupContact: undefined })
      );
      expect(result.ok).toBe(false);
    });
  });

  describe('malformed top-level body', () => {
    it('rejects a non-object body', () => {
      expect(validateCheckoutBody(null).ok).toBe(false);
      expect(validateCheckoutBody('nope').ok).toBe(false);
    });

    it('rejects an invalid fulfillmentMethod', () => {
      const result = validateCheckoutBody(
        shippingBody({ fulfillmentMethod: 'teleport' })
      );
      expect(result.ok).toBe(false);
    });
  });
});
