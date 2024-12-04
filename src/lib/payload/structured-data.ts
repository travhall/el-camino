// src/lib/payload/structured-data.ts

import type { Page, BlogPost } from './types';

interface ProductData {
  name: string;
  description: string;
  price: string;
  image: string;
  // Add more product fields as needed
}

interface OrganizationData {
  name: string;
  logo: string;
  address: string;
  // Add more org fields as needed
}

export function generateWebPageSchema(page: Page) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: page.seo?.metaTitle || page.title,
    description: page.seo?.metaDescription,
    url: `https://elcaminoskateshop.com/${page.slug}`,
    dateModified: page.updatedAt,
    datePublished: page.createdAt,
  };
}

export function generateBlogPostSchema(post: BlogPost) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt,
    image: post.featuredImage.url,
    datePublished: post.publishedDate,
    dateModified: post.updatedAt,
    author: {
      '@type': 'Person',
      name: post.author.name,
    },
    publisher: {
      '@type': 'Organization',
      name: 'El Camino Skate Shop',
      logo: {
        '@type': 'ImageObject',
        url: 'https://elcaminoskateshop.com/logo.png' // Update with actual logo URL
      }
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `https://elcaminoskateshop.com/blog/${post.slug}`
    }
  };
}

export function generateOrganizationSchema(data: OrganizationData) {
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': 'https://elcaminoskateshop.com',
    name: data.name,
    image: data.logo,
    address: {
      '@type': 'PostalAddress',
      streetAddress: '123 Main St', // Update with real address
      addressLocality: 'Eau Claire',
      addressRegion: 'WI',
      postalCode: '54701',
      addressCountry: 'US',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: 44.811349, // Update with real coordinates
      longitude: -91.498494,
    },
  };
}