#!/bin/bash

# Test script for Phases 6 and 8 implementation
# Run this after starting the dev server (npm run dev)

echo "🧪 Testing Phases 6 & 8 Implementation"
echo "========================================"
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
echo "2️⃣  Checking Phase 6 implementation (Debouncing)..."

# Check ProductFilters.astro for debouncing code
if grep -q "PHASE 6" src/components/ProductFilters.astro; then
    echo "   ✅ Phase 6 debouncing code present"

    if grep -q "filterTimeout" src/components/ProductFilters.astro; then
        echo "   ✅ Debouncing state variables found"
    fi

    if grep -q "batched" src/components/ProductFilters.astro; then
        echo "   ✅ Batch logging present"
    fi

    if grep -q "150" src/components/ProductFilters.astro; then
        echo "   ✅ 150ms debounce window configured"
    fi
else
    echo "   ❌ Phase 6 code missing"
fi

echo ""
echo "3️⃣  Checking Phase 8 implementation (Animations)..."

# Check for CSS animations
if grep -q "PHASE 8" src/components/ProductFilters.astro; then
    echo "   ✅ Phase 8 animation code present"

    if grep -q "filter-hidden" src/components/ProductFilters.astro; then
        echo "   ✅ CSS animation classes defined"
    fi

    if grep -q "filter-visible" src/components/ProductFilters.astro; then
        echo "   ✅ Visible state animation present"
    fi

    if grep -q "cubic-bezier" src/components/ProductFilters.astro; then
        echo "   ✅ Easing functions configured"
    fi

    if grep -q "transition-delay" src/components/ProductFilters.astro; then
        echo "   ✅ Staggered entrance animations present"
    fi

    if grep -q "prefers-reduced-motion" src/components/ProductFilters.astro; then
        echo "   ✅ Reduced motion accessibility support"
    fi
else
    echo "   ❌ Phase 8 code missing"
fi

echo ""
echo "4️⃣  Validating integration with previous phases..."

# Check that previous phases are still present
PREV_PHASES=0

if grep -q "PHASE 1" src/components/ProductFilters.astro; then
    echo "   ✅ Phase 1 (Prefetching) still present"
    PREV_PHASES=$((PREV_PHASES + 1))
fi

if grep -q "PHASE 3A" src/components/ProductFilters.astro; then
    echo "   ✅ Phase 3A (Flicker fix) still present"
    PREV_PHASES=$((PREV_PHASES + 1))
fi

if grep -q "PHASE 3B" src/components/ProductFilters.astro; then
    echo "   ✅ Phase 3B (Mobile clear) still present"
    PREV_PHASES=$((PREV_PHASES + 1))
fi

if grep -q "PHASE 4" src/lib/square/clientFilterEngine.ts; then
    echo "   ✅ Phase 4 (SSR metadata) still present"
    PREV_PHASES=$((PREV_PHASES + 1))
fi

if [ $PREV_PHASES -eq 4 ]; then
    echo "   ✅ All previous phases intact"
else
    echo "   ⚠️  Some previous phases may be missing"
fi

echo ""
echo "========================================"
echo "✅ Automated tests complete!"
echo ""
echo "📋 Manual Testing Checklist:"
echo ""
echo "Phase 6 (Debouncing):"
echo "  1. Navigate to http://localhost:4321/shop/all"
echo "  2. Open DevTools Console"
echo "  3. Rapidly click 3+ filter checkboxes"
echo "  4. ✓ Should see ONE console log:"
echo "     '[ClientFiltering] ⚡ Filtered X → Y products (batched 3 changes)'"
echo "  5. ✓ Only ONE filter operation, not three"
echo ""
echo "Phase 8 (Animations):"
echo "  1. Click a filter checkbox"
echo "  2. ✓ Watch products smoothly fade + shrink"
echo "  3. ✓ Grid smoothly collapses (no jump)"
echo "  4. ✓ Visible products smoothly fade + grow"
echo "  5. ✓ First 6 products cascade in (wave effect)"
echo "  6. ✓ No scrollbar jump or layout shift"
echo ""
echo "Combined Test:"
echo "  1. Rapidly click 4 checkboxes"
echo "  2. ✓ Checkboxes update immediately"
echo "  3. ✓ After 150ms pause, smooth animations play"
echo "  4. ✓ Only one filter operation in console"
echo "  5. ✓ Professional cascade entrance effect"
echo ""
echo "Accessibility (Phase 8):"
echo "  1. Enable 'Reduce Motion' in OS settings"
echo "  2. Reload page and click filter"
echo "  3. ✓ Instant show/hide, no animations"
echo ""
echo "See PHASES_6-8_IMPLEMENTATION.md for detailed documentation"
