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
  type?: 'website' | 'article' | 'product';
}

// Rest of existing types remain unchanged
export interface Page {
  id: string;
  title: string;
  slug: string;
  seo?: SEO;
  layout: Block[];
  createdAt: string;
  updatedAt: string;
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
