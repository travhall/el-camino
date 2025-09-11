/**
 * Phase 3: Real-Time Cache Performance Monitor
 * Tracks API response times and cache effectiveness
 */

import { trackCachePerformance } from '../lib/performance/PerformanceManager.js';
import { budgetManager } from '../lib/performance/BudgetManager.js';

interface ApiCall {
  endpoint: string;
  url: string;
  responseTime: number;
  cached: boolean;
  timestamp: number;
  error: boolean;
}

interface CacheStats {
  totalCalls: number;
  hitRate: number;
  avgResponseTime: number;
  endpoints: string[];
}

class CacheMonitor {
  private startTime: number;
  private apiCalls: ApiCall[];

  constructor() {
    this.startTime = Date.now();
    this.apiCalls = [];
    this.init();
  }

  init(): void {
    this.monitorFetchRequests();
    this.startPeriodicChecks();
    console.log('[CacheMonitor] Phase 3 monitoring initialized');
  }

  monitorFetchRequests(): void {
    const originalFetch = window.fetch;
    
    window.fetch = async (...args: Parameters<typeof fetch>): Promise<Response> => {
      const [url] = args;
      const startTime = Date.now();
      
      try {
        const response = await originalFetch(...args);
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        if (typeof url === 'string' && url.includes('/api/')) {
          this.trackApiCall(url, responseTime, response);
        }
        
        return response;
      } catch (error) {
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        if (typeof url === 'string' && url.includes('/api/')) {
          this.trackApiCall(url, responseTime, null, error as Error);
        }
        
        throw error;
      }
    };
  }

  trackApiCall(url: string, responseTime: number, response: Response | null, error: Error | null = null): void {
    // Determine if response was cached
    const cacheHeaders = response ? response.headers.get('x-cache') || response.headers.get('cf-cache-status') : null;
    const wasCached = cacheHeaders === 'HIT' || responseTime < 100; // Assume fast responses are cached
    
    // Extract endpoint name
    const endpoint = url.split('/api/')[1]?.split('?')[0] || 'unknown';
    
    // Track with performance manager
    trackCachePerformance(`api-${endpoint}`, wasCached, responseTime);
    
    // Store for analysis
    this.apiCalls.push({
      endpoint,
      url,
      responseTime,
      cached: wasCached,
      timestamp: Date.now(),
      error: !!error
    });
    
    // Keep only last 100 calls
    if (this.apiCalls.length > 100) {
      this.apiCalls.shift();
    }
    
    console.log(`[CacheMonitor] API ${endpoint}: ${wasCached ? 'HIT' : 'MISS'} (${responseTime}ms)`);
  }

  startPeriodicChecks(): void {
    // Run cache effectiveness check every 2 minutes
    setInterval(() => {
      budgetManager.checkCacheEffectiveness();
      this.logSummary();
    }, 120000);
    
    // Initial check after 30 seconds
    setTimeout(() => {
      budgetManager.checkCacheEffectiveness();
      this.logSummary();
    }, 30000);
  }

  logSummary(): void {
    if (this.apiCalls.length === 0) return;
    
    const recent = this.apiCalls.filter((call: ApiCall) => Date.now() - call.timestamp < 300000); // Last 5 minutes
    
    if (recent.length > 0) {
      const hitRate = recent.filter((call: ApiCall) => call.cached).length / recent.length;
      const avgResponseTime = recent.reduce((sum: number, call: ApiCall) => sum + call.responseTime, 0) / recent.length;
      const errors = recent.filter((call: ApiCall) => call.error).length;
      
      console.log(`[CacheMonitor] Summary (5min): ${recent.length} calls | ${(hitRate * 100).toFixed(1)}% hit rate | ${avgResponseTime.toFixed(0)}ms avg | ${errors} errors`);
    }
  }

  // Console commands for manual analysis
  getStats(): CacheStats {
    return {
      totalCalls: this.apiCalls.length,
      hitRate: this.apiCalls.filter((c: ApiCall) => c.cached).length / this.apiCalls.length,
      avgResponseTime: this.apiCalls.reduce((sum: number, c: ApiCall) => sum + c.responseTime, 0) / this.apiCalls.length,
      endpoints: [...new Set(this.apiCalls.map((c: ApiCall) => c.endpoint))]
    };
  }

  exportData(): string {
    return JSON.stringify(this.apiCalls, null, 2);
  }
}

// Initialize if in browser
if (typeof window !== 'undefined') {
  const cacheMonitor = new CacheMonitor();
  
  // Expose to console for manual testing
  (window as any).cacheMonitor = cacheMonitor;
  (window as any).cacheStats = (): CacheStats => cacheMonitor.getStats();
  (window as any).exportCacheData = (): string => cacheMonitor.exportData();
}
