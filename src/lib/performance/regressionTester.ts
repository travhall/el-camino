/**
 * Performance Regression Testing
 * Automated testing to prevent performance degradation
 */

import { performanceValidator, type ValidationResults } from './performanceValidation';
import { performanceManager } from './PerformanceManager';

export interface RegressionTest {
  name: string;
  description: string;
  threshold: number;
  unit: string;
  test: () => Promise<number>;
}

export interface RegressionResults {
  passed: number;
  failed: number;
  total: number;
  results: Array<{
    test: string;
    value: number;
    threshold: number;
    passed: boolean;
    improvement: number;
  }>;
  summary: string;
}

export class PerformanceRegressionTester {
  private tests: RegressionTest[] = [];
  private baselines: Map<string, number> = new Map();

  constructor() {
    this.setupDefaultTests();
  }

  /**
   * Setup default performance regression tests
   */
  private setupDefaultTests(): void {
    // Memory usage tests
    this.addTest({
      name: 'memory-usage',
      description: 'JavaScript heap memory usage',
      threshold: 20 * 1024 * 1024, // 20MB
      unit: 'bytes',
      test: async () => {
        const memory = (performance as any).memory;
        return memory ? memory.usedJSHeapSize : 0;
      }
    });

    // Monitoring overhead tests
    this.addTest({
      name: 'monitoring-overhead',
      description: 'Performance monitoring system overhead',
      threshold: 5, // 5ms
      unit: 'ms',
      test: async () => {
        const validator = performanceValidator;
        const metrics = validator.captureMetrics();
        return metrics.monitoringOverhead;
      }
    });

    // Core Web Vitals tests
    this.addTest({
      name: 'lcp-performance',
      description: 'Largest Contentful Paint',
      threshold: 2500, // 2.5 seconds
      unit: 'ms',
      test: async () => {
        const metrics = performanceManager.getAllMetrics();
        return metrics.coreWebVitals.lcp || 0;
      }
    });

    this.addTest({
      name: 'inp-performance',
      description: 'Interaction to Next Paint',
      threshold: 200, // 200ms
      unit: 'ms',
      test: async () => {
        const metrics = performanceManager.getAllMetrics();
        return metrics.coreWebVitals.inp || 0;
      }
    });

    this.addTest({
      name: 'cls-performance',
      description: 'Cumulative Layout Shift',
      threshold: 0.1, // 0.1 score
      unit: 'score',
      test: async () => {
        const metrics = performanceManager.getAllMetrics();
        return metrics.coreWebVitals.cls || 0;
      }
    });

    // Cache performance tests
    this.addTest({
      name: 'cache-hit-rate',
      description: 'Cache hit rate percentage',
      threshold: 0.8, // 80%
      unit: 'ratio',
      test: async () => {
        const metrics = performanceManager.getAllMetrics();
        return metrics.cacheMetrics.hitRate;
      }
    });
  }

  /**
   * Add a custom regression test
   */
  addTest(test: RegressionTest): void {
    this.tests.push(test);
  }

  /**
   * Set baseline values for comparison
   */
  async setBaselines(): Promise<void> {
    console.log('[RegressionTester] Setting performance baselines...');
    
    for (const test of this.tests) {
      try {
        const value = await test.test();
        this.baselines.set(test.name, value);
        console.log(`[RegressionTester] Baseline for ${test.name}: ${value}${test.unit}`);
      } catch (error) {
        console.warn(`[RegressionTester] Failed to set baseline for ${test.name}:`, error);
      }
    }
  }

  /**
   * Run all regression tests
   */
  async runTests(): Promise<RegressionResults> {
    console.log('[RegressionTester] Running performance regression tests...');
    
    const results: RegressionResults['results'] = [];
    let passed = 0;
    let failed = 0;

    for (const test of this.tests) {
      try {
        const currentValue = await test.test();
        const baseline = this.baselines.get(test.name) || test.threshold;
        const testPassed = currentValue <= test.threshold;
        
        if (testPassed) passed++;
        else failed++;

        const improvement = baseline > 0 ? ((baseline - currentValue) / baseline) * 100 : 0;

        results.push({
          test: test.name,
          value: currentValue,
          threshold: test.threshold,
          passed: testPassed,
          improvement: improvement
        });

        const status = testPassed ? '✅' : '❌';
        const improvementText = improvement > 0 ? `(${improvement.toFixed(1)}% improvement)` : 
                               improvement < 0 ? `(${Math.abs(improvement).toFixed(1)}% regression)` : '';
        
        console.log(`[RegressionTester] ${status} ${test.name}: ${currentValue}${test.unit} ${improvementText}`);
        
      } catch (error) {
        failed++;
        console.error(`[RegressionTester] ❌ ${test.name}: Test failed`, error);
        
        results.push({
          test: test.name,
          value: -1,
          threshold: test.threshold,
          passed: false,
          improvement: 0
        });
      }
    }

    const summary = `${passed}/${this.tests.length} tests passed. ` +
                   `${results.filter(r => r.improvement > 0).length} improvements detected.`;

    console.log(`[RegressionTester] ${summary}`);

    return {
      passed,
      failed,
      total: this.tests.length,
      results,
      summary
    };
  }

  /**
   * Quick validation check
   */
  async quickCheck(): Promise<boolean> {
    const results = await this.runTests();
    return results.failed === 0;
  }

  /**
   * Export test results for analysis
   */
  async exportResults(): Promise<string> {
    const results = await this.runTests();
    return JSON.stringify({
      timestamp: Date.now(),
      results,
      baselines: Array.from(this.baselines.entries())
    }, null, 2);
  }
}

// Global instance
export const regressionTester = new PerformanceRegressionTester();

// Initialize baselines on first load
if (typeof window !== 'undefined') {
  // Set baselines after page load
  window.addEventListener('load', () => {
    setTimeout(() => {
      regressionTester.setBaselines();
    }, 2000); // Wait 2 seconds for stabilization
  });

  // Run tests in development every 5 minutes
  if (import.meta.env.DEV) {
    setInterval(() => {
      regressionTester.quickCheck();
    }, 5 * 60 * 1000);
  }
}
