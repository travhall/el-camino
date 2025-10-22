// Test script to validate Netlify Blobs cache is working
// Run: node --loader ts-node/esm src/scripts/test-blob-cache.ts

import { navigationCache, categoryCache } from '../lib/cache/blobCache.js';

async function testBlobCache() {
  console.log('🧪 Testing Netlify Blobs Cache Implementation\n');
  
  try {
    // Test 1: Set and Get
    console.log('Test 1: Set and Get');
    await navigationCache.set('test-key', { data: 'test-value', timestamp: Date.now() });
    const value = await navigationCache.get('test-key');
    console.log('✅ Set/Get works:', value ? 'PASS' : 'FAIL');
    
    // Test 2: Has
    console.log('\nTest 2: Has');
    const exists = await navigationCache.has('test-key');
    console.log('✅ Has works:', exists ? 'PASS' : 'FAIL');
    
    // Test 3: GetOrCompute
    console.log('\nTest 3: GetOrCompute');
    let computeCount = 0;
    const result1 = await categoryCache.getOrCompute('compute-test', async () => {
      computeCount++;
      return { computed: true, count: computeCount };
    });
    const result2 = await categoryCache.getOrCompute('compute-test', async () => {
      computeCount++;
      return { computed: true, count: computeCount };
    });
    console.log('✅ GetOrCompute works:', 
      result1.count === 1 && result2.count === 1 ? 'PASS (cached)' : 'FAIL');
    
    // Test 4: Delete
    console.log('\nTest 4: Delete');
    await navigationCache.delete('test-key');
    const deletedValue = await navigationCache.get('test-key');
    console.log('✅ Delete works:', !deletedValue ? 'PASS' : 'FAIL');
    
    // Test 5: Cache Stats
    console.log('\nTest 5: Cache Stats');
    const stats = navigationCache.getStats();
    console.log('✅ Stats:', stats);
    
    console.log('\n✅ All tests completed!');
    console.log('\n📊 Cache Configuration:');
    console.log('  - Navigation Cache TTL: 1 hour');
    console.log('  - Category Cache TTL: 30 minutes');
    console.log('  - Product Cache TTL: 15 minutes');
    console.log('  - Inventory Cache TTL: 15 minutes');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testBlobCache();
