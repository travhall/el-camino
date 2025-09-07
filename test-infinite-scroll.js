// Quick test script to verify infinite scroll implementation
// Run this in browser console on localhost:4321/shop/all

console.log('🧪 Testing Infinite Scroll Implementation...');

// Test 1: Check if OptimizedFilterEngine exists
setTimeout(() => {
  const filterInstance = window.currentFilterInstance;
  if (filterInstance && filterInstance.filterEngine) {
    console.log('✅ OptimizedFilterEngine found');
    
    // Check performance metrics
    const metrics = filterInstance.filterEngine.getPerformanceMetrics();
    console.log('📊 Performance Metrics:', metrics);
    
    // Check product count
    const productCount = filterInstance.filterEngine.getAllProductsCount();
    console.log(`📦 Total Products: ${productCount}`);
    
    // Check if it's mobile device
    console.log(`📱 Device: ${filterInstance.filterEngine.isMobile ? 'Mobile' : 'Desktop'}`);
    
    // Check current batch size
    console.log(`📏 Current Batch Size: ${filterInstance.filterEngine.currentBatchSize}`);
    
  } else {
    console.error('❌ OptimizedFilterEngine not found');
  }
}, 2000);

// Test 2: Check if infinite scroll trigger exists
setTimeout(() => {
  const trigger = document.getElementById('infinite-scroll-trigger');
  if (trigger) {
    console.log('✅ Infinite scroll trigger found');
    console.log('📐 Trigger display:', trigger.style.display);
    console.log('👁️ Trigger visibility:', trigger.style.visibility);
    
    // Check if trigger is in viewport
    const rect = trigger.getBoundingClientRect();
    const inViewport = rect.top < window.innerHeight && rect.bottom > 0;
    console.log('🔍 Trigger in viewport:', inViewport);
    
  } else {
    console.error('❌ Infinite scroll trigger not found');
  }
}, 2000);

// Test 3: Check DOM for product cards
setTimeout(() => {
  const productCards = document.querySelectorAll('.product-card-wrapper');
  console.log(`🃏 Product cards found: ${productCards.length}`);
  
  const visibleCards = Array.from(productCards).filter(card => 
    window.getComputedStyle(card).display !== 'none'
  );
  console.log(`👀 Visible product cards: ${visibleCards.length}`);
  
  const hiddenCards = productCards.length - visibleCards.length;
  console.log(`🙈 Hidden product cards: ${hiddenCards}`);
  
}, 2000);

// Test 4: Check ScrollPerformanceMonitor
setTimeout(() => {
  if (window.scrollPerformanceMonitor) {
    console.log('✅ ScrollPerformanceMonitor found');
    const summary = window.scrollPerformanceMonitor.getPerformanceSummary();
    console.log('📊 Performance Summary:', summary);
  } else {
    console.warn('⚠️ ScrollPerformanceMonitor not found (expected - file needs to be loaded separately)');
  }
}, 2000);

console.log('🔧 Test script loaded. Results will appear in 2 seconds...');
console.log('💡 To manually test infinite scroll:');
console.log('   1. Scroll to bottom of page');
console.log('   2. Watch for more products to load');
console.log('   3. Check console for loading messages');
