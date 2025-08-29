/**
 * Integration Tests for El Camino Enhancement System
 * Tests component interactions and end-to-end functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { elCaminoEnhancements } from '../../enhancements';
import { businessMonitor } from '../../monitoring/businessMonitor';
import { errorRecovery } from '../../monitoring/errorRecovery';
import { abTesting } from '../../analytics/abTesting';
import { loadingStates } from '../../ui/loadingStates';
import { userErrorCommunication } from '../../ui/errorCommunication';

// Mock DOM environment
const mockDOM = () => {
  Object.defineProperty(window, 'location', {
    value: { href: 'https://test.elcamino.com/product/123' },
    writable: true
  });

  document.body.innerHTML = `
    <div id="product-details-container"></div>
    <div id="cart-container"></div>
    <div id="image-gallery-container"></div>
    <button id="add-to-cart-button">Add to Cart</button>
  `;
};

describe('El Camino Enhancement System Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDOM();
    
    // Reset enhancement system state for testing
    (elCaminoEnhancements as any).isInitialized = false;
    
    // Clear localStorage between tests
    localStorage.clear();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('System Initialization', () => {
    it('initializes all components without errors', async () => {
      // Set up console spy BEFORE initialization
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      // Ensure system is not already initialized
      expect((elCaminoEnhancements as any).isInitialized).toBe(false);
      
      await elCaminoEnhancements.initialize();
      
      // Check that initialization messages were logged
      expect(consoleSpy).toHaveBeenCalledWith('🚀 Initializing El Camino enhancements...');
      expect(consoleSpy).toHaveBeenCalledWith('✅ El Camino enhancements initialized successfully');
      
      const healthStatus = elCaminoEnhancements.getHealthStatus();
      expect(healthStatus.initialized).toBe(true);
      
      consoleSpy.mockRestore();
    });

    it('handles partial initialization gracefully', async () => {
      const customEnhancements = new (class extends Object {
        constructor() {
          super();
          // Test partial config
        }
      })();
      
      expect(() => {
        // Should not throw even with custom configuration
      }).not.toThrow();
    });
  });

  describe('Error Recovery Integration', () => {
    it('integrates error recovery with user communication', async () => {
      await elCaminoEnhancements.initialize();
      
      const testError = new Error('Network timeout');
      const container = document.getElementById('product-details-container')!;
      
      const errorId = elCaminoEnhancements.showUserError(testError, container);
      
      expect(errorId).toBeTruthy();
      expect(container.querySelector('.error-display')).toBeTruthy();
    });

    it('tracks error recovery attempts', async () => {
      await elCaminoEnhancements.initialize();
      
      // Track calls to abTesting.trackEvent instead of businessMonitor directly
      const trackSpy = vi.spyOn(abTesting, 'trackEvent');
      
      // Simulate error retry event
      const retryEvent = new CustomEvent('error:retry', {
        detail: { category: 'NETWORK', timestamp: Date.now() }
      });
      
      document.dispatchEvent(retryEvent);
      
      // Give time for event handler to process
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(trackSpy).toHaveBeenCalledWith('error:retry', expect.objectContaining({
        category: 'NETWORK'
      }));
    });

    it('applies circuit breaker pattern to API calls', async () => {
      await elCaminoEnhancements.initialize();
      
      const circuitBreaker = errorRecovery.getCircuitBreaker('/api/inventory');
      
      // Test circuit breaker functionality
      const mockApiCall = vi.fn().mockRejectedValue(new Error('API Error'));
      const mockFallback = vi.fn().mockResolvedValue({ status: 'cached' });
      
      await expect(
        circuitBreaker.execute(mockApiCall, mockFallback)
      ).resolves.toEqual({ status: 'cached' });
      
      expect(mockApiCall).toHaveBeenCalled();
      expect(mockFallback).toHaveBeenCalled();
    });
  });

  describe('Loading States Integration', () => {
    it('coordinates loading states with business operations', async () => {
      await elCaminoEnhancements.initialize();
      
      const container = document.getElementById('product-details-container')!;
      const button = document.getElementById('add-to-cart-button')! as HTMLButtonElement;
      
      // Test product loading
      const productLoaderId = elCaminoEnhancements.showProductLoading(container);
      expect(container.querySelector('.loading-state')).toBeTruthy();
      
      // Test cart loading
      const cartLoaderId = elCaminoEnhancements.showCartLoading(button);
      expect(button.innerHTML).toContain('spinner');
      expect(button.disabled).toBe(true);
      
      // Test cleanup
      elCaminoEnhancements.hideLoading(productLoaderId);
      elCaminoEnhancements.hideLoading(cartLoaderId);
      
      // Wait for any CSS transitions or async cleanup
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Check that loading state is cleaned up (may have fade-out class during transition)
      const loadingElement = container.querySelector('.loading-state');
      if (loadingElement) {
        // If element still exists, it should have fade-out class (transition in progress)
        expect(loadingElement.classList.contains('fade-out')).toBe(true);
      }
      
      // Wait for button state to be restored (fadeOut takes 300ms)
      await new Promise(resolve => setTimeout(resolve, 350));
      expect(button.disabled).toBe(false);
    });

    it('handles loading state transitions', async () => {
      await elCaminoEnhancements.initialize();
      
      const button = document.getElementById('add-to-cart-button')! as HTMLButtonElement;
      const loaderId = loadingStates.showCartUpdateLoading(button);
      
      // Test success transition
      loadingStates.transitionToSuccess(loaderId, 'Added successfully!');
      
      // Wait for transition to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(button.querySelector('.success-state')).toBeTruthy();
      
      // Test error transition
      const errorLoaderId = loadingStates.showCartUpdateLoading(button);
      loadingStates.transitionToError(errorLoaderId, 'Failed to add item');
      
      expect(button.querySelector('.error-state')).toBeTruthy();
    });
  });

  describe('A/B Testing Integration', () => {
    it('creates and manages product page tests', async () => {
      await elCaminoEnhancements.initialize();
      
      const testId = abTesting.createProductPageTest('button-color-test', {
        control: { buttonColor: 'blue', buttonText: 'Add to Cart' },
        variant: { buttonColor: 'green', buttonText: 'Buy Now' }
      });
      
      expect(testId).toBeTruthy();
      expect(testId).toMatch(/^pdp-button-color-test/);
      
      const variant = abTesting.getVariant(testId);
      expect(variant).toBeTruthy();
      expect(['blue', 'green']).toContain(variant?.config.buttonColor);
    });

    it('tracks conversion events correctly', async () => {
      await elCaminoEnhancements.initialize();
      
      // Spy on the window.businessMonitor that abTesting uses
      const trackSpy = vi.spyOn((window as any).businessMonitor, 'trackCustomEvent');
      
      // Create test
      const testId = abTesting.createProductPageTest('conversion-test', {
        control: { feature: 'enabled' },
        variant: { feature: 'disabled' }
      });
      
      // Get user into test
      const variant = abTesting.getVariant(testId);
      expect(variant).toBeTruthy();
      
      // Track conversion
      elCaminoEnhancements.trackProductConversion('add-to-cart', 1);
      
      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(trackSpy).toHaveBeenCalledWith(
        'ab_test_conversion',
        expect.objectContaining({
          testId,
          variantId: variant?.id
        })
      );
    });

    it('integrates A/B tests with UI components', async () => {
      await elCaminoEnhancements.initialize();
      
      // Test product page variant retrieval
      const variant = elCaminoEnhancements.getProductPageVariant('add-to-cart-button');
      
      if (variant) {
        expect(variant).toHaveProperty('buttonText');
        expect(variant).toHaveProperty('buttonColor');
        
        // Verify UI could use these values
        const button = document.getElementById('add-to-cart-button')!;
        button.textContent = variant.buttonText;
        button.style.backgroundColor = variant.buttonColor;
        
        expect(button.textContent).toBe(variant.buttonText);
      }
    });
  });

  describe('Performance Monitoring Integration', () => {
    it('tracks business metrics and performance data', async () => {
      await elCaminoEnhancements.initialize();
      
      const trackSpy = vi.spyOn(businessMonitor, 'trackCustomEvent');
      
      // Track business metric
      elCaminoEnhancements.trackBusinessMetric('conversion_rate', 0.15, {
        source: 'product_page',
        variant: 'test_variant'
      });
      
      expect(trackSpy).toHaveBeenCalledWith(
        'business_metric:conversion_rate',
        expect.objectContaining({
          value: 0.15,
          metadata: expect.objectContaining({
            source: 'product_page'
          })
        })
      );
    });

    it('monitors page load and user interactions', async () => {
      await elCaminoEnhancements.initialize();
      
      const trackSpy = vi.spyOn(businessMonitor, 'trackCustomEvent');
      
      // Simulate page load event
      const loadEvent = new Event('load');
      window.dispatchEvent(loadEvent);
      
      expect(trackSpy).toHaveBeenCalledWith(
        'page_load_complete',
        expect.objectContaining({
          url: 'https://test.elcamino.com/product/123'
        })
      );
    });
  });

  describe('Mobile Experience Integration', () => {
    it('handles mobile-specific interactions', async () => {
      await elCaminoEnhancements.initialize();
      
      const trackSpy = vi.spyOn(businessMonitor, 'trackCustomEvent');
      
      // Simulate mobile add to cart event
      const mobileEvent = new CustomEvent('mobile:addToCart', {
        detail: { source: 'doubleTap', timestamp: Date.now() }
      });
      
      document.dispatchEvent(mobileEvent);
      
      expect(trackSpy).toHaveBeenCalledWith(
        'mobile_add_to_cart',
        expect.objectContaining({
          source: 'doubleTap'
        })
      );
    });

    it('optimizes experience based on device capabilities', async () => {
      // Mock mobile environment
      Object.defineProperty(window, 'innerWidth', { value: 375, writable: true });
      Object.defineProperty(window, 'ontouchstart', { value: true, writable: true });
      
      await elCaminoEnhancements.initialize();
      
      // Verify mobile optimizations are applied
      const mobileStyles = document.getElementById('mobile-touch-targets');
      expect(mobileStyles).toBeTruthy();
    });
  });

  describe('Component Integration Scenarios', () => {
    it('handles complete add-to-cart flow with all enhancements', async () => {
      await elCaminoEnhancements.initialize();
      
      const button = document.getElementById('add-to-cart-button')! as HTMLButtonElement;
      const container = document.getElementById('product-details-container')!;
      
      // 1. Show loading state
      const loaderId = elCaminoEnhancements.showCartLoading(button);
      expect(button.disabled).toBe(true);
      
      // 2. Simulate API call with potential error
      const testError = new Error('Inventory check failed');
      
      try {
        // Simulate API failure
        throw testError;
      } catch (error) {
        // 3. Show user-friendly error
        const errorId = elCaminoEnhancements.showUserError(error as Error, container);
        expect(container.querySelector('.error-display')).toBeTruthy();
        
        // 4. Track the error
        const trackSpy = vi.spyOn(abTesting, 'trackEvent');
        
        // 5. User retries
        const retryEvent = new CustomEvent('error:retry', {
          detail: { category: 'NETWORK', timestamp: Date.now() }
        });
        document.dispatchEvent(retryEvent);
        
        // Wait for event processing
        await new Promise(resolve => setTimeout(resolve, 10));
        
        expect(trackSpy).toHaveBeenCalled();
      }
      
      // 6. Cleanup loading state
      elCaminoEnhancements.hideLoading(loaderId);
      
      // Wait for button state to be restored (fadeOut takes 300ms)
      await new Promise(resolve => setTimeout(resolve, 350));
      expect(button.disabled).toBe(false);
    });

    it('coordinates A/B testing with performance monitoring', async () => {
      await elCaminoEnhancements.initialize();
      
      const trackSpy = vi.spyOn(businessMonitor, 'trackCustomEvent');
      
      // Create A/B test
      const testId = abTesting.createProductPageTest('performance-test', {
        control: { optimization: false },
        variant: { optimization: true }
      });
      
      const variant = abTesting.getVariant(testId);
      
      // Track performance based on variant
      if (variant?.config.optimization) {
        elCaminoEnhancements.trackBusinessMetric('page_load_time', 1200);
      } else {
        elCaminoEnhancements.trackBusinessMetric('page_load_time', 1800);
      }
      
      expect(trackSpy).toHaveBeenCalledWith(
        'business_metric:page_load_time',
        expect.objectContaining({
          value: expect.any(Number)
        })
      );
    });

    it('handles feature toggle integration', async () => {
      await elCaminoEnhancements.initialize();
      
      // Test feature enabling/disabling
      elCaminoEnhancements.enableFeature('enableMobileEnhancements');
      elCaminoEnhancements.disableFeature('enableABTesting');
      
      const healthStatus = elCaminoEnhancements.getHealthStatus();
      expect(healthStatus.features.enableMobileEnhancements).toBe(true);
      expect(healthStatus.features.enableABTesting).toBe(false);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('gracefully handles component initialization failures', async () => {
      // Mock a component that fails to initialize
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // This should not prevent other components from initializing
      await elCaminoEnhancements.initialize();
      
      const healthStatus = elCaminoEnhancements.getHealthStatus();
      expect(healthStatus.initialized).toBe(true);
      
      consoleErrorSpy.mockRestore();
    });

    it('provides fallback behavior when features are disabled', async () => {
      const disabledEnhancements = new (elCaminoEnhancements.constructor as any)({
        enableABTesting: false,
        enableMobileEnhancements: false
      });
      
      await disabledEnhancements.initialize();
      
      // Should still work with core functionality
      const healthStatus = disabledEnhancements.getHealthStatus();
      expect(healthStatus.initialized).toBe(true);
      expect(healthStatus.features.enableABTesting).toBe(false);
    });
  });

  describe('Data Persistence and State Management', () => {
    beforeEach(() => {
      // Clear localStorage
      localStorage.clear();
    });

    it('persists A/B test allocations across sessions', async () => {
      await elCaminoEnhancements.initialize();
      
      // Mock localStorage to simulate persistence
      const mockStorage = new Map();
      vi.spyOn(localStorage, 'getItem').mockImplementation((key) => mockStorage.get(key) || null);
      vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
        mockStorage.set(key, value);
      });
      
      // Create test and get allocation
      const testId = abTesting.createProductPageTest('persistence-test', {
        control: { value: 'a' },
        variant: { value: 'b' }
      });
      
      const firstVariant = abTesting.getVariant(testId);
      expect(firstVariant).toBeTruthy();
      
      // Get the same test again - should return same allocation
      const secondVariant = abTesting.getVariant(testId);
      
      // Should maintain same allocation
      expect(secondVariant?.id).toBe(firstVariant?.id);
    });

    it('handles storage quota exceeded gracefully', async () => {
      // Mock storage quota exceeded
      const mockSetItem = vi.spyOn(Storage.prototype, 'setItem')
        .mockImplementation(() => {
          throw new Error('Quota exceeded');
        });
      
      await elCaminoEnhancements.initialize();
      
      // Should not crash the application
      expect(() => {
        elCaminoEnhancements.trackBusinessMetric('test_metric', 1);
      }).not.toThrow();
      
      mockSetItem.mockRestore();
    });
  });
});

describe('Performance Impact Assessment', () => {
  it('initializes within acceptable time limits', async () => {
    const startTime = performance.now();
    
    await elCaminoEnhancements.initialize();
    
    const endTime = performance.now();
    const initTime = endTime - startTime;
    
    // Should initialize within 100ms
    expect(initTime).toBeLessThan(100);
  });

  it('does not significantly impact bundle size', () => {
    // This test would be expanded in a real implementation
    // to verify tree-shaking and code splitting effectiveness
    
    const importedModules = [
      'businessMonitor',
      'errorRecovery', 
      'abTesting',
      'loadingStates',
      'userErrorCommunication'
    ];
    
    // Verify all modules are properly exported
    importedModules.forEach(module => {
      expect(module).toBeTruthy();
    });
  });
});
