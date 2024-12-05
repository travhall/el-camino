import type { BlogPost } from './types'

export interface SEOData {
  title: string;
  description: string;
  openGraph?: {
    basic: {
      title: string;
      type: string;
      image: string;
    };
  };
}

export async function getSEODataFromBlogPost(post: BlogPost): Promise<SEOData> {
  return {
    title: post.title,
    description: post.excerpt,
    openGraph: {
      basic: {
        title: post.title,
        type: 'article',
        image: post.featuredImage.url
      }
    }
  }
}