// src/lib/wordpress/content-utils.ts
// Utility functions for processing WordPress content

/**
 * Clean and sanitize WordPress content for display
 */
export function sanitizeWordPressContent(content: string): string {
  if (!content) return "";

  // Remove WordPress's automatic p tags around images
  return (
    content
      .replace(/<p>(\s*<img[^>]*>\s*)<\/p>/gi, "$1")
      .replace(/<p>(\s*<figure[^>]*>[\s\S]*?<\/figure>\s*)<\/p>/gi, "$1")
      .replace(/<p>(\s*<iframe[^>]*>[\s\S]*?<\/iframe>\s*)<\/p>/gi, "$1")
      // Fix WordPress's sometimes broken figure captions
      .replace(/<figcaption class="wp-element-caption">/gi, "<figcaption>")
      // Ensure proper spacing around blocks
      .replace(
        /(<\/figure>|<\/blockquote>|<\/div>)(\s*)(<h[1-6])/gi,
        "$1\n\n$3"
      )
      // Clean up extra whitespace
      .replace(/\n\s*\n\s*\n/g, "\n\n")
      .trim()
  );
}

/**
 * Extract first paragraph as excerpt if needed
 */
export function extractExcerpt(
  content: string,
  maxLength: number = 160
): string {
  if (!content) return "";

  // Strip HTML tags
  const textOnly = content
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (textOnly.length <= maxLength) {
    return textOnly;
  }

  // Find the last complete word within the limit
  const trimmed = textOnly.substring(0, maxLength);
  const lastSpace = trimmed.lastIndexOf(" ");

  return lastSpace > 0
    ? trimmed.substring(0, lastSpace) + "..."
    : trimmed + "...";
}

/**
 * Calculate estimated reading time
 */
export function calculateReadingTime(content: string): {
  minutes: number;
  seconds: number;
  text: string;
} {
  if (!content) return { minutes: 0, seconds: 0, text: "0 min read" };

  const wordsPerMinute = 200;
  const textOnly = content
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const wordCount = textOnly
    .split(" ")
    .filter((word) => word.length > 0).length;

  const totalMinutes = wordCount / wordsPerMinute;
  const minutes = Math.floor(totalMinutes);
  const seconds = Math.round((totalMinutes - minutes) * 60);

  let text: string;
  if (minutes === 0) {
    text = "< 1 min read";
  } else if (minutes === 1) {
    text = "1 min read";
  } else {
    text = `${minutes} min read`;
  }

  return { minutes, seconds, text };
}

/**
 * Get WordPress image URLs with optimization parameters
 */
export function optimizeWordPressImage(
  url: string,
  options: {
    width?: number;
    height?: number;
    quality?: number;
    crop?: boolean;
  } = {}
): string {
  if (!url || !url.includes("wordpress.com")) {
    return url;
  }

  const urlObj = new URL(url);
  const params = new URLSearchParams(urlObj.search);

  if (options.width) {
    params.set("w", options.width.toString());
  }

  if (options.height) {
    params.set("h", options.height.toString());
  }

  if (options.quality) {
    params.set("quality", options.quality.toString());
  }

  if (options.crop) {
    params.set("crop", "1");
  }

  // Default optimization
  if (!params.has("quality")) {
    params.set("quality", "85");
  }

  urlObj.search = params.toString();
  return urlObj.toString();
}

/**
 * Generate responsive image srcset for WordPress images
 */
export function generateWordPressSrcSet(
  url: string,
  baseWidth: number = 800
): string {
  if (!url || !url.includes("wordpress.com")) {
    return "";
  }

  const sizes = [
    Math.round(baseWidth * 0.5),
    Math.round(baseWidth * 0.75),
    baseWidth,
    Math.round(baseWidth * 1.5),
    Math.round(baseWidth * 2),
  ];

  return sizes
    .map((width) => `${optimizeWordPressImage(url, { width })} ${width}w`)
    .join(", ");
}

/**
 * Extract all images from WordPress content for preloading
 */
export function extractContentImages(content: string): string[] {
  if (!content) return [];

  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  const images: string[] = [];
  let match;

  while ((match = imgRegex.exec(content)) !== null) {
    images.push(match[1]);
  }

  return images;
}

/**
 * Check if content has specific WordPress blocks
 */
export function hasWordPressBlock(content: string, blockType: string): boolean {
  if (!content) return false;

  const blockClass = `wp-block-${blockType}`;
  return content.includes(blockClass);
}

/**
 * Get WordPress block types used in content
 */
export function getWordPressBlocks(content: string): string[] {
  if (!content) return [];

  const blockRegex = /wp-block-([a-zA-Z0-9-]+)/g;
  const blocks = new Set<string>();
  let match;

  while ((match = blockRegex.exec(content)) !== null) {
    blocks.add(match[1]);
  }

  return Array.from(blocks);
}

/**
 * WordPress content analytics for debugging/optimization
 */
export function analyzeWordPressContent(content: string): {
  wordCount: number;
  readingTime: ReturnType<typeof calculateReadingTime>;
  blockTypes: string[];
  imageCount: number;
  hasGallery: boolean;
  hasVideo: boolean;
  hasCode: boolean;
  estimatedLoadTime: string;
} {
  const blocks = getWordPressBlocks(content);
  const images = extractContentImages(content);

  return {
    wordCount: content
      .replace(/<[^>]*>/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 0).length,
    readingTime: calculateReadingTime(content),
    blockTypes: blocks,
    imageCount: images.length,
    hasGallery: hasWordPressBlock(content, "gallery"),
    hasVideo:
      hasWordPressBlock(content, "video") ||
      hasWordPressBlock(content, "embed"),
    hasCode: hasWordPressBlock(content, "code") || content.includes("<pre>"),
    estimatedLoadTime:
      images.length > 5
        ? "Slow (5+ images)"
        : images.length > 2
        ? "Medium (2-5 images)"
        : "Fast",
  };
}
