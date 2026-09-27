/**
 * Critical tests for variation parser - addresses fragile position-based parsing
 * Priority: High - Prevents silent failures with non-standard variation names
 */

import { describe, it, expect } from 'vitest';
import { parseVariationName, VARIATION_CONFIG } from '../variationParser';

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
