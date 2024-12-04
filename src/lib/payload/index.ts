// src/lib/payload/index.ts
import type { Page, BlogPost, BlogCategory, BlogTag } from './types'

// Re-export everything
export * from './types'
export * from './utils'
export * from './blog'
export * from './queries'
export * from './seo'
export * from './structured-data'

export const PAYLOAD_URL = import.meta.env.PUBLIC_PAYLOAD_URL || 'http://localhost:3000'

export async function getPage(slug: string): Promise<Page | null> {
  try {
    console.log(
      `Fetching page from ${PAYLOAD_URL}/api/pages?where[slug][equals]=${slug}`
    );
    const response = await fetch(
      `${PAYLOAD_URL}/api/pages?where[slug][equals]=${slug}`
    );

    if (!response.ok) {
      console.error(
        "Failed to fetch page:",
        response.status,
        response.statusText
      );
      const text = await response.text();
      console.error("Response body:", text);
      return null;
    }

    const data = await response.json();
    console.log("Page data received:", data);

    if (!data.docs?.length) {
      console.log("No page found with slug:", slug);
      return null;
    }

    return data.docs[0];
  } catch (error) {
    console.error("Error fetching page:", error);
    return null;
  }
}

export async function getAllPages(): Promise<Page[]> {
  try {
    console.log("Fetching all pages");
    const response = await fetch(`${PAYLOAD_URL}/api/pages`);

    if (!response.ok) {
      console.error(
        "Failed to fetch pages:",
        response.status,
        response.statusText
      );
      return [];
    }

    const data = await response.json();
    console.log("All pages received:", data);

    return data.docs || [];
  } catch (error) {
    console.error("Error fetching all pages:", error);
    return [];
  }
}

export async function getBlogPost(slug: string): Promise<BlogPost | null> {
  try {
    const response = await fetch(
      `${PAYLOAD_URL}/api/blog-posts?where[slug][equals]=${slug}`
    );

    if (!response.ok) {
      console.error(
        "Failed to fetch blog post:",
        response.status,
        response.statusText
      );
      return null;
    }

    const data = await response.json();

    if (!data.docs?.length) {
      return null;
    }

    return data.docs[0];
  } catch (error) {
    console.error("Error fetching blog post:", error);
    return null;
  }
}

export async function getBlogPosts(
  limit = 10,
  page = 1
): Promise<{ docs: BlogPost[]; totalPages: number; currentPage: number }> {
  try {
    const url = `${PAYLOAD_URL}/api/blog-posts?limit=${limit}&page=${page}&where[status][equals]=published&sort=-publishedDate`
    console.log('Fetching blog posts from:', url)

    const response = await fetch(url)
    console.log('Response status:', response.status)

    if (!response.ok) {
      console.error(
        "Failed to fetch blog posts:",
        response.status,
        response.statusText
      )
      return { docs: [], totalPages: 0, currentPage: 1 }
    }

    const data = await response.json()
    console.log('Blog posts data:', data)

    return {
      docs: data.docs || [],
      totalPages: data.totalPages || 0,
      currentPage: data.page || 1,
    }
  } catch (error) {
    console.error("Error fetching blog posts:", error)
    return { docs: [], totalPages: 0, currentPage: 1 }
  }
}

export async function getBlogCategories(): Promise<BlogCategory[]> {
  try {
    const response = await fetch(`${PAYLOAD_URL}/api/blog-categories`);

    if (!response.ok) {
      console.error(
        "Failed to fetch categories:",
        response.status,
        response.statusText
      );
      return [];
    }

    const data = await response.json();
    return data.docs || [];
  } catch (error) {
    console.error("Error fetching categories:", error);
    return [];
  }
}

export function getMediaUrl(path: string): string {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `${PAYLOAD_URL}${path}`;
}

export async function getBlogPostsByCategory(
  categorySlug: string,
  limit = 10,
  page = 1
): Promise<{ docs: BlogPost[]; totalPages: number; currentPage: number }> {
  try {
    const response = await fetch(
      `${PAYLOAD_URL}/api/blog-posts?limit=${limit}&page=${page}&where[category.slug][equals]=${categorySlug}&where[status][equals]=published&sort=-publishedDate`
    );

    if (!response.ok) {
      console.error(
        "Failed to fetch category posts:",
        response.status,
        response.statusText
      );
      return { docs: [], totalPages: 0, currentPage: 1 };
    }

    const data = await response.json();
    return {
      docs: data.docs || [],
      totalPages: data.totalPages || 0,
      currentPage: data.page || 1,
    };
  } catch (error) {
    console.error("Error fetching category posts:", error);
    return { docs: [], totalPages: 0, currentPage: 1 };
  }
}

export async function getBlogTags(): Promise<BlogTag[]> {
  try {
    const response = await fetch(`${PAYLOAD_URL}/api/blog-tags`)
    if (!response.ok) {
      console.error("Failed to fetch tags:", response.status, response.statusText)
      return []
    }
    const data = await response.json()
    return data.docs || []
  } catch (error) {
    console.error("Error fetching tags:", error)
    return []
  }
}

export async function getBlogPostsByTag(
  tagSlug: string,
  limit = 10,
  page = 1
): Promise<{ docs: BlogPost[]; totalPages: number; currentPage: number }> {
  try {
    const response = await fetch(
      `${PAYLOAD_URL}/api/blog-posts?limit=${limit}&page=${page}&where[tags.slug][equals]=${tagSlug}&where[status][equals]=published&sort=-publishedDate`
    )

    if (!response.ok) {
      console.error("Failed to fetch tag posts:", response.status, response.statusText)
      return { docs: [], totalPages: 0, currentPage: 1 }
    }

    const data = await response.json()
    return {
      docs: data.docs || [],
      totalPages: data.totalPages || 0,
      currentPage: data.page || 1,
    }
  } catch (error) {
    console.error("Error fetching tag posts:", error)
    return { docs: [], totalPages: 0, currentPage: 1 }
  }
}