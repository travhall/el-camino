// src/lib/wordpress/types.ts

export interface WordPressPost {
  id: number;
  date: string;
  slug: string;
  title: {
    rendered: string;
  };
  excerpt: {
    rendered: string;
  };
  content: {
    rendered: string;
  };
  _embedded?: WordPressEmbedded;
}

export interface WordPressPage {
  id: number;
  date: string;
  slug: string;
  title: {
    rendered: string;
  };
  content: {
    rendered: string;
  };
  _embedded?: WordPressEmbedded;
}

export interface WordPressEmbedded {
  "wp:featuredmedia"?: [WordPressFeaturedMedia];
  "wp:term"?: [WordPressTerm[]]; // FIXED: Array containing one array of terms
  author?: [WordPressAuthor];
}

export interface WordPressFeaturedMedia {
  source_url: string;
  alt_text?: string;
  caption?: { rendered: string };
  media_details?: {
    width: number;
    height: number;
    sizes?: {
      [key: string]: {
        source_url: string;
        width: number;
        height: number;
      };
    };
  };
}

export interface WordPressTerm {
  name: string;
  slug: string;
  taxonomy: string;
  description?: string;
}

export interface WordPressAuthor {
  name: string;
  avatar_urls: {
    "24"?: string;
    "48"?: string;
    "96"?: string;
  };
  description?: string;
  url?: string;
}

// Enhanced data extraction with error boundaries
export interface ExtractedWordPressData {
  category: WordPressTerm | null;
  categories: WordPressTerm[]; // NEW: All categories for this post
  featuredMedia: WordPressFeaturedMedia | null;
  author: WordPressAuthor | null;
  tags: WordPressTerm[]; // Add tags array
}

export interface WordPressFallbackContent {
  title: string;
  excerpt: string;
  imageAlt: string;
}

export interface OptimizedWordPressImages {
  main: string;
  srcSet: string;
  avatar?: string;
}

export interface ProcessedWordPressPost {
  post: WordPressPost;
  embeddedData: ExtractedWordPressData;
  fallbackContent: WordPressFallbackContent;
  optimizedImages?: OptimizedWordPressImages;
  structuredData: ArticleStructuredData;
}

export interface ArticleStructuredData {
  "@context": "https://schema.org";
  "@type": "Article";
  headline: string;
  image?: string;
  author: {
    "@type": "Person";
    name: string;
  };
  publisher: {
    "@type": "Organization";
    name: string;
    logo: {
      "@type": "ImageObject";
      url: string;
    };
  };
  datePublished: string;
  dateModified?: string;
  articleSection?: string;
  description: string;
  wordCount?: number;
  keywords?: string[]; // Add keywords for SEO
}

/**
 * Type guards for safe data extraction
 */
export function isValidWordPressPost(post: any): post is WordPressPost {
  return (
    post &&
    typeof post.id === "number" &&
    typeof post.slug === "string" &&
    post.title?.rendered &&
    post.excerpt?.rendered !== undefined &&
    post.content?.rendered !== undefined
  );
}

export function isValidWordPressPage(page: any): page is WordPressPage {
  return (
    page &&
    typeof page.id === "number" &&
    typeof page.slug === "string" &&
    page.title?.rendered &&
    page.content?.rendered !== undefined
  );
}

/**
 * Get the primary category for display, preferring non-Featured categories
 */
export function getPrimaryCategory(
  categories: WordPressTerm[]
): WordPressTerm | null {
  if (!categories || categories.length === 0) {
    return null;
  }

  // First, try to find a non-Featured category
  const nonFeaturedCategory = categories.find(
    (cat) => cat.name.toLowerCase() !== "featured"
  );

  if (nonFeaturedCategory) {
    return nonFeaturedCategory;
  }

  // If only Featured categories exist, return the first one
  return categories[0];
}

/**
 * Enhanced data extraction with better category handling - UPDATED to include all categories and tags
 */
export function extractEmbeddedData(
  post: WordPressPost
): ExtractedWordPressData {
  if (!post._embedded) {
    return {
      category: null,
      categories: [],
      featuredMedia: null,
      author: null,
      tags: [],
    };
  }

  try {
    // Extract all terms
    const allTerms = post._embedded["wp:term"]?.[0] || [];

    // Separate categories and tags
    const categories = allTerms.filter((term) => term.taxonomy === "category");
    const tags = allTerms.filter((term) => term.taxonomy === "post_tag");

    // Get primary category (prefer non-Featured categories)
    const primaryCategory = getPrimaryCategory(categories);

    return {
      category: primaryCategory,
      categories: categories,
      featuredMedia: post._embedded["wp:featuredmedia"]?.[0] || null,
      author: post._embedded.author?.[0] || null,
      tags: tags,
    };
  } catch (error) {
    console.warn("Error extracting embedded data:", error);
    return {
      category: null,
      categories: [],
      featuredMedia: null,
      author: null,
      tags: [],
    };
  }
}

/**
 * Check if post has "Featured" category
 */
export function isFeaturedPost(post: WordPressPost): boolean {
  const embeddedData = extractEmbeddedData(post);
  return embeddedData.categories.some(
    (cat) => cat.name.toLowerCase() === "featured"
  );
}

/**
 * Get display-friendly category name with fallback logic
 */
export function getDisplayCategory(post: WordPressPost): string | null {
  const embeddedData = extractEmbeddedData(post);

  if (!embeddedData.category) {
    return null;
  }

  return embeddedData.category.name;
}

/**
 * Content sanitization and fallback generation
 */
export function sanitizeHtmlContent(html: string): string {
  if (!html || typeof html !== "string") return "";

  // Remove HTML tags and decode entities
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .trim();
}

export function generateFallbackContent(
  post: WordPressPost
): WordPressFallbackContent {
  const cleanTitle =
    sanitizeHtmlContent(post.title.rendered) || "Untitled Article";
  const cleanExcerpt = sanitizeHtmlContent(post.excerpt.rendered);

  return {
    title: cleanTitle,
    excerpt: cleanExcerpt || "Read this interesting article from El Camino.",
    imageAlt: `Featured image for: ${cleanTitle}`,
  };
}

/**
 * Generate structured data for SEO - UPDATED to include tags as keywords
 */
export function generateStructuredData(
  post: WordPressPost,
  embeddedData: ExtractedWordPressData,
  fallbackContent: WordPressFallbackContent,
  siteUrl: string
): ArticleStructuredData {
  const wordCount = post.content.rendered
    ? sanitizeHtmlContent(post.content.rendered).split(/\s+/).length
    : undefined;

  // Extract tag names for SEO keywords
  const keywords =
    embeddedData.tags.length > 0
      ? embeddedData.tags.map((tag) => tag.name)
      : undefined;

  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: fallbackContent.title,
    image: embeddedData.featuredMedia?.source_url,
    author: {
      "@type": "Person",
      name: embeddedData.author?.name || "El Camino",
    },
    publisher: {
      "@type": "Organization",
      name: "El Camino Skate Shop",
      logo: {
        "@type": "ImageObject",
        url: `${siteUrl}/logo.png`,
      },
    },
    datePublished: post.date,
    dateModified: post.date,
    articleSection: embeddedData.category?.name,
    description: fallbackContent.excerpt,
    wordCount,
    keywords,
  };
}

/**
 * Word count and reading time estimation
 */
export function estimateReadingTime(content: string): {
  wordCount: number;
  readingTimeMinutes: number;
} {
  const cleanContent = sanitizeHtmlContent(content);
  const wordCount = cleanContent
    .split(/\s+/)
    .filter((word) => word.length > 0).length;
  const readingTimeMinutes = Math.max(1, Math.round(wordCount / 200)); // Average 200 WPM

  return { wordCount, readingTimeMinutes };
}

/**
 * Generate safe URL slug from title
 */
export function generateSlugFromTitle(title: string): string {
  return sanitizeHtmlContent(title)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Check if post/page has valid featured image
 */
export function hasFeaturedImage(post: WordPressPost | WordPressPage): boolean {
  return !!post._embedded?.["wp:featuredmedia"]?.[0]?.source_url;
}

/**
 * Get featured image with fallback
 */
export function getFeaturedImageUrl(
  post: WordPressPost | WordPressPage,
  fallback?: string
): string | null {
  const imageUrl = post._embedded?.["wp:featuredmedia"]?.[0]?.source_url;
  return imageUrl || fallback || null;
}

/**
 * Get author avatar with fallback to initials
 */
export function getAuthorAvatar(author: WordPressAuthor | null): {
  url: string | null;
  initials: string;
} {
  if (!author) {
    return { url: null, initials: "EC" }; // El Camino fallback
  }

  const avatarUrl =
    author.avatar_urls?.["96"] || author.avatar_urls?.["48"] || null;
  const initials = author.name
    ? author.name
        .split(" ")
        .map((part) => part.charAt(0))
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "EC";

  return { url: avatarUrl, initials };
}

/**
 * Format publish date for display
 */
export function formatPublishDate(dateString: string): {
  iso: string;
  display: string;
  relative: string;
} {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffInDays = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
    );

    let relative: string;
    if (diffInDays === 0) {
      relative = "Today";
    } else if (diffInDays === 1) {
      relative = "Yesterday";
    } else if (diffInDays < 7) {
      relative = `${diffInDays} days ago`;
    } else if (diffInDays < 30) {
      const weeks = Math.floor(diffInDays / 7);
      relative = `${weeks} week${weeks > 1 ? "s" : ""} ago`;
    } else {
      relative = date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    }

    return {
      iso: date.toISOString(),
      display: date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      relative,
    };
  } catch (error) {
    const fallbackDate = new Date().toISOString();
    return {
      iso: fallbackDate,
      display: "Date unavailable",
      relative: "Recently",
    };
  }
}

/**
 * Helper functions for tag handling
 */

/**
 * Check if post has tags
 */
export function hasTagsAvailable(post: WordPressPost): boolean {
  const embeddedData = extractEmbeddedData(post);
  return embeddedData.tags.length > 0;
}

/**
 * Get formatted tag list for display
 */
export function getFormattedTags(tags: WordPressTerm[]): Array<{
  name: string;
  slug: string;
  url: string;
}> {
  return tags.map((tag) => ({
    name: tag.name,
    slug: tag.slug,
    url: `/news/tag/${tag.slug}`, // Future tag archive URL
  }));
}

/**
 * Get most popular tags from a collection of posts
 */
export function getPopularTags(
  posts: WordPressPost[],
  limit: number = 10
): Array<{
  tag: WordPressTerm;
  count: number;
}> {
  const tagCounts = new Map<string, { tag: WordPressTerm; count: number }>();

  posts.forEach((post) => {
    const embeddedData = extractEmbeddedData(post);
    embeddedData.tags.forEach((tag) => {
      const existing = tagCounts.get(tag.slug);
      if (existing) {
        existing.count++;
      } else {
        tagCounts.set(tag.slug, { tag, count: 1 });
      }
    });
  });

  return Array.from(tagCounts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export interface NewsFilterOptions {
  categories: Array<{ name: string; slug: string; count: number }>;
  tags: Array<{ name: string; slug: string; count: number }>;
  authors: Array<{ name: string; slug: string; count: number }>;
  dateRanges: Array<{ name: string; value: string; count: number }>;
}

export interface NewsFilterState {
  search: string;
  sort: "newest" | "oldest" | "alphabetical" | "alphabetical-desc";
  categories: string[];
  tags: string[];
  authors: string[];
  dateRange: string;
}

export interface ProcessedNewsData {
  allPosts: WordPressPost[];
  featuredPost: WordPressPost | null;
  regularPosts: WordPressPost[];
  filterOptions: NewsFilterOptions;
  searchIndex: NewsSearchIndex;
}

export interface NewsSearchIndex {
  posts: Array<{
    id: number;
    slug: string;
    searchableContent: string;
    title: string;
    excerpt: string;
  }>;
}

/**
 * Build search index for client-side search
 */
export function buildSearchIndex(posts: WordPressPost[]): NewsSearchIndex {
  return {
    posts: posts.map((post) => ({
      id: post.id,
      slug: post.slug,
      title: post.title.rendered,
      excerpt: sanitizeHtmlContent(post.excerpt.rendered),
      searchableContent: [
        post.title.rendered,
        sanitizeHtmlContent(post.excerpt.rendered),
        sanitizeHtmlContent(post.content.rendered),
      ]
        .join(" ")
        .toLowerCase(),
    })),
  };
}

/**
 * Build filter options from posts data
 */
export function buildFilterOptions(
  posts: WordPressPost[],
  categories: Array<{ name: string; slug: string; count: number }>,
  tags: Array<{ name: string; slug: string; count: number }>
): NewsFilterOptions {
  // Build author counts
  const authorCounts = new Map<
    string,
    { name: string; slug: string; count: number }
  >();

  posts.forEach((post) => {
    const embeddedData = extractEmbeddedData(post);
    if (embeddedData.author) {
      const authorSlug = embeddedData.author.name
        .toLowerCase()
        .replace(/\s+/g, "-");
      const existing = authorCounts.get(authorSlug);
      if (existing) {
        existing.count++;
      } else {
        authorCounts.set(authorSlug, {
          name: embeddedData.author.name,
          slug: authorSlug,
          count: 1,
        });
      }
    }
  });

  // Build date range counts
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

  const dateRanges = [
    {
      name: "Past week",
      value: "week",
      count: posts.filter((post) => new Date(post.date) >= oneWeekAgo).length,
    },
    {
      name: "Past month",
      value: "month",
      count: posts.filter((post) => new Date(post.date) >= oneMonthAgo).length,
    },
    {
      name: "Past year",
      value: "year",
      count: posts.filter((post) => new Date(post.date) >= oneYearAgo).length,
    },
  ].filter((range) => range.count > 0);

  return {
    categories,
    tags,
    authors: Array.from(authorCounts.values()).sort(
      (a, b) => b.count - a.count
    ),
    dateRanges,
  };
}
