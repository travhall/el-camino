// src/lib/cms/content.ts
import { getCollection, type CollectionEntry } from 'astro:content';

export async function getBlogPosts(options?: {
  limit?: number;
  category?: string;
  tag?: string;
}): Promise<CollectionEntry<'blog'>[]> {
  const posts = await getCollection('blog');
  let filtered = posts.filter((post: CollectionEntry<'blog'>) => 
    post.data.status === 'published'
  );

  if (options?.category) {
    filtered = filtered.filter((post: CollectionEntry<'blog'>) => 
      post.data.category === options.category
    );
  }

  if (options?.tag) {
    filtered = filtered.filter((post: CollectionEntry<'blog'>) => 
      post.data.tags?.includes(options.tag!)
    );
  }

  return filtered
    .sort((a: CollectionEntry<'blog'>, b: CollectionEntry<'blog'>) => 
      b.data.publishedDate.getTime() - a.data.publishedDate.getTime()
    )
    .slice(0, options?.limit);
}

export async function getBlogCategories(): Promise<string[]> {
  const posts = await getCollection('blog');
  return Array.from(new Set(posts.map((post: CollectionEntry<'blog'>) => 
    post.data.category
  )));
}

export async function getBlogTags(): Promise<string[]> {
  const posts = await getCollection('blog');
  return Array.from(new Set(posts.flatMap((post: CollectionEntry<'blog'>) => 
    post.data.tags || []
  )));
}

export async function getPage(slug: string): Promise<CollectionEntry<'pages'> | undefined> {
  const pages = await getCollection('pages');
  return pages.find((page: CollectionEntry<'pages'>) => page.slug === slug);
}