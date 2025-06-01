// src/lib/wordpress/wordpress-images.ts

/**
 * Optimize WordPress.com image URLs with query parameters
 * WordPress.com supports Photon image service parameters
 */
export function optimizeWordPressImage(
  url: string,
  options: {
    width?: number;
    height?: number;
    quality?: number;
    format?: "webp" | "jpg" | "png";
    fit?: "cover" | "contain";
  } = {}
): string {
  if (!url || !url.includes("wordpress.com")) {
    return url;
  }

  const {
    width,
    height,
    quality = 85,
    format = "webp",
    fit = "cover",
  } = options;

  const params = new URLSearchParams();

  if (width) params.set("w", width.toString());
  if (height) params.set("h", height.toString());
  if (quality) params.set("quality", quality.toString());
  if (format === "webp") params.set("format", "webp");
  if (fit) params.set("fit", fit);

  // Add these WordPress.com optimization parameters
  params.set("strip", "all"); // Remove metadata
  params.set("zoom", "1"); // Prevent upscaling

  const baseUrl = url.split("?")[0];
  return `${baseUrl}?${params.toString()}`;
}

/**
 * Generate responsive image srcset for WordPress images
 */
export function generateWordPressSrcSet(
  url: string,
  sizes: number[] = [400, 800, 1200, 1600]
): string {
  if (!url || !url.includes("wordpress.com")) {
    return "";
  }

  return sizes
    .map((size) => `${optimizeWordPressImage(url, { width: size })} ${size}w`)
    .join(", ");
}
