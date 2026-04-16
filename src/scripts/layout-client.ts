/**
 * Layout client-side initialization
 * Handles performance monitoring and runtime optimizations.
 * Imported as a static module from Layout.astro so Vite/esbuild
 * can process the dynamic imports correctly as code-split chunks.
 */

// Initialize Performance Manager
import("../lib/performance/PerformanceManager")
  .then(({ performanceManager }) => {
    // Set reporting endpoint if available
    if (import.meta.env.MONITORING_ENDPOINT) {
      performanceManager.setReportingEndpoint(
        import.meta.env.MONITORING_ENDPOINT,
      );
    }

    if (import.meta.env.DEV) {
      // Log initial metrics in development (reduced frequency)
      setTimeout(() => {
        performanceManager.getHealthScore();
      }, 10000);
    }

    // Store basic metrics for admin dashboard
    setTimeout(() => {
      const metrics = performanceManager.getAllMetrics();
      if (metrics.coreWebVitals.lcp) {
        localStorage.setItem(
          "webVitalsData",
          JSON.stringify({
            timestamp: Date.now(),
            lcp: metrics.coreWebVitals.lcp,
            cls: metrics.coreWebVitals.cls,
            inp: metrics.coreWebVitals.inp,
            url: window.location.pathname,
          }),
        );
      }
    }, 10000);
  })
  .catch((error) => {
    console.warn("[Layout] Performance monitoring failed to load:", error);
  });

// Critical performance optimizations — run immediately
if ("HTMLCanvasElement" in window && !sessionStorage.getItem("imageFormatSupport")) {
  import("../lib/image/enhanced-optimizer").then(({ EnhancedImageOptimizer }) => {
    EnhancedImageOptimizer.detectFormatSupport();
  });
}

if (window.innerWidth <= 1024) {
  import("../lib/performance/mobileOptimization").then(({ initMobileOptimization }) => {
    initMobileOptimization();
  });
}
