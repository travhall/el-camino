// src/utils/performanceMonitoring.ts
export class PerformanceMonitor {
  private metrics = new Map<string, number>();
  private observer?: PerformanceObserver;

  constructor() {
    this.setupObserver();
  }

  private setupObserver(): void {
    if (typeof window === 'undefined' || !('PerformanceObserver' in window)) {
      return;
    }

    this.observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (entry.entryType === 'largest-contentful-paint') {
          this.recordMetric('LCP', entry.startTime);
        } else if (entry.entryType === 'first-input') {
          this.recordMetric('FID', (entry as any).processingStart - entry.startTime);
        } else if (entry.entryType === 'layout-shift' && !(entry as any).hadRecentInput) {
          this.recordMetric('CLS', (entry as any).value);
        }
      });
    });

    try {
      this.observer.observe({ 
        entryTypes: ['largest-contentful-paint', 'first-input', 'layout-shift'] 
      });
    } catch (e) {
      console.warn('Performance observer not supported:', e);
    }
  }

  private recordMetric(name: string, value: number): void {
    this.metrics.set(name, value);
    
    // Integrate with existing analytics if available
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'web_vitals', {
        metric_name: name,
        metric_value: Math.round(value),
        page_path: window.location.pathname
      });
    }

    // Log for debugging in development
    if (import.meta.env.DEV) {
      console.log(`[Performance] ${name}: ${Math.round(value)}ms`);
    }
  }

  getMetrics(): Record<string, number> {
    return Object.fromEntries(this.metrics);
  }

  // Enhanced INP monitoring (2025 Core Web Vital)
  private setupINPMonitoring(): void {
    if (typeof window === 'undefined') return;

    // Use web-vitals library if available, fallback to manual tracking
    if ((window as any).webVitals?.onINP) {
      (window as any).webVitals.onINP((metric: any) => {
        this.recordMetric('INP', metric.value);
      });
    } else {
      // Manual INP tracking fallback
      let maxINP = 0;
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry: any) => {
          if (entry.entryType === 'event') {
            const inp = entry.processingStart - entry.startTime + entry.duration;
            maxINP = Math.max(maxINP, inp);
            this.recordMetric('INP', maxINP);
          }
        });
      });

      try {
        observer.observe({ type: 'event', buffered: true });
      } catch (e) {
        console.warn('INP monitoring not supported:', e);
      }
    }
  }

  // Initialize monitoring with web-vitals library integration
  init(): void {
    this.setupINPMonitoring();

    // Initialize web-vitals library if available
    if (typeof window !== 'undefined') {
      import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
        getCLS((metric) => this.recordMetric('CLS', metric.value));
        getFID((metric) => this.recordMetric('FID', metric.value));
        getFCP((metric) => this.recordMetric('FCP', metric.value));
        getLCP((metric) => this.recordMetric('LCP', metric.value));
        getTTFB((metric) => this.recordMetric('TTFB', metric.value));
      }).catch(() => {
        console.warn('web-vitals library not available, using fallback monitoring');
      });
    }
  }
}

// Global instance
export const performanceMonitor = new PerformanceMonitor();

// Auto-initialize on page load
document.addEventListener('astro:page-load', () => {
  performanceMonitor.init();
});
