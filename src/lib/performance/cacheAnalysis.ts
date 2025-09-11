/**
 * Cache Impact Analysis Tool - Phase 1
 * Monitors current cache performance for optimization planning
 */

interface CacheAnalysisData {
  endpoint: string;
  responseTime: number;
  cacheStatus: string;
  timestamp: number;
  size?: number;
  headers: Record<string, string>;
}

class CacheAnalyzer {
  private measurements: CacheAnalysisData[] = [];
  private readonly STORAGE_KEY = 'cache_analysis_data';

  constructor() {
    this.loadStoredData();
    this.interceptFetch();
  }

  private loadStoredData(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        this.measurements = JSON.parse(stored);
      }
    } catch (error) {
      console.warn('[CacheAnalyzer] Failed to load stored data:', error);
    }
  }

  private saveData(): void {
    try {
      // Keep only last 100 measurements
      if (this.measurements.length > 100) {
        this.measurements = this.measurements.slice(-100);
      }
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.measurements));
    } catch (error) {
      console.warn('[CacheAnalyzer] Failed to save data:', error);
    }
  }

  private interceptFetch(): void {
    const originalFetch = window.fetch;
    
    window.fetch = async (...args) => {
      const [input, init] = args;
      const url = typeof input === 'string' ? input : 
                  input instanceof Request ? input.url : input.href;
      const startTime = performance.now();
      
      try {
        const response = await originalFetch(...args);
        const endTime = performance.now();
        
        // FIXED: Only analyze actual API calls and external resources, not dev assets
        if (this.shouldAnalyzeUrl(url)) {
          this.recordMeasurement({
            endpoint: this.cleanUrl(url),
            responseTime: endTime - startTime,
            cacheStatus: this.determineCacheStatus(response),
            timestamp: Date.now(),
            size: this.getResponseSize(response),
            headers: this.extractRelevantHeaders(response)
          });
        }
        
        return response;
      } catch (error) {
        const endTime = performance.now();
        if (this.shouldAnalyzeUrl(url)) {
          this.recordMeasurement({
            endpoint: this.cleanUrl(url),
            responseTime: endTime - startTime,
            cacheStatus: 'ERROR',
            timestamp: Date.now(),
            headers: {}
          });
        }
        throw error;
      }
    };
  }

  private shouldAnalyzeUrl(url: string): boolean {
    // Only analyze these types of requests (not dev assets)
    return (
      url.includes('/api/') ||
      url.includes('squarecdn.com') ||
      url.includes('wordpress.com') ||
      url.includes('s3.amazonaws.com') ||
      (url.includes('.netlify/') && url.includes('images'))
    ) && (
      // Exclude dev/build assets
      !url.includes('node_modules/') &&
      !url.includes('@vite/') &&
      !url.includes('@id/') &&
      !url.includes('@fs/') &&
      !url.includes('?astro&') &&
      !url.includes('.js?v=') &&
      !url.includes('.ts?v=')
    );
  }

  private cleanUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.pathname + (urlObj.search ? '?...' : '');
    } catch {
      return url.substring(0, 50);
    }
  }

  private determineCacheStatus(response: Response): string {
    const cacheControl = response.headers.get('cache-control') || '';
    const cfCache = response.headers.get('cf-cache-status');
    const xCache = response.headers.get('x-cache');
    
    if (cfCache) return `CF:${cfCache}`;
    if (xCache) return `X-Cache:${xCache}`;
    if (cacheControl.includes('no-store')) return 'NO_STORE';
    if (cacheControl.includes('no-cache')) return 'NO_CACHE';
    if (cacheControl.includes('max-age=0')) return 'REVALIDATE';
    if (cacheControl.includes('max-age')) return 'CACHEABLE';
    
    return 'UNKNOWN';
  }

  private getResponseSize(response: Response): number | undefined {
    const contentLength = response.headers.get('content-length');
    return contentLength ? parseInt(contentLength, 10) : undefined;
  }

  private extractRelevantHeaders(response: Response): Record<string, string> {
    const relevantHeaders = ['cache-control', 'etag', 'last-modified', 'cf-cache-status', 'x-cache'];
    const headers: Record<string, string> = {};
    
    relevantHeaders.forEach(header => {
      const value = response.headers.get(header);
      if (value) headers[header] = value;
    });
    
    return headers;
  }

  private recordMeasurement(data: CacheAnalysisData): void {
    this.measurements.push(data);
    this.saveData();
    
    if (import.meta.env.DEV) {
      console.log(`[CacheAnalyzer] ${data.endpoint}: ${data.responseTime.toFixed(0)}ms (${data.cacheStatus})`);
    }
  }

  // Public API for analysis
  public generateReport(): string {
    const now = Date.now();
    const recent = this.measurements.filter(m => now - m.timestamp < 5 * 60 * 1000); // Last 5 minutes
    
    if (recent.length === 0) {
      return 'No recent cache data available. Visit some pages to collect data.';
    }

    // Group by endpoint
    const byEndpoint = recent.reduce((acc, measurement) => {
      if (!acc[measurement.endpoint]) {
        acc[measurement.endpoint] = [];
      }
      acc[measurement.endpoint].push(measurement);
      return acc;
    }, {} as Record<string, CacheAnalysisData[]>);

    let report = '📊 CACHE ANALYSIS REPORT (Last 5 minutes)\n';
    report += '=' .repeat(50) + '\n\n';

    Object.entries(byEndpoint).forEach(([endpoint, measurements]) => {
      const avgResponseTime = measurements.reduce((sum, m) => sum + m.responseTime, 0) / measurements.length;
      const cacheStatuses = [...new Set(measurements.map(m => m.cacheStatus))];
      const avgSize = measurements.filter(m => m.size).reduce((sum, m) => sum + (m.size || 0), 0) / measurements.filter(m => m.size).length;
      
      report += `🔗 ${endpoint}\n`;
      report += `   Requests: ${measurements.length}\n`;
      report += `   Avg Response Time: ${avgResponseTime.toFixed(0)}ms\n`;
      report += `   Cache Status: ${cacheStatuses.join(', ')}\n`;
      if (avgSize) report += `   Avg Size: ${(avgSize / 1024).toFixed(1)}KB\n`;
      
      // Performance assessment
      if (avgResponseTime > 1000) {
        report += `   ⚠️  SLOW: Consider caching\n`;
      }
      if (cacheStatuses.includes('NO_STORE')) {
        report += `   ❌ NO_STORE: Preventing all caching\n`;
      }
      if (cacheStatuses.includes('REVALIDATE')) {
        report += `   🔄 REVALIDATE: Very conservative caching\n`;
      }
      
      report += '\n';
    });

    // Overall summary
    const allResponseTimes = recent.map(m => m.responseTime);
    const avgOverall = allResponseTimes.reduce((sum, time) => sum + time, 0) / allResponseTimes.length;
    const slowRequests = allResponseTimes.filter(time => time > 1000).length;
    
    report += '📈 SUMMARY\n';
    report += `-`.repeat(20) + '\n';
    report += `Total Requests: ${recent.length}\n`;
    report += `Average Response Time: ${avgOverall.toFixed(0)}ms\n`;
    report += `Slow Requests (>1s): ${slowRequests} (${((slowRequests / recent.length) * 100).toFixed(1)}%)\n`;
    
    if (slowRequests > recent.length * 0.3) {
      report += '\n🚨 HIGH IMPACT: >30% of requests are slow. Cache optimization recommended!\n';
    } else if (slowRequests > 0) {
      report += '\n⚠️  MEDIUM IMPACT: Some slow requests. Cache optimization would help.\n';
    } else {
      report += '\n✅ GOOD: Response times look healthy.\n';
    }

    return report;
  }

  public exportData(): string {
    return JSON.stringify(this.measurements, null, 2);
  }

  public clearData(): void {
    this.measurements = [];
    localStorage.removeItem(this.STORAGE_KEY);
    console.log('[CacheAnalyzer] Data cleared');
  }
}

// Global instance
export const cacheAnalyzer = new CacheAnalyzer();

// Add global methods for easy console access
if (typeof window !== 'undefined') {
  (window as any).cacheReport = () => console.log(cacheAnalyzer.generateReport());
  (window as any).exportCacheData = () => console.log(cacheAnalyzer.exportData());
  (window as any).clearCacheData = () => cacheAnalyzer.clearData();
  
  console.log('🔍 Cache Analysis Active! Use these commands:');
  console.log('  cacheReport() - View performance report');
  console.log('  exportCacheData() - Export raw data');
  console.log('  clearCacheData() - Clear collected data');
}

export default CacheAnalyzer;
