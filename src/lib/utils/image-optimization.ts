/**
 * Basic Image Optimization Utility for El Camino
 * Simple URL parameter optimization - works alongside EnhancedImageOptimizer
 */

export interface BasicImageOptions {
  width?: number;
  height?: number;
  quality?: number;
}

/**
 * Basic image URL optimization for any CDN that supports URL parameters
 */
export function optimizeImageUrl(url: string, options: BasicImageOptions = {}): string {
  if (!url) return '';

  const { width = 800, height, quality = 85 } = options;

  try {
    // Square CDN optimization 
    if (url.includes('squarecdn.com')) {
      const squareUrl = new URL(url);
      squareUrl.searchParams.set('w', width.toString());
      if (height) squareUrl.searchParams.set('h', height.toString());
      squareUrl.searchParams.set('q', quality.toString());
      squareUrl.searchParams.set('f', 'auto');
      return squareUrl.toString();
    }
    
    // WordPress image optimization
    if (url.includes('wp-content') || url.includes('wordpress')) {
      const wpUrl = new URL(url);
      wpUrl.searchParams.set('w', width.toString());
      if (height) wpUrl.searchParams.set('h', height.toString());
      return wpUrl.toString();
    }
    
    // Gravatar optimization  
    if (url.includes('gravatar.com')) {
      const gravatarUrl = new URL(url);
      const size = Math.max(width, height || width);
      gravatarUrl.searchParams.set('s', size.toString());
      return gravatarUrl.toString();
    }
    
    return url;
  } catch (error) {
    return url;
  }
}

/**
 * Generate optimized image for different contexts
 */
export function optimizeForContext(url: string, context: 'card' | 'hero' | 'thumbnail' | 'avatar' | 'gallery'): string {
  const contextSettings = {
    card: { width: 600, height: 400, quality: 85 },
    hero: { width: 1200, height: 800, quality: 90 },
    thumbnail: { width: 300, height: 200, quality: 80 },
    avatar: { width: 96, height: 96, quality: 85 },
    gallery: { width: 800, height: 600, quality: 85 }
  };

  return optimizeImageUrl(url, contextSettings[context]);
}

export default optimizeImageUrl;
