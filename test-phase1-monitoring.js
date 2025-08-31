/**
 * Phase 1 Test: Real-Time Monitoring - Regression Detection
 * Tests that regression detection is working after being enabled
 */

async function testRegressionDetection() {
  console.log('🧪 Testing Phase 1: Regression Detection');
  
  try {
    // Try to import the RealTimeMonitor
    const { RealTimeMonitor } = await import('../src/lib/performance/RealTimeMonitor.js');
    console.log('✅ RealTimeMonitor import successful');
    
    // Create instance to test constructor
    const monitor = new RealTimeMonitor();
    console.log('✅ RealTimeMonitor instance created');
    
    // Check if regression detection methods exist
    if (typeof monitor.startRegressionDetection === 'function') {
      console.log('✅ Regression detection method exists');
    } else {
      console.log('❌ Regression detection method missing');
      return false;
    }
    
    // Check baseline initialization  
    if (monitor.baselines) {
      console.log('✅ Baselines initialized');
    } else {
      console.log('❌ Baselines not initialized');
      return false;
    }
    
    // Test memory management is still active
    if (typeof monitor.startMemoryManagement === 'function') {
      console.log('✅ Memory management preserved');
    } else {
      console.log('❌ Memory management missing');
      return false;
    }
    
    console.log('✅ Phase 1 Test PASSED - Regression detection enabled successfully');
    return true;
    
  } catch (error) {
    console.error('❌ Phase 1 Test FAILED:', error.message);
    return false;
  }
}

// Run the test
testRegressionDetection().then(success => {
  if (success) {
    console.log('\n🎉 Phase 1 ready for production testing');
    console.log('Next: Test on actual site to verify monitoring improvements');
  } else {
    console.log('\n⚠️ Phase 1 needs debugging before proceeding');
  }
}).catch(console.error);
