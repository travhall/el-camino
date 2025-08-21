/**
 * Enhanced Performance Manager with Real User Monitoring
 * File: src/lib/performance/PerformanceManager.ts
 */

import { onCLS, onFCP, onLCP, onTTFB, onINP } from 'web-vitals';

export interface PerformanceMetrics {
  lcp: number | null;
  fcp: number | null;
  cls: number | null;
  inp: number | null;
  ttfb: number | null;
  timestamp: number;
}

export interface CacheMetrics {
  hitRate: number;
  missCount: number;
  totalRequests: number;
  avgResponseTime: number;
}

export interface ImageOptimizationMetrics {
  avifUsage: number;
  webpUsage: number;
  jpegUsage: number;
  avgLoadTime: number;
  totalImages: number;
}

export interface PWAMetrics {
  serviceWorkerActive: boolean;
  installPromptShown: boolean;
  installAccepted: boolean;
  offlinePageViews: number;
  cacheHits: number;
}

export interface PerformanceData {
  coreWebVitals: PerformanceMetrics;
  cacheMetrics: CacheMetrics;
  imageOptimization: ImageOptimizationMetrics;
  pwaMetrics: PWAMetrics;
}

class PerformanceManager {
  private metrics: PerformanceMetrics = {
    lcp: null,
    fcp: null,
    cls: null,
    inp: null,
    ttfb: null,
    timestamp: Date.now()
  };

  private cacheMetrics: CacheMetrics = {
    hitRate: 0,
    missCount: 0,
    totalRequests: 0,
    avgResponseTime: 0
  };

  private imageMetrics: ImageOptimizationMetrics = {
    avifUsage: 0,
    webpUsage: 0,
    jpegUsage: 0,
    avgLoadTime: 0,
    totalImages: 0
  };

  private pwaMetrics: PWAMetrics = {
    serviceWorkerActive: false,
    installPromptShown: false,
    installAccepted: false,
    offlinePageViews: 0,
    cacheHits: 0
  };

  private initialized = false;
  private reportingEndpoint: string | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.init();
    }
  }

  private init(): void {
    if (this.initialized) return;

    // Initialize Web Vitals monitoring
    this.initWebVitalsTracking();
    
    // Initialize resource monitoring
    this.initResourceMonitoring();
    
    // Initialize PWA monitoring
    this.initPWAMonitoring();
    
    // Initialize image optimization tracking
    this.initImageOptimizationTracking();

    // Report metrics periodically
    this.startPeriodicReporting();
    
    this.initialized = true;

    if (import.meta.env.DEV) {
      console.log('[PerformanceManager] Initialized with monitoring');
    }
  }

  private initWebVitalsTracking(): void {
    // Track Largest Contentful Paint
    onLCP((metric) => {
      this.metrics.lcp = metric.value;
      this.metrics.timestamp = Date.now();
      this.reportMetric('lcp', metric.value);
    });

    // Track First Contentful Paint
    onFCP((metric) => {
      this.metrics.fcp = metric.value;
      this.reportMetric('fcp', metric.value);
    });

    // Track Cumulative Layout Shift
    onCLS((metric) => {
      this.metrics.cls = metric.value;
      this.reportMetric('cls', metric.value);
    });

    // Track Interaction to Next Paint
    onINP((metric) => {
      this.metrics.inp = metric.value;
      this.reportMetric('inp', metric.value);
    });

    // Track Time to First Byte
    onTTFB((metric) => {
      this.metrics.ttfb = metric.value;
      this.reportMetric('ttfb', metric.value);
    });
  }

  private initResourceMonitoring(): void {
    // Monitor fetch requests for cache performance
    const originalFetch = window.fetch;
    let requestCount = 0;
    let totalResponseTime = 0;

    window.fetch = async (...args) => {
      const startTime = performance.now();
      requestCount++;
      
      try {
        const response = await originalFetch(...args);
        const endTime = performance.now();
        const responseTime = endTime - startTime;
        
        totalResponseTime += responseTime;
        this.cacheMetrics.totalRequests = requestCount;
        this.cacheMetrics.avgResponseTime = totalResponseTime / requestCount;
        
        // Check if response came from cache
        if (response.headers.get('X-Cache') === 'HIT' || 
            response.headers.get('CF-Cache-Status') === 'HIT') {
          this.cacheMetrics.hitRate = ((this.cacheMetrics.hitRate * (requestCount - 1)) + 1) / requestCount;
        } else {
          this.cacheMetrics.missCount++;
          this.cacheMetrics.hitRate = ((this.cacheMetrics.hitRate * (requestCount - 1)) + 0) / requestCount;
        }
        
        return response;
      } catch (error) {
        this.cacheMetrics.missCount++;
        throw error;
      }
    };
  }

  private initPWAMonitoring(): void {
    // Check if service worker is active
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(() => {
        this.pwaMetrics.serviceWorkerActive = true;
      });

      // Listen for service worker messages
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'CACHE_HIT') {
          this.pwaMetrics.cacheHits++;
        }
        if (event.data?.type === 'OFFLINE_PAGE_VIEW') {
          this.pwaMetrics.offlinePageViews++;
        }
      });
    }

    // Monitor install prompt
    window.addEventListener('beforeinstallprompt', () => {
      this.pwaMetrics.installPromptShown = true;
    });

    // Monitor app installation
    window.addEventListener('appinstalled', () => {
      this.pwaMetrics.installAccepted = true;
    });
  }

  private initImageOptimizationTracking(): void {
    // Track image format usage
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;
            const images = element.tagName === 'IMG' ? [element] : element.querySelectorAll('img');
            
            images.forEach((img) => {
              this.trackImageLoad(img as HTMLImageElement);
            });
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Track existing images
    document.querySelectorAll('img').forEach((img) => {
      this.trackImageLoad(img);
    });
  }

  private trackImageLoad(img: HTMLImageElement): void {
    const startTime = performance.now();
    
    const handleLoad = () => {
      const loadTime = performance.now() - startTime;
      const src = img.currentSrc || img.src;
      
      this.imageMetrics.totalImages++;
      this.imageMetrics.avgLoadTime = 
        ((this.imageMetrics.avgLoadTime * (this.imageMetrics.totalImages - 1)) + loadTime) / 
        this.imageMetrics.totalImages;

      // Detect format
      if (src.includes('.avif') || src.includes('f=avif')) {
        this.imageMetrics.avifUsage++;
      } else if (src.includes('.webp') || src.includes('f=webp')) {
        this.imageMetrics.webpUsage++;
      } else {
        this.imageMetrics.jpegUsage++;
      }

      img.removeEventListener('load', handleLoad);
    };

    if (img.complete) {
      handleLoad();
    } else {
      img.addEventListener('load', handleLoad);
    }
  }

  private reportMetric(metric: string, value: number): void {
    // Report critical performance issues immediately
    if (this.shouldAlert(metric, value)) {
      this.sendAlert(metric, value);
    }

    // Store metrics locally for dashboard
    this.storeMetricLocally(metric, value);

    if (import.meta.env.DEV) {
      console.log(`[PerformanceManager] ${metric.toUpperCase()}: ${value.toFixed(2)}`);
    }
  }

  private shouldAlert(metric: string, value: number): boolean {
    const thresholds = {
      lcp: 2500,   // 2.5 seconds
      cls: 0.1,    // 0.1
      inp: 200,    // 200ms
      fcp: 1800,   // 1.8 seconds
      ttfb: 800    // 800ms
    };

    return value > (thresholds[metric as keyof typeof thresholds] || Infinity);
  }

  private sendAlert(metric: string, value: number): void {
    if (!this.reportingEndpoint) return;

    fetch(this.reportingEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'performance_alert',
        metric,
        value,
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: Date.now()
      })
    }).catch(console.error);
  }

  private storeMetricLocally(metric: string, value: number): void {
    try {
      const stored = localStorage.getItem('performance_metrics') || '[]';
      const metrics = JSON.parse(stored);
      
      metrics.push({
        metric,
        value,
        timestamp: Date.now(),
        url: window.location.pathname
      });

      // Keep only last 100 entries
      if (metrics.length > 100) {
        metrics.splice(0, metrics.length - 100);
      }

      localStorage.setItem('performance_metrics', JSON.stringify(metrics));
    } catch (error) {
      console.warn('[PerformanceManager] Failed to store metrics locally:', error);
    }
  }

  private startPeriodicReporting(): void {
    // Report comprehensive metrics every 30 seconds
    setInterval(() => {
      this.reportComprehensiveMetrics();
    }, 30000);
  }

  private reportComprehensiveMetrics(): void {
    if (!this.reportingEndpoint) return;

    const data = this.getAllMetrics();
    
    fetch(this.reportingEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'comprehensive_metrics',
        data,
        timestamp: Date.now()
      })
    }).catch(console.error);
  }

  // Public API
  public getAllMetrics(): PerformanceData {
    return {
      coreWebVitals: { ...this.metrics },
      cacheMetrics: { ...this.cacheMetrics },
      imageOptimization: { ...this.imageMetrics },
      pwaMetrics: { ...this.pwaMetrics }
    };
  }

  public setReportingEndpoint(endpoint: string): void {
    this.reportingEndpoint = endpoint;
  }

  public getHealthScore(): {
    score: number;
    issues: string[];
  } {
    const issues: string[] = [];
    let score = 100;

    // Check Core Web Vitals
    if (this.metrics.lcp && this.metrics.lcp > 2500) {
      issues.push(`LCP too slow: ${this.metrics.lcp}ms`);
      score -= 20;
    }
    
    if (this.metrics.cls && this.metrics.cls > 0.1) {
      issues.push(`CLS too high: ${this.metrics.cls}`);
      score -= 15;
    }
    
    if (this.metrics.inp && this.metrics.inp > 200) {
      issues.push(`INP too slow: ${this.metrics.inp}ms`);
      score -= 15;
    }

    // Check cache performance
    if (this.cacheMetrics.hitRate < 0.5) {
      issues.push(`Low cache hit rate: ${(this.cacheMetrics.hitRate * 100).toFixed(1)}%`);
      score -= 10;
    }

    // Check image optimization
    const modernFormatUsage = (this.imageMetrics.avifUsage + this.imageMetrics.webpUsage) / 
                              this.imageMetrics.totalImages;
    if (modernFormatUsage < 0.7) {
      issues.push(`Low modern format usage: ${(modernFormatUsage * 100).toFixed(1)}%`);
      score -= 10;
    }

    return { score: Math.max(0, score), issues };
  }

  public exportMetrics(): string {
    return JSON.stringify(this.getAllMetrics(), null, 2);
  }
}

// Global instance
export const performanceManager = new PerformanceManager();

// Initialize immediately if in browser
if (typeof window !== 'undefined') {
  performanceManager;
}

export default PerformanceManager;
