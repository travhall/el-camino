#!/bin/bash

# Test script for filter optimization implementation
# Run this after starting the dev server (npm run dev)

echo "🧪 Testing Filter Optimization Implementation"
echo "=============================================="
echo ""

# Check if dev server is running
echo "1️⃣  Checking dev server..."
if curl -s http://localhost:4321 > /dev/null 2>&1; then
    echo "   ✅ Dev server is running"
else
    echo "   ❌ Dev server not running. Please run: npm run dev"
    exit 1
fi

echo ""
echo "2️⃣  Testing filter metadata API..."

# Test the filter metadata API
RESPONSE=$(curl -s -w "\n%{http_code}" http://localhost:4321/api/filter-metadata)
HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
    echo "   ✅ API endpoint responding (HTTP 200)"

    # Check if response has expected structure
    if echo "$BODY" | jq -e '.products' > /dev/null 2>&1; then
        PRODUCT_COUNT=$(echo "$BODY" | jq '.products | length')
        BRAND_COUNT=$(echo "$BODY" | jq '.brands | length')
        echo "   ✅ Response structure valid"
        echo "   📊 Products: $PRODUCT_COUNT"
        echo "   📊 Brands: $BRAND_COUNT"
    else
        echo "   ⚠️  Response structure unexpected"
        echo "   Response: $BODY"
    fi
else
    echo "   ❌ API endpoint failed (HTTP $HTTP_CODE)"
    echo "   Response: $BODY"
fi

echo ""
echo "3️⃣  Testing category-specific metadata..."

# Test category-specific endpoint (if categories exist)
CATEGORY_RESPONSE=$(curl -s -w "\n%{http_code}" "http://localhost:4321/api/filter-metadata?category=some-category" 2>/dev/null)
CATEGORY_HTTP_CODE=$(echo "$CATEGORY_RESPONSE" | tail -n 1)

if [ "$CATEGORY_HTTP_CODE" = "200" ]; then
    echo "   ✅ Category-specific API working"
elif [ "$CATEGORY_HTTP_CODE" = "500" ]; then
    echo "   ⚠️  Category parameter causes error (may be expected if category doesn't exist)"
else
    echo "   ℹ️  Category API HTTP $CATEGORY_HTTP_CODE"
fi

echo ""
echo "4️⃣  Checking file modifications..."

# Check that key files exist
if [ -f "src/components/ProductFilters.astro" ]; then
    echo "   ✅ ProductFilters.astro exists"

    # Check for key implementations
    if grep -q "setupIntelligentPrefetching" src/components/ProductFilters.astro; then
        echo "   ✅ Phase 1 (Prefetching) code present"
    else
        echo "   ❌ Phase 1 code missing"
    fi

    if grep -q "initializeClientSideFiltering" src/components/ProductFilters.astro; then
        echo "   ✅ Phase 2 (Client-side filtering) code present"
    else
        echo "   ❌ Phase 2 code missing"
    fi
else
    echo "   ❌ ProductFilters.astro not found"
fi

if [ -f "src/pages/api/filter-metadata.ts" ]; then
    echo "   ✅ API endpoint file exists"
else
    echo "   ❌ API endpoint file missing"
fi

if [ -f "src/lib/square/clientFilterEngine.ts" ]; then
    echo "   ✅ Filter engine file exists"
else
    echo "   ❌ Filter engine file missing"
fi

echo ""
echo "=============================================="
echo "✅ Automated tests complete!"
echo ""
echo "📋 Manual Testing Steps:"
echo "   1. Navigate to http://localhost:4321/shop/all"
echo "   2. Open DevTools Console"
echo "   3. Hover over a brand checkbox (watch console)"
echo "   4. Click the checkbox (should filter instantly)"
echo "   5. Check URL updated without page reload"
echo ""
echo "Expected console logs:"
echo "   [ClientFiltering] 🔄 Loading filter metadata..."
echo "   [ClientFiltering] ✅ Filter metadata loaded and ready"
echo "   [ClientFiltering] ⚡ Filtered X → Y products instantly"
echo ""
echo "See FILTER_OPTIMIZATION_IMPLEMENTATION.md for detailed testing instructions"
