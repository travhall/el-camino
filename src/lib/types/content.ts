// src/lib/types/content.ts
import { getCollection, type CollectionEntry } from 'astro:content';

export async function getPage(slug: string): Promise<CollectionEntry<'pages'> | undefined> {
  const pages = await getCollection('pages');
  return pages.find((page: CollectionEntry<'pages'>) => page.slug === slug);
}

export interface SEO {
 title?: string;
 description?: string;
 image?: string;
 noIndex?: boolean;
}

export interface Media {
 src: string;
 alt?: string;
 caption?: string;
}

export interface Block {
 blockType: 'content' | 'imageGallery';
 content?: string;
 images?: Media[];
 appearance?: 'normal' | 'emphasis' | 'meta';
 columns?: '2' | '3' | '4';
}

export interface BlogPost {
 title: string;
 excerpt: string;
 featuredImage: Media;
 category: string;
 tags?: string[];
 publishedDate: Date;
 status: 'draft' | 'published';
 content: string;
 author: string;
 seo?: SEO;
 updatedAt?: Date;
}

export interface Page {
 title: string;
 content: string;
 seo?: SEO;
 layout?: Block[];
}

export type BlogEntry = CollectionEntry<'blog'>;
export type PageEntry = CollectionEntry<'pages'>;