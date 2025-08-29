/**
 * Core Web Vitals monitoring implementation
 * Phase 1 monitoring infrastructure per technical assessment
 */

import { getCLS, getFID, getFCP, getLCP, getTTFB, type Metric } from 'web-vitals';

interface PerformanceMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  timestamp: number;
  page: string;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private readonly thresholds = {
    LCP: { good: 2500, poor: 4000 },
    FID: { good: 100, poor: 300 },
    CLS: { good: 0.1, poor: 0.25 },
    FCP: { good: 1800, poor: 3000 },
    TTFB: { good: 800, poor: 1800 }
  };

  init() {
    if (typeof window === 'undefined') return;
    getCLS(this.onMetric.bind(this));
    getFID(this.onMetric.bind(this));
    getFCP(this.onMetric.bind(this));
    getLCP(this.onMetric.bind(this));
    getTTFB(this.onMetric.bind(this));

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.sendBeacon();
      }
    });
  }

  private onMetric(metric: Metric) {
    const rating = this.getRating(metric.name as keyof typeof this.thresholds, metric.value);
    
    const perfMetric: PerformanceMetric = {
      name: metric.name,
      value: metric.value,
      rating,
      timestamp: Date.now(),
      page: window.location.pathname
    };

    this.metrics.push(perfMetric);
    
    if (rating === 'poor') {
      console.warn(`Poor ${metric.name}: ${metric.value}`, metric);
    }

    if (['LCP', 'CLS', 'FID'].includes(metric.name)) {
      this.sendMetric(perfMetric);
    }
  }

  private getRating(metricName: keyof typeof this.thresholds, value: number) {
    const threshold = this.thresholds[metricName];
    if (!threshold) return 'good';
    
    if (value <= threshold.good) return 'good';
    if (value <= threshold.poor) return 'needs-improvement';
    return 'poor';
  }

  private sendMetric(metric: PerformanceMetric) {
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/metrics', JSON.stringify(metric));
    }
  }

  private sendBeacon() {
    if (this.metrics.length > 0) {
      navigator.sendBeacon?.('/api/metrics/batch', JSON.stringify(this.metrics));
      this.metrics = [];
    }
  }

  measureOperation<T>(name: string, operation: () => T): T {
    const start = performance.now();
    const result = operation();
    const duration = performance.now() - start;
    
    if (duration > 100) {
      console.warn(`Slow operation: ${name} took ${duration.toFixed(2)}ms`);
    }
    
    return result;
  }

  getSnapshot() {
    return {
      metrics: this.metrics.slice(),
      navigation: performance.getEntriesByType('navigation')[0],
      memory: (performance as any).memory
    };
  }
}

export const performanceMonitor = new PerformanceMonitor();

if (typeof window !== 'undefined') {
  performanceMonitor.init();
}
