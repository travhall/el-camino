// @vitest-environment node
/**
 * Server-rendered output of the two filter sidebars (plan 234):
 * - ProductFilters: the first paint of the result count must match what the
 *   client writes once a filter changes ("N products" when nothing is filtered
 *   out), on mobile as well as desktop.
 * - NewsFilters: must not ship the filter options as a JSON blob for a
 *   `window.newsFilterOptions` global that nothing reads.
 */
import { describe, it, expect, vi } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import ProductFilters from '../ProductFilters.astro';
import NewsFilters from '../NewsFilters.astro';

// The first render compiles each component through Vite, which can exceed the
// 5 s default under full-suite load. A slow cold start is not a bug.
vi.setConfig({ testTimeout: 20_000 });

async function render(
  component: Parameters<AstroContainer['renderToString']>[0],
  props: Record<string, unknown>,
  url = 'http://localhost/'
): Promise<string> {
  const container = await AstroContainer.create();
  return container.renderToString(component, {
    props,
    locals: { nonce: 'test' },
    request: new Request(url),
  });
}

/** The text of every element carrying `data-result-count`. */
function resultCounts(html: string): string[] {
  return [
    ...html.matchAll(/<p[^>]*data-result-count[^>]*>([\s\S]*?)<\/p>/g),
  ].map((m) => m[1].replace(/\s+/g, ' ').trim());
}

describe('ProductFilters: first-paint result count', () => {
  const props = {
    filterOptions: { brands: [], categories: [] },
    categoryPath: 'skateboards',
  };

  it('reads "N products" in every count element when nothing is filtered out', async () => {
    const html = await render(ProductFilters, {
      ...props,
      totalProducts: 34,
      filteredCount: 34,
    });

    // Two elements: the mobile summary and the desktop one.
    expect(resultCounts(html)).toEqual(['34 products', '34 products']);
  });

  it('reads "X of N products" in every count element when filtered', async () => {
    const html = await render(ProductFilters, {
      ...props,
      totalProducts: 34,
      filteredCount: 4,
    });

    expect(resultCounts(html)).toEqual([
      '4 of 34 products',
      '4 of 34 products',
    ]);
  });
});

describe('NewsFilters: no unused options blob', () => {
  const filterOptions = {
    categories: [{ name: 'Shop News', slug: 'shop-news', count: 3 }],
    tags: [{ name: 'Skate', slug: 'skate', count: 2 }],
    authors: [],
    dateRanges: [],
  };

  it('does not serialise the filter options into the page', async () => {
    const html = await render(NewsFilters, {
      filterOptions,
      totalPosts: 11,
      filteredCount: 11,
    });

    expect(html).not.toContain('id="news-filter-options"');
    expect(html).not.toContain('application/json');
  });

  it('still renders the filters themselves', async () => {
    const html = await render(NewsFilters, {
      filterOptions,
      totalPosts: 11,
      filteredCount: 11,
    });

    expect(html).toContain('Shop News');
    expect(html).toContain('data-tag-chip="skate"');
  });
});
