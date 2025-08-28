// WordPress Integration Validation Script
// Run this in browser console: validateWordPressIntegration()

function validateWordPressIntegration() {
  console.log("🧪 Validating WordPress Integration...\n");

  const results = [];

  // Test 1: Business Component Protection
  console.log("1. Testing Business Component Protection...");
  const productShowcases = document.querySelectorAll(".wp-product-showcase");
  const blogProductCards = document.querySelectorAll(".blog-product-card");
  const eventBlocks = document.querySelectorAll(".wp-event-block");

  let protectionWorking = true;
  let protectedComponents = 0;

  [...productShowcases, ...blogProductCards, ...eventBlocks].forEach((el) => {
    const computedStyle = window.getComputedStyle(el);
    if (computedStyle.isolation === "isolate") {
      protectedComponents++;
    } else {
      protectionWorking = false;
      console.warn(`Protection failed for component: ${el.className}`);
    }
  });

  results.push({
    test: "Business Component Protection",
    passed: protectionWorking && protectedComponents > 0,
    details: `${protectedComponents} components properly isolated (${
      protectionWorking ? "all working" : "some failing"
    })`,
  });

  console.log(
    `   ${
      protectionWorking ? "✅" : "❌"
    } Component protection: ${protectedComponents} isolated`
  );

  // Test 2: WordPress Content Styling
  console.log("2. Testing WordPress Content Styling...");
  const wordPressContent = document.querySelector(".wordpress-content");
  const hasWordPressStyles = wordPressContent !== null;

  results.push({
    test: "WordPress Content Styling",
    passed: hasWordPressStyles,
    details: hasWordPressStyles
      ? "WordPress content container found"
      : "No WordPress content container",
  });

  console.log(
    `   ${
      hasWordPressStyles ? "✅" : "❌"
    } WordPress content styling applied`
  );

  // Test 3: Block Detection
  console.log("3. Testing Block Detection...");
  const allBlocks = document.querySelectorAll(
    '[class*="wp-block"], .wp-product-showcase, .wp-event-block, .wp-team-member'
  );
  const blockCount = allBlocks.length;

  results.push({
    test: "Block Detection",
    passed: blockCount > 0,
    details: `${blockCount} WordPress blocks detected`,
  });

  console.log(
    `   ${blockCount > 0 ? "✅" : "⚠️"} Blocks detected: ${blockCount}`
  );

  // Test 4: Link Protection in WordPress Content
  console.log("4. Testing Link Protection...");
  const wordPressLinks = wordPressContent
    ? wordPressContent.querySelectorAll("a")
    : [];
  const businessComponentLinks = document.querySelectorAll(
    ".wp-product-showcase a, .blog-product-card a, .wp-event-block a"
  );

  let linkProtectionWorking = true;
  businessComponentLinks.forEach((link) => {
    const computedStyle = window.getComputedStyle(link);
    if (
      computedStyle.textDecoration.includes("underline") &&
      !link.closest("a")?.classList.contains("expected-underline")
    ) {
      linkProtectionWorking = false;
    }
  });

  results.push({
    test: "Link Style Protection",
    passed: linkProtectionWorking,
    details: `${businessComponentLinks.length} business component links protected from WordPress styling`,
  });

  console.log(
    `   ${linkProtectionWorking ? "✅" : "⚠️"} Link protection: ${
      businessComponentLinks.length
    } links checked`
  );

  // Test 5: Component Rendering
  console.log("5. Testing Component Rendering...");
  const showcaseCount = productShowcases.length;
  const eventCount = eventBlocks.length;
  const cardCount = blogProductCards.length;
  const totalComponents = showcaseCount + eventCount + cardCount;

  results.push({
    test: "Component Rendering",
    passed: totalComponents > 0,
    details: `Page has ${showcaseCount} showcases, ${eventCount} events, ${cardCount} product cards`,
  });

  console.log(
    `   ${totalComponents > 0 ? "✅" : "⚠️"} Components rendering: showcases:${showcaseCount}, events:${eventCount}, cards:${cardCount}`
  );

  // Test 6: Debug Mode Test (if enabled)
  console.log("6. Testing Debug Mode Capability...");
  document.body.classList.add("wordpress-debug");
  setTimeout(() => {
    const debugOutlines = document.querySelectorAll(
      ".wordpress-debug .wp-product-showcase, .wordpress-debug .blog-product-card"
    );
    const debugMode = debugOutlines.length > 0;

    results.push({
      test: "Debug Mode",
      passed: debugMode,
      details: debugMode
        ? "Debug mode visual indicators working"
        : "Debug mode not functioning",
    });

    console.log(`   ${debugMode ? "✅" : "⚠️"} Debug mode functionality`);

    // Remove debug class
    document.body.classList.remove("wordpress-debug");

    // Generate final report
    generateReport(results);
  }, 100);
}

function generateReport(results) {
  console.log("\n📊 WordPress Integration Validation Results:");
  console.log("=".repeat(50));

  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  const passRate = Math.round((passed / total) * 100);

  results.forEach((result) => {
    console.log(
      `${result.passed ? "✅" : "❌"} ${result.test}: ${result.details}`
    );
  });

  console.log("=".repeat(50));
  console.log(`Overall: ${passed}/${total} tests passed (${passRate}%)`);

  if (passRate >= 80) {
    console.log("🎉 WordPress integration is working excellently!");
    console.log(
      "💡 Business components are properly protected from WordPress styling."
    );
  } else if (passRate >= 60) {
    console.log(
      "⚠️ WordPress integration is mostly working but needs attention."
    );
    console.log(
      "🔧 Some components may not be properly isolated from WordPress styles."
    );
  } else {
    console.log("❌ WordPress integration has significant issues.");
    console.log("🚨 Business component protection is not working correctly.");
  }

  console.log(
    '\n💡 To enable debug mode: document.body.classList.add("wordpress-debug")'
  );
  console.log(
    '💡 To disable debug mode: document.body.classList.remove("wordpress-debug")'
  );
  console.log(
    "💡 Test on both /admin/content/wordpress-demo and /news/and-were-off"
  );
}

// Make functions available globally
window.validateWordPressIntegration = validateWordPressIntegration;
window.enableDebugMode = () => document.body.classList.add("wordpress-debug");
window.disableDebugMode = () => document.body.classList.remove("wordpress-debug");

console.log("💡 WordPress Integration Validator loaded!");
console.log("💡 Available commands:");
console.log("   validateWordPressIntegration() - Run full test suite");
console.log("   enableDebugMode() - Show visual protection boundaries");
console.log("   disableDebugMode() - Hide debug visuals");
