import { describe, it, expect } from 'vitest';
import {
  assignProductImagesToVariations,
  heroImageForVariation,
} from '../variationImages';
import type { ProductVariation } from '../types';

const v = (
  id: string,
  attributes: Record<string, string> | undefined,
  extra: Partial<ProductVariation> = {}
): ProductVariation => ({
  id,
  variationId: id,
  name: id,
  price: 10,
  attributes,
  ...extra,
});

describe('assignProductImagesToVariations', () => {
  describe('color variants (item-level images, one per color)', () => {
    const make = () => [
      v('black-s', { color: 'Black', size: 'S' }),
      v('black-m', { color: 'Black', size: 'M' }),
      v('white-s', { color: 'White', size: 'S' }),
      v('white-l', { color: 'White', size: 'L' }),
    ];

    it('maps one image per color, in the order colors first appear', () => {
      const variations = make();
      assignProductImagesToVariations(variations, ['black.jpg', 'white.jpg']);

      expect(variations.map((x) => x.image)).toEqual([
        'black.jpg',
        'black.jpg',
        'white.jpg',
        'white.jpg',
      ]);
    });

    it('does not set the multi-image array in the color case', () => {
      const variations = make();
      assignProductImagesToVariations(variations, ['black.jpg', 'white.jpg']);
      expect(variations.every((x) => x.images === undefined)).toBe(true);
    });

    it("never overwrites a variation's own image", () => {
      const variations = make();
      variations[2].image = 'white-own.jpg';
      assignProductImagesToVariations(variations, ['black.jpg', 'white.jpg']);

      expect(variations[2].image).toBe('white-own.jpg');
      expect(variations[3].image).toBe('white.jpg');
    });

    it('maps nothing when there are fewer images than colors', () => {
      const variations = make();
      // 3 colors but only 2 images
      variations.push(v('red-s', { color: 'Red', size: 'S' }));
      assignProductImagesToVariations(variations, ['a.jpg', 'b.jpg']);

      expect(variations.every((x) => x.image === undefined)).toBe(true);
    });

    it('accepts the "colour" spelling, case-insensitively', () => {
      const variations = [
        v('a', { Colour: 'Red' }),
        v('b', { Colour: 'Blue' }),
      ];
      assignProductImagesToVariations(variations, ['red.jpg', 'blue.jpg']);

      expect(variations.map((x) => x.image)).toEqual(['red.jpg', 'blue.jpg']);
    });

    it('leaves a variation with no value for the color attribute unmapped', () => {
      const variations = [
        v('a', { color: 'Red' }),
        v('b', { color: 'Blue' }),
        v('c', { color: '' }),
      ];
      assignProductImagesToVariations(variations, ['red.jpg', 'blue.jpg']);

      expect(variations.map((x) => x.image)).toEqual([
        'red.jpg',
        'blue.jpg',
        undefined,
      ]);
    });
  });

  describe('no color attribute (shared multi-angle images)', () => {
    it('gives every variation the full image array and the first as its image', () => {
      const variations = [
        v('8.0', { size: '8.0' }),
        v('8.25', { size: '8.25' }),
      ];
      const images = ['front.jpg', 'back.jpg', 'detail.jpg'];
      assignProductImagesToVariations(variations, images);

      for (const x of variations) {
        expect(x.images).toEqual(images);
        expect(x.image).toBe('front.jpg');
      }
    });

    it("keeps a variation's own image but still fills its gallery", () => {
      const variations = [v('a', { size: 'S' }, { image: 'own.jpg' })];
      assignProductImagesToVariations(variations, ['x.jpg', 'y.jpg']);

      expect(variations[0].image).toBe('own.jpg');
      expect(variations[0].images).toEqual(['x.jpg', 'y.jpg']);
    });

    it("keeps a variation's own multi-image set", () => {
      const own = ['own1.jpg', 'own2.jpg'];
      const variations = [v('a', { size: 'S' }, { images: own })];
      assignProductImagesToVariations(variations, ['x.jpg', 'y.jpg']);

      expect(variations[0].images).toBe(own);
    });

    it('treats unparsed (undefined) attributes as having no color', () => {
      const variations = [v('a', undefined)];
      assignProductImagesToVariations(variations, ['x.jpg', 'y.jpg']);

      expect(variations[0].images).toEqual(['x.jpg', 'y.jpg']);
    });
  });

  describe('no-ops', () => {
    it.each([
      ['undefined', undefined],
      ['empty', []],
      ['a single image', ['only.jpg']],
    ])('does nothing for %s', (_label, images) => {
      const variations = [v('a', { color: 'Red' }), v('b', { size: 'S' })];
      assignProductImagesToVariations(variations, images);

      expect(variations.every((x) => !x.image && !x.images)).toBe(true);
    });

    it('does nothing for an empty variation list', () => {
      expect(() =>
        assignProductImagesToVariations([], ['a.jpg', 'b.jpg'])
      ).not.toThrow();
    });
  });
});

describe('heroImageForVariation', () => {
  it("prefers the selected variation's own image", () => {
    expect(heroImageForVariation('primary.jpg', { image: 'white.jpg' })).toBe(
      'white.jpg'
    );
  });

  it('falls back to the product image when the variation has none', () => {
    expect(heroImageForVariation('primary.jpg', {})).toBe('primary.jpg');
    expect(heroImageForVariation('primary.jpg', { image: '' })).toBe(
      'primary.jpg'
    );
    expect(heroImageForVariation('primary.jpg', undefined)).toBe('primary.jpg');
  });

  it('picks up the image the item-level mapping assigns, for a non-first color', () => {
    // The bug this guards: a promoted default (or ?variant=) on White while
    // the item's primary image is Black's.
    const variations = [
      v('black-s', { color: 'Black', size: 'S' }),
      v('white-s', { color: 'White', size: 'S' }),
    ];
    assignProductImagesToVariations(variations, ['black.jpg', 'white.jpg']);

    expect(heroImageForVariation('black.jpg', variations[1])).toBe('white.jpg');
    expect(heroImageForVariation('black.jpg', variations[0])).toBe('black.jpg');
  });
});
