import { describe, it, expect } from 'vitest';
import { FEATURED_CARD_IMAGE_SIZES } from '../sizes';

describe('FEATURED_CARD_IMAGE_SIZES', () => {
  it('matches the featured card breakpoint exactly, so the LCP preload stays in sync', () => {
    expect(FEATURED_CARD_IMAGE_SIZES).toBe(
      '(max-width: 767px) 100vw, (max-width: 1535px) 67vw, 50vw',
    );
  });
});
