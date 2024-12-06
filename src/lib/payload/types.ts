export interface Media {
  id: string;
  url: string;
  alt?: string;
  caption?: string;
}

export interface SEO {
  title: string;
  description: string;
  image?: string;
  noIndex?: boolean;
  canonicalUrl?: string;
  type?: 'article' | 'website' | 'product';
}

interface BaseBlock {
  id: string;
  blockType: string;
}

export interface ContentBlock extends BaseBlock {
  blockType: 'content';
  content: any; // Rich text content
  appearance: 'normal' | 'emphasis' | 'meta';
}

export interface ImageGalleryBlock extends BaseBlock {
  blockType: 'imageGallery';
  images: {
    image: Media;
    caption?: string;
  }[];
  columns: '2' | '3' | '4';
}

export interface VideoBlock extends BaseBlock {
  blockType: 'video';
  url: string;
  caption?: string;
  transcript?: string;
}

export type Block = ContentBlock | ImageGalleryBlock | VideoBlock;

export interface Page {
  id: string;
  title: string;
  slug: string;
  seo?: SEO;
  layout: Block[];
  createdAt: string;
  updatedAt: string;
}

export interface BlogCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
}

export interface BlogTag {
  id: string;
  name: string;
  slug: string;
}

export interface BlogAuthor {
  id: string;
  name: string;
}

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  featuredImage: Media;
  excerpt: string;
  content: any;
  category: BlogCategory;
  tags?: BlogTag[];
  author: BlogAuthor;
  status: 'draft' | 'published';
  publishedDate: string;
  seo?: SEO;
  createdAt: string;
  updatedAt: string;
}