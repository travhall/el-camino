import type { BlogPost, SEO, Page } from './types'

export function getSEO(
  content: BlogPost | Page | { title: string; description?: string; image?: string },
  overrides: Partial<SEO> = {}
): SEO {
  // Handle CMS content (BlogPost or Page)
  if ('seo' in content && content.seo) {
    return {
      title: overrides.title || content.seo.title || content.title,
      description: overrides.description || content.seo.description || ('excerpt' in content ? content.excerpt : ''),
      image: overrides.image || content.seo.image || ('featuredImage' in content ? content.featuredImage.url : undefined),
      noIndex: overrides.noIndex ?? content.seo.noIndex ?? false,
      canonicalUrl: overrides.canonicalUrl,
      type: overrides.type || ('excerpt' in content ? 'article' : 'website')
    }
  }

  // Handle direct content
  return {
    title: overrides.title || content.title,
    description: overrides.description || '',
    image: overrides.image || ('image' in content ? content.image : undefined),
    noIndex: overrides.noIndex ?? false,
    canonicalUrl: overrides.canonicalUrl,
    type: overrides.type || 'website'
  }
}

// Keep these for backward compatibility
export const getSEODataFromPage = getSEO;
export const getSEODataFromBlogPost = getSEO;