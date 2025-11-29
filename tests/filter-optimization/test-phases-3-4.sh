#!/bin/bash

# Test script for Phases 3A, 3B, and 4 implementation
# Run this after starting the dev server (npm run dev)

echo "🧪 Testing Phases 3A, 3B, and 4 Implementation"
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
echo "2️⃣  Testing SSR metadata injection (Phase 4)..."

# Test shop/all page for SSR metadata
RESPONSE=$(curl -s http://localhost:4321/shop/all)

if echo "$RESPONSE" | grep -q "window.__FILTER_METADATA__"; then
    echo "   ✅ SSR metadata found in /shop/all"

    # Extract and count products from metadata
    METADATA_LINE=$(echo "$RESPONSE" | grep "window.__FILTER_METADATA__")
    if echo "$METADATA_LINE" | grep -q "products"; then
        echo "   ✅ Metadata contains products array"
    fi
else
    echo "   ❌ SSR metadata NOT found in page source"
fi

echo ""
echo "3️⃣  Checking modified files..."

# Check ProductFilters.astro
if grep -q "PHASE 3A" src/components/ProductFilters.astro; then
    echo "   ✅ Phase 3A code present (Desktop flicker fix)"
else
    echo "   ❌ Phase 3A code missing"
fi

if grep -q "PHASE 3B" src/components/ProductFilters.astro; then
    echo "   ✅ Phase 3B code present (Mobile instant clear)"
else
    echo "   ❌ Phase 3B code missing"
fi

if grep -q "filters-loading" src/components/ProductFilters.astro; then
    echo "   ✅ Loading state CSS present"
else
    echo "   ❌ Loading state CSS missing"
fi

# Check clientFilterEngine.ts
if grep -q "PHASE 4" src/lib/square/clientFilterEngine.ts; then
    echo "   ✅ Phase 4 code present (SSR metadata detection)"
else
    echo "   ❌ Phase 4 code missing"
fi

# Check shop/all.astro
if grep -q "__FILTER_METADATA__" src/pages/shop/all.astro; then
    echo "   ✅ Phase 4 SSR injection in shop/all"
else
    echo "   ❌ Phase 4 SSR injection missing from shop/all"
fi

# Check category pages
if grep -q "__FILTER_METADATA__" src/pages/category/\[...slug\].astro; then
    echo "   ✅ Phase 4 SSR injection in category pages"
else
    echo "   ❌ Phase 4 SSR injection missing from category pages"
fi

echo ""
echo "4️⃣  Testing filter metadata API (fallback)..."

# Test the filter metadata API endpoint
API_RESPONSE=$(curl -s -w "\n%{http_code}" http://localhost:4321/api/filter-metadata)
API_HTTP_CODE=$(echo "$API_RESPONSE" | tail -n 1)

if [ "$API_HTTP_CODE" = "200" ]; then
    echo "   ✅ API endpoint still working (fallback path)"
else
    echo "   ❌ API endpoint failed (HTTP $API_HTTP_CODE)"
fi

echo ""
echo "=============================================="
echo "✅ Automated tests complete!"
echo ""
echo "📋 Manual Testing Checklist:"
echo ""
echo "Phase 3A (Desktop Flicker):"
echo "  1. Navigate to http://localhost:4321/shop/all"
echo "  2. Click filter immediately (within 1 second)"
echo "  3. ✓ Should filter instantly with no flicker"
echo "  4. ✓ Look for subtle loading bar at top (~0.2s)"
echo ""
echo "Phase 3B (Mobile Clear):"
echo "  1. Resize browser to mobile (<1024px)"
echo "  2. Open filter drawer, select filters"
echo "  3. Click 'Clear All' in drawer"
echo "  4. ✓ Should clear instantly (<50ms perceived)"
echo "  5. ✓ Check console for 'Mobile instant clear' log"
echo ""
echo "Phase 4 (SSR Metadata):"
echo "  1. Open DevTools Console"
echo "  2. Navigate to any shop/category page"
echo "  3. ✓ Look for '[SSR Metadata] ✅ Injected X products'"
echo "  4. ✓ Look for 'PHASE 4: Using SSR-injected metadata'"
echo "  5. ✓ No /api/filter-metadata call in Network tab"
echo ""
echo "See PHASES_3-4_IMPLEMENTATION.md for detailed testing"
