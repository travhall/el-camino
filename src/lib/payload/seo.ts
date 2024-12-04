// src/lib/payload/seo.ts

import type { Media, Page, BlogPost } from "./types";

export interface SEOData {
  title: string;
  description: string;
  image?: string;
  noIndex?: boolean;
  canonicalUrl?: string;
  publishedDate?: string;
  modifiedDate?: string;
  type?: 'website' | 'article';
  author?: string;
}

export function getSEODataFromPage(page: Page): SEOData {
  const ogImage = page.seo?.ogImage as Media | null;
  const SITE_NAME = "El Camino Skate Shop";

  return {
    title: page.seo?.metaTitle 
      ? `${page.seo.metaTitle} | ${SITE_NAME}`
      : `${page.title} | ${SITE_NAME}`,
    description: page.seo?.metaDescription || 
      "El Camino Skate Shop is a skater owned and operated skateboard shop, located in Eau Claire, WI",
    image: ogImage?.url ? getMediaUrl(ogImage.url) : undefined,
    noIndex: page.seo?.noIndex || false,
    canonicalUrl: page.slug ? `https://elcaminoskateshop.com/${page.slug}` : undefined,
    type: 'website'
  };
}

export function getSEODataFromBlogPost(post: BlogPost): SEOData {
  const SITE_NAME = "El Camino Skate Shop";
  const ogImage = post.seo?.ogImage as Media | null;

  return {
    title: post.seo?.metaTitle 
      ? `${post.seo.metaTitle} | ${SITE_NAME}`
      : `${post.title} | ${SITE_NAME}`,
    description: post.seo?.metaDescription || post.excerpt,
    image: ogImage?.url 
      ? getMediaUrl(ogImage.url) 
      : post.featuredImage?.url 
        ? getMediaUrl(post.featuredImage.url) 
        : undefined,
    noIndex: post.seo?.noIndex || false,
    canonicalUrl: `https://elcaminoskateshop.com/blog/${post.slug}`,
    publishedDate: post.publishedDate,
    modifiedDate: post.updatedAt,
    type: 'article',
    author: post.author.name
  };
}

function getMediaUrl(url: string): string {
  const PAYLOAD_URL = import.meta.env.PUBLIC_PAYLOAD_URL || 'http://localhost:3000';
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `${PAYLOAD_URL}${url}`;
}