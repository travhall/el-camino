// @vitest-environment node
/**
 * Regression tests for ArticleGrid's empty/error/loaded states (plan 191).
 * The grid is server-rendered, so an empty `posts` array must never render
 * skeletons — that made the homepage show permanent skeletons whenever
 * WordPress returned nothing.
 */
import { describe, it, expect } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import ArticleGrid from '../ArticleGrid.astro';
import type { WordPressPost } from '@/lib/wordpress/types';

const post: WordPressPost = {
  id: 1,
  date: '2026-01-01T00:00:00',
  modified: '2026-01-01T00:00:00',
  slug: 'test-post',
  title: { rendered: 'Test Post Title' },
  excerpt: { rendered: '<p>Excerpt</p>' },
  content: { rendered: '<p>Content</p>' },
};

async function render(props: Record<string, unknown>): Promise<string> {
  const container = await AstroContainer.create();
  return container.renderToString(ArticleGrid, {
    props,
    locals: { nonce: 'test' },
    request: new Request('http://localhost/'),
  });
}

describe('ArticleGrid', () => {
  it('renders the empty state, not skeletons, when posts is empty', async () => {
    const html = await render({ posts: [], showSidebar: true });
    expect(html).toContain('Nothing new on the wall yet');
    expect(html).toContain('href="/shop/all"');
    expect(html).not.toContain('loading-article-card');
    expect(html).not.toContain('Loading article...');
  });

  it('makes the empty state span the full grid width', async () => {
    const html = await render({ posts: [], showSidebar: true });
    expect(html).toMatch(
      /<div class="[^"]*text-center[^"]*col-span-full[^"]*"/
    );
  });

  it('renders only the error banner when posts is empty and error is set', async () => {
    const html = await render({
      posts: [],
      error: 'We could not load the news.',
      showSidebar: true,
    });
    expect(html).toContain('We could not load the news.');
    expect(html).not.toContain('Nothing new on the wall yet');
    expect(html).not.toContain('loading-article-card');
  });

  it('renders cards and no empty state when posts exist', async () => {
    const html = await render({ posts: [post], showSidebar: true });
    expect(html).toContain('Test Post Title');
    expect(html).not.toContain('Nothing new on the wall yet');
    expect(html).not.toContain('loading-article-card');
  });
});
