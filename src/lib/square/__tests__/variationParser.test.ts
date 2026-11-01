/**
 * Critical tests for variation parser - addresses fragile position-based parsing
 * Priority: High - Prevents silent failures with non-standard variation names
 */

import { describe, it, expect } from 'vitest';
import {
  parseVariationName,
  resolveVariationForSelection,
  VARIATION_CONFIG,
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

    it('handles single attribute variations', () => {
      const result = parseVariationName('Large');
      expect(result).toEqual({ variant: 'Large' });
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
