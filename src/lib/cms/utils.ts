// src/lib/cms/utils.ts
import type { CollectionEntry } from 'astro:content';

export function getBlogUrl(post: CollectionEntry<'blog'>): string {
  return `/news/${post.slug}`;
}

export function getPageUrl(page: CollectionEntry<'pages'>): string {
  return `/${page.slug}`;
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}