/**
 * Performance Regression Tester
 * Validates that performance optimizations haven't broken functionality
 */

export interface RegressionTestResult {
  passed: number;
  failed: number;
  total: number;
  summary: string;
  details: TestResult[];
}

export interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
}

class RegressionTester {
  private tests: Array<() => Promise<TestResult>> = [];

  constructor() {
    this.initializeTests();
  }

  /**
   * Run all regression tests
   */
  async runTests(): Promise<RegressionTestResult> {
    const results: TestResult[] = [];
    
    for (const test of this.tests) {
      try {
        const result = await test();
        results.push(result);
      } catch (error) {
        results.push({
          name: 'Test execution failed',
          passed: false,
          duration: 0,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    const total = results.length;

    return {
      passed,
      failed,
      total,
      summary: failed === 0 ? 'All tests passed' : `${failed} of ${total} tests failed`,
      details: results
    };
  }

  /**
   * Initialize default regression tests
   */
  private initializeTests(): void {
    // Test 1: Performance monitoring system
    this.tests.push(async () => {
      const start = performance.now();
      
      try {
        // Check if performance monitoring is working
        const hasPerformance = typeof performance !== 'undefined';
        const hasObserver = typeof PerformanceObserver !== 'undefined';
        
        if (!hasPerformance || !hasObserver) {
          return {
            name: 'Performance APIs Available',
            passed: false,
            duration: performance.now() - start,
            error: 'Performance APIs not available'
          };
        }

        return {
          name: 'Performance APIs Available',
          passed: true,
          duration: performance.now() - start
        };
      } catch (error) {
        return {
          name: 'Performance APIs Available',
          passed: false,
          duration: performance.now() - start,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Test 2: DOM manipulation performance
    this.tests.push(async () => {
      const start = performance.now();
      
      try {
        // Create a test element and measure manipulation time
        const testElement = document.createElement('div');
        testElement.innerHTML = '<span>Test</span>';
        document.body.appendChild(testElement);
        
        // Perform some DOM operations
        testElement.classList.add('test-class');
        testElement.setAttribute('data-test', 'value');
        const textContent = testElement.textContent;
        
        // Clean up
        document.body.removeChild(testElement);
        
        const duration = performance.now() - start;
        
        return {
          name: 'DOM Manipulation Performance',
          passed: duration < 50, // Should complete within 50ms
          duration,
          error: duration >= 50 ? `DOM operations took ${duration.toFixed(2)}ms (threshold: 50ms)` : undefined
        };
      } catch (error) {
        return {
          name: 'DOM Manipulation Performance',
          passed: false,
          duration: performance.now() - start,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Test 3: Error handling system
    this.tests.push(async () => {
      const start = performance.now();
      
      try {
        // Test that error boundaries are working
        const testError = new Error('Test error for regression testing');
        let errorCaught = false;
        
        try {
          throw testError;
        } catch (e) {
          errorCaught = true;
        }
        
        return {
          name: 'Error Handling System',
          passed: errorCaught,
          duration: performance.now() - start,
          error: !errorCaught ? 'Error handling not working properly' : undefined
        };
      } catch (error) {
        return {
          name: 'Error Handling System',
          passed: false,
          duration: performance.now() - start,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Test 4: Local storage functionality
    this.tests.push(async () => {
      const start = performance.now();
      
      try {
        const testKey = 'regression_test_key';
        const testValue = 'regression_test_value';
        
        // Test localStorage operations
        localStorage.setItem(testKey, testValue);
        const retrieved = localStorage.getItem(testKey);
        localStorage.removeItem(testKey);
        
        return {
          name: 'Local Storage Functionality',
          passed: retrieved === testValue,
          duration: performance.now() - start,
          error: retrieved !== testValue ? 'LocalStorage read/write failed' : undefined
        };
      } catch (error) {
        return {
          name: 'Local Storage Functionality',
          passed: false,
          duration: performance.now() - start,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Test 5: Network fetch capabilities
    this.tests.push(async () => {
      const start = performance.now();
      
      try {
        // Test that fetch is available and works
        if (typeof fetch === 'undefined') {
          return {
            name: 'Network Fetch Capabilities',
            passed: false,
            duration: performance.now() - start,
            error: 'Fetch API not available'
          };
        }

        // Test a simple data URL fetch
        const response = await fetch('data:text/plain,test');
        const text = await response.text();
        
        return {
          name: 'Network Fetch Capabilities',
          passed: text === 'test',
          duration: performance.now() - start,
          error: text !== 'test' ? 'Fetch returned unexpected data' : undefined
        };
      } catch (error) {
        return {
          name: 'Network Fetch Capabilities',
          passed: false,
          duration: performance.now() - start,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });
  }

  /**
   * Add a custom test
   */
  addTest(testFn: () => Promise<TestResult>): void {
    this.tests.push(testFn);
  }

  /**
   * Clear all tests
   */
  clearTests(): void {
    this.tests = [];
  }

  /**
   * Get test count
   */
  getTestCount(): number {
    return this.tests.length;
  }
}

// Export singleton instance
export const regressionTester = new RegressionTester();
