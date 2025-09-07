/**
 * Scroll Performance Monitor - Phase 1 Optimization Extension
 * File: src/lib/performance/ScrollPerformanceMonitor.ts
 *
 * Integrates with existing PerformanceManager to track infinite scroll optimizations
 */

export interface ScrollMetrics {
  batchLoadTime: number;
  domUpdateTime: number;
  filterTime: number;
  totalProducts: number;
  visibleProducts: number;
  timestamp: number;
}

export interface ScrollPerformanceData {
  averageBatchTime: number;
  averageDomUpdateTime: number;
  averageFilterTime: number;
  totalBatches: number;
  totalFilters: number;
  lastMetrics: ScrollMetrics | null;
}

export class ScrollPerformanceMonitor {
  private scrollMetrics: ScrollMetrics[] = [];
  private maxStoredMetrics = 100; // Keep last 100 measurements
  private performanceManager: any = null;

  constructor() {
    // Try to get existing PerformanceManager instance
    if (typeof window !== "undefined") {
      this.performanceManager = (window as any).performanceManager;
      if (this.performanceManager) {
        console.log(
          "[ScrollPerformanceMonitor] ✅ Connected to existing PerformanceManager"
        );
      } else {
        console.warn(
          "[ScrollPerformanceMonitor] ⚠️ PerformanceManager not found - metrics will be logged only"
        );
      }
    }
  }

  /**
   * Report scroll performance metrics
   */
  public reportScrollMetrics(metrics: Omit<ScrollMetrics, "timestamp">): void {
    const timestampedMetrics: ScrollMetrics = {
      ...metrics,
      timestamp: Date.now(),
    };

    // Store metrics locally
    this.scrollMetrics.push(timestampedMetrics);

    // Keep only recent metrics
    if (this.scrollMetrics.length > this.maxStoredMetrics) {
      this.scrollMetrics = this.scrollMetrics.slice(-this.maxStoredMetrics);
    }

    // Report to existing PerformanceManager if available
    if (
      this.performanceManager &&
      typeof this.performanceManager.reportMetric === "function"
    ) {
      try {
        this.performanceManager.reportMetric(
          "scroll_batch_time",
          metrics.batchLoadTime
        );
        this.performanceManager.reportMetric(
          "scroll_dom_update",
          metrics.domUpdateTime
        );
        this.performanceManager.reportMetric(
          "scroll_filter_time",
          metrics.filterTime
        );

        console.log(
          "[ScrollPerformanceMonitor] 📊 Metrics reported to PerformanceManager"
        );
      } catch (error) {
        console.warn(
          "[ScrollPerformanceMonitor] ❌ Failed to report to PerformanceManager:",
          error
        );
      }
    }

    // Development logging
    if (import.meta.env.DEV) {
      console.log(
        "[ScrollPerformanceMonitor] 📊 Scroll Metrics:",
        timestampedMetrics
      );
      this.logPerformanceAnalysis();
    }

    // Check for performance regressions
    this.checkPerformanceThresholds(metrics);
  }

  /**
   * Get aggregated performance data
   */
  public getPerformanceData(): ScrollPerformanceData {
    if (this.scrollMetrics.length === 0) {
      return {
        averageBatchTime: 0,
        averageDomUpdateTime: 0,
        averageFilterTime: 0,
        totalBatches: 0,
        totalFilters: 0,
        lastMetrics: null,
      };
    }

    const batchMetrics = this.scrollMetrics.filter((m) => m.batchLoadTime > 0);
    const filterMetrics = this.scrollMetrics.filter((m) => m.filterTime > 0);

    const averageBatchTime =
      batchMetrics.length > 0
        ? batchMetrics.reduce((sum, m) => sum + m.batchLoadTime, 0) /
          batchMetrics.length
        : 0;

    const averageDomUpdateTime =
      this.scrollMetrics.length > 0
        ? this.scrollMetrics.reduce((sum, m) => sum + m.domUpdateTime, 0) /
          this.scrollMetrics.length
        : 0;

    const averageFilterTime =
      filterMetrics.length > 0
        ? filterMetrics.reduce((sum, m) => sum + m.filterTime, 0) /
          filterMetrics.length
        : 0;

    return {
      averageBatchTime,
      averageDomUpdateTime,
      averageFilterTime,
      totalBatches: batchMetrics.length,
      totalFilters: filterMetrics.length,
      lastMetrics: this.scrollMetrics[this.scrollMetrics.length - 1] || null,
    };
  }

  /**
   * Check performance against Phase 1 optimization targets
   */
  private checkPerformanceThresholds(
    metrics: Omit<ScrollMetrics, "timestamp">
  ): void {
    const THRESHOLDS = {
      MAX_BATCH_TIME: 800, // Target: 50% faster than baseline 1600ms
      MAX_DOM_UPDATE: 50, // Target: Fast DOM updates
      MAX_FILTER_TIME: 100, // Target: Near-instant filtering
      WARN_BATCH_TIME: 600, // Warning threshold
      WARN_DOM_UPDATE: 30, // Warning threshold
      WARN_FILTER_TIME: 50, // Warning threshold
    };

    const warnings: string[] = [];
    const errors: string[] = [];

    // Check batch load time
    if (metrics.batchLoadTime > THRESHOLDS.MAX_BATCH_TIME) {
      errors.push(
        `Batch load time too slow: ${metrics.batchLoadTime.toFixed(
          1
        )}ms (max: ${THRESHOLDS.MAX_BATCH_TIME}ms)`
      );
    } else if (metrics.batchLoadTime > THRESHOLDS.WARN_BATCH_TIME) {
      warnings.push(
        `Batch load time warning: ${metrics.batchLoadTime.toFixed(1)}ms`
      );
    }

    // Check DOM update time
    if (metrics.domUpdateTime > THRESHOLDS.MAX_DOM_UPDATE) {
      errors.push(
        `DOM update too slow: ${metrics.domUpdateTime.toFixed(1)}ms (max: ${
          THRESHOLDS.MAX_DOM_UPDATE
        }ms)`
      );
    } else if (metrics.domUpdateTime > THRESHOLDS.WARN_DOM_UPDATE) {
      warnings.push(
        `DOM update warning: ${metrics.domUpdateTime.toFixed(1)}ms`
      );
    }

    // Check filter time
    if (metrics.filterTime > THRESHOLDS.MAX_FILTER_TIME) {
      errors.push(
        `Filter time too slow: ${metrics.filterTime.toFixed(1)}ms (max: ${
          THRESHOLDS.MAX_FILTER_TIME
        }ms)`
      );
    } else if (metrics.filterTime > THRESHOLDS.WARN_FILTER_TIME) {
      warnings.push(`Filter time warning: ${metrics.filterTime.toFixed(1)}ms`);
    }

    // Log warnings and errors
    if (warnings.length > 0) {
      console.warn(
        "[ScrollPerformanceMonitor] ⚠️ Performance warnings:",
        warnings
      );
    }
    if (errors.length > 0) {
      console.error(
        "[ScrollPerformanceMonitor] ❌ Performance threshold violations:",
        errors
      );
    }

    // Success logging for good performance
    if (warnings.length === 0 && errors.length === 0) {
      console.log(
        "[ScrollPerformanceMonitor] ✅ All performance thresholds met"
      );
    }
  }

  /**
   * Log performance analysis for development
   */
  private logPerformanceAnalysis(): void {
    const data = this.getPerformanceData();

    console.group("[ScrollPerformanceMonitor] 📈 Performance Analysis");
    console.log(
      `Average Batch Load Time: ${data.averageBatchTime.toFixed(1)}ms`
    );
    console.log(
      `Average DOM Update Time: ${data.averageDomUpdateTime.toFixed(1)}ms`
    );
    console.log(`Average Filter Time: ${data.averageFilterTime.toFixed(1)}ms`);
    console.log(`Total Batches Loaded: ${data.totalBatches}`);
    console.log(`Total Filters Applied: ${data.totalFilters}`);

    if (data.lastMetrics) {
      console.log(
        `Current Products: ${data.lastMetrics.visibleProducts}/${data.lastMetrics.totalProducts}`
      );
    }

    console.groupEnd();
  }

  /**
   * Export metrics for external analysis
   */
  public exportMetrics(): ScrollMetrics[] {
    return [...this.scrollMetrics];
  }

  /**
   * Clear stored metrics
   */
  public clearMetrics(): void {
    this.scrollMetrics = [];
    console.log("[ScrollPerformanceMonitor] 🧹 Metrics cleared");
  }

  /**
   * Get performance summary for admin dashboard
   */
  public getPerformanceSummary(): {
    status: "excellent" | "good" | "needs-improvement" | "poor";
    score: number;
    details: string[];
  } {
    const data = this.getPerformanceData();

    if (data.totalBatches === 0) {
      return {
        status: "good",
        score: 85,
        details: ["No scroll performance data available yet"],
      };
    }

    let score = 100;
    const details: string[] = [];

    // Evaluate batch performance (40% weight)
    if (data.averageBatchTime > 800) {
      score -= 40;
      details.push("Batch loading is slow");
    } else if (data.averageBatchTime > 600) {
      score -= 20;
      details.push("Batch loading could be faster");
    } else {
      details.push("Batch loading performance is excellent");
    }

    // Evaluate DOM update performance (35% weight)
    if (data.averageDomUpdateTime > 50) {
      score -= 35;
      details.push("DOM updates are slow");
    } else if (data.averageDomUpdateTime > 30) {
      score -= 15;
      details.push("DOM updates could be faster");
    } else {
      details.push("DOM update performance is excellent");
    }

    // Evaluate filter performance (25% weight)
    if (data.averageFilterTime > 100) {
      score -= 25;
      details.push("Filtering is slow");
    } else if (data.averageFilterTime > 50) {
      score -= 10;
      details.push("Filtering could be faster");
    } else {
      details.push("Filter performance is excellent");
    }

    let status: "excellent" | "good" | "needs-improvement" | "poor";
    if (score >= 90) status = "excellent";
    else if (score >= 75) status = "good";
    else if (score >= 60) status = "needs-improvement";
    else status = "poor";

    return { status, score, details };
  }
}

// Create global instance for use across components
declare global {
  interface Window {
    scrollPerformanceMonitor?: ScrollPerformanceMonitor;
  }
}

// Initialize global instance if in browser
if (typeof window !== "undefined") {
  window.scrollPerformanceMonitor = new ScrollPerformanceMonitor();
}

export default ScrollPerformanceMonitor;
