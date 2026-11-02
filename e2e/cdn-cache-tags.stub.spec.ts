import { test, expect } from '@playwright/test';
import { TEE, DECK } from './fixtures/square-catalog.mjs';

/**
 * The PDP and the quick-view API carry cache tags per product and per
 * variation. The Square webhook purges those tags when stock changes
 * (lib/cache/cdnPurge.ts), so what the pages emit has to match what the
 * webhook builds: a variation tag per variation, or a stock change would
 * purge nothing. The CDN itself isn't served under the stub, so this checks
 * the headers the real pages send.
 */

const tagsOf = (headers: Record<string, string>) =>
  (headers['netlify-cache-tag'] ?? '').split(',').filter(Boolean);

for (const product of [TEE, DECK]) {
  test.describe(`cache tags: ${product.name}`, () => {
    const variationTags = product.variations.map((v) => `variation-${v.id}`);

    test('the product page is tagged by product and by every variation', async ({
      request,
    }) => {
      const res = await request.get(`/product/${product.id}`);
      expect(res.ok()).toBe(true);

      const tags = tagsOf(res.headers());
      expect(tags).toEqual(
        expect.arrayContaining([
          `product-${product.id}`,
          'products',
          ...variationTags,
        ])
      );
    });

    test('the quick-view response is tagged the same way', async ({
      request,
    }) => {
      const res = await request.get(`/api/quick-view-product?id=${product.id}`);
      expect(res.ok()).toBe(true);

      const tags = tagsOf(res.headers());
      expect(tags).toEqual(
        expect.arrayContaining([
          `product-${product.id}`,
          'products',
          'quick-view',
          ...variationTags,
        ])
      );
    });
  });
}
