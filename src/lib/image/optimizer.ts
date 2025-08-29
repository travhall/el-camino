/**
 * Image Optimization Pipeline - Phase 2 UX Enhancement
 * WebP/AVIF support with responsive sizing and CDN integration
 */

export interface ImageOptimizationConfig {
  formats: ImageFormat[];
  sizes: ResponsiveSize[];
  quality: QualitySettings;
  lazyLoading: boolean;
  placeholder: PlaceholderType;
}

export interface ResponsiveSize {
  breakpoint: number;
  width: number;
  height?: number;
}

export interface QualitySettings {
  avif: number;
  webp: number;
  jpeg: number;
}

export type ImageFormat = 'avif' | 'webp' | 'jpeg';
export type PlaceholderType = 'blur' | 'color' | 'svg';

class ImageOptimizer {
  private config: ImageOptimizationConfig = {
    formats: ['avif', 'webp', 'jpeg'],
    sizes: [
      { breakpoint: 320, width: 320 },
      { breakpoint: 768, width: 768 },
      { breakpoint: 1024, width: 1024 },
      { breakpoint: 1920, width: 1920 }
    ],
    quality: { avif: 85, webp: 85, jpeg: 90 },
    lazyLoading: true,
    placeholder: 'blur'
  };

  generatePictureElement(
    src: string, 
    alt: string, 
    options: Partial<ImageOptimizationConfig> = {}
  ): string {
    const config = { ...this.config, ...options };
    
    const sources = config.formats.slice(0, -1).map(format => 
      this.generateSource(src, format, config)
    ).join('\n    ');
    
    const fallbackSrc = this.generateSrcSet(src, 'jpeg', config);
    const sizes = this.generateSizes(config.sizes);
    
    return `
  <picture>
    ${sources}
    <img 
      src="${this.generateSingleSrc(src, 'jpeg', 800)}"
      srcset="${fallbackSrc}"
      sizes="${sizes}"
      alt="${alt}"
      ${config.lazyLoading ? 'loading="lazy"' : ''}
      ${this.generatePlaceholder(src, config.placeholder)}
      decoding="async"
      fetchpriority="${this.isAboveFold(src) ? 'high' : 'auto'}"
    />
  </picture>`.trim();
  }

  private generateSource(
    src: string, 
    format: ImageFormat, 
    config: ImageOptimizationConfig
  ): string {
    const srcset = this.generateSrcSet(src, format, config);
    const sizes = this.generateSizes(config.sizes);
    
    return `<source type="image/${format}" srcset="${srcset}" sizes="${sizes}" />`;
  }

  private generateSrcSet(
    src: string, 
    format: ImageFormat, 
    config: ImageOptimizationConfig
  ): string {
    return config.sizes
      .map(size => {
        const optimizedSrc = this.generateSingleSrc(src, format, size.width, config.quality[format]);
        return `${optimizedSrc} ${size.width}w`;
      })
      .join(', ');
  }

  private generateSingleSrc(
    src: string, 
    format: ImageFormat, 
    width: number, 
    quality?: number
  ): string {
    const baseUrl = this.getCDNUrl();
    const params = new URLSearchParams({
      f: format,
      w: width.toString(),
      ...(quality && { q: quality.toString() }),
      fit: 'cover'
    });
    
    return `${baseUrl}${src}?${params.toString()}`;
  }

  private generateSizes(sizes: ResponsiveSize[]): string {
    return sizes
      .map((size, index) => {
        if (index === sizes.length - 1) {
          return `${size.width}px`;
        }
        return `(max-width: ${size.breakpoint}px) ${size.width}px`;
      })
      .join(', ');
  }

  private generatePlaceholder(src: string, type: PlaceholderType): string {
    switch (type) {
      case 'blur':
        return `style="background: url('${this.generateBlurPlaceholder(src)}') center/cover"`;
      case 'color':
        return `style="background-color: ${this.extractDominantColor(src)}"`;
      case 'svg':
        return `style="background: url('${this.generateSVGPlaceholder()}') center/cover"`;
      default:
        return '';
    }
  }

  private generateBlurPlaceholder(src: string): string {
    return this.generateSingleSrc(src, 'jpeg', 20, 20);
  }

  private extractDominantColor(src: string): string {
    // In production, this would extract the dominant color
    // For now, return a neutral gray
    return '#f3f4f6';
  }

  private generateSVGPlaceholder(): string {
    return `data:image/svg+xml;base64,${btoa(`
      <svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
        <rect width="100" height="100" fill="#f3f4f6"/>
        <circle cx="50" cy="50" r="20" fill="#e5e7eb"/>
      </svg>
    `)}`;
  }

  private isAboveFold(src: string): boolean {
    // Determine if image is above the fold based on src or context
    return src.includes('hero') || src.includes('main-product');
  }

  private getCDNUrl(): string {
    // In production, this would be your CDN endpoint
    if (process.env.NODE_ENV === 'production') {
      return process.env.CDN_URL || 'https://cdn.elcamino.com';
    }
    return 'http://localhost:4321/_image';
  }

  // Performance monitoring integration
  trackImagePerformance(src: string, format: ImageFormat, loadTime: number) {
    const metric = {
      src,
      format,
      loadTime,
      timestamp: Date.now()
    };

    if (typeof window !== 'undefined' && 'businessMonitor' in window) {
      (window as any).businessMonitor.trackCustomEvent('image_load', metric);
    }
  }

  // Intersection Observer for lazy loading
  createLazyLoader(): IntersectionObserver {
    if (typeof window === 'undefined') {
      return null as any;
    }

    return new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target as HTMLImageElement;
          const picture = img.closest('picture');
          
          if (picture) {
            this.loadPictureElement(picture);
          } else {
            this.loadImageElement(img);
          }
        }
      });
    }, {
      rootMargin: '50px 0px',
      threshold: 0.1
    });
  }

  private loadPictureElement(picture: Element) {
    const sources = picture.querySelectorAll('source[data-srcset]');
    const img = picture.querySelector('img[data-src]') as HTMLImageElement;
    
    sources.forEach(source => {
      const srcset = source.getAttribute('data-srcset');
      if (srcset) {
        source.setAttribute('srcset', srcset);
        source.removeAttribute('data-srcset');
      }
    });
    
    if (img) {
      const src = img.getAttribute('data-src');
      const srcset = img.getAttribute('data-srcset');
      
      if (src) {
        const startTime = performance.now();
        
        img.onload = () => {
          const loadTime = performance.now() - startTime;
          const format = this.detectImageFormat(src);
          this.trackImagePerformance(src, format, loadTime);
          img.classList.add('loaded');
        };
        
        img.setAttribute('src', src);
        if (srcset) img.setAttribute('srcset', srcset);
        
        img.removeAttribute('data-src');
        img.removeAttribute('data-srcset');
      }
    }
  }

  private loadImageElement(img: HTMLImageElement) {
    const src = img.getAttribute('data-src');
    if (src) {
      const startTime = performance.now();
      
      img.onload = () => {
        const loadTime = performance.now() - startTime;
        const format = this.detectImageFormat(src);
        this.trackImagePerformance(src, format, loadTime);
        img.classList.add('loaded');
      };
      
      img.src = src;
      img.removeAttribute('data-src');
    }
  }

  private detectImageFormat(src: string): ImageFormat {
    if (src.includes('f=avif')) return 'avif';
    if (src.includes('f=webp')) return 'webp';
    return 'jpeg';
  }
}

// Helper function for Astro components
export function generateOptimizedImage(
  src: string,
  alt: string,
  options?: Partial<ImageOptimizationConfig>
): string {
  const optimizer = new ImageOptimizer();
  return optimizer.generatePictureElement(src, alt, options);
}

// Initialize lazy loading
export function initializeImageOptimization() {
  if (typeof window === 'undefined') return;
  
  const optimizer = new ImageOptimizer();
  const lazyLoader = optimizer.createLazyLoader();
  
  // Find all lazy images and observe them
  const lazyImages = document.querySelectorAll('img[data-src], picture img[data-src]');
  lazyImages.forEach(img => lazyLoader.observe(img));
  
  // Add CSS for loading states
  if (!document.querySelector('#image-optimization-styles')) {
    const styles = document.createElement('style');
    styles.id = 'image-optimization-styles';
    styles.textContent = `
      img[data-src], picture img[data-src] {
        transition: opacity 0.3s ease-in-out;
        opacity: 0;
      }
      img.loaded {
        opacity: 1;
      }
      img[loading="lazy"] {
        background: #f3f4f6;
        min-height: 200px;
      }
    `;
    document.head.appendChild(styles);
  }
}

export const imageOptimizer = new ImageOptimizer();
