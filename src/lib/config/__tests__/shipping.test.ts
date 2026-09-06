import { describe, it, expect } from 'vitest';
import {
  calculateShippingRate,
  FREE_SHIPPING_THRESHOLD_DOLLARS,
  FLAT_RATE_SHIPPING_DOLLARS,
  SHIPPING_RATES,
} from '../shipping';

describe('shipping config constants', () => {
  it('derives the free shipping threshold from SHIPPING_RATES', () => {
    expect(FREE_SHIPPING_THRESHOLD_DOLLARS).toBe(75);
  });

  it('derives the flat rate shipping cost from SHIPPING_RATES', () => {
    expect(FLAT_RATE_SHIPPING_DOLLARS).toBe(5.99);
  });

  it("fails loudly if the 'free' or 'standard' rate is ever removed", () => {
    expect(SHIPPING_RATES.find((r) => r.id === 'free')).toBeDefined();
    expect(SHIPPING_RATES.find((r) => r.id === 'standard')).toBeDefined();
  });
});

describe('calculateShippingRate', () => {
  it('charges the standard rate below the free-shipping threshold', () => {
    expect(calculateShippingRate(FREE_SHIPPING_THRESHOLD_DOLLARS - 0.01)).toBe(
      FLAT_RATE_SHIPPING_DOLLARS
    );
  });

  it('is free exactly at the threshold — comparator is >=', () => {
    expect(calculateShippingRate(FREE_SHIPPING_THRESHOLD_DOLLARS)).toBe(0);
  });

  it('is free above the threshold', () => {
    expect(calculateShippingRate(FREE_SHIPPING_THRESHOLD_DOLLARS + 25)).toBe(0);
  });

  it('charges the standard rate for a zero subtotal', () => {
    expect(calculateShippingRate(0)).toBe(FLAT_RATE_SHIPPING_DOLLARS);
  });

  it('charges the standard rate for a negative subtotal (characterizes current behavior — not expected in production)', () => {
    expect(calculateShippingRate(-10)).toBe(FLAT_RATE_SHIPPING_DOLLARS);
  });
});
