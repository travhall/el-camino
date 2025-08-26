// Phase 1 Test: View Transitions Validation
// Tests navigation performance and transition functionality

async function testViewTransitions() {
  console.log('🧪 Testing Phase 1: View Transitions');
  
  // Get baseline if available
  let baseline = null;
  try {
    baseline = JSON.parse(localStorage.getItem('performance-baseline'));
  } catch (error) {
    console.log('⚠️ No baseline found, proceeding with basic tests');
  }
  
  // Test 1: Navigation timing
  console.log('🔄 Testing navigation performance...');
  const navigationStart = performance.now();
  
  // Simulate navigation (without actually navigating)
  const testEvent = new CustomEvent('astro:before-preparation', { detail: { url: '/shop/all' } });
  document.dispatchEvent(testEvent);
  
  const navigationEnd = performance.now();
  const navigationTime = navigationEnd - navigationStart;
  
  // Test 2: Check if ClientRouter is available
  console.log('🔍 Checking ClientRouter availability...');
  const hasViewTransitions = 'startViewTransition' in document;
  const hasAstroTransitions = !!document.querySelector('astro-route');
  
  // Test 3: Navigation Manager status
  console.log('🔍 Checking NavigationManager status...');
  let navigationManagerEnabled = false;
  try {
    if (window.navigationManager) {
      navigationManagerEnabled = window.navigationManager.enabled;
    }
  } catch (error) {
    console.log('NavigationManager not available yet');
  }
  
  // Test 4: Check for JavaScript errors
  let errorCount = 0;
  const errorListener = (e) => {
    errorCount++;
    console.error('❌ JavaScript error detected:', e.error);
  };
  
  window.addEventListener('error', errorListener);
  
  await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
  
  window.removeEventListener('error', errorListener);
  
  // Validation checks
  const checks = {
    navigationSpeed: navigationTime < 10, // ≤10ms for event dispatch
    noNewErrors: errorCount === 0,
    viewTransitionsSupported: hasViewTransitions,
    navigationManagerEnabled: navigationManagerEnabled
  };
  
  const results = {
    navigationTime: `${navigationTime.toFixed(2)}ms`,
    checks,
    errorCount,
    hasViewTransitions,
    navigationManagerEnabled,
    timestamp: new Date().toISOString()
  };
  
  console.log('📊 Phase 1 Test Results:', results);
  
  // Determine pass/fail
  const passed = Object.values(checks).every(Boolean);
  
  if (passed) {
    console.log('✅ Phase 1: PASSED - View transitions enabled successfully');
    localStorage.setItem('phase1-completed', 'true');
    localStorage.setItem('phase1-results', JSON.stringify(results));
  } else {
    console.log('❌ Phase 1: FAILED - Issues detected');
    console.log('Failed checks:', Object.entries(checks).filter(([key, value]) => !value));
  }
  
  return { passed, results };
}

// Auto-execute test
if (typeof window !== 'undefined') {
  // Wait for page to fully load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(testViewTransitions, 1000);
    });
  } else {
    setTimeout(testViewTransitions, 1000);
  }
}

// Export for manual testing
if (typeof module !== 'undefined') {
  module.exports = { testViewTransitions };
}
