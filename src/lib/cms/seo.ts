import type { SEO } from '@/lib/types/content';

export function generateMetaTags(seo?: SEO) {
  return {
    title: seo?.title,
    description: seo?.description,
    'og:image': seo?.image,
    robots: seo?.noIndex ? 'noindex' : 'index,follow'
  };
}