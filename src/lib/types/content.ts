export interface BlogPost {
  id: string
  title: string
  slug: string
  excerpt: string
  featuredImage: {
    url: string
    altText?: string
    caption?: string
  }
  content: any
  author: {
    name: string
  }
  category: {
    name: string
    slug: string
  }
  tags?: Array<{
    name: string
    slug: string
  }>
  status: 'draft' | 'published'
  publishedDate: string
  createdAt: string
  updatedAt: string
}