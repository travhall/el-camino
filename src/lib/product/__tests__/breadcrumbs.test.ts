import { describe, it, expect } from 'vitest';
import { getBackLink, type BreadcrumbPath } from '../breadcrumbs';

const path = (items: Array<[string, string]>): BreadcrumbPath => ({
  items: items.map(([name, url], i) => ({ name, url, position: i + 1 })),
  structuredData: {},
});

describe('getBackLink', () => {
  it('goes to the most specific category', () => {
    const p = path([
      ['Home', '/'],
      ['Apparel', '/category/apparel'],
      ['Hoodies', '/category/hoodies'],
      ['Thrasher', '/shop/all?brands=Thrasher'],
      ['Flame Hoodie', '/product/flame-hoodie'],
    ]);

    expect(getBackLink(p)).toEqual({
      name: 'Hoodies',
      url: '/category/hoodies',
    });
  });

  it('skips the brand crumb: it is a filtered shop view, not where a shopper came from', () => {
    const p = path([
      ['Home', '/'],
      ['Decks', '/category/decks'],
      ['Real', '/shop/all?brands=Real'],
      ['Some Deck', '/product/some-deck'],
    ]);

    expect(getBackLink(p).url).toBe('/category/decks');
  });

  it('falls back to the shop when the product has no category', () => {
    const p = path([
      ['Home', '/'],
      ['Thrasher', '/shop/all?brands=Thrasher'],
      ['Mystery Item', '/product/mystery-item'],
    ]);

    expect(getBackLink(p)).toEqual({ name: 'Shop', url: '/shop/all' });
  });

  it('falls back to the shop when the breadcrumb path could not be built', () => {
    expect(getBackLink(undefined)).toEqual({ name: 'Shop', url: '/shop/all' });
  });
});
