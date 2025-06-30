// src/lib/wordpress/api.ts
import type { WordPressPage, WordPressPost } from "./types";
import { imageCache } from "@/lib/square/cacheUtils";
import {
  createError,
  handleError,
  ErrorType,
  logError,
} from "@/lib/square/errorUtils";
import type { AppError } from "@/lib/square/errorUtils";

// Add WordPress cache to existing cache exports in square/cacheUtils.ts
// export const wordpressCache = new Cache<any>('wordpress', 300); // 5 minutes

// Import the WordPress cache (this would be added to cacheUtils.ts)
const wordpressCache = new (await import("@/lib/square/cacheUtils")).Cache<any>(
  "wordpress",
  300
);

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
 * Process WordPress post data with error handling
 */
function processPost(post: any): WordPressPost {
  try {
    // Extract first category for display (WordPress.com returns categories as object with names as keys)
    let firstCategory = null;
    if (post.categories && typeof post.categories === "object") {
      const categoryNames = Object.keys(post.categories);
      if (categoryNames.length > 0) {
        const categoryData = post.categories[categoryNames[0]];
        firstCategory = {
          name: categoryData.name || categoryNames[0],
          slug: categoryData.slug || "",
          taxonomy: "category",
          description: categoryData.description || "",
        };
      }
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

        // Categories - convert WordPress.com structure to expected format
        ...(firstCategory
          ? {
              "wp:term": [[firstCategory]],
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
