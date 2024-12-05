export interface MediaFile {
  url: string
  altText?: string
  caption?: string
}

export interface Block {
  id: string
  blockType: string
  [key: string]: any
}

export interface ContentBlock extends Block {
  blockType: 'content'
  content: string
  appearance?: 'normal' | 'emphasis' | 'meta'
}

export interface GalleryImage {
  image: MediaFile
  caption?: string
}

export interface ImageGalleryBlock extends Block {
  blockType: 'imageGallery'
  images: GalleryImage[]
  columns?: '2' | '3' | '4'
}

export interface VideoBlock extends Block {
  blockType: 'video'
  url: string
  caption?: string
  transcript?: string
}

export interface BlogPost {
  id: string
  title: string
  slug: string
  excerpt: string
  featuredImage: MediaFile
  layout: (ContentBlock | ImageGalleryBlock | VideoBlock)[]
  category: {
    name: string
    slug: string
  }
  tags?: Array<{
    name: string
    slug: string
  }>
  author: {
    name: string
  }
  status: 'draft' | 'published'
  publishedDate: string
  seo?: {
    title?: string
    description?: string
    image?: MediaFile
    noIndex?: boolean
  }
}