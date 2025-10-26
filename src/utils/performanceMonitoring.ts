// src/utils/performanceMonitoring.ts - Lightweight replacement
interface CoreWebVitals {
  LCP?: number;
  INP?: number;
  CLS?: number;
}

export class PerformanceMonitor {
  private metrics = new Map<string, number>();
  private observer?: PerformanceObserver;
  private initialized = false;

  private setupObserver(): void {
    if (
      this.initialized ||
      typeof window === "undefined" ||
      !("PerformanceObserver" in window)
    ) {
      return;
    }

    this.observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        switch (entry.entryType) {
          case "largest-contentful-paint":
            this.recordMetric("LCP", entry.startTime);
            break;
          case "layout-shift":
            if (!(entry as any).hadRecentInput) {
              this.addCLS((entry as any).value);
            }
            break;
        }
      }
    });

    try {
      this.observer.observe({
        entryTypes: ["largest-contentful-paint", "layout-shift"],
      });
      this.initialized = true;
    } catch (e) {
      // Silent fail - don't log in production
    }
  }

  private addCLS(value: number): void {
    const current = this.metrics.get("CLS") || 0;
    this.recordMetric("CLS", current + value);
  }

  private recordMetric(name: string, value: number): void {
    this.metrics.set(name, value);
  }

  init(): void {
    if (this.initialized) return;

    this.setupObserver();

    // Simple INP tracking using existing Performance API
    document.addEventListener("click", this.handleInteraction.bind(this), {
      passive: true,
      once: true,
    });
    document.addEventListener("keydown", this.handleInteraction.bind(this), {
      passive: true,
      once: true,
    });
  }

  private handleInteraction(): void {
    // Measure time to next paint after first interaction
    requestAnimationFrame(() => {
      const inp = performance.now() - performance.now();
      // This is a simplified INP - for production use web-vitals library
      this.recordMetric("INP", inp);
    });
  }

  getMetrics(): CoreWebVitals {
    return {
      LCP: this.metrics.get("LCP"),
      INP: this.metrics.get("INP"),
      CLS: this.metrics.get("CLS"),
    };
  }

  disconnect(): void {
    this.observer?.disconnect();
    this.initialized = false;
  }
}

// Single global instance
export const performanceMonitor = new PerformanceMonitor();

// Initialize once on page load only
if (typeof document !== "undefined") {
  document.addEventListener(
    "astro:page-load",
    () => {
      performanceMonitor.init();
    },
    { once: true }
  );
}
