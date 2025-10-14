// Test script for related products and recently viewed services
// Run this in the browser console on any product page

import { getRelatedProducts } from "@/lib/product/relatedProducts";
import { recentlyViewed } from "@/lib/product/recentlyViewed";
import { fetchProducts, fetchProduct } from "@/lib/square/client";

async function testServices() {
  console.log("🧪 Testing Related Products & Recently Viewed Services\n");

  // Test 1: Related Products
  console.log("📦 Test 1: Related Products");
  try {
    const allProducts = await fetchProducts();
    const testProduct = allProducts[0]; // Get first product

    console.log("Source Product:", testProduct.title);
    console.log(
      "Category from URL:",
      testProduct.url.match(/\/category\/([^\/]+)/)?.[1]
    );

    const related = await getRelatedProducts(testProduct, allProducts, {
      maxResults: 6,
    });

    console.log(`Found ${related.products.length} related products`);
    console.log("Match Type:", related.matchType);
    console.log("Confidence:", related.confidence);
    console.log(
      "Products:",
      related.products.map((p) => p.title)
    );
  } catch (error) {
    console.error("❌ Related Products Test Failed:", error);
  }

  // Test 2: Recently Viewed
  console.log("\n👁️  Test 2: Recently Viewed");
  try {
    // Clear existing
    recentlyViewed.clear();
    console.log("Cleared existing items");

    // Add some test products
    const allProducts = await fetchProducts();
    const testProducts = allProducts.slice(0, 3);

    testProducts.forEach((product) => {
      recentlyViewed.add(product);
      console.log(`Added: ${product.title}`);
    });

    // Get items
    const items = recentlyViewed.get();
    console.log(`\nStored ${items.length} items`);
    console.log(
      "Items:",
      items.map((i) => i.title)
    );

    // Test deduplication
    console.log("\n🔄 Testing deduplication...");
    recentlyViewed.add(testProducts[0]); // Add first product again
    const afterDedup = recentlyViewed.get(); // cSpell:ignore afterDedup
    console.log(`After re-adding first product: ${afterDedup.length} items`);
    console.log("First item:", afterDedup[0].title);

    // Test limit
    console.log("\n📊 Testing limit...");
    const limited = recentlyViewed.get(2);
    console.log(`With limit=2: ${limited.length} items`);
  } catch (error) {
    console.error("❌ Recently Viewed Test Failed:", error);
  }

  console.log("\n✅ Tests complete!");
}

// Run tests
testServices();
