/**
 * El Camino Enhancement Integration Manager
 * Orchestrates all Phase 1-3 components for seamless operation
 */

import { businessMonitor } from './monitoring/businessMonitor';
import { errorRecovery } from './monitoring/errorRecovery';
import { userErrorCommunication } from './ui/errorCommunication';
import { loadingStates } from './ui/loadingStates';
import { imageOptimizer } from './image/optimizer';
import { mobileExperience } from './mobile/experienceManager';
import { abTesting } from './analytics/abTesting';

export interface EnhancementConfig {
  enableMonitoring: boolean;
  enableErrorRecovery: boolean;
  enableImageOptimization: boolean;
  enableMobileEnhancements: boolean;
  enableABTesting: boolean;
  enableLoadingStates: boolean;
}

class ElCaminoEnhancementManager {
  private config: EnhancementConfig = {
    enableMonitoring: true,
    enableErrorRecovery: true,
    enableImageOptimization: true,
    enableMobileEnhancements: true,
    enableABTesting: true,
    enableLoadingStates: true
  };

  private isInitialized = false;

  constructor(config?: Partial<EnhancementConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.warn('El Camino enhancements already initialized');
      return;
    }

    console.log('🚀 Initializing El Camino enhancements...');

    try {
      // Phase 1: Critical Foundation
      if (this.config.enableMonitoring) {
        this.initializeMonitoring();
      }

      if (this.config.enableErrorRecovery) {
        this.initializeErrorRecovery();
      }

      // Phase 2: User Experience Enhancement
      if (this.config.enableLoadingStates) {
        this.initializeLoadingStates();
      }

      if (this.config.enableImageOptimization) {
        await this.initializeImageOptimization();
      }

      if (this.config.enableMobileEnhancements) {
        this.initializeMobileEnhancements();
      }

      // Phase 3: Enterprise Features
      if (this.config.enableABTesting) {
        this.initializeABTesting();
      }

      this.setupIntegrations();
      this.isInitialized = true;

      console.log('✅ El Camino enhancements initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize El Camino enhancements:', error);
      throw error;
    }
  }

  private initializeMonitoring() {
    console.log('📊 Initializing performance monitoring...');
    
    // Business monitor is automatically initialized
    // Track page load completion
    window.addEventListener('load', () => {
      businessMonitor.trackCustomEvent('page_load_complete', {
        url: window.location.href,
        timestamp: Date.now()
      });
    });

    console.log('✅ Performance monitoring initialized');
  }

  private initializeErrorRecovery() {
    console.log('🛡️ Initializing error recovery...');
    
    // Global error handling is set up in errorRecovery
    // Add custom recovery strategies for specific scenarios
    
    // Product page specific error handling
    document.addEventListener('product:load:error', (event: any) => {
      const error = event.detail.error;
      const container = document.querySelector('#product-details-container');
      
      if (container) {
        userErrorCommunication.showInventoryError(error, container as HTMLElement);
      }
    });

    // Cart specific error handling
    document.addEventListener('cart:error', (event: any) => {
      const error = event.detail.error;
      const container = document.querySelector('#cart-container');
      
      if (container) {
        userErrorCommunication.showCartError(error, container as HTMLElement);
      }
    });

    console.log('✅ Error recovery initialized');
  }

  private initializeLoadingStates() {
    console.log('⏳ Initializing loading states...');
    
    // Integrate loading states with common operations
    this.setupLoadingStateIntegrations();
    
    console.log('✅ Loading states initialized');
  }

  private async initializeImageOptimization() {
    console.log('🖼️ Initializing image optimization...');
    
    // Initialize lazy loading for existing images
    if (typeof window !== 'undefined') {
      const { initializeImageOptimization } = await import('./image/optimizer');
      initializeImageOptimization();
    }
    
    console.log('✅ Image optimization initialized');
  }

  private initializeMobileEnhancements() {
    console.log('📱 Initializing mobile enhancements...');
    
    // Mobile experience manager auto-initializes
    // Additional mobile-specific event handlers
    document.addEventListener('mobile:addToCart', (event: any) => {
      const { source } = event.detail;
      businessMonitor.trackCustomEvent('mobile_add_to_cart', {
        source,
        timestamp: Date.now()
      });
    });
    
    console.log('✅ Mobile enhancements initialized');
  }

  private initializeABTesting() {
    console.log('🧪 Initializing A/B testing...');
    
    // Set up common A/B tests for El Camino
    this.setupDefaultABTests();
    
    console.log('✅ A/B testing initialized');
  }

  private setupLoadingStateIntegrations() {
    // Integrate with product loading
    document.addEventListener('product:loading:start', (event: any) => {
      const container = event.detail.container;
      if (container) {
        const loaderId = loadingStates.showProductDetailsLoading(container);
        event.detail.loaderId = loaderId;
      }
    });

    document.addEventListener('product:loading:complete', (event: any) => {
      const loaderId = event.detail.loaderId;
      if (loaderId) {
        loadingStates.hideLoading(loaderId);
      }
    });

    // Integrate with cart operations
    document.addEventListener('cart:updating', (event: any) => {
      const button = event.detail.button;
      if (button) {
        const loaderId = loadingStates.showCartUpdateLoading(button);
        event.detail.loaderId = loaderId;
      }
    });

    document.addEventListener('cart:updated', (event: any) => {
      const loaderId = event.detail.loaderId;
      const success = event.detail.success;
      
      if (loaderId) {
        if (success) {
          loadingStates.transitionToSuccess(loaderId, 'Added to cart!');
        } else {
          loadingStates.transitionToError(loaderId, 'Failed to add item');
        }
      }
    });
  }

  private setupDefaultABTests() {
    // Product page add-to-cart button variations
    abTesting.createProductPageTest('add-to-cart-button', {
      control: {
        buttonText: 'Add to Cart',
        buttonColor: '#3b82f6',
        showQuantitySelector: true
      },
      variant_a: {
        buttonText: 'Add to Bag',
        buttonColor: '#10b981',
        showQuantitySelector: true
      },
      variant_b: {
        buttonText: 'Buy Now',
        buttonColor: '#ef4444',
        showQuantitySelector: false
      }
    });

    // Cart flow optimization test
    abTesting.createCartFlowTest('checkout-flow', {
      control: {
        showProgressIndicator: false,
        requireAccountCreation: false,
        showRelatedProducts: true
      },
      optimized: {
        showProgressIndicator: true,
        requireAccountCreation: false,
        showRelatedProducts: false
      }
    });

    // Product image display test
    abTesting.createProductPageTest('image-layout', {
      control: {
        imageLayout: 'carousel',
        showZoom: true,
        thumbnailPosition: 'bottom'
      },
      variant_a: {
        imageLayout: 'grid',
        showZoom: true,
        thumbnailPosition: 'side'
      }
    });
  }

  private setupIntegrations() {
    // Connect error recovery with A/B testing
    document.addEventListener('error:retry', (event: any) => {
      abTesting.trackEvent('error:retry', {
        category: event.detail.category,
        timestamp: Date.now()
      });
    });

    // Connect mobile experience with analytics
    document.addEventListener('mobile:gesture', (event: any) => {
      businessMonitor.trackCustomEvent('mobile_gesture', event.detail);
    });

    // Connect loading states with performance monitoring
    document.addEventListener('loading:state:change', (event: any) => {
      businessMonitor.trackCustomEvent('loading_state_change', event.detail);
    });
  }

  // Public methods for runtime control
  enableFeature(feature: keyof EnhancementConfig) {
    this.config[feature] = true;
    console.log(`✅ Enabled feature: ${feature}`);
  }

  disableFeature(feature: keyof EnhancementConfig) {
    this.config[feature] = false;
    console.log(`❌ Disabled feature: ${feature}`);
  }

  // A/B testing helpers for components
  getProductPageVariant(testName: string = 'add-to-cart-button') {
    return abTesting.getProductPageVariant(`pdp-${testName}`);
  }

  trackProductConversion(goal: string, value?: number) {
    // Track for all active product page tests
    const activeTests = abTesting.getAllActiveTests();
    activeTests
      .filter(test => test.testId.startsWith('pdp-'))
      .forEach(test => {
        const matchingGoal = test.conversionGoals.find(g => g.id === goal);
        if (matchingGoal) {
          abTesting.trackConversion(test.testId, goal, value);
        }
      });
  }

  // Error handling helpers
  showUserError(error: Error, container?: HTMLElement) {
    const targetContainer = container || document.body;
    return userErrorCommunication.showUserFriendlyError(error, targetContainer);
  }

  // Loading state helpers
  showProductLoading(container: HTMLElement) {
    return loadingStates.showProductDetailsLoading(container);
  }

  showCartLoading(button: HTMLElement) {
    return loadingStates.showCartUpdateLoading(button);
  }

  hideLoading(loaderId: string) {
    loadingStates.hideLoading(loaderId);
  }

  // Performance tracking helpers
  trackBusinessMetric(metric: string, value: number, metadata?: any) {
    businessMonitor.trackCustomEvent(`business_metric:${metric}`, {
      value,
      metadata,
      timestamp: Date.now()
    });
  }

  // Health check
  getHealthStatus() {
    return {
      initialized: this.isInitialized,
      features: this.config,
      activeABTests: abTesting.getAllActiveTests().length,
      timestamp: Date.now()
    };
  }
}

// Global integration
declare global {
  interface Window {
    ElCaminoEnhancements: ElCaminoEnhancementManager;
  }
}

// Export singleton instance
export const elCaminoEnhancements = new ElCaminoEnhancementManager();

// Initialize automatically when imported
if (typeof window !== 'undefined') {
  window.ElCaminoEnhancements = elCaminoEnhancements;
  
  // Auto-initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      elCaminoEnhancements.initialize();
    });
  } else {
    elCaminoEnhancements.initialize();
  }
}

export default elCaminoEnhancements;
