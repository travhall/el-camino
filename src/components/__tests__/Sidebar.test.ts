// @vitest-environment node
/**
 * Plan 231. On the home page "Shop by Category" sits below the article grid, off
 * screen on mobile and desktop alike, yet its first two category images were
 * `loading="eager"` / `fetchpriority="high"`. Together with the LCP hero and the
 * second article image they started within ~60 ms of it and shared the throttled
 * link (home LCP 4.4 s, the hero's 92 KB taking 3.1-3.7 s). Off-screen images
 * must not outrank the LCP image.
 */
import { describe, it, expect, vi } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';

vi.mock('@/lib/square/categoryNav', () => ({
  getCategoriesForSidebar: vi.fn().mockResolvedValue(
    ['Decks', 'Trucks', 'Wheels', 'Bearings'].map((category, i) => ({
      id: `cat-${i}`,
      category,
      url: `/category/${category.toLowerCase()}`,
    }))
  ),
}));
vi.mock('@/lib/square/categoryImages', () => ({
  getCategoryImageUrls: vi.fn().mockResolvedValue({}),
}));

import Sidebar from '../Sidebar.astro';

// First render compiles through Vite; see ArticleGrid.test.ts.
vi.setConfig({ testTimeout: 20_000 });

describe('Sidebar category images (plan 231)', () => {
  it('none is eager or high priority: the sidebar is below the fold', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(Sidebar, {
      locals: { nonce: 'test' },
      request: new Request('http://localhost/'),
    });

    const imgs = html.match(/<img\b[^>]*class="category-img[^>]*>/g) ?? [];
    expect(imgs).toHaveLength(4);
    for (const img of imgs) {
      expect(img).toContain('loading="lazy"');
      expect(img).not.toContain('fetchpriority="high"');
      expect(img).not.toContain('loading="eager"');
      expect(img).not.toContain('decoding="sync"');
    }
  });
});
