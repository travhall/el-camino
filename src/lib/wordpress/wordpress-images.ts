// src/lib/wordpress/wordpress-images.ts
import { imageCache } from "@/lib/square/cacheUtils";
import { EL_CAMINO_LOGO_DATA_URI } from "@/lib/constants/assets";
import type { WordPressPost, OptimizedWordPressImages } from "./types";

export interface ImageOptimizationOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: "webp" | "jpeg" | "png" | "auto";
  fit?: "crop" | "resize" | "contain";
  gravity?: "center" | "top" | "bottom" | "left" | "right";
}

/**
 * Enhanced WordPress image optimization with caching
 * Uses Photon API with multiple subdomain support for performance
 */
export function optimizeWordPressImageCached(
  url: string,
  options: ImageOptimizationOptions = {}
): string {
  if (!url || (!url.includes("wordpress.com") && !url.includes("wp.com"))) {
    return url;
  }

  const cacheKey = `wp_img_${url}_${JSON.stringify(options)}`;

  return (
    imageCache.get(cacheKey) ||
    (() => {
      const optimized = optimizeWordPressImage(url, options);
      imageCache.set(cacheKey, optimized);
      return optimized;
    })()
  );
}

/**
 * Core WordPress image optimization using Photon API
 */
export function optimizeWordPressImage(
  url: string,
  options: ImageOptimizationOptions = {}
): string {
  if (!url || (!url.includes("wordpress.com") && !url.includes("wp.com"))) {
    return url;
  }

  try {
    // Extract the image path from WordPress URL
    const urlObj = new URL(url);
    const imagePath = urlObj.pathname + urlObj.search;

    // Use multiple subdomains for parallel downloads (Photon best practice)
    const subdomains = ["i0", "i1", "i2"];
    const subdomain = subdomains[Math.abs(hashCode(url)) % subdomains.length];

    // Build Photon URL with optimizations
    const photonUrl = new URL(`https://${subdomain}.wp.com${imagePath}`);

    // Apply optimizations as query parameters
    if (options.width)
      photonUrl.searchParams.set("w", options.width.toString());
    if (options.height)
      photonUrl.searchParams.set("h", options.height.toString());
    if (options.quality)
      photonUrl.searchParams.set("quality", options.quality.toString());
    if (options.format && options.format !== "auto")
      photonUrl.searchParams.set("format", options.format);
    if (options.fit && options.fit !== "resize")
      photonUrl.searchParams.set("fit", options.fit);
    if (options.gravity && options.gravity !== "center")
      photonUrl.searchParams.set("gravity", options.gravity);

    // Default optimizations for better performance
    if (!options.quality) photonUrl.searchParams.set("quality", "85");
    if (!options.format) photonUrl.searchParams.set("format", "webp");

    return photonUrl.toString();
  } catch (error) {
    console.warn("Error optimizing WordPress image:", error);
    return url;
  }
}

/**
 * Generate responsive srcSet for WordPress images
 */
export function generateWordPressSrcSetCached(
  url: string,
  options: ImageOptimizationOptions = {}
): string {
  if (!url) return "";

  const cacheKey = `wp_srcset_${url}_${JSON.stringify(options)}`;

  return (
    imageCache.get(cacheKey) ||
    (() => {
      const srcSet = generateWordPressSrcSet(url, options);
      imageCache.set(cacheKey, srcSet);
      return srcSet;
    })()
  );
}

/**
 * Core responsive srcSet generation
 */
export function generateWordPressSrcSet(
  url: string,
  options: ImageOptimizationOptions = {}
): string {
  if (!url || (!url.includes("wordpress.com") && !url.includes("wp.com"))) {
    return "";
  }

  const baseWidth = options.width || 800;
  const widths = [
    Math.round(baseWidth * 0.5), // 50%
    Math.round(baseWidth * 0.75), // 75%
    baseWidth, // 100%
    Math.round(baseWidth * 1.5), // 150%
    Math.round(baseWidth * 2), // 200%
  ].filter((w, i, arr) => arr.indexOf(w) === i); // Remove duplicates

  const srcSetEntries = widths.map((width) => {
    const optimizedUrl = optimizeWordPressImage(url, {
      ...options,
      width,
    });
    return `${optimizedUrl} ${width}w`;
  });

  return srcSetEntries.join(", ");
}

/**
 * Batch optimize WordPress images for multiple posts
 * More efficient than individual optimization
 */
export function batchOptimizeWordPressImages(
  posts: WordPressPost[],
  options: {
    featured?: ImageOptimizationOptions;
    avatar?: ImageOptimizationOptions;
    thumbnail?: ImageOptimizationOptions;
  } = {}
): Map<string, OptimizedWordPressImages> {
  const results = new Map<string, OptimizedWordPressImages>();

  // Extract all image URLs to avoid duplicate processing
  const imageUrlsToProcess = new Map<
    string,
    { type: string; postId: string }
  >();

  posts.forEach((post) => {
    const postId = post.id.toString();
    const featuredMedia = post._embedded?.["wp:featuredmedia"]?.[0];
    const author = post._embedded?.author?.[0];

    if (featuredMedia?.source_url) {
      imageUrlsToProcess.set(featuredMedia.source_url, {
        type: "featured",
        postId,
      });
    }

    if (author?.avatar_urls?.["96"]) {
      imageUrlsToProcess.set(author.avatar_urls["96"], {
        type: "avatar",
        postId,
      });
    }
  });

  // Process images in batches
  const processedImages = new Map<
    string,
    { optimized: string; srcSet: string }
  >();

  imageUrlsToProcess.forEach(({ type }, url) => {
    const opts = type === "avatar" ? options.avatar : options.featured;

    const optimized = optimizeWordPressImageCached(url, opts);
    const srcSet =
      type === "featured" ? generateWordPressSrcSetCached(url, opts) : "";

    processedImages.set(url, { optimized, srcSet });
  });

  // Map results back to posts
  posts.forEach((post) => {
    const postId = post.id.toString();
    const featuredMedia = post._embedded?.["wp:featuredmedia"]?.[0];
    const author = post._embedded?.author?.[0];

    const featuredUrl = featuredMedia?.source_url;
    const avatarUrl = author?.avatar_urls?.["96"];

    const featuredResult = featuredUrl
      ? processedImages.get(featuredUrl)
      : null;
    const avatarResult = avatarUrl ? processedImages.get(avatarUrl) : null;

    if (featuredResult) {
      results.set(postId, {
        main: featuredResult.optimized,
        srcSet: featuredResult.srcSet,
        avatar: avatarResult?.optimized,
      });
    }
  });

  return results;
}

/**
 * Get optimal image sizes for different contexts
 */
export function getOptimalImageSizes(
  context: "featured" | "card" | "thumbnail" | "avatar"
): ImageOptimizationOptions {
  switch (context) {
    case "featured":
      return {
        width: 1200,
        height: 630,
        quality: 90,
        format: "webp",
        fit: "crop",
        gravity: "center",
      };

    case "card":
      return {
        width: 600,
        height: 400,
        quality: 85,
        format: "webp",
        fit: "crop",
        gravity: "center",
      };

    case "thumbnail":
      return {
        width: 300,
        height: 200,
        quality: 80,
        format: "webp",
        fit: "crop",
        gravity: "center",
      };

    case "avatar":
      return {
        width: 96,
        height: 96,
        quality: 85,
        format: "webp",
        fit: "crop",
        gravity: "center",
      };

    default:
      return {
        quality: 85,
        format: "webp",
      };
  }
}

/**
 * Generate placeholder image for failed loads
 */
export function generatePlaceholderImage(
  width: number = 600,
  height: number = 400,
  text: string = "El Camino"
): string {
  // Use El Camino branded logo as consistent fallback for all failed images
  return EL_CAMINO_LOGO_DATA_URI;
}

/**
 * Check if image URL is valid and accessible
 */
export async function validateImageUrl(url: string): Promise<boolean> {
  if (!url) return false;

  try {
    const response = await fetch(url, { method: "HEAD" });
    const isImage =
      response.headers.get("content-type")?.startsWith("image/") ?? false;
    return response.ok && isImage;
  } catch {
    return false;
  }
}

/**
 * Get image dimensions from URL (if available in metadata)
 */
export function extractImageDimensions(
  featuredMedia: { media_details?: { width: number; height: number } } | null
): { width: number; height: number } | null {
  if (
    featuredMedia?.media_details?.width &&
    featuredMedia?.media_details?.height
  ) {
    return {
      width: featuredMedia.media_details.width,
      height: featuredMedia.media_details.height,
    };
  }
  return null;
}

/**
 * Simple hash function for consistent subdomain distribution
 */
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Clear image cache for WordPress images
 */
export function clearWordPressImageCache(): void {
  // This would require access to imageCache internals or a method to filter keys
  // For now, we can clear the entire image cache or add a method to Cache class
  console.log("[WordPress Images] Cache would be cleared here");
  // imageCache.clearByPrefix('wp_img_');
}

/**
 * Preload critical images for better performance
 */
export function preloadCriticalImages(imageUrls: string[]): void {
  if (typeof window === "undefined") return;

  imageUrls.slice(0, 6).forEach((url) => {
    // Only preload first 6 images
    if (url) {
      const link = document.createElement("link");
      link.rel = "preload";
      link.as = "image";
      link.href = url;
      document.head.appendChild(link);
    }
  });
}
