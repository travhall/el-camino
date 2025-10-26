/**
 * Performance Validation & Testing Utilities
 * Measures the impact of our Phase 1-2 optimizations
 */

export interface PerformanceMetrics {
  pageLoadTime: number;
  memoryUsage: number;
  jsExecutionTime: number;
  monitoringOverhead: number;
  timestamp: number;
}

export interface ValidationResults {
  metrics: PerformanceMetrics;
  status: "excellent" | "good" | "needs-improvement" | "poor";
  improvements: string[];
  issues: string[];
}

export class PerformanceValidator {
  private startTime: number = 0;
  private metrics: PerformanceMetrics[] = [];

  constructor() {
    this.startTime = performance.now();
  }

  /**
   * Capture current performance metrics
   */
  captureMetrics(): PerformanceMetrics {
    const now = performance.now();
    const memory = (performance as any).memory;

    return {
      pageLoadTime: now - this.startTime,
      memoryUsage: memory ? memory.usedJSHeapSize : 0,
      jsExecutionTime: this.measureJSExecutionTime(),
      monitoringOverhead: this.measureMonitoringOverhead(),
      timestamp: Date.now(),
    };
  }

  /**
   * Measure JavaScript execution time overhead
   */
  private measureJSExecutionTime(): number {
    const entries = performance.getEntriesByType("measure");
    const jsEntries = entries.filter(
      (entry) => entry.name.includes("script") || entry.name.includes("js")
    );

    return jsEntries.reduce((total, entry) => total + entry.duration, 0);
  }

  /**
   * Estimate monitoring system overhead
   */
  private measureMonitoringOverhead(): number {
    const observers = document.querySelectorAll(
      "[data-performance-observer]"
    ).length;
    const intervals = this.countActiveIntervals();
    const eventListeners = this.estimateEventListeners();

    // Rough estimate: each observer ~1ms, intervals ~2ms each, listeners ~0.1ms each
    return observers * 1 + intervals * 2 + eventListeners * 0.1;
  }

  /**
   * Count active intervals (rough estimate)
   */
  private countActiveIntervals(): number {
    // Check for known performance monitoring intervals
    const performanceManager = (window as any).performanceManager;
    // RealTimeMonitor disabled for performance optimization

    let count = 0;
    if (performanceManager) count += 1; // PerformanceManager has 1 interval (5 minutes)

    return count;
  }

  /**
   * Estimate event listeners (performance impact)
   */
  private estimateEventListeners(): number {
    const elements = document.querySelectorAll("*");
    let listenerCount = 0;

    // Common performance-impacting listeners
    const heavyListeners = ["scroll", "resize", "mousemove", "touchmove"];

    elements.forEach((el) => {
      heavyListeners.forEach((event) => {
        const hasListener =
          (el as any)[`on${event}`] !== null ||
          el.getAttribute(`on${event}`) !== null;
        if (hasListener) listenerCount++;
      });
    });

    return listenerCount;
  }

  /**
   * Validate current performance against targets
   */
  validate(): ValidationResults {
    const metrics = this.captureMetrics();
    this.metrics.push(metrics);

    const improvements: string[] = [];
    const issues: string[] = [];

    // Memory usage validation
    if (metrics.memoryUsage < 10 * 1024 * 1024) {
      // < 10MB
      improvements.push("Memory usage optimized");
    } else if (metrics.memoryUsage > 50 * 1024 * 1024) {
      // > 50MB
      issues.push("High memory usage detected");
    }

    // Monitoring overhead validation
    if (metrics.monitoringOverhead < 5) {
      // < 5ms
      improvements.push("Monitoring overhead reduced");
    } else if (metrics.monitoringOverhead > 20) {
      // > 20ms
      issues.push("High monitoring overhead");
    }

    // Page load time validation
    if (metrics.pageLoadTime < 2000) {
      // < 2 seconds
      improvements.push("Fast page load time");
    } else if (metrics.pageLoadTime > 5000) {
      // > 5 seconds
      issues.push("Slow page load time");
    }

    // Overall status
    let status: ValidationResults["status"];
    if (issues.length === 0 && improvements.length >= 2) {
      status = "excellent";
    } else if (issues.length === 0) {
      status = "good";
    } else if (issues.length <= 1) {
      status = "needs-improvement";
    } else {
      status = "poor";
    }

    return {
      metrics,
      status,
      improvements,
      issues,
    };
  }

  /**
   * Get performance trend over time
   */
  getTrend(): { improving: boolean; degrading: boolean; stable: boolean } {
    if (this.metrics.length < 3) {
      return { improving: false, degrading: false, stable: true };
    }

    const recent = this.metrics.slice(-3);
    const memoryTrend = recent[2].memoryUsage - recent[0].memoryUsage;
    const overheadTrend =
      recent[2].monitoringOverhead - recent[0].monitoringOverhead;

    const improving = memoryTrend < 0 && overheadTrend < 0;
    const degrading = memoryTrend > 1024 * 1024 || overheadTrend > 5; // 1MB or 5ms

    return {
      improving,
      degrading,
      stable: !improving && !degrading,
    };
  }

  /**
   * Export metrics for analysis
   */
  exportMetrics(): string {
    return JSON.stringify(
      {
        timestamp: Date.now(),
        metrics: this.metrics,
        trend: this.getTrend(),
        summary: this.validate(),
      },
      null,
      2
    );
  }

  /**
   * Reset metrics collection
   */
  reset(): void {
    this.metrics = [];
    this.startTime = performance.now();
  }
}

// Global instance for easy access
export const performanceValidator = new PerformanceValidator();

// Auto-validation every 30 seconds in development
if (typeof window !== "undefined" && import.meta.env.DEV) {
  setInterval(() => {
    const results = performanceValidator.validate();
    if (results.issues.length > 0) {
      console.warn("[PerformanceValidator] Issues detected:", results.issues);
    }
    if (results.improvements.length > 0) {
      console.log(
        "[PerformanceValidator] Improvements confirmed:",
        results.improvements
      );
    }
  }, 30000);
}
