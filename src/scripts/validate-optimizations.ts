/**
 * Performance Optimization Validation Script
 * Quick check to ensure optimizations are working
 */

import { performanceValidator } from '../lib/performance/performanceValidation';
import { regressionTester } from '../lib/performance/regressionTester';

async function validateOptimizations() {
  console.log('🔍 Validating Performance Optimizations...\n');

  try {
    // 1. Check performance validation system
    console.log('1. Testing Performance Validation System:');
    const validation = performanceValidator.validate();
    console.log(`   Status: ${validation.status}`);
    console.log(`   Issues: ${validation.issues.length}`);
    console.log(`   Improvements: ${validation.improvements.length}\n`);

    // 2. Run regression tests
    console.log('2. Running Regression Tests:');
    const regressionResults = await regressionTester.runTests();
    console.log(`   Passed: ${regressionResults.passed}/${regressionResults.total}`);
    console.log(`   Summary: ${regressionResults.summary}\n`);

    // 3. Check for disabled systems
    console.log('3. Checking Disabled Systems:');
    const realTimeMonitor = (window as any).realTimeMonitor;
    const redundantMonitoring = document.querySelector('script[src*="performanceMonitoring"]');
    
    console.log(`   ✅ RealTimeMonitor disabled: ${realTimeMonitor === undefined ? 'Yes' : 'No'}`);
    console.log(`   ✅ Redundant monitoring disabled: ${redundantMonitoring === null ? 'Yes' : 'No'}`);

    // 4. Check memory usage
    console.log('\n4. Memory Usage Check:');
    const memory = (performance as any).memory;
    if (memory) {
      const usedMB = Math.round(memory.usedJSHeapSize / 1024 / 1024);
      const totalMB = Math.round(memory.totalJSHeapSize / 1024 / 1024);
      console.log(`   Used: ${usedMB}MB / ${totalMB}MB`);
      console.log(`   Status: ${usedMB < 20 ? '✅ Optimized' : '⚠️ High usage'}`);
    }

    // 5. Final assessment
    console.log('\n🎉 Performance Optimization Status:');
    const allGood = validation.issues.length === 0 && 
                   regressionResults.failed === 0 && 
                   realTimeMonitor === undefined;
    
    console.log(`   Overall: ${allGood ? '✅ EXCELLENT' : '⚠️ NEEDS ATTENTION'}`);
    
    if (allGood) {
      console.log('   All optimizations active and working correctly!');
    } else {
      console.log('   Some issues detected - check the details above.');
    }

  } catch (error) {
    console.error('❌ Validation failed:', error);
  }
}

// Export for use in browser console
if (typeof window !== 'undefined') {
  (window as any).validateOptimizations = validateOptimizations;
  console.log('💡 Run validateOptimizations() in the browser console to check optimizations');
}

export { validateOptimizations };
