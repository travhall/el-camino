/**
 * Simple image optimization utility focused on Square CDN
 * File: src/lib/image/optimizer.ts
 */

export interface ImageOptimizationOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: "auto" | "webp" | "avif";
  blur?: boolean;
}

export class ImageOptimizer {
  /**
   * Optimize Square CDN image URL with parameters
   */
  static optimizeSquareImage(
    src: string,
    options: ImageOptimizationOptions = {}
  ): string {
    if (!src.includes("squarecdn.com")) {
      return src;
    }

    try {
      const url = new URL(src);

      // Add optimization parameters
      if (options.width) url.searchParams.set("w", options.width.toString());
      if (options.height) url.searchParams.set("h", options.height.toString());
      if (options.quality)
        url.searchParams.set("q", options.quality.toString());
      if (options.format) url.searchParams.set("f", options.format);

      // Blur version for placeholders
      if (options.blur) {
        url.searchParams.set("w", "40");
        url.searchParams.set("h", "40");
        url.searchParams.set("q", "20");
        url.searchParams.set("blur", "5");
      }

      return url.toString();
    } catch {
      return src;
    }
  }

  /**
   * Generate responsive image sizes for different screen widths
   */
  static generateResponsiveSizes(baseSrc: string): {
    mobile: string;
    tablet: string;
    desktop: string;
    blur: string;
  } {
    return {
      mobile: this.optimizeSquareImage(baseSrc, {
        width: 400,
        height: 300,
        quality: 80,
        format: "auto",
      }),
      tablet: this.optimizeSquareImage(baseSrc, {
        width: 600,
        height: 400,
        quality: 85,
        format: "auto",
      }),
      desktop: this.optimizeSquareImage(baseSrc, {
        width: 800,
        height: 533,
        quality: 85,
        format: "auto",
      }),
      blur: this.optimizeSquareImage(baseSrc, { blur: true }),
    };
  }

  /**
   * Determine if image should be priority loaded based on position
   */
  static shouldPrioritizeImage(index: number, screenWidth?: number): boolean {
    // Calculate based on typical grid layouts
    const mobile = screenWidth && screenWidth < 640 ? 4 : 0; // 1 column x 4 rows
    const tablet = screenWidth && screenWidth < 1024 ? 8 : 0; // 2 columns x 4 rows
    const desktop = 12; // 3-4 columns x 3-4 rows

    if (mobile && index < mobile) return true;
    if (tablet && index < tablet) return true;
    return index < desktop;
  }
}

export default ImageOptimizer;
