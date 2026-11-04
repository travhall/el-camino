/**
 * Critical tests for variation parser - addresses fragile position-based parsing
 * Priority: High - Prevents silent failures with non-standard variation names
 */

import { describe, it, expect } from 'vitest';
import {
  parseVariationName,
  resolveVariationForSelection,
  VARIATION_CONFIG,
  isAttributeValueAvailable,
} from '../variationParser';
import type { ProductVariation } from '../types';

describe('VariationParser Critical Edge Cases', () => {
  describe('Position-based parsing fragility', () => {
    it('handles standard comma-separated format', () => {
      const result = parseVariationName('Large, Red, Cotton');
      expect(result).toEqual({
        size: 'Large',
        color: 'Red',
        material: 'Cotton',
      });
    });

    it('handles non-standard variation names gracefully', () => {
      const result = parseVariationName('Non-Standard Format');
      expect(result).toBeDefined();
    });

    it('handles empty variation names', () => {
      const result = parseVariationName('');
      expect(result).toEqual({});
    });

    it('handles single attribute variations that match a size heuristic', () => {
      // 'Large' matches detectAttributeType's size word list, so it is now
      // classified as 'size' rather than the generic 'variant' fallback.
      const result = parseVariationName('Large');
      expect(result).toEqual({ size: 'Large' });
    });

    it('detects color for single-token variation names', () => {
      expect(parseVariationName('Black')).toEqual({ color: 'Black' });
      expect(parseVariationName('Orange')).toEqual({ color: 'Orange' });
      expect(parseVariationName('Denim')).toEqual({ color: 'Denim' });
    });

    it('detects material for a single-token variation name', () => {
      expect(parseVariationName('Cotton')).toEqual({ material: 'Cotton' });
    });

    it('detects size for a bare numeric single-token variation name', () => {
      expect(parseVariationName('28')).toEqual({ size: '28' });
    });

    it('falls back to variant for single-token names matching no heuristic', () => {
      // Gift-card denominations like "$25" have no color/material/size match.
      expect(parseVariationName('$25')).toEqual({ variant: '$25' });
    });

    it('handles variations with extra commas', () => {
      const result = parseVariationName('Large,, Red,, Cotton');
      expect(result).toBeDefined();
    });
  });

  describe('Configuration validation', () => {
    it('has proper attribute mappings', () => {
      expect(VARIATION_CONFIG.attributeMappings).toBeDefined();
      expect(VARIATION_CONFIG.displayNames).toBeDefined();
    });

    it('handles different part counts', () => {
      expect(parseVariationName('A')).toBeDefined();
      expect(parseVariationName('A, B')).toBeDefined();
      expect(parseVariationName('A, B, C')).toBeDefined();
    });
  });
});

describe('resolveVariationForSelection', () => {
  const v = (
    id: string,
    attributes: Record<string, string>,
    inStock: boolean
  ): ProductVariation => ({
    id,
    variationId: id,
    name: Object.values(attributes).join(', '),
    price: 10,
    quantity: inStock ? 5 : 0,
    inStock,
    attributes,
  });

  // Matrix: Black/S (in), Black/M (sold out), White/S (in), White/L (in).
  // Black/L and White/M do not exist.
  const variations = [
    v('black-s', { color: 'Black', size: 'S' }, true),
    v('black-m', { color: 'Black', size: 'M' }, false),
    v('white-s', { color: 'White', size: 'S' }, true),
    v('white-l', { color: 'White', size: 'L' }, true),
  ];

  const resolve = (
    selected: Record<string, string>,
    type: string,
    value: string
  ) => resolveVariationForSelection(variations, selected, type, value)?.id;

  it('returns the exact combination when it exists', () => {
    expect(resolve({ color: 'Black', size: 'S' }, 'color', 'White')).toBe(
      'white-s'
    );
  });

  it('returns an exact combination even when it is sold out', () => {
    expect(resolve({ color: 'Black', size: 'S' }, 'size', 'M')).toBe('black-m');
  });

  it('snaps to the only variation carrying the value when the combination does not exist', () => {
    // Black/L doesn't exist; only White/L has size L
    expect(resolve({ color: 'Black', size: 'S' }, 'size', 'L')).toBe('white-l');
  });

  it('prefers the candidate that keeps the most other selections', () => {
    // White/M doesn't exist. Candidates with M: Black/M only -> snap there.
    expect(resolve({ color: 'White', size: 'S' }, 'size', 'M')).toBe('black-m');
  });

  it('prefers an in-stock candidate when several keep the same number of selections', () => {
    const sparse = [
      v('s-blue', { size: 'S', color: 'Blue' }, true),
      v('l-red', { size: 'L', color: 'Red' }, false),
      v('l-green', { size: 'L', color: 'Green' }, true),
    ];
    expect(
      resolveVariationForSelection(
        sparse,
        { size: 'S', color: 'Blue' },
        'size',
        'L'
      )?.id
    ).toBe('l-green');
  });

  it('falls back to catalog order when stock and kept selections tie', () => {
    const tied = [
      v('a', { size: 'S', color: 'Blue' }, true),
      v('b', { size: 'L', color: 'Red' }, true),
      v('c', { size: 'L', color: 'Green' }, true),
    ];
    expect(
      resolveVariationForSelection(
        tied,
        { size: 'S', color: 'Blue' },
        'size',
        'L'
      )?.id
    ).toBe('b');
  });

  it('returns undefined when no variation has the value', () => {
    expect(
      resolve({ color: 'Black', size: 'S' }, 'size', 'XXL')
    ).toBeUndefined();
  });

  it('does not mutate the selection or the variations list', () => {
    const selected = { color: 'Black', size: 'S' };
    const order = variations.map((x) => x.id);
    resolveVariationForSelection(variations, selected, 'size', 'L');
    expect(selected).toEqual({ color: 'Black', size: 'S' });
    expect(variations.map((x) => x.id)).toEqual(order);
  });
});

describe('isAttributeValueAvailable', () => {
  const makeVariation = (
    overrides: Partial<ProductVariation>
  ): ProductVariation => ({
    id: overrides.id ?? 'id-default',
    variationId: overrides.variationId ?? 'var-default',
    name: overrides.name ?? '',
    price: overrides.price ?? 0,
    ...overrides,
  });

  const variations: ProductVariation[] = [
    makeVariation({
      variationId: 'v-30-denim',
      attributes: { size: '30', color: 'Denim' },
      inStock: true,
    }),
    makeVariation({
      variationId: 'v-32-denim',
      attributes: { size: '32', color: 'Denim' },
      inStock: false,
    }),
    makeVariation({
      variationId: 'v-30-black',
      attributes: { size: '30', color: 'Black' },
      inStock: false,
    }),
    makeVariation({
      variationId: 'v-32-black',
      attributes: { size: '32', color: 'Black' },
      inStock: true,
    }),
  ];

  it('returns true when the combination is in stock', () => {
    expect(
      isAttributeValueAvailable(variations, { color: 'Denim' }, 'size', '30')
    ).toBe(true);
  });

  it('returns false when the combination exists but is out of stock', () => {
    expect(
      isAttributeValueAvailable(variations, { color: 'Denim' }, 'size', '32')
    ).toBe(false);
  });

  it('agrees with a click when the combination does not exist: snaps to the nearest variation with that value', () => {
    // No Green exists, so selecting size 30 lands on 30/Denim (in stock)
    expect(
      isAttributeValueAvailable(variations, { color: 'Green' }, 'size', '30')
    ).toBe(true);
    expect(
      resolveVariationForSelection(variations, { color: 'Green' }, 'size', '30')
        ?.variationId
    ).toBe('v-30-denim');
  });

  it('returns false when no variation has the value at all', () => {
    expect(
      isAttributeValueAvailable(variations, { color: 'Denim' }, 'size', '34')
    ).toBe(false);
  });

  it('returns different results for the same value depending on the current selection (regression: not a bare "any variation" check)', () => {
    const availableWithBlack = isAttributeValueAvailable(
      variations,
      { color: 'Black' },
      'size',
      '32'
    );
    const availableWithDenim = isAttributeValueAvailable(
      variations,
      { color: 'Denim' },
      'size',
      '32'
    );
    expect(availableWithBlack).toBe(true);
    expect(availableWithDenim).toBe(false);
  });

  it('matches any variation with that value in stock when currentAttributes is empty', () => {
    expect(isAttributeValueAvailable(variations, {}, 'size', '30')).toBe(true);
  });
});
