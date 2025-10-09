import { test, expect } from '@playwright/test';

test.describe('Memory Leak Diagnostics', () => {
  test('should identify memory leak sources', async ({ page, context }) => {
    const client = await context.newCDPSession(page);
    
    // Enable heap profiler
    await client.send('HeapProfiler.enable');
    
    console.log('\n🔍 Starting detailed memory leak investigation...\n');
    
    // Navigate to page
    await page.goto('http://localhost:4321/shop/all');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    // Take initial heap snapshot
    console.log('📸 Taking initial heap snapshot...');
    await client.send('HeapProfiler.takeHeapSnapshot');
    
    // Check what's attached to window
    const initialWindowProps = await page.evaluate(() => {
      const props: any = {};
      for (const key in window) {
        if (key.includes('Observer') || key.includes('observer') || 
            key.includes('listener') || key.includes('timeout')) {
          props[key] = typeof (window as any)[key];
        }
      }
      return props;
    });
    
    console.log('Initial window properties:', initialWindowProps);
    
    // Count event listeners before navigation
    const initialListeners = await page.evaluate(() => {
      const counts: any = {};
      
      // Check various elements for listeners
      const elementsToCheck = [
        { name: 'window', element: window },
        { name: 'document', element: document },
        { name: 'body', element: document.body },
      ];
      
      // Note: We can't directly count listeners, but we can check what's registered
      return {
        timestamp: Date.now(),
        message: 'Listeners counted (approximation)'
      };
    });
    
    console.log('Initial listener state:', initialListeners);
    
    // Navigate away and back multiple times
    for (let i = 0; i < 3; i++) {
      console.log(`\n🔄 Navigation cycle ${i + 1}/3`);
      
      await page.goto('http://localhost:4321/');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);
      
      await page.goto('http://localhost:4321/shop/all');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);
      
      // Check for leaked references
      const cycleCheck = await page.evaluate(() => {
        const detachedElements = document.querySelectorAll('[aria-live="polite"]');
        return {
          detachedLiveRegions: detachedElements.length,
          bodyChildCount: document.body.children.length,
        };
      });
      
      console.log(`After cycle ${i + 1}:`, cycleCheck);
    }
    
    // Check final state
    const finalWindowProps = await page.evaluate(() => {
      const props: any = {};
      for (const key in window) {
        if (key.includes('Observer') || key.includes('observer') || 
            key.includes('listener') || key.includes('timeout')) {
          props[key] = typeof (window as any)[key];
        }
      }
      return props;
    });
    
    console.log('\nFinal window properties:', finalWindowProps);
    
    // Take final snapshot and compare
    console.log('\n📸 Taking final heap snapshot...');
    const snapshot = await client.send('HeapProfiler.takeHeapSnapshot');
    
    // Get detailed node statistics
    const nodeStats = await page.evaluate(() => {
      const stats = {
        totalElements: document.getElementsByTagName('*').length,
        hiddenElements: Array.from(document.getElementsByTagName('*')).filter(
          el => (el as HTMLElement).style.display === 'none'
        ).length,
        productCards: document.querySelectorAll('.product-card-wrapper').length,
        liveRegions: document.querySelectorAll('[aria-live]').length,
        eventTargets: document.querySelectorAll('[data-tag-initialized]').length,
      };
      
      return stats;
    });
    
    console.log('\n📊 DOM Statistics:', nodeStats);
    
    // Check for common leak patterns
    const leakPatterns = await page.evaluate(() => {
      const patterns: any = {};
      
      // Check for accumulated data attributes
      const cards = document.querySelectorAll('.product-card-wrapper');
      patterns.cardsWithBatchIndex = Array.from(cards).filter(
        c => c.hasAttribute('data-batch-index')
      ).length;
      
      // Check for multiple instances of same ID
      const grids = document.querySelectorAll('#filterable-product-grid');
      patterns.multipleGrids = grids.length;
      
      // Check for orphaned timers (indirect check)
      patterns.bodyChildren = document.body.children.length;
      
      return patterns;
    });
    
    console.log('\n🐛 Leak Pattern Analysis:', leakPatterns);
    
    // Analyze heap growth
    const heapStats = await client.send('Runtime.getHeapUsage');
    console.log('\n💾 Final Heap Usage:', {
      used: `${(heapStats.usedSize / 1024 / 1024).toFixed(2)} MB`,
      total: `${(heapStats.totalSize / 1024 / 1024).toFixed(2)} MB`,
    });
    
    console.log('\n✅ Diagnostic complete\n');
  });
  
  test('should check for specific ProductGrid leaks', async ({ page }) => {
    await page.goto('http://localhost:4321/shop/all');
    await page.waitForLoadState('networkidle');
    
    console.log('\n🎯 Checking ProductGrid-specific issues...\n');
    
    // Check animation state
    const animationState = await page.evaluate(() => {
      const cards = document.querySelectorAll('.product-card-wrapper');
      return {
        totalCards: cards.length,
        animatingCards: document.querySelectorAll('.animating').length,
        opacity0Cards: document.querySelectorAll('.opacity-0').length,
        opacity100Cards: document.querySelectorAll('.opacity-100').length,
      };
    });
    
    console.log('Animation state:', animationState);
    
    // Navigate away
    await page.goto('http://localhost:4321/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    
    // Check if anything leaked
    const afterNav = await page.evaluate(() => {
      return {
        productCards: document.querySelectorAll('.product-card-wrapper').length,
        grids: document.querySelectorAll('#filterable-product-grid').length,
        liveRegions: document.querySelectorAll('[aria-live="polite"]').length,
        triggers: document.querySelectorAll('#infinite-scroll-trigger').length,
      };
    });
    
    console.log('After navigation:', afterNav);
    
    expect(afterNav.productCards).toBe(0);
    expect(afterNav.grids).toBe(0);
    expect(afterNav.liveRegions).toBe(0);
    expect(afterNav.triggers).toBe(0);
  });
});
