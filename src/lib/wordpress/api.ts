// src/lib/wordpress/api.ts
import type { WordPressPage, WordPressPost } from "./types";

// Configuration
const WP_URL =
  "https://public-api.wordpress.com/rest/v1.1/sites/elcaminoskateshop.wordpress.com";
const MEMORY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const STORAGE_CACHE_TTL = 30 * 60 * 1000; // 30 minutes
const STORAGE_PREFIX = "wp_cache_";

// Cache interfaces
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

// In-memory cache
const memoryCache: Record<string, CacheEntry<any>> = {};

/**
 * Fetches data with dual-layer caching (memory and localStorage)
 * @param endpoint API endpoint to fetch
 * @param cacheKey Unique cache key
 * @returns Cached or fresh data
 */
async function fetchWithCache<T>(
  endpoint: string,
  cacheKey: string
): Promise<T> {
  const now = Date.now();

  // 1. Check memory cache first (fastest)
  if (
    memoryCache[cacheKey] &&
    now - memoryCache[cacheKey].timestamp < MEMORY_CACHE_TTL
  ) {
    return memoryCache[cacheKey].data;
  }

  // 2. Try localStorage next
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(`${STORAGE_PREFIX}${cacheKey}`);
      if (stored) {
        const parsedItem = JSON.parse(stored) as CacheEntry<T>;
        if (now - parsedItem.timestamp < STORAGE_CACHE_TTL) {
          // Refresh memory cache with localStorage data
          memoryCache[cacheKey] = parsedItem;
          return parsedItem.data;
        }
      }
    } catch (e) {
      // Silently fail on localStorage errors (might be disabled/private mode)
    }
  }

  // 3. Fetch fresh data
  try {
    const response = await fetch(`${WP_URL}${endpoint}`, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = (await response.json()) as T;

    // Update memory cache
    const cacheItem: CacheEntry<T> = { data, timestamp: now };
    memoryCache[cacheKey] = cacheItem;

    // Update localStorage when available
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(
          `${STORAGE_PREFIX}${cacheKey}`,
          JSON.stringify(cacheItem)
        );
      } catch (e) {
        // Silently fail on localStorage errors
      }
    }

    return data;
  } catch (error) {
    console.error(`API fetch error for ${endpoint}:`, error);
    throw error;
  }
}

/**
 * Process WordPress post data into our application format
 */
function processPost(post: any): WordPressPost {
  return {
    id: post.ID,
    date: post.date,
    slug: post.slug,
    title: { rendered: post.title },
    excerpt: { rendered: post.excerpt },
    content: { rendered: post.content },
    _embedded: post.featured_image
      ? {
          "wp:featuredmedia": [
            {
              source_url: post.featured_image,
              alt_text: post.title,
            },
          ],
        }
      : undefined,
  };
}

/**
 * Process WordPress page data into our application format
 */
function processPage(page: any): WordPressPage {
  return {
    id: page.ID,
    date: page.date,
    slug: page.slug,
    title: { rendered: page.title },
    content: { rendered: page.content },
    _embedded: page.featured_image
      ? {
          "wp:featuredmedia": [
            {
              source_url: page.featured_image,
              alt_text: page.title,
            },
          ],
        }
      : undefined,
  };
}

/**
 * Get all posts with caching
 */
export async function getPosts(): Promise<WordPressPost[]> {
  try {
    const data = await fetchWithCache<any>(
      "/posts?fields=ID,title,date,excerpt,content,slug,featured_image",
      "all_posts"
    );

    return Array.isArray(data.posts) ? data.posts.map(processPost) : [];
  } catch (error) {
    console.error("Error fetching posts:", error);
    return [];
  }
}

/**
 * Get a single post by slug with caching
 */
export async function getPost(slug: string): Promise<WordPressPost | null> {
  try {
    const cacheKey = `post_${slug}`;
    const post = await fetchWithCache<any>(
      `/posts/slug:${slug}?fields=ID,title,date,excerpt,content,slug,featured_image`,
      cacheKey
    );

    return processPost(post);
  } catch (error) {
    console.error(`Error fetching post "${slug}":`, error);
    return null;
  }
}

/**
 * Get all pages with caching
 */
export async function getAllPages(): Promise<WordPressPage[]> {
  try {
    const data = await fetchWithCache<any>(
      "/posts?type=page&fields=ID,title,date,content,slug,featured_image",
      "all_pages"
    );

    if (!data.posts || !Array.isArray(data.posts)) {
      return [];
    }

    return data.posts.map(processPage);
  } catch (error) {
    console.error("Error fetching pages:", error);
    return [];
  }
}

/**
 * Get a single page by slug with caching
 */
export async function getPage(slug: string): Promise<WordPressPage | null> {
  try {
    const cacheKey = `page_${slug}`;

    // Check cache first (allows faster lookup than searching through all pages)
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

    // Fallback: try to find the page in all pages (which are likely cached)
    const allPages = await getAllPages();
    const page = allPages.find((p) => p.slug === slug);

    return page || null;
  } catch (error) {
    console.error(`Error fetching page "${slug}":`, error);
    return null;
  }
}

// Predefined page collections
const FOOTER_PAGE_SLUGS = [
  "privacy-policy",
  "return-policy",
  "shipping-policy",
  "terms-and-conditions",
];

const NAV_PAGE_SLUGS = ["about", "products", "blog", "contact"];

/**
 * Get footer pages with caching
 */
export async function getFooterPages(): Promise<WordPressPage[]> {
  try {
    // Check for specialized cache first
    const cacheKey = "footer_pages";

    // Check if cached footer pages data exists (memory or localStorage)
    if (
      memoryCache[cacheKey] &&
      Date.now() - memoryCache[cacheKey].timestamp < MEMORY_CACHE_TTL
    ) {
      return memoryCache[cacheKey].data;
    }

    // Otherwise get all pages (likely cached) and filter
    const allPages = await getAllPages();
    const footerPages = allPages.filter((page) =>
      FOOTER_PAGE_SLUGS.includes(page.slug)
    );

    // Cache the result in memory
    memoryCache[cacheKey] = {
      data: footerPages,
      timestamp: Date.now(),
    };

    return footerPages;
  } catch (error) {
    console.error("Error fetching footer pages:", error);
    return [];
  }
}

/**
 * Get navigation pages with caching
 */
export async function getNavPages(): Promise<WordPressPage[]> {
  try {
    // Check for specialized cache first
    const cacheKey = "nav_pages";

    // Check if cached nav pages data exists (memory or localStorage)
    if (
      memoryCache[cacheKey] &&
      Date.now() - memoryCache[cacheKey].timestamp < MEMORY_CACHE_TTL
    ) {
      return memoryCache[cacheKey].data;
    }

    // Otherwise get all pages (likely cached) and filter
    const allPages = await getAllPages();
    const navPages = allPages.filter((page) =>
      NAV_PAGE_SLUGS.includes(page.slug)
    );

    // Cache the result in memory
    memoryCache[cacheKey] = {
      data: navPages,
      timestamp: Date.now(),
    };

    return navPages;
  } catch (error) {
    console.error("Error fetching navigation pages:", error);
    return [];
  }
}

/**
 * Clear all caches (memory and localStorage)
 */
export function clearAllCaches(): void {
  // Clear memory cache
  Object.keys(memoryCache).forEach((key) => {
    delete memoryCache[key];
  });

  // Clear localStorage cache
  if (typeof window !== "undefined") {
    try {
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith(STORAGE_PREFIX)) {
          localStorage.removeItem(key);
        }
      });
    } catch (e) {
      console.error("Error clearing localStorage cache:", e);
    }
  }
}

/**
 * Clear a specific cache item
 */
export function clearCacheItem(key: string): void {
  // Clear from memory cache
  if (memoryCache[key]) {
    delete memoryCache[key];
  }

  // Clear from localStorage
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
    } catch (e) {
      console.error(`Error clearing localStorage cache for key "${key}":`, e);
    }
  }
}

/**
 * Get cache statistics (for debugging)
 */
export function getCacheStats(): {
  memoryCacheSize: number;
  memoryCacheKeys: string[];
  storageCacheSize: number;
  storageCacheKeys: string[];
} {
  const memoryCacheKeys = Object.keys(memoryCache);
  let storageCacheKeys: string[] = [];

  // Check localStorage when available
  if (typeof window !== "undefined") {
    try {
      storageCacheKeys = Object.keys(localStorage)
        .filter((key) => key.startsWith(STORAGE_PREFIX))
        .map((key) => key.replace(STORAGE_PREFIX, ""));
    } catch (e) {
      console.error("Error getting localStorage stats:", e);
    }
  }

  return {
    memoryCacheSize: memoryCacheKeys.length,
    memoryCacheKeys,
    storageCacheSize: storageCacheKeys.length,
    storageCacheKeys,
  };
}
