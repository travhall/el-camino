// src/lib/wordpress/api.ts
import type { WordPressPage, WordPressPost, WordPressTerm } from "./types";
import { extractEmbeddedData } from "./types";
import {
  createError,
  handleError,
  ErrorType,
  logError,
} from "@/lib/square/errorUtils";
import type { AppError } from "@/lib/square/errorUtils";
import { wordpressCache } from "@/lib/square/cacheUtils";

// Configuration
const WP_URL =
  "https://public-api.wordpress.com/rest/v1.1/sites/elcaminoskateshop.wordpress.com";

/**
 * Process WordPress API errors into standardized format
 */
function processWordPressError(error: unknown, source: string): AppError {
  if (error instanceof Error) {
    if (
      error.message.includes("404") ||
      error.message.includes("status: 404")
    ) {
      return createError(
        ErrorType.DATA_NOT_FOUND,
        "WordPress content not found",
        {
          source,
          originalError: error,
        }
      );
    }

    if (
      error.message.includes("timeout") ||
      error.message.includes("ETIMEDOUT")
    ) {
      return createError(ErrorType.TIMEOUT_ERROR, "WordPress API timeout", {
        source,
        originalError: error,
      });
    }

    if (
      error.message.includes("network") ||
      error.message.includes("ENOTFOUND")
    ) {
      return createError(
        ErrorType.NETWORK_ERROR,
        "WordPress API network error",
        {
          source,
          originalError: error,
        }
      );
    }

    if (error.message.includes("429")) {
      return createError(ErrorType.API_RATE_LIMIT, "WordPress API rate limit", {
        source,
        originalError: error,
      });
    }

    if (
      error.message.includes("500") ||
      error.message.includes("502") ||
      error.message.includes("503")
    ) {
      return createError(
        ErrorType.API_UNAVAILABLE,
        "WordPress API unavailable",
        {
          source,
          originalError: error,
        }
      );
    }

    return createError(ErrorType.API_RESPONSE_ERROR, error.message, {
      source,
      originalError: error,
    });
  }

  return createError(ErrorType.UNKNOWN, "Unknown WordPress API error", {
    source,
    originalError: error,
  });
}

/**
 * Fetch data with standardized caching and error handling
 */
async function fetchWithCache<T>(
  endpoint: string,
  cacheKey: string
): Promise<T> {
  return wordpressCache.getOrCompute(cacheKey, async () => {
    try {
      const response = await fetch(`${WP_URL}${endpoint}`, {
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return (await response.json()) as T;
    } catch (error) {
      const appError = processWordPressError(
        error,
        `wordpress-api:${endpoint}`
      );
      throw appError; // Let the cache handle the error with handleError
    }
  });
}

/**
 * Process WordPress post data with error handling - UPDATED to handle ALL categories and tags
 */
function processPost(post: any): WordPressPost {
  try {
    // Extract ALL categories (WordPress.com returns categories as object with names as keys)
    let extractedCategories: WordPressTerm[] = [];
    if (post.categories && typeof post.categories === "object") {
      const categoryNames = Object.keys(post.categories);
      extractedCategories = categoryNames.map((categoryName) => {
        const categoryData = post.categories[categoryName];
        return {
          name: categoryData.name || categoryName,
          slug: categoryData.slug || "",
          taxonomy: "category",
          description: categoryData.description || "",
        };
      });
    }

    // Extract ALL tags (WordPress.com returns tags as object with names as keys)
    let extractedTags: WordPressTerm[] = [];
    if (post.tags && typeof post.tags === "object") {
      const tagNames = Object.keys(post.tags);
      extractedTags = tagNames.map((tagName) => {
        const tagData = post.tags[tagName];
        return {
          name: tagData.name || tagName,
          slug: tagData.slug || tagName.toLowerCase().replace(/\s+/g, "-"),
          taxonomy: "post_tag",
          description: tagData.description || "",
        };
      });
    }

    return {
      id: post.ID || 0,
      date: post.date || new Date().toISOString(),
      slug: post.slug || "",
      title: { rendered: post.title || "Untitled" },
      excerpt: { rendered: post.excerpt || "" },
      content: { rendered: post.content || "" },
      _embedded: {
        // Featured media
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

        // Categories and Tags - ALL categories and tags included
        // NOTE: In WordPress REST API, both categories and tags come under wp:term
        // Structure: "wp:term": [ [term1, term2, term3] ]
        ...(extractedCategories.length > 0 || extractedTags.length > 0
          ? {
              "wp:term": [
                [...extractedCategories, ...extractedTags],
              ],
            }
          : {}),

        // Author - map WordPress.com author structure
        ...(post.author
          ? {
              author: [
                {
                  name: post.author.name || post.author.login || "Anonymous",
                  avatar_urls: {
                    "96": post.author.avatar_URL || "",
                    "48": post.author.avatar_URL || "",
                    "24": post.author.avatar_URL || "",
                  },
                  description: post.author.description || "",
                  url: post.author.URL || "",
                },
              ],
            }
          : {}),
      },
    };
  } catch (error) {
    const appError = processWordPressError(
      error,
      `processPost:${post?.ID || "unknown"}`
    );
    logError(appError);

    // Return minimal valid post to prevent breaking renders
    return {
      id: post?.ID || 0,
      date: new Date().toISOString(),
      slug: post?.slug || "untitled",
      title: { rendered: "Content temporarily unavailable" },
      excerpt: { rendered: "Please try again later." },
      content: { rendered: "" },
    };
  }
}

/**
 * Process WordPress page data with error handling
 */
function processPage(page: any): WordPressPage {
  try {
    return {
      id: page.ID || 0,
      date: page.date || new Date().toISOString(),
      slug: page.slug || "",
      title: { rendered: page.title || "Untitled" },
      content: { rendered: page.content || "" },
      _embedded: {
        // Featured media
        ...(page.featured_image
          ? {
              "wp:featuredmedia": [
                {
                  source_url: page.featured_image,
                  alt_text: page.title || "Featured image",
                },
              ],
            }
          : {}),

        // Author for pages
        ...(page.author
          ? {
              author: [
                {
                  name: page.author.name || page.author.login || "Anonymous",
                  avatar_urls: {
                    "96": page.author.avatar_URL || "",
                    "48": page.author.avatar_URL || "",
                    "24": page.author.avatar_URL || "",
                  },
                  description: page.author.description || "",
                  url: page.author.URL || "",
                },
              ],
            }
          : {}),
      },
    };
  } catch (error) {
    const appError = processWordPressError(
      error,
      `processPage:${page?.ID || "unknown"}`
    );
    logError(appError);

    // Return minimal valid page
    return {
      id: page?.ID || 0,
      date: new Date().toISOString(),
      slug: page?.slug || "untitled",
      title: { rendered: "Page temporarily unavailable" },
      content: { rendered: "Please try again later." },
    };
  }
}

// =============================================================================
// POSTS API (for news/blog content)
// =============================================================================

/**
 * Get all posts with standardized caching and error handling
 */
export async function getPosts(): Promise<WordPressPost[]> {
  try {
    const data = await fetchWithCache<any>(
      "/posts?fields=ID,title,date,excerpt,content,slug,featured_image,author,categories,tags",
      "all_posts"
    );

    if (!data?.posts || !Array.isArray(data.posts)) {
      return [];
    }

    return data.posts
      .map(processPost)
      .filter((post: any): post is WordPressPost => post.id > 0);
  } catch (error) {
    const appError = processWordPressError(error, "getPosts");
    return handleError<WordPressPost[]>(appError, []);
  }
}

/**
 * Get a single post by slug with standardized error handling
 */
export async function getPost(slug: string): Promise<WordPressPost | null> {
  if (!slug) {
    return null;
  }

  try {
    const cacheKey = `post_${slug}`;
    const post = await fetchWithCache<any>(
      `/posts/slug:${slug}?fields=ID,title,date,excerpt,content,slug,featured_image,author,categories,tags`,
      cacheKey
    );

    return post ? processPost(post) : null;
  } catch (error) {
    const appError = processWordPressError(error, `getPost:${slug}`);
    return handleError<WordPressPost | null>(appError, null);
  }
}

// =============================================================================
// PAGES API (for legal/policy content)
// =============================================================================

/**
 * Get all pages with standardized caching and error handling
 */
export async function getPages(): Promise<WordPressPage[]> {
  try {
    const data = await fetchWithCache<any>(
      "/posts?type=page&fields=ID,title,date,content,slug,featured_image",
      "all_pages"
    );

    if (!data?.posts || !Array.isArray(data.posts)) {
      return [];
    }

    return data.posts
      .map(processPage)
      .filter((page: any): page is WordPressPage => page.id > 0);
  } catch (error) {
    const appError = processWordPressError(error, "getPages");
    return handleError<WordPressPage[]>(appError, []);
  }
}

/**
 * Get a single page by slug with fallback strategy
 */
export async function getPage(slug: string): Promise<WordPressPage | null> {
  if (!slug) {
    return null;
  }

  try {
    const cacheKey = `page_${slug}`;

    // Try direct fetch first
    try {
      const page = await fetchWithCache<any>(
        `/posts/slug:${slug}?type=page&fields=ID,title,date,content,slug,featured_image`,
        cacheKey
      );

      if (page) {
        return processPage(page);
      }
    } catch (directFetchError) {
      console.warn(
        `Direct page fetch failed for "${slug}", trying fallback...`
      );
    }

    // Fallback: search through all pages
    const allPages = await getPages();
    const page = allPages.find((p) => p.slug === slug);

    return page || null;
  } catch (error) {
    const appError = processWordPressError(error, `getPage:${slug}`);
    return handleError<WordPressPage | null>(appError, null);
  }
}

/**
 * Get specific legal/policy pages for footer
 */
export async function getLegalPages(): Promise<WordPressPage[]> {
  const legalSlugs = [
    "privacy-policy",
    "return-policy",
    "shipping-policy",
    "terms-and-conditions",
  ];

  try {
    const cacheKey = "legal_pages";

    return wordpressCache.getOrCompute(cacheKey, async () => {
      const allPages = await getPages();
      return allPages.filter((page) => legalSlugs.includes(page.slug));
    });
  } catch (error) {
    const appError = processWordPressError(error, "getLegalPages");
    return handleError<WordPressPage[]>(appError, []);
  }
}

// =============================================================================
// NEW: TAG-RELATED API FUNCTIONS
// =============================================================================

/**
 * Get posts by tag slug (for future tag archive pages)
 */
export async function getPostsByTag(tagSlug: string): Promise<WordPressPost[]> {
  try {
    const allPosts = await getPosts();

    return allPosts.filter((post) => {
      const embeddedData = post._embedded;
      if (!embeddedData?.["wp:term"]?.[0]) return false;

      return embeddedData["wp:term"][0].some(
        (term) => term.taxonomy === "post_tag" && term.slug === tagSlug
      );
    });
  } catch (error) {
    const appError = processWordPressError(error, `getPostsByTag:${tagSlug}`);
    return handleError<WordPressPost[]>(appError, []);
  }
}

/**
 * Get all unique tags from all posts
 */
export async function getAllTags(): Promise<
  Array<{ name: string; slug: string; count: number }>
> {
  try {
    const cacheKey = "all_tags";

    return wordpressCache.getOrCompute(cacheKey, async () => {
      const allPosts = await getPosts();
      const tagCounts = new Map<
        string,
        { name: string; slug: string; count: number }
      >();

      allPosts.forEach((post) => {
        const embeddedData = post._embedded;
        if (embeddedData?.["wp:term"]?.[0]) {
          embeddedData["wp:term"][0]
            .filter((term) => term.taxonomy === "post_tag")
            .forEach((tag) => {
              const existing = tagCounts.get(tag.slug);
              if (existing) {
                existing.count++;
              } else {
                tagCounts.set(tag.slug, {
                  name: tag.name,
                  slug: tag.slug,
                  count: 1,
                });
              }
            });
        }
      });

      return Array.from(tagCounts.values()).sort((a, b) => b.count - a.count);
    });
  } catch (error) {
    const appError = processWordPressError(error, "getAllTags");
    return handleError<Array<{ name: string; slug: string; count: number }>>(
      appError,
      []
    );
  }
}

// =============================================================================
// CACHE MANAGEMENT (Using standardized patterns)
// =============================================================================

/**
 * Clear WordPress cache using standard cache methods
 */
export function clearWordPressCache(): void {
  wordpressCache.clear();
  console.log("[WordPress] Cache cleared");
}

/**
 * Clear specific WordPress cache item
 */
export function clearWordPressCacheItem(key: string): void {
  wordpressCache.delete(key);
  console.log(`[WordPress] Cache item cleared: ${key}`);
}

/**
 * Get WordPress cache statistics
 */
export function getWordPressCacheStats(): {
  cacheSize: number;
  cacheName: string;
} {
  // Note: This would require adding a getStats method to the Cache class
  return {
    cacheSize: Object.keys((wordpressCache as any).cache || {}).length,
    cacheName: "wordpress",
  };
}

/**
 * Prune expired WordPress cache entries
 */
export function pruneWordPressCache(): number {
  return wordpressCache.prune();
}

/**
 * Get all categories with post counts
 */
export async function getAllCategories(): Promise<
  Array<{ name: string; slug: string; count: number }>
> {
  try {
    const cacheKey = "all_categories";

    return wordpressCache.getOrCompute(cacheKey, async () => {
      const allPosts = await getPosts();
      const categoryCounts = new Map<
        string,
        { name: string; slug: string; count: number }
      >();

      allPosts.forEach((post) => {
        const embeddedData = extractEmbeddedData(post);
        if (embeddedData.category) {
          const existing = categoryCounts.get(embeddedData.category.slug);
          if (existing) {
            existing.count++;
          } else {
            categoryCounts.set(embeddedData.category.slug, {
              name: embeddedData.category.name,
              slug: embeddedData.category.slug,
              count: 1,
            });
          }
        }
      });

      return Array.from(categoryCounts.values())
        .filter((cat) => cat.slug !== "featured") // Exclude featured from filters
        .sort((a, b) => b.count - a.count);
    });
  } catch (error) {
    const appError = processWordPressError(error, "getAllCategories");
    return handleError<Array<{ name: string; slug: string; count: number }>>(
      appError,
      []
    );
  }
}

/**
 * Get posts by category slug
 */
export async function getPostsByCategory(
  categorySlug: string
): Promise<WordPressPost[]> {
  try {
    const allPosts = await getPosts();
    return allPosts.filter((post) => {
      const embeddedData = extractEmbeddedData(post);
      return embeddedData.category?.slug === categorySlug;
    });
  } catch (error) {
    const appError = processWordPressError(
      error,
      `getPostsByCategory:${categorySlug}`
    );
    return handleError<WordPressPost[]>(appError, []);
  }
}

/**
 * Check if post is featured (has "featured" category)
 */
export function isFeaturedPost(post: WordPressPost): boolean {
  const embeddedData = extractEmbeddedData(post);

  // Check if post has featured category
  if (embeddedData.category?.slug === "featured") {
    return true;
  }

  // Also check in all terms in case featured is not the primary category
  if (post._embedded?.["wp:term"]?.[0]) {
    return post._embedded["wp:term"][0].some(
      (term) => term.taxonomy === "category" && term.slug === "featured"
    );
  }

  return false;
}

/**
 * Get the featured post (first post with "featured" category)
 */
export async function getFeaturedPost(): Promise<WordPressPost | null> {
  try {
    const allPosts = await getPosts();
    return allPosts.find(isFeaturedPost) || null;
  } catch (error) {
    const appError = processWordPressError(error, "getFeaturedPost");
    return handleError<WordPressPost | null>(appError, null);
  }
}

/**
 * Get posts for news page with smart featured handling
 */
export async function getNewsPagePosts(): Promise<{
  featuredPost: WordPressPost | null;
  regularPosts: WordPressPost[];
  allPosts: WordPressPost[];
}> {
  try {
    const allPosts = await getPosts();
    const featuredPost = allPosts.find(isFeaturedPost) || null;

    // Remove featured post from regular posts to avoid duplication
    const regularPosts = allPosts.filter((post) => !isFeaturedPost(post));

    return {
      featuredPost,
      regularPosts,
      allPosts, // For filtering - includes featured post
    };
  } catch (error) {
    const appError = processWordPressError(error, "getNewsPagePosts");
    return handleError<{
      featuredPost: WordPressPost | null;
      regularPosts: WordPressPost[];
      allPosts: WordPressPost[];
    }>(appError, {
      featuredPost: null,
      regularPosts: [],
      allPosts: [],
    });
  }
}
