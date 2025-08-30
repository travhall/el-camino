#!/bin/bash

# El Camino Phase 1-Enhanced Validation Script
# Validates that critical enhancements are working properly

echo "🚀 El Camino Phase 1-Enhanced Validation Starting..."
echo "=================================================="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Counters
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0

# Helper functions
check_pass() {
    echo -e "${GREEN}✅ PASS:${NC} $1"
    ((PASSED_CHECKS++))
    ((TOTAL_CHECKS++))
}

check_fail() {
    echo -e "${RED}❌ FAIL:${NC} $1"
    ((FAILED_CHECKS++))
    ((TOTAL_CHECKS++))
}

check_warn() {
    echo -e "${YELLOW}⚠️  WARN:${NC} $1"
    ((TOTAL_CHECKS++))
}

check_info() {
    echo -e "${NC}ℹ️  INFO:${NC} $1"
}

# Function to check if file exists and has content
check_file_exists() {
    if [ -f "$1" ]; then
        if [ -s "$1" ]; then
            check_pass "File exists and has content: $1"
            return 0
        else
            check_fail "File exists but is empty: $1"
            return 1
        fi
    else
        check_fail "File missing: $1"
        return 1
    fi
}

# Function to check if directory exists
check_dir_exists() {
    if [ -d "$1" ]; then
        check_pass "Directory exists: $1"
        return 0
    else
        check_fail "Directory missing: $1"
        return 1
    fi
}

# Function to grep for specific content in files
check_file_content() {
    local file="$1"
    local pattern="$2"
    local description="$3"
    
    if [ -f "$file" ]; then
        if grep -q "$pattern" "$file"; then
            check_pass "$description in $file"
            return 0
        else
            check_fail "$description NOT found in $file"
            return 1
        fi
    else
        check_fail "Cannot check content - file missing: $file"
        return 1
    fi
}

echo ""
echo "🔍 Phase 1: Checking Core File Structure"
echo "========================================"

# Check core Phase 1-Enhanced files exist
check_file_exists "src/lib/square/locking/inventoryLock.ts"
check_file_exists "src/lib/square/locking/cartIntegration.ts"
check_file_exists "src/lib/monitoring/memory/memoryManager.ts"
check_file_exists "src/lib/square/rateLimit/rateLimitManager.ts"
check_file_exists "src/lib/security/tokenManager.ts"
check_file_exists "src/lib/enhancementsPhase1.ts"
check_file_exists "src/lib/square/inventoryEnhanced.ts"

# Check test files
check_file_exists "src/test/phase1Enhanced/integration.test.ts"

echo ""
echo "🔧 Phase 2: Validating Core Component Integration"
echo "================================================"

# Check inventory locking integration
check_file_content "src/lib/square/locking/inventoryLock.ts" "InventoryLockManager" "Inventory lock manager class"
check_file_content "src/lib/square/locking/inventoryLock.ts" "acquireLock" "Acquire lock method"
check_file_content "src/lib/square/locking/inventoryLock.ts" "releaseLock" "Release lock method"

# Check cart integration
check_file_content "src/lib/square/locking/cartIntegration.ts" "SecureCartManager" "Secure cart manager class"
check_file_content "src/lib/square/locking/cartIntegration.ts" "secureAddToCart" "Secure add to cart method"
check_file_content "src/lib/square/locking/cartIntegration.ts" "validateCartInventory" "Cart inventory validation"

# Check memory management
check_file_content "src/lib/monitoring/memory/memoryManager.ts" "MemoryManager" "Memory manager class"
check_file_content "src/lib/monitoring/memory/memoryManager.ts" "memoryPressure" "Memory pressure handling"
check_file_content "src/lib/monitoring/memory/memoryManager.ts" "detectMemoryLeak" "Memory leak detection"

# Check rate limiting
check_file_content "src/lib/square/rateLimit/rateLimitManager.ts" "RateLimitManager" "Rate limit manager class"
check_file_content "src/lib/square/rateLimit/rateLimitManager.ts" "checkRateLimit" "Rate limit checking method"
check_file_content "src/lib/square/rateLimit/rateLimitManager.ts" "withRateLimit" "Rate limit wrapper method"

# Check security management
check_file_content "src/lib/security/tokenManager.ts" "SecurityTokenManager" "Security token manager class"
check_file_content "src/lib/security/tokenManager.ts" "validateTokenSafety" "Token validation method"
check_file_content "src/lib/security/tokenManager.ts" "performSecurityScan" "Security scanning method"

echo ""
echo "🔗 Phase 3: Validating System Integration"
echo "========================================"

# Check Phase 1-Enhanced main integration file
check_file_content "src/lib/enhancementsPhase1.ts" "ElCaminoPhase1Enhanced" "Main integration class"
check_file_content "src/lib/enhancementsPhase1.ts" "initializeEnhanced" "Enhanced initialization method"
check_file_content "src/lib/enhancementsPhase1.ts" "elCaminoEnhancements" "Existing enhancements integration"

# Check enhanced inventory integration
check_file_content "src/lib/square/inventoryEnhanced.ts" "checkItemInventoryWithLocks" "Lock-aware inventory checking"
check_file_content "src/lib/square/inventoryEnhanced.ts" "isItemAvailableForPurchase" "Purchase availability checking"
check_file_content "src/lib/square/inventoryEnhanced.ts" "validateCartInventory" "Cart inventory validation"

# Check integration with existing systems
check_file_content "src/lib/enhancementsPhase1.ts" "businessMonitor" "Business monitoring integration"
check_file_content "src/lib/enhancementsPhase1.ts" "setupEnhancedIntegrations" "Enhanced integrations setup"

echo ""
echo "⚙️  Phase 4: Checking TypeScript Integration"
echo "==========================================="

# Check TypeScript compilation
if command -v tsc &> /dev/null; then
    check_info "TypeScript compiler found, running type check..."
    if tsc --noEmit --project tsconfig.json > /tmp/tsc-check.log 2>&1; then
        check_pass "TypeScript compilation successful"
    else
        check_fail "TypeScript compilation errors found"
        echo "First 10 lines of TypeScript errors:"
        head -10 /tmp/tsc-check.log
    fi
else
    check_warn "TypeScript compiler not found - skipping type check"
fi

echo ""
echo "🧪 Phase 5: Running Integration Tests"
echo "=================================="

# Check if test runner is available
if command -v npm &> /dev/null; then
    if [ -f "package.json" ]; then
        # Check if test script exists
        if grep -q '"test"' package.json; then
            check_info "Running integration tests..."
            if npm test -- --run src/test/phase1Enhanced > /tmp/test-results.log 2>&1; then
                check_pass "Integration tests passed"
            else
                check_fail "Integration tests failed"
                echo "Test output:"
                tail -20 /tmp/test-results.log
            fi
        else
            check_warn "No test script found in package.json"
        fi
    else
        check_warn "No package.json found - skipping npm tests"
    fi
else
    check_warn "npm not found - skipping integration tests"
fi

echo ""
echo "🔒 Phase 6: Security Validation"
echo "=============================="

# Check for potential security issues
if [ -d "src" ]; then
    # Check for hardcoded secrets (basic patterns) - exclude test files and directories
    secret_matches=$(grep -r "sk_[a-zA-Z0-9_-]" src/ 2>/dev/null | grep -v "\.test\." | grep -v "/test/" | grep -v "mockResolvedValue" | grep -v "test.*:" | grep -v "spec\." | wc -l)
    if [ "$secret_matches" -gt 0 ]; then
        check_fail "Potential secret key found in source code"
        echo "Run: grep -r 'sk_[a-zA-Z0-9_-]' src/ | grep -v test to investigate"
    else
        check_pass "No secret keys found in production code (test files excluded)"
    fi

    # Check for TODO security items
    if grep -r "TODO.*security\|FIXME.*security" src/ > /dev/null 2>&1; then
        check_warn "Security-related TODOs found"
        grep -r "TODO.*security\|FIXME.*security" src/ | head -3
    else
        check_pass "No security-related TODOs found"
    fi
fi

echo ""
echo "📊 Phase 7: Performance & Memory Validation"
echo "========================================="

# Check for memory management integration
check_file_content "src/lib/enhancementsPhase1.ts" "memory:pressure" "Memory pressure event handling"
check_file_content "src/lib/enhancementsPhase1.ts" "optimization" "Performance optimization coordination"

# Check for existing performance monitoring integration
if [ -f "src/lib/monitoring/performance.ts" ]; then
    check_pass "Existing performance monitoring found"
    check_file_content "src/lib/enhancementsPhase1.ts" "elCaminoEnhancements" "Integration with existing performance system"
else
    check_warn "Existing performance monitoring not found at expected location"
fi

echo ""
echo "🌐 Phase 8: API Integration Validation" 
echo "===================================="

# Check Square API integration
check_file_content "src/lib/square/inventoryEnhanced.ts" "withSquareRateLimit" "Square API rate limiting"
check_file_content "src/lib/enhancementsPhase1.ts" "ElCaminoSquareAPI" "Square API wrapper integration"

# Check existing Square client integration
if [ -f "src/lib/square/client.ts" ]; then
    check_pass "Existing Square client found"
    if grep -q "requestDeduplicator" src/lib/square/inventoryEnhanced.ts; then
        check_pass "Request deduplication integrated"
    else
        check_warn "Request deduplication not found in enhanced inventory"
    fi
else
    check_warn "Square client not found at expected location"
fi

echo ""
echo "📱 Phase 9: UI Integration Validation"
echo "=================================="

# Check for UI event integration
check_file_content "src/lib/enhancementsPhase1.ts" "addEventListener" "Event listener integration"
check_file_content "src/lib/enhancementsPhase1.ts" "dispatchEvent" "Event dispatching"

# Check for cart integration events
check_file_content "src/lib/enhancementsPhase1.ts" "cart:add:request" "Cart add request handling"
check_file_content "src/lib/enhancementsPhase1.ts" "checkout:validate" "Checkout validation handling"

echo ""
echo "🏁 Phase 10: Final System Health Check"
echo "====================================="

# Check main integration file exports
check_file_content "src/lib/enhancementsPhase1.ts" "inventoryLockManager" "Inventory lock manager export"
check_file_content "src/lib/enhancementsPhase1.ts" "memoryManager" "Memory manager export"  
check_file_content "src/lib/enhancementsPhase1.ts" "rateLimitManager" "Rate limit manager export"
check_file_content "src/lib/enhancementsPhase1.ts" "securityTokenManager" "Security token manager export"

# Check for global window integration
check_file_content "src/lib/enhancementsPhase1.ts" "window.ElCaminoEnhancementsPhase1" "Global window integration"
check_file_content "src/lib/enhancementsPhase1.ts" "auto-initialize" "Auto-initialization setup"

echo ""
echo "📋 VALIDATION SUMMARY"
echo "==================="
echo -e "Total Checks: ${TOTAL_CHECKS}"
echo -e "${GREEN}Passed: ${PASSED_CHECKS}${NC}"
echo -e "${RED}Failed: ${FAILED_CHECKS}${NC}"
echo -e "Warnings: $((TOTAL_CHECKS - PASSED_CHECKS - FAILED_CHECKS))"

# Calculate success percentage
if [ $TOTAL_CHECKS -gt 0 ]; then
    SUCCESS_RATE=$(( (PASSED_CHECKS * 100) / TOTAL_CHECKS ))
    echo -e "Success Rate: ${SUCCESS_RATE}%"
    
    if [ $FAILED_CHECKS -eq 0 ]; then
        echo ""
        echo -e "${GREEN}🎉 Phase 1-Enhanced Validation PASSED!${NC}"
        echo -e "${GREEN}All critical components are properly integrated.${NC}"
        echo ""
        echo "✅ Next Steps:"
        echo "   1. Run the application and test cart functionality"
        echo "   2. Monitor browser console for any integration errors"
        echo "   3. Test inventory locking with multiple browser tabs"
        echo "   4. Verify memory management under load"
        echo "   5. Test rate limiting with rapid API calls"
        exit 0
    elif [ $FAILED_CHECKS -le 3 ]; then
        echo ""
        echo -e "${YELLOW}⚠️  Phase 1-Enhanced Validation PARTIAL${NC}"
        echo -e "${YELLOW}Some non-critical issues found, but core functionality should work.${NC}"
        echo ""
        echo "🔧 Recommended Actions:"
        echo "   1. Review and fix the failed checks above"
        echo "   2. Test core functionality manually"
        echo "   3. Monitor for runtime errors"
        exit 1
    else
        echo ""
        echo -e "${RED}❌ Phase 1-Enhanced Validation FAILED${NC}"
        echo -e "${RED}Critical issues found that may prevent proper operation.${NC}"
        echo ""
        echo "🚨 Required Actions:"
        echo "   1. Fix all failed checks before proceeding"
        echo "   2. Review integration code carefully"
        echo "   3. Run validation again after fixes"
        exit 2
    fi
else
    echo -e "${RED}❌ No validation checks could be performed${NC}"
    exit 3
fi
