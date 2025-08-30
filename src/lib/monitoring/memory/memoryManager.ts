/**
 * El Camino Enhanced: Memory Management System
 * Integrates with existing performance monitoring to prevent memory leaks and crashes
 */

import { businessMonitor } from '../businessMonitor';
import { processSquareError, logError, AppError } from '../../square/errorUtils';

interface MemoryMetrics {
  used: number;
  total: number;
  percentage: number;
  timestamp: number;
  pressureLevel: 'normal' | 'moderate' | 'critical';
}

interface MemoryPressureThresholds {
  moderate: number; // 70%
  critical: number;  // 85%
  emergency: number; // 95%
}

interface MemoryLeakDetection {
  isLeakDetected: boolean;
  leakRate: number; // MB per minute
  confidence: number; // 0-1
  recommendations: string[];
}

class MemoryManager {
  private readonly thresholds: MemoryPressureThresholds = {
    moderate: 0.70,
    critical: 0.85,
    emergency: 0.95
  };

  private memoryHistory: MemoryMetrics[] = [];
  private readonly maxHistorySize = 20;
  private readonly monitoringInterval = 30000; // 30 seconds
  private monitoringTimer?: NodeJS.Timeout;
  private isMonitoring = false;

  private leakDetectionSamples: Array<{ timestamp: number; memory: number }> = [];
  private readonly leakDetectionWindow = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.initializeMemoryMonitoring();
  }

  /**
   * Initialize memory monitoring system
   * Integrates with existing El Camino performance monitoring
   */
  private initializeMemoryMonitoring(): void {
    if (typeof window === 'undefined' || typeof performance === 'undefined') {
      console.log('Memory monitoring not available in this environment');
      return;
    }

    // Check if Performance.measureUserAgentSpecificMemory is available
    if ('measureUserAgentSpecificMemory' in performance) {
      this.startAdvancedMonitoring();
    } else {
      this.startBasicMonitoring();
    }

    // Integrate with existing page lifecycle
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.checkMemoryPressure();
      }
    });

    // Memory pressure response system
    this.setupMemoryPressureHandlers();
  }

  /**
   * Start advanced memory monitoring using newer APIs
   */
  private async startAdvancedMonitoring(): Promise<void> {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    console.log('🧠 Starting advanced memory monitoring...');

    this.monitoringTimer = setInterval(async () => {
      try {
        // @ts-ignore - measureUserAgentSpecificMemory is experimental
        const memoryInfo = await performance.measureUserAgentSpecificMemory();
        const totalBytes = memoryInfo.bytes;
        const usedBytes = totalBytes;

        await this.processMemoryMetrics({
          used: usedBytes,
          total: this.estimateAvailableMemory(),
          timestamp: Date.now()
        });

      } catch (error) {
        // Fallback to basic monitoring
        this.startBasicMonitoring();
      }
    }, this.monitoringInterval);
  }

  /**
   * Start basic memory monitoring using available APIs
   */
  private startBasicMonitoring(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    console.log('🧠 Starting basic memory monitoring...');

    this.monitoringTimer = setInterval(() => {
      try {
        const memInfo = (performance as any).memory;
        
        if (memInfo) {
          this.processMemoryMetrics({
            used: memInfo.usedJSHeapSize,
            total: memInfo.totalJSHeapSize,
            timestamp: Date.now()
          });
        } else {
          // Estimate based on available information
          this.processMemoryMetrics({
            used: this.estimateMemoryUsage(),
            total: this.estimateAvailableMemory(),
            timestamp: Date.now()
          });
        }

      } catch (error) {
        console.warn('Memory monitoring error:', error);
      }
    }, this.monitoringInterval);
  }

  /**
   * Process memory metrics and detect issues
   */
  private async processMemoryMetrics(rawMetrics: { used: number; total: number; timestamp: number }): Promise<void> {
    const percentage = rawMetrics.total > 0 ? rawMetrics.used / rawMetrics.total : 0;
    
    const metrics: MemoryMetrics = {
      ...rawMetrics,
      percentage,
      pressureLevel: this.calculatePressureLevel(percentage)
    };

    // Add to history
    this.memoryHistory.push(metrics);
    if (this.memoryHistory.length > this.maxHistorySize) {
      this.memoryHistory.shift();
    }

    // Update leak detection samples
    this.leakDetectionSamples.push({
      timestamp: metrics.timestamp,
      memory: metrics.used
    });
    this.cleanupOldSamples();

    // Track with business monitor
    businessMonitor.trackCustomEvent('memory_metrics', {
      usedMB: Math.round(metrics.used / (1024 * 1024)),
      totalMB: Math.round(metrics.total / (1024 * 1024)),
      percentage: Math.round(percentage * 100),
      pressureLevel: metrics.pressureLevel
    });

    // Check for memory pressure or leaks
    await this.handleMemoryConditions(metrics);
  }

  /**
   * Calculate memory pressure level
   */
  private calculatePressureLevel(percentage: number): MemoryMetrics['pressureLevel'] {
    if (percentage >= this.thresholds.critical) return 'critical';
    if (percentage >= this.thresholds.moderate) return 'moderate';
    return 'normal';
  }

  /**
   * Handle different memory conditions with memoryPressure detection
   */
  private async handleMemoryConditions(metrics: MemoryMetrics): Promise<void> {
    // Memory pressure handling - detects and responds to memory pressure conditions
    if (metrics.pressureLevel === 'critical') {
      await this.handleCriticalMemoryPressure(metrics);
    } else if (metrics.pressureLevel === 'moderate') {
      await this.handleModerateMemoryPressure(metrics);
    }

    // Memory leak detection
    const leakDetection = this.detectMemoryLeak();
    if (leakDetection.isLeakDetected) {
      await this.handleMemoryLeak(leakDetection);
    }

    // Emergency handling
    if (metrics.percentage >= this.thresholds.emergency) {
      await this.handleEmergencyMemoryPressure(metrics);
    }
  }

  /**
   * Handle moderate memory pressure
   */
  private async handleModerateMemoryPressure(metrics: MemoryMetrics): Promise<void> {
    businessMonitor.trackCustomEvent('memory_pressure_moderate', {
      percentage: Math.round(metrics.percentage * 100),
      usedMB: Math.round(metrics.used / (1024 * 1024))
    });

    // Gentle cleanup
    await this.optimizeMemoryUsage();
    
    // Notify user interface for graceful degradation
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('memory:pressure:moderate', {
        detail: { metrics }
      }));
    }
  }

  /**
   * Handle critical memory pressure
   */
  private async handleCriticalMemoryPressure(metrics: MemoryMetrics): Promise<void> {
    businessMonitor.trackCustomEvent('memory_pressure_critical', {
      percentage: Math.round(metrics.percentage * 100),
      usedMB: Math.round(metrics.used / (1024 * 1024)),
      actionTaken: 'aggressive_cleanup'
    });

    // Aggressive cleanup
    await this.aggressiveMemoryCleanup();
    
    // Notify components to reduce memory usage
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('memory:pressure:critical', {
        detail: { metrics }
      }));
    }

    console.warn('⚠️ Critical memory pressure detected - performing cleanup');
  }

  /**
   * Handle emergency memory pressure - prevent crashes
   */
  private async handleEmergencyMemoryPressure(metrics: MemoryMetrics): Promise<void> {
    businessMonitor.trackCustomEvent('memory_pressure_emergency', {
      percentage: Math.round(metrics.percentage * 100),
      usedMB: Math.round(metrics.used / (1024 * 1024)),
      actionTaken: 'emergency_measures'
    });

    // Emergency measures
    await this.emergencyMemoryRecovery();
    
    // Force garbage collection if available
    if (window.gc) {
      window.gc();
    }

    console.error('🚨 Emergency memory pressure - taking immediate action');
  }

  /**
   * Detect potential memory leaks
   */
  private detectMemoryLeak(): MemoryLeakDetection {
    if (this.leakDetectionSamples.length < 3) {
      return { isLeakDetected: false, leakRate: 0, confidence: 0, recommendations: [] };
    }

    const samples = this.leakDetectionSamples.slice(-10); // Last 10 samples
    let totalIncrease = 0;
    let increases = 0;

    for (let i = 1; i < samples.length; i++) {
      const increase = samples[i].memory - samples[i - 1].memory;
      if (increase > 0) {
        totalIncrease += increase;
        increases++;
      }
    }

    if (increases === 0) {
      return { isLeakDetected: false, leakRate: 0, confidence: 0, recommendations: [] };
    }

    const avgIncrease = totalIncrease / increases;
    const timeSpan = samples[samples.length - 1].timestamp - samples[0].timestamp;
    const leakRate = (avgIncrease * 60000) / timeSpan; // MB per minute

    // Leak detection thresholds
    const isLeakDetected = leakRate > 1 && increases / samples.length > 0.7; // >1MB/min with 70% increases
    const confidence = Math.min((leakRate / 5) * (increases / samples.length), 1);

    const recommendations: string[] = [];
    if (isLeakDetected) {
      recommendations.push('Monitor for unclosed event listeners');
      recommendations.push('Check for retained DOM references');
      recommendations.push('Review large object caches');
      if (leakRate > 5) {
        recommendations.push('Consider page refresh for user');
      }
    }

    return { isLeakDetected, leakRate, confidence, recommendations };
  }

  /**
   * Handle detected memory leak
   */
  private async handleMemoryLeak(detection: MemoryLeakDetection): Promise<void> {
    businessMonitor.trackCustomEvent('memory_leak_detected', {
      leakRate: detection.leakRate,
      confidence: detection.confidence,
      recommendations: detection.recommendations.length
    });

    console.warn(`🚨 Memory leak detected: ${detection.leakRate.toFixed(2)} MB/min (confidence: ${Math.round(detection.confidence * 100)}%)`);

    // Aggressive cleanup for confirmed leaks
    if (detection.confidence > 0.7) {
      await this.aggressiveMemoryCleanup();
    }

    // Notify application for preventive measures
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('memory:leak:detected', {
        detail: { detection }
      }));
    }
  }

  // Memory cleanup methods

  /**
   * Optimize memory usage - gentle cleanup
   */
  private async optimizeMemoryUsage(): Promise<void> {
    // Clear non-essential caches
    if (typeof window !== 'undefined') {
      // Clear image caches that are not currently visible
      const images = document.querySelectorAll('img[data-lazy-loaded="true"]');
      images.forEach(img => {
        const rect = img.getBoundingClientRect();
        const isVisible = rect.top < window.innerHeight && rect.bottom > 0;
        if (!isVisible && (img as HTMLImageElement).src) {
          // Keep src for fast reload, but clear larger cached data
          img.removeAttribute('data-cached-data');
        }
      });

      // Notify cache systems to optimize
      window.dispatchEvent(new CustomEvent('memory:optimize', { 
        detail: { level: 'gentle' }
      }));
    }
  }

  /**
   * Aggressive memory cleanup - more extensive
   */
  private async aggressiveMemoryCleanup(): Promise<void> {
    if (typeof window !== 'undefined') {
      // Clear non-critical caches more aggressively
      window.dispatchEvent(new CustomEvent('memory:cleanup:aggressive', {
        detail: { timestamp: Date.now() }
      }));

      // Clear interval timers that aren't critical
      // (Components should listen for this event and clean up)
      
      // Force DOM cleanup
      this.cleanupDetachedNodes();
    }
  }

  /**
   * Emergency memory recovery - last resort
   */
  private async emergencyMemoryRecovery(): Promise<void> {
    if (typeof window !== 'undefined') {
      // Emergency cleanup
      window.dispatchEvent(new CustomEvent('memory:emergency', {
        detail: { timestamp: Date.now() }
      }));

      // Consider suggesting page refresh to user
      console.warn('💡 Consider refreshing the page to recover memory');
    }
  }

  /**
   * Setup memory pressure response handlers
   */
  private setupMemoryPressureHandlers(): void {
    // Integrate with existing El Camino components
    if (typeof window !== 'undefined') {
      // Product image optimization during pressure
      window.addEventListener('memory:pressure:moderate', () => {
        window.dispatchEvent(new CustomEvent('product:optimize:images'));
      });

      // Reduce animations during critical pressure
      window.addEventListener('memory:pressure:critical', () => {
        document.body.classList.add('reduced-motion');
        window.dispatchEvent(new CustomEvent('ui:reduce:animations'));
      });

      // Emergency measures
      window.addEventListener('memory:emergency', () => {
        // Disable non-essential features
        document.body.classList.add('emergency-mode');
        window.dispatchEvent(new CustomEvent('ui:emergency:mode'));
      });
    }
  }

  // Helper methods

  private cleanupDetachedNodes(): void {
    // Find detached nodes and clean references
    if (typeof document !== 'undefined') {
      // This is a simplified approach - in production, you'd want more sophisticated detection
      const detachedElements = document.querySelectorAll('[data-removed="true"]');
      detachedElements.forEach(el => el.remove());
    }
  }

  private cleanupOldSamples(): void {
    const cutoff = Date.now() - this.leakDetectionWindow;
    this.leakDetectionSamples = this.leakDetectionSamples.filter(
      sample => sample.timestamp > cutoff
    );
  }

  private estimateMemoryUsage(): number {
    // Rough estimation based on DOM complexity and known factors
    const domNodes = document ? document.querySelectorAll('*').length : 1000;
    const estimatedPerNode = 1024; // rough estimate
    return domNodes * estimatedPerNode;
  }

  private estimateAvailableMemory(): number {
    // Conservative estimate for browser environments
    if (navigator.deviceMemory) {
      return navigator.deviceMemory * 1024 * 1024 * 1024 * 0.5; // 50% of device memory
    }
    return 2 * 1024 * 1024 * 1024; // 2GB default estimate
  }

  /**
   * Get current memory status for monitoring/debugging
   */
  getCurrentMemoryStatus(): {
    current: MemoryMetrics | null;
    trend: 'increasing' | 'stable' | 'decreasing';
    leakDetection: MemoryLeakDetection;
  } {
    const current = this.memoryHistory[this.memoryHistory.length - 1] || null;
    
    let trend: 'increasing' | 'stable' | 'decreasing' = 'stable';
    if (this.memoryHistory.length >= 3) {
      const recent = this.memoryHistory.slice(-3);
      const increases = recent.filter((m, i) => i > 0 && m.used > recent[i - 1].used).length;
      
      if (increases >= 2) trend = 'increasing';
      else if (increases === 0) trend = 'decreasing';
    }

    return {
      current,
      trend,
      leakDetection: this.detectMemoryLeak()
    };
  }

  /**
   * Stop monitoring and cleanup
   */
  destroy(): void {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
    }
    this.isMonitoring = false;
    this.memoryHistory = [];
    this.leakDetectionSamples = [];
  }

  /**
   * Check memory pressure on demand
   */
  async checkMemoryPressure(): Promise<MemoryMetrics | null> {
    try {
      if (typeof performance === 'undefined') return null;

      const memInfo = (performance as any).memory;
      if (!memInfo) return null;

      const metrics: MemoryMetrics = {
        used: memInfo.usedJSHeapSize,
        total: memInfo.totalJSHeapSize,
        percentage: memInfo.usedJSHeapSize / memInfo.totalJSHeapSize,
        timestamp: Date.now(),
        pressureLevel: this.calculatePressureLevel(memInfo.usedJSHeapSize / memInfo.totalJSHeapSize)
      };

      await this.handleMemoryConditions(metrics);
      return metrics;

    } catch (error) {
      logError(processSquareError(error, 'checkMemoryPressure'));
      return null;
    }
  }
}

// Export singleton instance integrating with El Camino architecture
export const memoryManager = new MemoryManager();

// Export types for integration
export type { MemoryMetrics, MemoryLeakDetection, MemoryPressureThresholds };
