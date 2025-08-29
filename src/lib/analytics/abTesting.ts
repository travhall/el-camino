/**
 * A/B Testing Framework - Phase 3 Enterprise Features
 * Advanced analytics integration with conversion tracking
 */

export interface ABTestConfig {
  testId: string;
  name: string;
  description?: string;
  variants: ABVariant[];
  allocation: AllocationStrategy;
  targeting?: TargetingRules;
  duration?: {
    startDate: Date;
    endDate: Date;
  };
  conversionGoals: ConversionGoal[];
  trafficAllocation: number; // Percentage of users to include
}

export interface ABVariant {
  id: string;
  name: string;
  description?: string;
  allocation: number; // Percentage allocation within test
  config: Record<string, any>; // Variant-specific configuration
}

export interface AllocationStrategy {
  type: 'random' | 'sticky' | 'segment';
  stickyKey?: string; // For consistent user experience
  segments?: string[]; // User segments to target
}

export interface TargetingRules {
  userAgent?: string[];
  geographic?: string[];
  customAttributes?: Record<string, any>;
  newUsers?: boolean;
  returningUsers?: boolean;
}

export interface ConversionGoal {
  id: string;
  name: string;
  event: string;
  value?: number;
  funnel?: string[];
}

export interface TestResult {
  testId: string;
  variantId: string;
  userId: string;
  timestamp: number;
  conversionData?: ConversionData;
}

export interface ConversionData {
  goalId: string;
  value: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

class ABTestingFramework {
  private activeTests = new Map<string, ABTestConfig>();
  private userAllocations = new Map<string, Map<string, string>>(); // userId -> testId -> variantId
  private results = new Map<string, TestResult[]>();
  private userId: string;

  constructor() {
    this.userId = this.getUserId();
    this.loadStoredAllocations();
    this.initializeTracking();
  }

  // Test Management
  createTest(config: ABTestConfig): boolean {
    // Validate test configuration
    if (!this.validateTestConfig(config)) {
      console.error('Invalid test configuration:', config);
      return false;
    }

    // Ensure allocations sum to 100%
    const totalAllocation = config.variants.reduce((sum, variant) => sum + variant.allocation, 0);
    if (Math.abs(totalAllocation - 100) > 0.1) {
      console.error('Variant allocations must sum to 100%');
      return false;
    }

    this.activeTests.set(config.testId, config);
    console.log(`A/B Test created: ${config.name} (${config.testId})`);
    
    return true;
  }

  // Product-specific test methods
  createProductPageTest(testName: string, variants: Record<string, any>): string {
    const testId = `pdp-${testName}-${Date.now()}`;
    
    const variantConfigs = Object.entries(variants).map(([key, config], index) => ({
      id: `variant-${key}`,
      name: key,
      allocation: 100 / Object.keys(variants).length,
      config
    }));

    const testConfig: ABTestConfig = {
      testId,
      name: `Product Page: ${testName}`,
      variants: variantConfigs,
      allocation: { type: 'sticky', stickyKey: 'pdp-tests' },
      conversionGoals: [
        {
          id: 'add-to-cart',
          name: 'Add to Cart',
          event: 'cart:item:added'
        },
        {
          id: 'purchase',
          name: 'Purchase Conversion',
          event: 'checkout:completed',
          value: 1
        }
      ],
      trafficAllocation: 100
    };

    this.createTest(testConfig);
    return testId;
  }

  createCartFlowTest(testName: string, variants: Record<string, any>): string {
    const testId = `cart-${testName}-${Date.now()}`;
    
    const variantConfigs = Object.entries(variants).map(([key, config], index) => ({
      id: `variant-${key}`,
      name: key,
      allocation: 100 / Object.keys(variants).length,
      config
    }));

    const testConfig: ABTestConfig = {
      testId,
      name: `Cart Flow: ${testName}`,
      variants: variantConfigs,
      allocation: { type: 'sticky', stickyKey: 'cart-tests' },
      conversionGoals: [
        {
          id: 'cart-completion',
          name: 'Cart to Checkout',
          event: 'checkout:started'
        },
        {
          id: 'purchase-completion',
          name: 'Purchase Completion',
          event: 'checkout:completed',
          value: 1
        }
      ],
      trafficAllocation: 50 // More conservative for checkout flow
    };

    this.createTest(testConfig);
    return testId;
  }

  // User allocation and variant retrieval
  getVariant(testId: string): ABVariant | null {
    const test = this.activeTests.get(testId);
    if (!test) return null;

    // Check if user should participate
    if (!this.shouldUserParticipate(test)) {
      return null;
    }

    // Check existing allocation
    const userTests = this.userAllocations.get(this.userId);
    if (userTests && userTests.has(testId)) {
      const variantId = userTests.get(testId)!;
      const variant = test.variants.find(v => v.id === variantId);
      if (variant) {
        this.trackExperience(testId, variantId);
        return variant;
      }
    }

    // Allocate user to variant
    const allocatedVariant = this.allocateUserToVariant(test);
    if (allocatedVariant) {
      this.setUserAllocation(testId, allocatedVariant.id);
      this.trackExperience(testId, allocatedVariant.id);
      return allocatedVariant;
    }

    return null;
  }

  // Convenience methods for common use cases
  getProductPageVariant(testId: string): any {
    const variant = this.getVariant(testId);
    return variant ? variant.config : null;
  }

  isInVariant(testId: string, variantId: string): boolean {
    const variant = this.getVariant(testId);
    return variant?.id === variantId;
  }

  // Feature flag style usage
  isFeatureEnabled(testId: string, featureName: string): boolean {
    const variant = this.getVariant(testId);
    return variant?.config[featureName] === true;
  }

  getFeatureValue(testId: string, featureName: string, defaultValue: any = null): any {
    const variant = this.getVariant(testId);
    return variant?.config[featureName] ?? defaultValue;
  }

  // Conversion tracking
  trackConversion(testId: string, goalId: string, value: number = 1, metadata?: Record<string, any>) {
    const userTests = this.userAllocations.get(this.userId);
    if (!userTests || !userTests.has(testId)) {
      return; // User not in test
    }

    const variantId = userTests.get(testId)!;
    const test = this.activeTests.get(testId);
    const goal = test?.conversionGoals.find(g => g.id === goalId);
    
    if (!test || !goal) {
      console.warn(`Invalid test or goal: ${testId}, ${goalId}`);
      return;
    }

    const conversionData: ConversionData = {
      goalId,
      value,
      timestamp: Date.now(),
      metadata
    };

    const result: TestResult = {
      testId,
      variantId,
      userId: this.userId,
      timestamp: Date.now(),
      conversionData
    };

    this.recordResult(result);
    this.sendConversionToAnalytics(result);
    
    console.log(`Conversion tracked: ${goalId} for test ${testId}, variant ${variantId}`);
  }

  // Event-based conversion tracking
  trackEvent(eventName: string, eventData?: any) {
    // Check all active tests for matching conversion goals
    this.activeTests.forEach((test, testId) => {
      const matchingGoals = test.conversionGoals.filter(goal => goal.event === eventName);
      
      matchingGoals.forEach(goal => {
        const value = goal.value || eventData?.value || 1;
        this.trackConversion(testId, goal.id, value, eventData);
      });
    });
  }

  // Analytics integration
  private sendConversionToAnalytics(result: TestResult) {
    // Google Analytics 4 integration
    if (typeof gtag !== 'undefined') {
      gtag('event', 'ab_test_conversion', {
        test_id: result.testId,
        variant_id: result.variantId,
        goal_id: result.conversionData?.goalId,
        value: result.conversionData?.value
      });
    }

    // Custom analytics integration
    if (typeof window !== 'undefined' && 'businessMonitor' in window) {
      (window as any).businessMonitor.trackCustomEvent('ab_test_conversion', {
        testId: result.testId,
        variantId: result.variantId,
        goalId: result.conversionData?.goalId,
        value: result.conversionData?.value,
        userId: this.userId
      });
    }
  }

  private trackExperience(testId: string, variantId: string) {
    if (typeof gtag !== 'undefined') {
      gtag('event', 'ab_test_exposure', {
        test_id: testId,
        variant_id: variantId
      });
    }

    if (typeof window !== 'undefined' && 'businessMonitor' in window) {
      (window as any).businessMonitor.trackCustomEvent('ab_test_exposure', {
        testId,
        variantId,
        userId: this.userId
      });
    }
  }

  // User allocation logic
  private shouldUserParticipate(test: ABTestConfig): boolean {
    // Check traffic allocation
    if (Math.random() * 100 > test.trafficAllocation) {
      return false;
    }

    // Check time-based targeting
    if (test.duration) {
      const now = new Date();
      if (now < test.duration.startDate || now > test.duration.endDate) {
        return false;
      }
    }

    // Check targeting rules
    if (test.targeting) {
      if (!this.matchesTargetingRules(test.targeting)) {
        return false;
      }
    }

    return true;
  }

  private allocateUserToVariant(test: ABTestConfig): ABVariant | null {
    if (test.allocation.type === 'random') {
      return this.randomAllocation(test.variants);
    } else if (test.allocation.type === 'sticky') {
      return this.stickyAllocation(test.variants, test.allocation.stickyKey || test.testId);
    }

    return this.randomAllocation(test.variants);
  }

  private randomAllocation(variants: ABVariant[]): ABVariant | null {
    const random = Math.random() * 100;
    let cumulativeAllocation = 0;

    for (const variant of variants) {
      cumulativeAllocation += variant.allocation;
      if (random < cumulativeAllocation) {
        return variant;
      }
    }

    return variants[variants.length - 1]; // Fallback to last variant
  }

  private stickyAllocation(variants: ABVariant[], stickyKey: string): ABVariant | null {
    // Create deterministic hash from user ID and sticky key
    const hashInput = `${this.userId}-${stickyKey}`;
    const hash = this.simpleHash(hashInput);
    const normalized = (hash % 10000) / 100; // 0-99.99

    let cumulativeAllocation = 0;
    for (const variant of variants) {
      cumulativeAllocation += variant.allocation;
      if (normalized < cumulativeAllocation) {
        return variant;
      }
    }

    return variants[variants.length - 1];
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  private matchesTargetingRules(targeting: TargetingRules): boolean {
    // User agent targeting
    if (targeting.userAgent) {
      const userAgent = navigator.userAgent.toLowerCase();
      if (!targeting.userAgent.some(pattern => userAgent.includes(pattern.toLowerCase()))) {
        return false;
      }
    }

    // Geographic targeting (requires location data)
    if (targeting.geographic) {
      const userLocation = this.getUserLocation();
      if (userLocation && !targeting.geographic.includes(userLocation)) {
        return false;
      }
    }

    // New vs returning user targeting
    if (targeting.newUsers !== undefined || targeting.returningUsers !== undefined) {
      const isReturningUser = this.isReturningUser();
      if (targeting.newUsers && isReturningUser) return false;
      if (targeting.returningUsers && !isReturningUser) return false;
    }

    return true;
  }

  // Storage and persistence
  private setUserAllocation(testId: string, variantId: string) {
    let userTests = this.userAllocations.get(this.userId);
    if (!userTests) {
      userTests = new Map();
      this.userAllocations.set(this.userId, userTests);
    }
    
    userTests.set(testId, variantId);
    this.saveAllocationsToStorage();
  }

  private saveAllocationsToStorage() {
    try {
      const allocationsData = Array.from(this.userAllocations.entries()).map(([userId, tests]) => [
        userId,
        Array.from(tests.entries())
      ]);
      
      localStorage.setItem('ab_test_allocations', JSON.stringify(allocationsData));
    } catch (error) {
      console.warn('Failed to save A/B test allocations:', error);
    }
  }

  private loadStoredAllocations() {
    try {
      const stored = localStorage.getItem('ab_test_allocations');
      if (stored) {
        const allocationsData = JSON.parse(stored);
        this.userAllocations = new Map(
          allocationsData.map(([userId, tests]: [string, [string, string][]]) => [
            userId,
            new Map(tests)
          ])
        );
      }
    } catch (error) {
      console.warn('Failed to load stored A/B test allocations:', error);
    }
  }

  private recordResult(result: TestResult) {
    let testResults = this.results.get(result.testId);
    if (!testResults) {
      testResults = [];
      this.results.set(result.testId, testResults);
    }
    
    testResults.push(result);
    
    // Send to analytics backend
    this.sendResultToBackend(result);
  }

  private sendResultToBackend(result: TestResult) {
    // In production, send to your analytics backend
    if (process.env.NODE_ENV === 'production') {
      fetch('/api/analytics/ab-test-result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result)
      }).catch(error => {
        console.warn('Failed to send A/B test result:', error);
      });
    }
  }

  // Utility methods
  private getUserId(): string {
    let userId = localStorage.getItem('ab_test_user_id');
    if (!userId) {
      userId = 'user_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
      localStorage.setItem('ab_test_user_id', userId);
    }
    return userId;
  }

  private getUserLocation(): string | null {
    // In production, this would use IP geolocation or user preference
    return null;
  }

  private isReturningUser(): boolean {
    return localStorage.getItem('returning_user') === 'true';
  }

  private validateTestConfig(config: ABTestConfig): boolean {
    if (!config.testId || !config.name || !config.variants) {
      return false;
    }

    if (config.variants.length < 2) {
      return false;
    }

    if (!config.conversionGoals || config.conversionGoals.length === 0) {
      return false;
    }

    return true;
  }

  private initializeTracking() {
    // Set up automatic event tracking for common e-commerce events
    document.addEventListener('cart:item:added', (event: any) => {
      this.trackEvent('cart:item:added', event.detail);
    });

    document.addEventListener('checkout:started', (event: any) => {
      this.trackEvent('checkout:started', event.detail);
    });

    document.addEventListener('checkout:completed', (event: any) => {
      this.trackEvent('checkout:completed', event.detail);
    });

    // Mark returning user
    if (localStorage.getItem('user_visited')) {
      localStorage.setItem('returning_user', 'true');
    } else {
      localStorage.setItem('user_visited', 'true');
    }
  }

  // Test management
  stopTest(testId: string) {
    this.activeTests.delete(testId);
    console.log(`A/B Test stopped: ${testId}`);
  }

  getTestResults(testId: string): TestResult[] {
    return this.results.get(testId) || [];
  }

  getAllActiveTests(): ABTestConfig[] {
    return Array.from(this.activeTests.values());
  }

  getUserTests(): Map<string, string> {
    return this.userAllocations.get(this.userId) || new Map();
  }
}

// Export singleton instance
export const abTesting = new ABTestingFramework();

// Helper functions for common test scenarios
export function createPDPTest(name: string, variants: Record<string, any>) {
  return abTesting.createProductPageTest(name, variants);
}

export function createCartTest(name: string, variants: Record<string, any>) {
  return abTesting.createCartFlowTest(name, variants);
}

export function getTestVariant(testId: string) {
  return abTesting.getVariant(testId);
}

export function trackConversion(testId: string, goalId: string, value?: number) {
  return abTesting.trackConversion(testId, goalId, value);
}

export function isInVariant(testId: string, variantId: string) {
  return abTesting.isInVariant(testId, variantId);
}

export function isFeatureEnabled(testId: string, feature: string) {
  return abTesting.isFeatureEnabled(testId, feature);
}

// Global event tracking
export function trackEvent(eventName: string, data?: any) {
  abTesting.trackEvent(eventName, data);
}
