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
  "wp:term"?: [[WordPressTerm]];
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
  featuredMedia: WordPressFeaturedMedia | null;
  author: WordPressAuthor | null;
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
 * Safe data extraction with fallbacks
 */
export function extractEmbeddedData(
  post: WordPressPost
): ExtractedWordPressData {
  if (!post._embedded) {
    return { category: null, featuredMedia: null, author: null };
  }

  try {
    return {
      category: post._embedded["wp:term"]?.[0]?.[0] || null,
      featuredMedia: post._embedded["wp:featuredmedia"]?.[0] || null,
      author: post._embedded.author?.[0] || null,
    };
  } catch (error) {
    console.warn("Error extracting embedded data:", error);
    return { category: null, featuredMedia: null, author: null };
  }
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
 * Generate structured data for SEO
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
