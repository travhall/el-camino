// src/lib/wordpress/api-compatibility.ts - New file
import type { WordPressPost, WordPressTerm } from "./types";

/**
 * Normalize WordPress.com API responses to standard WordPress REST API format
 * Fixes mixed results between demo content and live WordPress.com content
 */
export function normalizeWordPressComResponse(wpComData: any): any {
  return {
    ...wpComData,
    categories: normalizeCategories(wpComData.categories),
    tags: normalizeTags(wpComData.tags),
    _embedded: normalizeEmbeddedData(wpComData),
  };
}

/**
 * Convert WordPress.com categories object to array format
 */
function normalizeCategories(categories: any): WordPressTerm[] {
  if (!categories) return [];

  if (Array.isArray(categories)) {
    return categories; // Already in correct format
  }

  // WordPress.com format: object with names as keys
  return Object.values(categories).map((cat: any) => ({
    name: cat.name || "",
    slug: cat.slug || "",
    taxonomy: "category",
    description: cat.description || "",
  }));
}

/**
 * Convert WordPress.com tags object to array format
 */
function normalizeTags(tags: any): WordPressTerm[] {
  if (!tags) return [];

  if (Array.isArray(tags)) {
    return tags; // Already in correct format
  }

  // WordPress.com format: object with names as keys
  return Object.values(tags).map((tag: any) => ({
    name: tag.name || "",
    slug: tag.slug || "",
    taxonomy: "post_tag",
    description: tag.description || "",
  }));
}

/**
 * Normalize embedded data structure
 */
function normalizeEmbeddedData(wpComData: any): any {
  const categories = normalizeCategories(wpComData.categories);
  const tags = normalizeTags(wpComData.tags);

  return {
    // Featured media
    ...(wpComData.featured_image
      ? {
          "wp:featuredmedia": [
            {
              source_url: wpComData.featured_image,
              alt_text: wpComData.title || "Featured image",
            },
          ],
        }
      : {}),

    // Combined categories and tags in standard format
    ...(categories.length > 0 || tags.length > 0
      ? {
          "wp:term": [[...categories, ...tags]],
        }
      : {}),

    // Author normalization
    ...(wpComData.author
      ? {
          author: [
            {
              name: wpComData.author.name || "",
              description: wpComData.author.description || "",
              avatar_urls: wpComData.author.avatar_URLs || {},
            },
          ],
        }
      : {}),
  };
}

/**
 * Enhanced processPost function with WordPress.com compatibility
 */
export function processPostWithCompatibility(post: any): WordPressPost {
  // Normalize WordPress.com data structure first
  const normalizedPost = normalizeWordPressComResponse(post);

  // Extract normalized categories and tags
  const categories = normalizeCategories(post.categories);
  const tags = normalizeTags(post.tags);

  return {
    id: post.ID || 0,
    date: post.date || new Date().toISOString(),
    slug: post.slug || "",
    title: { rendered: post.title || "Untitled" },
    excerpt: { rendered: post.excerpt || "" },
    content: { rendered: post.content || "" },
    _embedded: {
      // Featured media with fallback
      ...(post.featured_image
        ? {
            "wp:featuredmedia": [
              {
                source_url: post.featured_image,
                alt_text: post.title || "Featured image",
              },
            ],
          }
        : {}),

      // Normalized terms structure
      ...(categories.length > 0 || tags.length > 0
        ? {
            "wp:term": [[...categories, ...tags]],
          }
        : {}),

      // Author data
      ...(post.author
        ? {
            author: [
              {
                name: post.author.name || "",
                description: post.author.description || "",
                avatar_urls: post.author.avatar_URLs || {},
              },
            ],
          }
        : {}),
    },
  };
}
