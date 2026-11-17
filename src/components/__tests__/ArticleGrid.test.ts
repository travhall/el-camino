// @vitest-environment node
/**
 * Regression tests for ArticleGrid's empty/error/loaded states (plan 191).
 * The grid is server-rendered, so an empty `posts` array must never render
 * skeletons — that made the homepage show permanent skeletons whenever
 * WordPress returned nothing.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, vi } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import ArticleGrid from '../ArticleGrid.astro';
import type { WordPressPost } from '@/lib/wordpress/types';

// The first render compiles ArticleGrid and its card components through Vite,
// which took 3.7 s alone and timed out (5 s default) under full-suite load,
// failing the pre-commit hook on clean code. A slow cold start is not a bug.
vi.setConfig({ testTimeout: 20_000 });

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

  // Plan 230. Chrome ignores an `opacity: 0` element as an LCP candidate, so
  // cards that start hidden make LCP wait for the script that reveals them
  // (2.0 s of /news's 4.1 s on throttled mobile). Cards in the first viewport
  // must be visible in the server HTML; the rest keep the scroll-in reveal.
  describe('filterable news grid: first cards are not hidden behind JS (plan 230)', () => {
    const posts: WordPressPost[] = Array.from({ length: 8 }, (_, i) => ({
      ...post,
      id: i + 1,
      slug: `post-${i + 1}`,
      title: { rendered: `Post ${i + 1}` },
    }));

    const wrapperClasses = (html: string): string[] =>
      [
        ...html.matchAll(
          /<div class="([^"]*\barticle-card-wrapper\b[^"]*)"[^>]*\brole="article"/g
        ),
      ].map((m) => m[1]);

    it('grid view: the first four cards are not hidden, the rest are', async () => {
      const html = await render({ posts, filterable: true, view: 'grid' });
      const classes = wrapperClasses(html);

      expect(classes).toHaveLength(8);
      classes.forEach((c, i) => {
        const tokens = c.split(/\s+/);
        expect(tokens.includes('opacity-0'), `card ${i}`).toBe(i >= 4);
        expect(tokens.includes('news-entrance'), `card ${i}`).toBe(i < 4);
      });
    });

    it('list view: the first two cards are not hidden, the rest are', async () => {
      const html = await render({ posts, filterable: true, view: 'list' });
      const classes = wrapperClasses(html);

      expect(classes).toHaveLength(8);
      classes.forEach((c, i) => {
        const tokens = c.split(/\s+/);
        expect(tokens.includes('opacity-0'), `card ${i}`).toBe(i >= 2);
        expect(tokens.includes('news-entrance'), `card ${i}`).toBe(i < 2);
      });
    });

    it('still marks every card for the filter and reveal scripts', async () => {
      const html = await render({ posts, filterable: true, view: 'grid' });

      expect(html.match(/data-initial-index="\d+"/g)).toHaveLength(8);
      expect(html.match(/data-variant="grid"/g)).toHaveLength(8);
    });

    it('the news page ships a noscript rule that shows the hidden cards', () => {
      // Without JS nothing reveals the cards that start `opacity-0`.
      const page = readFileSync(
        resolve(__dirname, '../../pages/news/index.astro'),
        'utf8'
      );
      const noscript = /<noscript>([\s\S]*?)<\/noscript>/.exec(page)?.[1] ?? '';

      expect(noscript).toContain('.article-card-wrapper.opacity-0');
      expect(noscript).toMatch(/opacity:\s*1/);
      expect(noscript).toMatch(/transform:\s*none/);
    });

    // The first cards use the home page's entrance (a CSS animation that starts
    // at opacity 0.001, so Chrome counts the card as an LCP candidate as soon
    // as its image paints) instead of a true opacity 0.
    describe('news-entrance reuses the home page entrance (plan 230)', () => {
      const source = readFileSync(
        resolve(__dirname, '../ArticleGrid.astro'),
        'utf8'
      );

      it('animates with a fade-only keyframe, paused until armed', () => {
        expect(source).toMatch(
          /\.article-card-wrapper\.news-entrance\s*\{[^}]*animation:\s*newsCardEntrance[^}]*animation-play-state:\s*paused/s
        );
        expect(source).toMatch(
          /\.article-card-wrapper\.news-entrance\.entrance-armed\s*\{[^}]*animation-play-state:\s*running/s
        );
      });

      it('the keyframe only animates opacity, from 0.001', () => {
        // A scale/translate in the entrance shrinks the card's painted area, and
        // measured on the preview a later full-size card then took over as the
        // LCP element (3.6 s vs 2.25 s). Opacity alone leaves the area intact.
        const frames =
          /@keyframes newsCardEntrance\s*\{([\s\S]*?)\n  \}/.exec(
            source
          )?.[1] ?? '';
        expect(frames).toMatch(/from\s*\{[^}]*opacity:\s*0\.001/);
        expect(frames).toMatch(/to\s*\{[^}]*opacity:\s*1/);
        expect(frames).not.toMatch(/transform|scale|translate/);
      });

      it('leaves no forwards fill, so the filter exit can still fade the card', () => {
        const rule =
          /\.article-card-wrapper\.news-entrance\s*\{([^}]*)\}/s.exec(
            source
          )?.[1] ?? '';
        expect(rule).toMatch(/animation:[^;]*\bbackwards\b/s);
        expect(rule).not.toMatch(/animation:[^;]*\b(both|forwards)\b/s);
      });

      it('is shown without animation when scripting is off or motion is reduced', () => {
        for (const query of [
          '@media (scripting: none)',
          '@media (prefers-reduced-motion: reduce)',
        ]) {
          const block = source.slice(source.indexOf(query));
          expect(block.slice(0, 500), query).toContain('news-entrance');
        }
      });

      it('is covered by the inline 2.5 s safety net that arms every card', () => {
        const net =
          /<script is:inline[\s\S]*?<\/script>/.exec(source)?.[0] ?? '';
        expect(net).toContain('news-entrance');
        expect(net).toContain('2500');
      });

      it('gives each first card its stagger order', async () => {
        const html = await render({ posts, filterable: true, view: 'grid' });
        expect(html).toMatch(/news-entrance[^>]*style="--animation-order: ?0/);
        expect(html).toMatch(/news-entrance[^>]*style="--animation-order: ?3/);
      });
    });
  });
});
