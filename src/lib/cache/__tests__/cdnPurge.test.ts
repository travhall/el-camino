import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@netlify/functions', () => ({
  purgeCache: vi.fn().mockResolvedValue(undefined),
}));

import { purgeCache } from '@netlify/functions';
import {
  productCacheTags,
  purgeProductPages,
  productTag,
  variationTag,
} from '../cdnPurge';

beforeEach(() => {
  vi.mocked(purgeCache).mockReset().mockResolvedValue(undefined);
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('productCacheTags', () => {
  it('carries the product, the catch-all, extras and each variation', () => {
    expect(productCacheTags('P1', ['V1', 'V2'], ['quick-view'])).toEqual([
      'product-P1',
      'products',
      'quick-view',
      'variation-V1',
      'variation-V2',
    ]);
  });

  it('works with no variations or extras', () => {
    expect(productCacheTags('P1')).toEqual(['product-P1', 'products']);
  });

  it('drops empty ids and de-duplicates', () => {
    expect(productCacheTags('P1', ['V1', '', 'V1'])).toEqual([
      'product-P1',
      'products',
      'variation-V1',
    ]);
  });

  it('uses the same tag builders the purge does', () => {
    expect(productCacheTags('P1', ['V1'])).toContain(productTag('P1'));
    expect(productCacheTags('P1', ['V1'])).toContain(variationTag('V1'));
  });
});

describe('purgeProductPages', () => {
  it('purges the variation and product tags', async () => {
    const ok = await purgeProductPages({
      productIds: ['P1'],
      variationIds: ['V1', 'V2'],
    });

    expect(ok).toBe(true);
    expect(purgeCache).toHaveBeenCalledTimes(1);
    expect(purgeCache).toHaveBeenCalledWith({
      tags: ['product-P1', 'variation-V1', 'variation-V2'],
    });
  });

  it('does nothing when there is nothing to purge (an empty tag list must never reach the API)', async () => {
    expect(await purgeProductPages({})).toBe(true);
    expect(
      await purgeProductPages({ productIds: [''], variationIds: [] })
    ).toBe(true);
    expect(purgeCache).not.toHaveBeenCalled();
  });

  it('de-duplicates ids', async () => {
    await purgeProductPages({ variationIds: ['V1', 'V1'] });
    expect(purgeCache).toHaveBeenCalledWith({ tags: ['variation-V1'] });
  });

  it('splits a large set into batches', async () => {
    const ids = Array.from({ length: 250 }, (_, i) => `V${i}`);
    await purgeProductPages({ variationIds: ids });

    expect(purgeCache).toHaveBeenCalledTimes(3);
    const sizes = vi
      .mocked(purgeCache)
      .mock.calls.map((c) => c[0]?.tags?.length);
    expect(sizes).toEqual([100, 100, 50]);
  });

  it('purges every product page instead for a bulk change', async () => {
    const ids = Array.from({ length: 600 }, (_, i) => `O${i}`);
    await purgeProductPages({ productIds: ids, variationIds: ids });

    expect(purgeCache).toHaveBeenCalledTimes(1);
    expect(purgeCache).toHaveBeenCalledWith({ tags: ['products'] });
  });

  it('never throws: a failed purge is logged and reported', async () => {
    vi.mocked(purgeCache).mockRejectedValue(new Error('no credentials'));

    await expect(purgeProductPages({ variationIds: ['V1'] })).resolves.toBe(
      false
    );
    expect(console.warn).toHaveBeenCalled();
  });
});
