// src/lib/types/content.ts

export interface MediaFile {
  url: string
  altText?: string
  caption?: string
}

export interface PostData {
  title: string
  excerpt: string
  slug: string
  featuredImage: MediaFile
  content: any // Rich text content from Payload
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
  seo?: {
    title?: string
    description?: string
    image?: MediaFile
    noIndex?: boolean
  }
}

export interface BlogPost extends PostData {
  id: string
  createdAt: string
  updatedAt: string
}
