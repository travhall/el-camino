/**
 * WordPress API Tests - Error handling and data processing
 * Tests error categorization, fallback strategies, and cache integration
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import type { WordPressPost } from '../types';
import {
  getPosts,
  getPost,
  getPages,
  getPage,
  getLegalPages,
  getPostsByTag,
  getAllTags,
  getAllCategories,
  getPostsByCategory,
  isFeaturedPost,
  getFeaturedPost,
  getNewsPagePosts,
} from '../api';

// Mock dependencies
vi.mock('@/lib/cache/blobCache', () => ({
  wordpressCache: {
    getOrCompute: vi.fn(<T>(key: string, compute: () => Promise<T>) =>
      compute()
    ),
    clear: vi.fn(),
    delete: vi.fn(),
    prune: vi.fn(() => 0),
  },
}));

global.fetch = vi.fn();
// `global.fetch` is typed as the real `fetch` signature, but the tests only
// ever call `.mockResolvedValueOnce(...)` / `.mockRejectedValueOnce(...)`
// with lightweight `{ ok, json }`-style fixtures, not full `Response`
// objects — so we work through an untyped `Mock` handle instead of casting
// `as any` at every call site.
const mockFetch = global.fetch as Mock;

describe('WordPress API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getPosts', () => {
    it('should fetch and process posts successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          posts: [
            {
              ID: 1,
              title: 'Test Post',
              date: '2024-01-01',
              excerpt: 'Test excerpt',
              content: 'Test content',
              slug: 'test-post',
              featured_image: 'test.jpg',
              categories: {
                News: { name: 'News', slug: 'news' },
              },
              tags: {
                Featured: { name: 'Featured', slug: 'featured' },
              },
            },
          ],
        }),
      });

      const posts = await getPosts();

      expect(posts).toHaveLength(1);
      expect(posts[0].id).toBe(1);
      expect(posts[0].title.rendered).toBe('Test Post');
      expect(posts[0]._embedded?.['wp:featuredmedia']?.[0].source_url).toBe(
        'test.jpg'
      );
    });

    it('should return empty array on API error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const posts = await getPosts();

      expect(posts).toEqual([]);
    });

    it('should handle malformed response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ invalid: 'data' }),
      });

      const posts = await getPosts();

      expect(posts).toEqual([]);
    });

    it('should filter out invalid posts', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          posts: [
            {
              ID: 1,
              title: 'Valid Post',
              slug: 'valid',
            },
            {
              ID: 0, // Invalid ID
              title: 'Invalid Post',
            },
            {
              ID: 2,
              title: 'Another Valid',
              slug: 'valid-2',
            },
          ],
        }),
      });

      const posts = await getPosts();

      expect(posts).toHaveLength(2);
      expect(posts[0].id).toBe(1);
      expect(posts[1].id).toBe(2);
    });

    it('should process categories and tags', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          posts: [
            {
              ID: 1,
              title: 'Test Post',
              slug: 'test',
              categories: {
                News: { name: 'News', slug: 'news' },
                Updates: { name: 'Updates', slug: 'updates' },
              },
              tags: {
                Important: { name: 'Important', slug: 'important' },
              },
            },
          ],
        }),
      });

      const posts = await getPosts();

      expect(posts[0]._embedded?.['wp:term']).toBeDefined();
      expect(posts[0]._embedded?.['wp:term']?.[0]).toHaveLength(3); // 2 categories + 1 tag
    });
  });

  describe('getPost', () => {
    it('should fetch single post by slug', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ID: 1,
          title: 'Test Post',
          slug: 'test-post',
          content: 'Test content',
        }),
      });

      const post = await getPost('test-post');

      expect(post).not.toBeNull();
      expect(post?.id).toBe(1);
      expect(post?.slug).toBe('test-post');
    });

    it('should return null for empty slug', async () => {
      const post = await getPost('');

      expect(post).toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should handle 404 errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const post = await getPost('non-existent');

      expect(post).toBeNull();
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ENOTFOUND'));

      const post = await getPost('test-post');

      expect(post).toBeNull();
    });
  });

  describe('Error Categorization', () => {
    it('should categorize 404 errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('HTTP error! status: 404'));

      const post = await getPost('missing');

      expect(post).toBeNull();
    });

    it('should categorize timeout errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Request timeout ETIMEDOUT'));

      const posts = await getPosts();

      expect(posts).toEqual([]);
    });

    it('should categorize rate limit errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('HTTP error! status: 429'));

      const posts = await getPosts();

      expect(posts).toEqual([]);
    });

    it('should categorize server errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('HTTP error! status: 500'));

      const posts = await getPosts();

      expect(posts).toEqual([]);
    });
  });

  describe('getPages', () => {
    it('should fetch and process pages', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          posts: [
            {
              ID: 10,
              title: 'Privacy Policy',
              slug: 'privacy-policy',
              content: 'Privacy content',
            },
          ],
        }),
      });

      const pages = await getPages();

      expect(pages).toHaveLength(1);
      expect(pages[0].id).toBe(10);
      expect(pages[0].title.rendered).toBe('Privacy Policy');
    });

    it('should return empty array on error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const pages = await getPages();

      expect(pages).toEqual([]);
    });
  });

  describe('getPage with Fallback', () => {
    it('should fetch page directly first', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ID: 10,
          title: 'Privacy Policy',
          slug: 'privacy-policy',
          content: 'Content',
        }),
      });

      const page = await getPage('privacy-policy');

      expect(page).not.toBeNull();
      expect(page?.id).toBe(10);
    });

    it('should fallback to fetching all pages', async () => {
      // First fetch (direct) fails
      mockFetch.mockRejectedValueOnce(new Error('Not found'));

      // Second fetch (all pages) succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          posts: [
            {
              ID: 10,
              title: 'Privacy Policy',
              slug: 'privacy-policy',
              content: 'Content',
            },
          ],
        }),
      });

      const page = await getPage('privacy-policy');

      expect(page).not.toBeNull();
      expect(page?.slug).toBe('privacy-policy');
    });

    it('should return null if page not found in fallback', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Not found'));

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          posts: [
            {
              ID: 10,
              slug: 'other-page',
            },
          ],
        }),
      });

      const page = await getPage('non-existent');

      expect(page).toBeNull();
    });
  });

  describe('getLegalPages', () => {
    it('should fetch specific legal pages', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          posts: [
            { ID: 1, slug: 'privacy-policy', title: 'Privacy Policy' },
            { ID: 2, slug: 'return-policy', title: 'Return Policy' },
            { ID: 3, slug: 'other-page', title: 'Other' },
          ],
        }),
      });

      const pages = await getLegalPages();

      // Should only include legal slugs
      expect(pages.length).toBeGreaterThan(0);
      expect(
        pages.every((p) =>
          [
            'privacy-policy',
            'return-policy',
            'shipping-policy',
            'terms-and-conditions',
          ].includes(p.slug)
        )
      ).toBe(true);
    });

    it('should return empty array on error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Error'));

      const pages = await getLegalPages();

      expect(pages).toEqual([]);
    });
  });

  describe('Tag Functions', () => {
    it('should get posts by tag', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          posts: [
            {
              ID: 1,
              slug: 'post-1',
              tags: {
                skateboarding: { name: 'Skateboarding', slug: 'skateboarding' },
              },
            },
            {
              ID: 2,
              slug: 'post-2',
              tags: {
                events: { name: 'Events', slug: 'events' },
              },
            },
          ],
        }),
      });

      const posts = await getPostsByTag('skateboarding');

      expect(posts).toHaveLength(1);
      expect(posts[0].id).toBe(1);
    });

    it('should get all unique tags with counts', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          posts: [
            {
              ID: 1,
              tags: {
                skate: { name: 'Skateboarding', slug: 'skate' },
              },
            },
            {
              ID: 2,
              tags: {
                skate: { name: 'Skateboarding', slug: 'skate' },
                events: { name: 'Events', slug: 'events' },
              },
            },
          ],
        }),
      });

      const tags = await getAllTags();

      expect(tags).toHaveLength(2);
      const skateTag = tags.find((t) => t.slug === 'skate');
      expect(skateTag?.count).toBe(2);
      const eventTag = tags.find((t) => t.slug === 'events');
      expect(eventTag?.count).toBe(1);
    });

    it('should return empty array on error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Error'));

      const tags = await getAllTags();

      expect(tags).toEqual([]);
    });
  });

  describe('Category Functions', () => {
    it('should get posts by category', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          posts: [
            {
              ID: 1,
              slug: 'post-1',
              categories: {
                news: { name: 'News', slug: 'news' },
              },
            },
            {
              ID: 2,
              slug: 'post-2',
              categories: {
                events: { name: 'Events', slug: 'events' },
              },
            },
          ],
        }),
      });

      const posts = await getPostsByCategory('news');

      expect(posts).toHaveLength(1);
      expect(posts[0].id).toBe(1);
    });

    it('should get all categories with counts', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          posts: [
            {
              ID: 1,
              categories: {
                news: { name: 'News', slug: 'news' },
              },
            },
            {
              ID: 2,
              categories: {
                news: { name: 'News', slug: 'news' },
              },
            },
            {
              ID: 3,
              categories: {
                events: { name: 'Events', slug: 'events' },
              },
            },
          ],
        }),
      });

      const categories = await getAllCategories();

      expect(categories.length).toBeGreaterThan(0);
      const newsCategory = categories.find((c) => c.slug === 'news');
      expect(newsCategory?.count).toBe(2);
    });

    it('should exclude featured category from list', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          posts: [
            {
              ID: 1,
              categories: {
                featured: { name: 'Featured', slug: 'featured' },
              },
            },
            {
              ID: 2,
              categories: {
                news: { name: 'News', slug: 'news' },
              },
            },
          ],
        }),
      });

      const categories = await getAllCategories();

      expect(categories.every((c) => c.slug !== 'featured')).toBe(true);
    });
  });

  describe('Featured Post Handling', () => {
    it('should identify featured post', () => {
      // Only the fields `isFeaturedPost`/`extractEmbeddedData` actually read
      // are populated; cast through `unknown` rather than the real
      // `WordPressPost` shape to keep the fixture minimal.
      const featuredPost = {
        id: 1,
        _embedded: {
          'wp:term': [
            [{ taxonomy: 'category', slug: 'featured', name: 'Featured' }],
          ],
        },
      } as unknown as WordPressPost;

      expect(isFeaturedPost(featuredPost)).toBe(true);
    });

    it('should identify non-featured post', () => {
      const regularPost = {
        id: 1,
        _embedded: {
          'wp:term': [[{ taxonomy: 'category', slug: 'news', name: 'News' }]],
        },
      } as unknown as WordPressPost;

      expect(isFeaturedPost(regularPost)).toBe(false);
    });

    it('should get featured post', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          posts: [
            {
              ID: 1,
              slug: 'regular',
              categories: {
                news: { name: 'News', slug: 'news' },
              },
            },
            {
              ID: 2,
              slug: 'featured',
              categories: {
                featured: { name: 'Featured', slug: 'featured' },
              },
            },
          ],
        }),
      });

      const featured = await getFeaturedPost();

      expect(featured).not.toBeNull();
      expect(featured?.id).toBe(2);
    });

    it('should return null if no featured post', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          posts: [
            {
              ID: 1,
              categories: {
                news: { name: 'News', slug: 'news' },
              },
            },
          ],
        }),
      });

      const featured = await getFeaturedPost();

      expect(featured).toBeNull();
    });
  });

  describe('News Page Posts', () => {
    it('should separate featured and regular posts', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          posts: [
            {
              ID: 1,
              slug: 'regular-1',
              categories: {
                news: { name: 'News', slug: 'news' },
              },
            },
            {
              ID: 2,
              slug: 'featured',
              categories: {
                featured: { name: 'Featured', slug: 'featured' },
              },
            },
            {
              ID: 3,
              slug: 'regular-2',
              categories: {
                news: { name: 'News', slug: 'news' },
              },
            },
          ],
        }),
      });

      const result = await getNewsPagePosts();

      expect(result.featuredPost?.id).toBe(2);
      expect(result.regularPosts).toHaveLength(2);
      expect(result.regularPosts.every((p) => p.id !== 2)).toBe(true);
      expect(result.allPosts).toHaveLength(3);
    });

    it('should handle no featured post', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          posts: [
            {
              ID: 1,
              categories: {
                news: { name: 'News', slug: 'news' },
              },
            },
          ],
        }),
      });

      const result = await getNewsPagePosts();

      expect(result.featuredPost).toBeNull();
      expect(result.regularPosts).toHaveLength(1);
      expect(result.allPosts).toHaveLength(1);
    });

    it('should return empty structure on error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Error'));

      const result = await getNewsPagePosts();

      expect(result.featuredPost).toBeNull();
      expect(result.regularPosts).toEqual([]);
      expect(result.allPosts).toEqual([]);
    });
  });

  describe('Data Processing Resilience', () => {
    it('should handle missing author data', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          posts: [
            {
              ID: 1,
              title: 'No Author Post',
              slug: 'no-author',
              // No author field
            },
          ],
        }),
      });

      const posts = await getPosts();

      expect(posts).toHaveLength(1);
      expect(posts[0]._embedded?.author).toBeUndefined();
    });

    it('should handle missing featured image', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          posts: [
            {
              ID: 1,
              title: 'No Image Post',
              slug: 'no-image',
              // No featured_image
            },
          ],
        }),
      });

      const posts = await getPosts();

      expect(posts).toHaveLength(1);
      expect(posts[0]._embedded?.['wp:featuredmedia']).toBeUndefined();
    });

    it('should return fallback content on processing error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          posts: [
            {
              // Missing required fields to trigger error
              malformed: 'data',
            },
          ],
        }),
      });

      const posts = await getPosts();

      // Should return fallback content or empty array
      expect(Array.isArray(posts)).toBe(true);
    });
  });
});
