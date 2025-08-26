#!/bin/bash
# Phase 1 Validation Script
# Tests that view transitions are working correctly

echo "🧪 Phase 1 Validation: View Transitions"
echo "========================================"

# Test 1: Build validation
echo "📦 Testing build compilation..."
cd /Users/travishall/GitHub/el-camino

if npm run check > build_test.log 2>&1; then
    echo "✅ Build: PASSED - No TypeScript errors"
else
    echo "❌ Build: FAILED - TypeScript errors detected"
    echo "Build errors:"
    tail -20 build_test.log
    exit 1
fi

# Test 2: Quick dev server test
echo "🚀 Testing dev server startup..."
timeout 15 npm run dev > dev_test.log 2>&1 &
DEV_PID=$!

sleep 10

if kill -0 $DEV_PID 2>/dev/null; then
    echo "✅ Dev Server: PASSED - Starts without errors"
    kill $DEV_PID
else
    echo "❌ Dev Server: FAILED - Startup issues"
    echo "Dev server errors:"
    tail -20 dev_test.log
fi

# Test 3: Check for disabled optimizations log
echo "🔍 Checking optimization status..."
if grep -q "Heavy optimizations disabled" dev_test.log; then
    echo "⚠️  Other optimizations still disabled (expected for Phase 1)"
else
    echo "ℹ️  Optimization status log not found"
fi

# Test 4: File change verification
echo "📝 Verifying code changes..."

# Check Layout.astro changes
if grep -q "import { ClientRouter } from \"astro:transitions\"" src/layouts/Layout.astro; then
    echo "✅ Import: ClientRouter import updated correctly"
else
    echo "❌ Import: ClientRouter import not updated"
fi

if grep -q "<ClientRouter />" src/layouts/Layout.astro; then
    echo "✅ Component: ClientRouter uncommented successfully"
else
    echo "❌ Component: ClientRouter still commented out"
fi

# Check NavigationManager.ts changes
if grep -q "this.enabled = true;" src/lib/navigation/NavigationManager.ts; then
    echo "✅ Navigation: Manager enabled successfully"
else
    echo "❌ Navigation: Manager still disabled"
fi

if grep -q "this.interceptHistoryMethods();" src/lib/navigation/NavigationManager.ts; then
    echo "✅ Navigation: History methods enabled successfully"
else
    echo "❌ Navigation: History methods still disabled"
fi

echo ""
echo "📊 Phase 1 Summary:"
echo "==================="
echo "Changes Made:"
echo "  • Fixed ClientRouter import path"
echo "  • Enabled view transitions in Layout.astro"
echo "  • Enabled NavigationManager functionality"
echo ""
echo "Next Steps:"
echo "  • Test navigation between pages in browser"
echo "  • Verify smooth transitions are working"
echo "  • Check for any JavaScript errors in console"
echo "  • Proceed to Phase 2 if everything looks good"
echo ""
echo "Manual Testing Instructions:"
echo "  1. Run: npm run dev"
echo "  2. Navigate to different pages (/, /shop/all, /product/...)"
echo "  3. Check browser console for any errors"
echo "  4. Verify transitions feel smoother than before"
echo ""

# Cleanup
rm -f build_test.log dev_test.log

echo "🎉 Phase 1 validation completed!"
