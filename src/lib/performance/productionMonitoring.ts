// src/lib/performance/productionMonitoring.ts - Lightweight performance tracking

interface ProductionMetrics {
  navigationTime: number;
  prefetchHits: number;
  cacheHits: number;
  slowNavigation: number;
}

class ProductionMonitor {
  private metrics: ProductionMetrics = {
    navigationTime: 0,
    prefetchHits: 0,
    cacheHits: 0,
    slowNavigation: 0,
  };

  private sessionStart = Date.now();

  track(event: string, data: any): void {
    if (!import.meta.env.PROD) return;

    switch (event) {
      case "navigation":
        this.metrics.navigationTime = data.duration;
        if (data.duration > 300) this.metrics.slowNavigation++;
        break;
      case "prefetch-hit":
        this.metrics.prefetchHits++;
        break;
      case "cache-hit":
        this.metrics.cacheHits++;
        break;
    }

    // Alert on performance regressions
    if (this.metrics.slowNavigation > 3) {
      console.warn("[Production] Multiple slow navigation detected");
    }
  }

  getHealthCheck(): boolean {
    const avgNavTime = this.metrics.navigationTime;
    const healthyPerformance = avgNavTime < 200;

    if (!healthyPerformance) {
      console.warn("[Production] Navigation performance degraded:", avgNavTime);
    }

    return healthyPerformance;
  }
}

export const productionMonitor = new ProductionMonitor();
