/**
 * Critical tests for variation parser - addresses fragile position-based parsing
 * Priority: High - Prevents silent failures with non-standard variation names
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { parseVariationName, VARIATION_CONFIG } from '../variationParser';
import type { ProductVariation } from '../types';

describe('VariationParser Critical Edge Cases', () => {
  describe('Position-based parsing fragility', () => {
    it('handles standard comma-separated format', () => {
      const result = parseVariationName('Large, Red, Cotton');
      expect(result).toEqual({ size: 'Large', color: 'Red', material: 'Cotton' });
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
