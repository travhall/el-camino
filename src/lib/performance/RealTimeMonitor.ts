/**
 * Enhanced Real-Time Monitoring System
 * Advanced performance tracking with regression detection and automated insights
 * File: src/lib/performance/RealTimeMonitor.ts
 */

import { budgetManager, type BudgetViolation } from './BudgetManager';

export interface PerformanceEvent {
  id: string;
  type: 'metric' | 'regression' | 'improvement' | 'alert';
  metric: string;
  value: number;
  previousValue?: number;
  change?: number;
  severity: 'info' | 'warning' | 'critical';
  timestamp: number;
  url: string;
  userAgent: string;
  connection?: string;
  deviceType?: 'mobile' | 'tablet' | 'desktop';
}

export interface PerformanceInsight {
  id: string;
  title: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  effort: 'low' | 'medium' | 'high';
  category: 'performance' | 'seo' | 'ux' | 'business';
  recommendation: string;
  estimatedSavings: string;
  confidence: number;
  timestamp: number;
}

export interface PerformanceRegression {
  id: string;
  metric: string;
  currentValue: number;
  baselineValue: number;
  change: number;
  changePercent: number;
  severity: 'minor' | 'major' | 'critical';
  detectedAt: number;
  possibleCauses: string[];
}

export class RealTimeMonitor {
  private events: PerformanceEvent[] = [];
  private insights: PerformanceInsight[] = [];
  private regressions: PerformanceRegression[] = [];
  private baselines: Map<string, number> = new Map();
  private listeners: Map<string, ((event: PerformanceEvent) => void)[]> = new Map();
  private websocket: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  // Memory management configuration
  private readonly MAX_EVENTS = 250; // Reduced from 1000
  private readonly MAX_INSIGHTS = 25; // Reduced from 50
  private readonly CLEANUP_INTERVAL = 30 * 60 * 1000; // 30 minutes

  constructor() {
    this.initializeBaselines();
    // PHASE 1 & 2: Enable core monitoring features
    this.startRegressionDetection();
    this.startInsightGeneration();
    // PHASE 3B: WebSocket enabled for real-time monitoring
    this.connectWebSocket();
    this.startMemoryManagement(); // Keep memory cleanup
    
    if (import.meta.env.DEV) {
      console.log('[RealTimeMonitor] Initialized with reduced features for better performance');
    }
  }

  private initializeBaselines(): void {
    // Set performance baselines for regression detection
    this.baselines.set('lcp', 2100); // Current LCP baseline
    this.baselines.set('inp', 147);  // Current INP baseline
    this.baselines.set('cls', 0.08); // Current CLS baseline
    this.baselines.set('fcp', 1200); // Current FCP baseline
    this.baselines.set('ttfb', 180); // Current TTFB baseline
  }

  private connectWebSocket(): void {
    if (import.meta.env.PROD && import.meta.env.PUBLIC_WS_ENDPOINT) {
      try {
        this.websocket = new WebSocket(import.meta.env.PUBLIC_WS_ENDPOINT);
        
        this.websocket.onopen = () => {
          console.log('[RealTimeMonitor] WebSocket connected');
          this.reconnectAttempts = 0;
        };

        this.websocket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleWebSocketMessage(data);
          } catch (error) {
            console.error('[RealTimeMonitor] Failed to parse WebSocket message:', error);
          }
        };

        this.websocket.onclose = () => {
          console.log('[RealTimeMonitor] WebSocket disconnected');
          this.attemptReconnect();
        };

        this.websocket.onerror = (error) => {
          console.error('[RealTimeMonitor] WebSocket error:', error);
        };
      } catch (error) {
        console.error('[RealTimeMonitor] Failed to connect WebSocket:', error);
      }
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.pow(2, this.reconnectAttempts) * 1000; // Exponential backoff
      
      setTimeout(() => {
        console.log(`[RealTimeMonitor] Reconnection attempt ${this.reconnectAttempts}`);
        this.connectWebSocket();
      }, delay);
    }
  }

  private handleWebSocketMessage(data: any): void {
    switch (data.type) {
      case 'performance_alert':
        this.handleRemoteAlert(data);
        break;
      case 'baseline_update':
        this.updateBaseline(data.metric, data.value);
        break;
      case 'competitor_update':
        this.handleCompetitorUpdate(data);
        break;
    }
  }

  public recordMetric(metric: string, value: number): void {
    const deviceType = this.detectDeviceType();
    const connection = this.getConnectionType();
    
    const event: PerformanceEvent = {
      id: this.generateEventId(),
      type: 'metric',
      metric,
      value,
      severity: 'info',
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      connection,
      deviceType
    };

    // Check for regressions
    const regression = this.detectRegression(metric, value);
    if (regression) {
      this.regressions.push(regression);
      event.type = 'regression';
      event.severity = regression.severity === 'critical' ? 'critical' : 'warning';
      event.previousValue = regression.baselineValue;
      event.change = regression.change;
    }

    // Check budget violations
    const violation = budgetManager.checkMetric(metric, value);
    if (violation) {
      event.severity = violation.severity;
      event.type = 'alert';
    }

    this.events.push(event);
    this.notifyListeners(event);

    // Send to WebSocket if connected
    if (this.websocket?.readyState === WebSocket.OPEN) {
      this.websocket.send(JSON.stringify({
        type: 'metric_update',
        event
      }));
    }

    // Trim events to keep only recent ones (using new memory limits)
    if (this.events.length > this.MAX_EVENTS) {
      this.events = this.events.slice(-this.MAX_EVENTS);
    }
  }

  private detectRegression(metric: string, value: number): PerformanceRegression | null {
    const baseline = this.baselines.get(metric);
    if (!baseline) return null;

    const change = value - baseline;
    const changePercent = (change / baseline) * 100;

    // Determine regression thresholds based on metric
    const thresholds = {
      lcp: { minor: 5, major: 15, critical: 25 },
      inp: { minor: 10, major: 25, critical: 50 },
      cls: { minor: 20, major: 50, critical: 100 },
      fcp: { minor: 10, major: 20, critical: 40 },
      ttfb: { minor: 15, major: 30, critical: 60 }
    };

    const threshold = thresholds[metric as keyof typeof thresholds];
    if (!threshold) return null;

    let severity: 'minor' | 'major' | 'critical' | null = null;
    if (changePercent > threshold.critical) severity = 'critical';
    else if (changePercent > threshold.major) severity = 'major';
    else if (changePercent > threshold.minor) severity = 'minor';

    if (!severity) return null;

    return {
      id: this.generateEventId(),
      metric,
      currentValue: value,
      baselineValue: baseline,
      change,
      changePercent,
      severity,
      detectedAt: Date.now(),
      possibleCauses: this.identifyPossibleCauses(metric, changePercent)
    };
  }

  private identifyPossibleCauses(metric: string, changePercent: number): string[] {
    const causes: Record<string, string[]> = {
      lcp: [
        'Server response time increased',
        'Large images not optimized',
        'JavaScript blocking render',
        'CSS render blocking',
        'Third-party scripts delay'
      ],
      inp: [
        'Heavy JavaScript processing',
        'Main thread blocking',
        'Large DOM manipulations',
        'Event handler delays',
        'Third-party script impact'
      ],
      cls: [
        'Images without dimensions',
        'Web fonts loading late',
        'Dynamic content injection',
        'Ad slots causing shifts',
        'CSS animation issues'
      ],
      fcp: [
        'Render blocking resources',
        'Server response delays',
        'CSS loading issues',
        'Font loading problems',
        'Critical resource delays'
      ],
      ttfb: [
        'Server performance issues',
        'Database query delays',
        'CDN configuration problems',
        'Network connectivity issues',
        'Backend processing delays'
      ]
    };

    return causes[metric] || ['Unknown cause'];
  }

  private startRegressionDetection(): void {
    // Run regression analysis every 15 minutes (reduced from 5 minutes to lower overhead)
    setInterval(() => {
      this.analyzePerformanceRegressions();
    }, 15 * 60 * 1000);
  }

  private analyzePerformanceRegressions(): void {
    // Analyze recent events for patterns
    const recentEvents = this.events.filter(e => 
      Date.now() - e.timestamp < 30 * 60 * 1000 // Last 30 minutes
    );

    // Look for consistent performance degradation
    const metricGroups = this.groupEventsByMetric(recentEvents);
    
    Object.entries(metricGroups).forEach(([metric, events]) => {
      if (events.length >= 3) {
        const trend = this.calculateTrend(events);
        if (trend.isNegative && trend.significance > 0.7) {
          this.generateRegressionInsight(metric, trend);
        }
      }
    });
  }

  private groupEventsByMetric(events: PerformanceEvent[]): Record<string, PerformanceEvent[]> {
    return events.reduce((groups, event) => {
      if (!groups[event.metric]) groups[event.metric] = [];
      groups[event.metric].push(event);
      return groups;
    }, {} as Record<string, PerformanceEvent[]>);
  }

  private calculateTrend(events: PerformanceEvent[]): { isNegative: boolean; significance: number } {
    if (events.length < 2) return { isNegative: false, significance: 0 };

    const values = events.map(e => e.value);
    const timePoints = events.map(e => e.timestamp);
    
    // Simple linear regression to detect trend
    const n = values.length;
    const sumX = timePoints.reduce((a, b) => a + b, 0);
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = timePoints.reduce((sum, x, i) => sum + x * values[i], 0);
    const sumXX = timePoints.reduce((sum, x) => sum + x * x, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const correlation = Math.abs(slope) / Math.max(...values);
    
    return {
      isNegative: slope > 0, // For performance metrics, higher is worse
      significance: Math.min(correlation, 1)
    };
  }

  private startInsightGeneration(): void {
    // Generate insights every 10 minutes
    setInterval(() => {
      this.generateAutomatedInsights();
    }, 10 * 60 * 1000);
  }

  private generateAutomatedInsights(): void {
    const currentMetrics = this.getCurrentMetrics();
    
    // Generate insights based on current performance
    this.generateLCPInsights(currentMetrics.lcp);
    this.generateINPInsights(currentMetrics.inp);
    this.generateCLSInsights(currentMetrics.cls);
    this.generateImageOptimizationInsights();
    this.generateCacheInsights();

    // Clean up old insights (using new memory limits)
    if (this.insights.length > this.MAX_INSIGHTS) {
      this.insights = this.insights.slice(-this.MAX_INSIGHTS);
    }
  }

  private generateLCPInsights(lcp: number): void {
    if (lcp > 2500) {
      this.insights.push({
        id: this.generateEventId(),
        title: 'LCP Optimization Opportunity',
        description: `LCP is ${lcp}ms, which exceeds the 2.5s recommendation.`,
        impact: lcp > 4000 ? 'high' : 'medium',
        effort: 'medium',
        category: 'performance',
        recommendation: 'Optimize largest contentful paint by preloading hero images and reducing server response time.',
        estimatedSavings: `${Math.round((lcp - 2000) / 1000 * 100)}% faster loading`,
        confidence: 0.85,
        timestamp: Date.now()
      });
    }
  }

  private generateINPInsights(inp: number): void {
    if (inp > 200) {
      this.insights.push({
        id: this.generateEventId(),
        title: 'Interaction Responsiveness Issue',
        description: `INP is ${inp}ms, indicating slow interaction response.`,
        impact: inp > 500 ? 'high' : 'medium',
        effort: 'medium',
        category: 'ux',
        recommendation: 'Reduce JavaScript execution time and break up long tasks.',
        estimatedSavings: `${Math.round((inp - 150) / inp * 100)}% faster interactions`,
        confidence: 0.80,
        timestamp: Date.now()
      });
    }
  }

  private generateCLSInsights(cls: number): void {
    if (cls > 0.1) {
      this.insights.push({
        id: this.generateEventId(),
        title: 'Layout Stability Issue',
        description: `CLS is ${cls.toFixed(3)}, causing visual instability.`,
        impact: cls > 0.25 ? 'high' : 'medium',
        effort: 'low',
        category: 'ux',
        recommendation: 'Add explicit dimensions to images and reserve space for dynamic content.',
        estimatedSavings: 'Improved user experience and reduced bounce rate',
        confidence: 0.90,
        timestamp: Date.now()
      });
    }
  }

  private generateImageOptimizationInsights(): void {
    // This would integrate with actual image metrics
    const modernFormatUsage = 0.75; // Example value
    
    if (modernFormatUsage < 0.8) {
      this.insights.push({
        id: this.generateEventId(),
        title: 'Image Format Optimization',
        description: `Only ${Math.round(modernFormatUsage * 100)}% of images use modern formats.`,
        impact: 'medium',
        effort: 'low',
        category: 'performance',
        recommendation: 'Convert remaining JPEG/PNG images to AVIF or WebP format.',
        estimatedSavings: `${Math.round((1 - modernFormatUsage) * 30)}% smaller image sizes`,
        confidence: 0.95,
        timestamp: Date.now()
      });
    }
  }

  private generateCacheInsights(): void {
    // This would integrate with actual cache metrics
    const cacheHitRate = 0.85; // Example value
    
    if (cacheHitRate < 0.9) {
      this.insights.push({
        id: this.generateEventId(),
        title: 'Cache Optimization Opportunity',
        description: `Cache hit rate is ${Math.round(cacheHitRate * 100)}%.`,
        impact: 'medium',
        effort: 'low',
        category: 'performance',
        recommendation: 'Review cache headers and CDN configuration for better cache efficiency.',
        estimatedSavings: `${Math.round((0.95 - cacheHitRate) * 100)}% faster repeat visits`,
        confidence: 0.75,
        timestamp: Date.now()
      });
    }
  }

  private generateRegressionInsight(metric: string, trend: any): void {
    this.insights.push({
      id: this.generateEventId(),
      title: `Performance Regression Detected: ${metric.toUpperCase()}`,
      description: `${metric.toUpperCase()} has shown consistent degradation with ${Math.round(trend.significance * 100)}% confidence.`,
      impact: 'high',
      effort: 'high',
      category: 'performance',
      recommendation: `Investigate recent changes that may have impacted ${metric.toUpperCase()} performance.`,
      estimatedSavings: 'Prevent further performance degradation',
      confidence: trend.significance,
      timestamp: Date.now()
    });
  }

  private getCurrentMetrics(): Record<string, number> {
    // This would integrate with the actual PerformanceManager
    return {
      lcp: 2100,
      inp: 147,
      cls: 0.08,
      fcp: 1200,
      ttfb: 180
    };
  }

  private detectDeviceType(): 'mobile' | 'tablet' | 'desktop' {
    const width = window.innerWidth;
    if (width < 768) return 'mobile';
    if (width < 1024) return 'tablet';
    return 'desktop';
  }

  private getConnectionType(): string {
    const nav = navigator as any;
    return nav.connection?.effectiveType || 'unknown';
  }

  private generateEventId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private handleRemoteAlert(data: any): void {
    console.log('[RealTimeMonitor] Remote alert received:', data);
    // Handle alerts from other sources or admin panel
  }

  private updateBaseline(metric: string, value: number): void {
    this.baselines.set(metric, value);
    console.log(`[RealTimeMonitor] Baseline updated for ${metric}: ${value}`);
  }

  private handleCompetitorUpdate(data: any): void {
    console.log('[RealTimeMonitor] Competitor update received:', data);
    // Handle competitive intelligence updates
  }

  // Public API
  public addEventListener(eventType: string, callback: (event: PerformanceEvent) => void): void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType)!.push(callback);
  }

  public removeEventListener(eventType: string, callback: (event: PerformanceEvent) => void): void {
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private notifyListeners(event: PerformanceEvent): void {
    const listeners = this.listeners.get(event.type) || [];
    listeners.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('[RealTimeMonitor] Error in event listener:', error);
      }
    });

    // Also notify 'all' listeners
    const allListeners = this.listeners.get('all') || [];
    allListeners.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('[RealTimeMonitor] Error in event listener:', error);
      }
    });
  }

  public getRecentEvents(limit = 50): PerformanceEvent[] {
    return this.events.slice(-limit);
  }

  public getInsights(category?: string): PerformanceInsight[] {
    if (category) {
      return this.insights.filter(i => i.category === category);
    }
    return [...this.insights];
  }

  public getRegressions(): PerformanceRegression[] {
    return [...this.regressions];
  }

  private startMemoryManagement(): void {
    setInterval(() => {
      this.performMemoryCleanup();
    }, this.CLEANUP_INTERVAL);
  }
  
  private performMemoryCleanup(): void {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    
    // Clean old events
    this.events = this.events
      .filter(e => e.timestamp > oneHourAgo)
      .slice(-this.MAX_EVENTS);
    
    // Clean old insights  
    this.insights = this.insights
      .filter(i => i.timestamp > oneHourAgo)
      .slice(-this.MAX_INSIGHTS);
    
    // Clean old regressions
    this.regressions = this.regressions
      .filter(r => r.detectedAt > oneHourAgo);
    
    if (import.meta.env.DEV) {
      console.log(`[RealTimeMonitor] Memory cleanup: ${this.events.length} events, ${this.insights.length} insights`);
    }
  }

  public clearOldData(): void {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    this.events = this.events.filter(e => e.timestamp > oneHourAgo).slice(-this.MAX_EVENTS);
    this.insights = this.insights.filter(i => i.timestamp > oneHourAgo).slice(-this.MAX_INSIGHTS);
    this.regressions = this.regressions.filter(r => r.detectedAt > oneHourAgo);
  }

  public destroy(): void {
    if (this.websocket) {
      this.websocket.close();
    }
    this.listeners.clear();
    this.events = [];
    this.insights = [];
    this.regressions = [];
  }
}

// PHASE 3A: Global instance enabled for site-wide monitoring
export const realTimeMonitor = new RealTimeMonitor();

// PHASE 3A: Auto-cleanup enabled
if (typeof window !== 'undefined') {
  setInterval(() => {
    realTimeMonitor.clearOldData();
  }, 60 * 60 * 1000); // Cleanup every hour
}
