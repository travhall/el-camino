import { describe, it, expect } from 'vitest';
import { buildFilterOptions } from '../types';
import type { WordPressPost } from '../types';

function makePost(overrides: Partial<WordPressPost> = {}): WordPressPost {
  return {
    id: 1,
    date: '2026-01-01T00:00:00',
    modified: '2026-01-01T00:00:00',
    slug: 'test-post',
    title: { rendered: 'Test Post' },
    excerpt: { rendered: 'An excerpt' },
    content: { rendered: '<p>Full body content</p>' },
    ...overrides,
  };
}

describe('buildFilterOptions', () => {
  it('passes categories and tags through unchanged', () => {
    const categories = [{ name: 'News', slug: 'news', count: 2 }];
    const tags = [{ name: 'Event', slug: 'event', count: 1 }];

    const result = buildFilterOptions([], categories, tags);

    expect(result.categories).toBe(categories);
    expect(result.tags).toBe(tags);
  });

  it('counts authors from embedded data, most frequent first', () => {
    const posts = [
      makePost({
        id: 1,
        _embedded: { author: [{ name: 'Alice', avatar_urls: {} }] },
      }),
      makePost({
        id: 2,
        _embedded: { author: [{ name: 'Bob', avatar_urls: {} }] },
      }),
      makePost({
        id: 3,
        _embedded: { author: [{ name: 'Alice', avatar_urls: {} }] },
      }),
    ];

    const result = buildFilterOptions(posts, [], []);

    expect(result.authors[0]).toMatchObject({ name: 'Alice', count: 2 });
    expect(result.authors[1]).toMatchObject({ name: 'Bob', count: 1 });
  });

  it('only includes date ranges that have at least one matching post', () => {
    const oldPost = makePost({ date: '2000-01-01T00:00:00' });

    const result = buildFilterOptions([oldPost], [], []);

    expect(result.dateRanges).toEqual([]);
  });
});
