/**
 * Enhanced Image Optimization with AVIF-first strategy
 * File: src/lib/image/enhanced-optimizer.ts
 */

import { SHIMMER_PLACEHOLDER_DATA_URI } from '@/lib/constants/assets';
import { toNetlifyImageCDN } from './netlifyImageCDN';

export interface ModernImageOptions {
  width?: number;
  height?: number;
  quality?: number;
  formats?: ('avif' | 'webp' | 'jpeg')[];
  sizes?: string;
  priority?: boolean;
  placeholder?: 'blur' | 'shimmer' | 'none';
  progressive?: boolean;
  eager?: boolean;
}

export interface ResponsiveImageSet {
  avif?: string;
  webp?: string;
  jpeg: string;
  sizes: string;
  placeholder: string;
  aspectRatio: number;
}

export class EnhancedImageOptimizer {
  private static readonly QUALITY_SETTINGS = {
    // PHASE 4 TRACK B: Further optimized quality settings for LCP improvement
    // Target: -300ms to -600ms faster downloads on WordPress images
    avif: { high: 62, medium: 48, low: 35 }, // -3 from high/medium
    webp: { high: 78, medium: 68, low: 58 }, // -4 from high/medium
    jpeg: { high: 85, medium: 75, low: 68 }, // -3 from high/medium
  };

  /**
   * Generate optimized image sources for Square CDN
   */
  static generateOptimizedSources(
    src: string,
    options: ModernImageOptions = {}
  ): ResponsiveImageSet {
    // Support Square CDN, Square's S3 (production + sandbox), and WordPress images
    const isSquareImage =
      src.includes('squarecdn.com') ||
      src.includes('.s3.amazonaws.com') ||
      src.includes('.s3-');

    const isWordPressImage =
      src.includes('wordpress.com') || src.includes('wp.com');

    if (!isSquareImage && !isWordPressImage) {
      return this.fallbackImageSet(src, options);
    }

    const {
      width = 800,
      height,
      quality = 'medium',
      formats = ['avif', 'webp', 'jpeg'],
      sizes = '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw',
    } = options;

    const aspectRatio = height ? width / height : 16 / 9;
    const qualitySettings =
      typeof quality === 'string'
        ? this.QUALITY_SETTINGS
        : {
            avif: { medium: quality },
            webp: { medium: quality },
            jpeg: { medium: quality },
          };

    const result: ResponsiveImageSet = {
      sizes,
      aspectRatio,
      jpeg: this.optimizeSquareImageUrl(src, {
        width,
        height,
        quality: qualitySettings.jpeg.medium,
        format: 'auto',
      }),
      placeholder: this.generatePlaceholder(src, options.placeholder),
    };

    // Generate AVIF if supported/requested
    if (formats.includes('avif')) {
      result.avif = this.optimizeSquareImageUrl(src, {
        width,
        height,
        quality: qualitySettings.avif.medium,
        format: 'avif',
      });
    }

    // Generate WebP if supported/requested
    if (formats.includes('webp')) {
      result.webp = this.optimizeSquareImageUrl(src, {
        width,
        height,
        quality: qualitySettings.webp.medium,
        format: 'webp',
      });
    }

    return result;
  }

  /**
   * Generate responsive srcset for different screen sizes
   */
  static generateResponsiveSrcSet(
    src: string,
    format: 'avif' | 'webp' | 'jpeg',
    options: ModernImageOptions = {}
  ): string {
    const baseWidth = options.width || 800;
    const quality = this.getQualityForFormat(format, options.quality);

    const breakpoints = [320, 640, 768, 1024, 1280, 1920];
    const srcsetEntries: string[] = [];

    breakpoints.forEach((width) => {
      if (width <= baseWidth * 1.5) {
        // Don't upscale beyond 150%
        const height = options.height
          ? Math.round((options.height * width) / baseWidth)
          : undefined;
        const optimizedUrl = this.optimizeSquareImageUrl(src, {
          width,
          height,
          quality,
          format: format === 'jpeg' ? 'auto' : format,
        });
        srcsetEntries.push(`${optimizedUrl} ${width}w`);
      }
    });

    return srcsetEntries.join(', ');
  }

  /**
   * Optimize image URLs through Netlify CDN
   * PHASE 4: Enhanced WordPress image optimization for LCP improvement
   */
  private static optimizeSquareImageUrl(
    src: string,
    options: {
      width?: number;
      height?: number;
      quality?: number;
      format?: string;
    }
  ): string {
    try {
      const url = new URL(src);

      // Check if this is a Square image (S3 or squarecdn.com)
      // Fix: S3 regional URLs include region (e.g., s3.us-west-2.amazonaws.com)
      const isSquareImage =
        url.hostname.includes('.s3.') || // Matches s3.us-west-2.amazonaws.com
        url.hostname.includes('.s3-') || // Matches s3-region.amazonaws.com
        url.hostname.includes('squarecdn.com');

      // Check if this is a WordPress image
      const isWordPressImage =
        url.hostname.includes('wordpress.com') ||
        url.hostname.includes('wp.com');

      if (isSquareImage || isWordPressImage) {
        // PHASE 4 TRACK B: Aggressive compression for WordPress LCP
        // Reduced to quality=75 for 20-30% smaller files with imperceptible quality loss
        // Expected: -400ms to -700ms LCP improvement on article pages
        const optimizedQuality = isWordPressImage
          ? Math.min(options.quality || 75, 75) // Cap at 75 for WordPress (was 80)
          : options.quality || 85; // Keep 85 for Square product images

        // Proxy ALL supported images through Netlify Image CDN
        // Enables automatic AVIF/WebP conversion + edge caching.
        // Square product images: fit=cover with the height. WordPress content
        // images: width only (fit null), so the aspect ratio is preserved.
        // Format: an explicit one wins; otherwise WordPress asks for AVIF
        // (falls back automatically if the browser can't).
        return toNetlifyImageCDN(src, options.width || 600, {
          quality: optimizedQuality,
          fit: isSquareImage && options.height ? 'cover' : null,
          height: isSquareImage ? options.height : undefined,
          format:
            options.format && options.format !== 'auto'
              ? options.format
              : isWordPressImage
                ? 'avif'
                : undefined,
        });
      }

      // Non-supported images pass through unchanged
      return src;
    } catch {
      return src;
    }
  }

  /**
   * Generate placeholder image
   */
  private static generatePlaceholder(
    src: string,
    type: 'blur' | 'shimmer' | 'none' = 'blur'
  ): string {
    if (type === 'none') return '';

    if (type === 'blur') {
      return this.optimizeSquareImageUrl(src, {
        width: 40,
        height: 30,
        quality: 20,
        format: 'auto',
      });
    }

    // Return shimmer data URL
    return SHIMMER_PLACEHOLDER_DATA_URI;
  }

  /**
   * Get quality setting for specific format
   */
  private static getQualityForFormat(
    format: 'avif' | 'webp' | 'jpeg',
    quality: number | string = 'medium'
  ): number {
    if (typeof quality === 'number') return quality;

    return this.QUALITY_SETTINGS[format][
      quality as keyof typeof this.QUALITY_SETTINGS.avif
    ];
  }

  /**
   * Fallback for non-Square CDN images
   */
  private static fallbackImageSet(
    src: string,
    options: ModernImageOptions = {}
  ): ResponsiveImageSet {
    // For S3 or other non-CDN images, still provide proper responsive attributes
    const width = options.width || 800;
    const height = options.height || (width * 9) / 16;

    return {
      jpeg: src, // Original URL, can't optimize
      sizes: options.sizes || '100vw',
      placeholder: SHIMMER_PLACEHOLDER_DATA_URI, // Use shimmer instead of empty
      aspectRatio: height / width,
    };
  }
}

export default EnhancedImageOptimizer;

// Kept here so existing imports keep working; the builder lives in its own module.
export { toNetlifyImageCDN } from './netlifyImageCDN';
