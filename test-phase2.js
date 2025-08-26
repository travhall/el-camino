// Phase 2 Test: Enhanced Image Optimization Validation
// Tests AVIF/WebP format detection and usage

async function testImageOptimization() {
  console.log('🧪 Testing Phase 2: Enhanced Image Optimization');
  
  // Test 1: Format Detection
  console.log('🔍 Testing format detection...');
  
  // Wait for format detection to complete
  await new Promise(resolve => {
    let attempts = 0;
    const checkFormats = () => {
      const formatSupport = sessionStorage.getItem('imageFormatSupport');
      attempts++;
      
      if (formatSupport || attempts > 30) { // Max 3 seconds wait
        resolve(formatSupport);
      } else {
        setTimeout(checkFormats, 100);
      }
    };
    checkFormats();
  });
  
  const formatSupport = sessionStorage.getItem('imageFormatSupport');
  let supportData = null;
  
  if (formatSupport) {
    try {
      supportData = JSON.parse(formatSupport);
      console.log('✅ Format detection completed:', supportData);
    } catch (error) {
      console.log('⚠️ Format data parsing error:', error);
    }
  } else {
    console.log('⚠️ Format detection not completed within timeout');
  }
  
  // Test 2: Check for JavaScript errors
  let errorCount = 0;
  const errorListener = (e) => {
    errorCount++;
    console.error('❌ JavaScript error:', e.error);
  };
  
  window.addEventListener('error', errorListener);
  
  // Test 3: Monitor image loading with formats
  const imageLoads = [];
  const imageObserver = new PerformanceObserver((list) => {
    list.getEntries().forEach(entry => {
      if (entry.name.includes('squarecdn.com') || entry.name.includes('/images/')) {
        const isOptimized = entry.name.includes('format=avif') || 
                           entry.name.includes('format=webp') ||
                           entry.name.includes('.avif') ||
                           entry.name.includes('.webp');
        
        imageLoads.push({
          url: entry.name.split('/').pop(),
          duration: Math.round(entry.duration),
          optimized: isOptimized,
          size: entry.transferSize || 0
        });
      }
    });
  });
  
  imageObserver.observe({ entryTypes: ['resource'] });
  
  // Wait for image loads
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  imageObserver.disconnect();
  window.removeEventListener('error', errorListener);
  
  // Test 4: Calculate improvements
  const baseline = JSON.parse(localStorage.getItem('performance-baseline') || '{}');
  
  // Validation checks
  const checks = {
    formatDetectionWorking: !!formatSupport,
    avifSupported: supportData?.avif === true,
    webpSupported: supportData?.webp === true,
    noNewErrors: errorCount === 0,
    imagesLoaded: imageLoads.length > 0
  };
  
  const results = {
    formatSupport: supportData,
    imageLoads: imageLoads.slice(0, 5), // First 5 images for logging
    totalImages: imageLoads.length,
    optimizedImages: imageLoads.filter(img => img.optimized).length,
    averageLoadTime: imageLoads.length > 0 
      ? Math.round(imageLoads.reduce((sum, img) => sum + img.duration, 0) / imageLoads.length)
      : 0,
    checks,
    errorCount,
    timestamp: new Date().toISOString()
  };
  
  console.log('📊 Phase 2 Test Results:', results);
  
  // Determine pass/fail
  const criticalChecks = [checks.formatDetectionWorking, checks.noNewErrors];
  const passed = criticalChecks.every(Boolean);
  
  if (passed) {
    console.log('✅ Phase 2: PASSED - Image optimization enabled successfully');
    console.log(`📈 Format support: AVIF ${supportData?.avif ? '✅' : '❌'}, WebP ${supportData?.webp ? '✅' : '❌'}`);
    if (imageLoads.length > 0) {
      console.log(`📸 Loaded ${imageLoads.length} images, ${imageLoads.filter(img => img.optimized).length} optimized`);
    }
    localStorage.setItem('phase2-completed', 'true');
    localStorage.setItem('phase2-results', JSON.stringify(results));
  } else {
    console.log('❌ Phase 2: FAILED - Issues detected');
    console.log('Failed checks:', Object.entries(checks).filter(([key, value]) => !value));
  }
  
  return { passed, results };
}

// Auto-execute test
if (typeof window !== 'undefined') {
  // Wait for page to fully load and image optimization to initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(testImageOptimization, 2000); // Wait 2 seconds for format detection
    });
  } else {
    setTimeout(testImageOptimization, 2000);
  }
}

// Export for manual testing
if (typeof module !== 'undefined') {
  module.exports = { testImageOptimization };
}
