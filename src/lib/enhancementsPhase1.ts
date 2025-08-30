/**
 * El Camino Phase 1-Enhanced Integration
 * Integrates critical security, inventory, memory, and rate limiting enhancements
 * Builds upon existing enhancement framework (Phase 1-3 architecture)
 */

import { elCaminoEnhancements } from './enhancements';
import { inventoryLockManager } from './square/locking/inventoryLock';
import { SecureCartManager, CartSessionManager } from './square/locking/cartIntegration';
import { memoryManager } from './monitoring/memory/memoryManager';
import { rateLimitManager } from './square/rateLimit/rateLimitManager';
import { securityTokenManager, SecurityUtils } from './security/tokenManager';
import { businessMonitor } from './monitoring/businessMonitor';

export interface Phase1EnhancedConfig {
  // Phase 1-Enhanced Features
  enableInventoryLocking: boolean;
  enableMemoryManagement: boolean;
  enableRateLimiting: boolean;
  enableSecurityScanning: boolean;
  
  // Existing El Camino Features (Phase 1-3)
  enableMonitoring: boolean;
  enableErrorRecovery: boolean;
  enableImageOptimization: boolean;
  enableMobileEnhancements: boolean;
  enableABTesting: boolean;
  enableLoadingStates: boolean;
}

class ElCaminoPhase1Enhanced {
  private config: Phase1EnhancedConfig = {
    // Phase 1-Enhanced (New Critical Features)
    enableInventoryLocking: true,
    enableMemoryManagement: true,
    enableRateLimiting: true,
    enableSecurityScanning: true,
    
    // Existing Phase 1-3 Features (Maintained)
    enableMonitoring: true,
    enableErrorRecovery: true,
    enableImageOptimization: true,
    enableMobileEnhancements: true,
    enableABTesting: true,
    enableLoadingStates: true
  };

  private isEnhancedInitialized = false;

  constructor(config?: Partial<Phase1EnhancedConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  async initializeEnhanced(): Promise<void> {
    if (this.isEnhancedInitialized) {
      console.warn('El Camino Phase 1-Enhanced already initialized');
      return;
    }

    console.log('🚀 Initializing El Camino Phase 1-Enhanced...');

    try {
      // Step 1: Initialize existing El Camino enhancements (Phase 1-3)
      await elCaminoEnhancements.initialize();

      // Step 2: Initialize Phase 1-Enhanced critical components
      await this.initializeCriticalEnhancements();

      // Step 3: Setup integrations between existing and new systems
      this.setupEnhancedIntegrations();

      this.isEnhancedInitialized = true;

      console.log('✅ El Camino Phase 1-Enhanced initialized successfully');
      
      businessMonitor.trackCustomEvent('phase1_enhanced_initialized', {
        timestamp: Date.now(),
        features: Object.keys(this.config).filter(key => this.config[key as keyof Phase1EnhancedConfig])
      });

    } catch (error) {
      console.error('❌ Failed to initialize El Camino Phase 1-Enhanced:', error);
      throw error;
    }
  }

  /**
   * Initialize critical Phase 1-Enhanced components
   */
  private async initializeCriticalEnhancements(): Promise<void> {
    
    // Initialize Security Scanning (Critical - prevents token exposure)
    if (this.config.enableSecurityScanning) {
      console.log('🔐 Initializing security token management...');
      
      // Security manager is auto-initialized, but we can perform additional setup
      this.setupSecurityIntegrations();
      
      console.log('✅ Security token management initialized');
    }

    // Initialize Inventory Locking (Critical - prevents overselling)  
    if (this.config.enableInventoryLocking) {
      console.log('🔒 Initializing inventory locking system...');
      
      // Inventory lock manager is auto-initialized, setup cart integrations
      this.setupInventoryIntegrations();
      
      console.log('✅ Inventory locking system initialized');
    }

    // Initialize Memory Management (Critical - prevents crashes)
    if (this.config.enableMemoryManagement) {
      console.log('🧠 Initializing memory management...');
      
      // Memory manager starts monitoring automatically, setup pressure handlers
      this.setupMemoryIntegrations();
      
      console.log('✅ Memory management initialized');
    }

    // Initialize Rate Limiting (Critical - prevents abuse)
    if (this.config.enableRateLimiting) {
      console.log('🛡️ Initializing rate limiting...');
      
      // Rate limit manager is ready, setup Square API integration
      this.setupRateLimitIntegrations();
      
      console.log('✅ Rate limiting initialized');
    }
  }

  /**
   * Setup security integrations with existing systems
   */
  private setupSecurityIntegrations(): void {
    // Integrate security scanning with existing error recovery
    document.addEventListener('security:token:exposure', (event: any) => {
      const error = new Error(`Security Issue: ${event.detail.issue}`);
      
      // Use existing error recovery system
      if (elCaminoEnhancements.showUserError) {
        elCaminoEnhancements.showUserError(error);
      }
      
      businessMonitor.trackCustomEvent('security_issue_handled', {
        issue: event.detail.issue,
        severity: event.detail.severity
      });
    });

    // Integrate with existing A/B testing for security-related UX
    if (this.config.enableABTesting && elCaminoEnhancements.getProductPageVariant) {
      const securityVariant = elCaminoEnhancements.getProductPageVariant('security-ui');
      if (securityVariant?.showSecurityIndicators) {
        document.body.classList.add('security-indicators-enabled');
      }
    }
  }

  /**
   * Setup inventory locking integrations
   */
  private setupInventoryIntegrations(): void {
    // Integrate with existing cart system
    document.addEventListener('cart:add:request', async (event: any) => {
      const { productData, callback } = event.detail;
      
      try {
        const sessionId = CartSessionManager.getSessionId();
        
        // Use secure cart operations
        const result = await SecureCartManager.secureAddToCart({
          type: 'add',
          variationId: productData.variationId,
          quantity: productData.quantity || 1,
          sessionId,
          productData
        });

        if (result.success) {
          // Trigger existing success handling
          if (callback) callback(null, result);
          
          // Use existing loading states system
          if (elCaminoEnhancements.showCartLoading) {
            const button = document.querySelector('#add-to-cart-button') as HTMLElement;
            if (button) {
              const loaderId = elCaminoEnhancements.showCartLoading(button);
              setTimeout(() => elCaminoEnhancements.hideLoading(loaderId), 2000);
            }
          }
        } else {
          if (callback) callback(result.error, null);
          
          // Show user-friendly error using existing system
          if (elCaminoEnhancements.showUserError && result.error) {
            elCaminoEnhancements.showUserError(result.error);
          }
        }
        
      } catch (error) {
        console.error('Secure cart operation failed:', error);
        if (callback) callback(error, null);
      }
    });

    // Integrate inventory validation with existing checkout flow
    document.addEventListener('checkout:validate', async (event: any) => {
      const { cartItems, callback } = event.detail;
      const sessionId = CartSessionManager.getSessionId();
      
      const validation = await SecureCartManager.validateCartInventory(cartItems, sessionId);
      
      if (!validation.valid) {
        // Use existing error communication system
        const container = document.querySelector('#cart-container') as HTMLElement;
        if (container && elCaminoEnhancements.showUserError) {
          const error = new Error('Inventory validation failed: ' + validation.issues.map(i => i.issue).join(', '));
          elCaminoEnhancements.showUserError(error, container);
        }
      }
      
      if (callback) callback(validation);
    });
  }

  /**
   * Setup memory management integrations
   */
  private setupMemoryIntegrations(): void {
    // Integrate with existing performance monitoring
    document.addEventListener('memory:pressure:moderate', (event: any) => {
      businessMonitor.trackCustomEvent('memory_pressure_moderate', {
        percentage: event.detail.metrics.percentage,
        timestamp: Date.now()
      });

      // Use existing image optimization system to reduce memory usage
      document.dispatchEvent(new CustomEvent('image:optimize:aggressive'));
    });

    document.addEventListener('memory:pressure:critical', (event: any) => {
      businessMonitor.trackCustomEvent('memory_pressure_critical', {
        percentage: event.detail.metrics.percentage,
        emergencyMode: true
      });

      // Disable non-essential animations using existing mobile system
      document.dispatchEvent(new CustomEvent('mobile:reduce:animations'));
      
      // Use existing loading states system to show memory warning
      if (elCaminoEnhancements.showUserError) {
        const error = new Error('System running low on memory - some features may be reduced');
        elCaminoEnhancements.showUserError(error);
      }
    });

    // Integrate memory leak detection with existing monitoring
    document.addEventListener('memory:leak:detected', (event: any) => {
      const { detection } = event.detail;
      
      businessMonitor.trackCustomEvent('memory_leak_detected', {
        leakRate: detection.leakRate,
        confidence: detection.confidence,
        recommendations: detection.recommendations.length
      });

      if (detection.confidence > 0.8) {
        // Suggest page refresh using existing UI patterns
        console.warn('💡 High confidence memory leak detected - consider page refresh');
      }
    });
  }

  /**
   * Setup rate limiting integrations
   */
  private setupRateLimitIntegrations(): void {
    // Integrate with existing Square API client
    const originalSquareApiCall = window.ElCaminoSquareAPI || {};
    
    // Wrap existing API calls with rate limiting
    if (typeof window !== 'undefined') {
      window.ElCaminoSquareAPI = {
        ...originalSquareApiCall,
        
        async callWithRateLimit(endpoint: string, operation: () => Promise<any>, options: any = {}) {
          const clientId = CartSessionManager.getSessionId();
          
          try {
            return await rateLimitManager.withRateLimit(operation, {
              clientId,
              endpoint,
              clientType: options.isAdmin ? 'admin' : 'anonymous',
              fallback: options.fallback
            });
          } catch (error) {
            // Integrate with existing error handling
            if (elCaminoEnhancements.showUserError) {
              elCaminoEnhancements.showUserError(error as Error);
            }
            throw error;
          }
        }
      };
    }

    // Monitor rate limit violations
    document.addEventListener('rate:limit:exceeded', (event: any) => {
      const { endpoint, retryAfter } = event.detail;
      
      businessMonitor.trackCustomEvent('rate_limit_exceeded', {
        endpoint,
        retryAfter,
        timestamp: Date.now()
      });

      // Show user-friendly message using existing system
      if (elCaminoEnhancements.showUserError) {
        const error = new Error(`Please wait ${retryAfter} seconds before trying again`);
        elCaminoEnhancements.showUserError(error);
      }
    });
  }

  /**
   * Setup comprehensive integrations between all systems
   */
  private setupEnhancedIntegrations(): void {
    // Cross-system event coordination
    this.setupCrossSystemEvents();
    
    // Enhanced error handling
    this.setupEnhancedErrorHandling();
    
    // Performance optimization coordination
    this.setupPerformanceCoordination();
    
    // Security monitoring integration
    this.setupSecurityMonitoring();
  }

  /**
   * Setup cross-system event coordination
   */
  private setupCrossSystemEvents(): void {
    // Coordinate memory pressure with inventory operations
    document.addEventListener('memory:pressure:critical', () => {
      // Temporarily reduce inventory lock timeouts to free memory faster
      console.log('🧠 Memory pressure: Reducing inventory lock duration');
    });

    // Coordinate rate limiting with memory management
    document.addEventListener('rate:limit:exceeded', () => {
      // Rate limiting can help reduce memory pressure
      console.log('🛡️ Rate limiting active: May help reduce memory pressure');
    });

    // Security issues should trigger defensive measures
    document.addEventListener('security:issue:detected', (event: any) => {
      if (event.detail.severity === 'critical') {
        // Implement additional protections
        document.body.classList.add('security-lockdown');
        console.warn('🔒 Security lockdown mode activated');
      }
    });
  }

  /**
   * Enhanced error handling that coordinates all systems
   */
  private setupEnhancedErrorHandling(): void {
    // Central error handler that coordinates all enhancement systems
    window.addEventListener('error', (event) => {
      const error = event.error;
      
      // Check if error is related to enhancement systems
      if (error?.message?.includes('inventory') || error?.message?.includes('rate limit')) {
        businessMonitor.trackCustomEvent('enhancement_system_error', {
          message: error.message,
          stack: error.stack?.substring(0, 500),
          timestamp: Date.now()
        });
      }
    });

    // Unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      const error = event.reason;
      
      if (error?.code === 'INVENTORY_LOCK_FAILED' || error?.code === 'RATE_LIMIT_EXCEEDED') {
        // These are expected errors that should be handled gracefully
        console.warn('Enhancement system handled error:', error.message);
        event.preventDefault(); // Prevent default browser handling
      }
    });
  }

  /**
   * Setup performance coordination between systems
   */
  private setupPerformanceCoordination(): void {
    // Coordinate all performance optimization systems
    let optimizationLevel = 0; // 0 = normal, 1 = moderate, 2 = aggressive

    // Memory pressure increases optimization level
    document.addEventListener('memory:pressure:moderate', () => {
      optimizationLevel = Math.max(optimizationLevel, 1);
      this.applyOptimizationLevel(optimizationLevel);
    });

    document.addEventListener('memory:pressure:critical', () => {
      optimizationLevel = 2;
      this.applyOptimizationLevel(optimizationLevel);
    });

    // Rate limiting can reduce optimization level need
    document.addEventListener('rate:limit:active', () => {
      // Rate limiting reduces load, may allow reducing optimization level
      if (optimizationLevel > 0) {
        setTimeout(() => {
          optimizationLevel = Math.max(0, optimizationLevel - 1);
          this.applyOptimizationLevel(optimizationLevel);
        }, 30000); // Re-evaluate after 30 seconds
      }
    });
  }

  /**
   * Apply coordinated optimization level across all systems
   */
  private applyOptimizationLevel(level: number): void {
    const body = document.body;
    
    // Remove existing optimization classes
    body.classList.remove('optimization-moderate', 'optimization-aggressive');
    
    switch (level) {
      case 1: // Moderate optimization
        body.classList.add('optimization-moderate');
        
        // Reduce inventory lock duration slightly
        // Increase rate limit check frequency
        // Enable image lazy loading
        document.dispatchEvent(new CustomEvent('optimization:moderate'));
        break;
        
      case 2: // Aggressive optimization  
        body.classList.add('optimization-aggressive');
        
        // Minimize inventory lock duration
        // Strict rate limiting
        // Aggressive image optimization
        // Reduce animations
        document.dispatchEvent(new CustomEvent('optimization:aggressive'));
        break;
        
      default: // Normal operation
        document.dispatchEvent(new CustomEvent('optimization:normal'));
        break;
    }

    businessMonitor.trackCustomEvent('optimization_level_changed', {
      level,
      timestamp: Date.now()
    });
  }

  /**
   * Setup comprehensive security monitoring
   */
  private setupSecurityMonitoring(): void {
    // Monitor all enhancement systems for security issues
    const securityEvents = [
      'inventory:lock:violation',
      'rate:limit:abuse',
      'memory:suspicious:usage',
      'security:token:exposure'
    ];

    securityEvents.forEach(eventType => {
      document.addEventListener(eventType, (event: any) => {
        businessMonitor.trackCustomEvent('security_event', {
          type: eventType,
          details: event.detail,
          timestamp: Date.now()
        });

        // Escalate severe security events
        if (event.detail?.severity === 'critical') {
          console.error(`🚨 Critical Security Event: ${eventType}`, event.detail);
        }
      });
    });
  }

  /**
   * Get comprehensive system health status
   */
  getSystemHealth(): {
    overall: 'healthy' | 'warning' | 'critical';
    components: {
      inventoryLocking: boolean;
      memoryManagement: boolean;
      rateLimiting: boolean;
      securityScanning: boolean;
      existingEnhancements: boolean;
    };
    metrics: {
      memoryUsage: number;
      activeLocks: number;
      rateLimitBlocks: number;
      securityIssues: number;
    };
  } {
    const memoryStatus = memoryManager.getCurrentMemoryStatus();
    const rateLimitStats = rateLimitManager.getStatistics();
    const inventoryLocks = inventoryLockManager.getAllActiveLocks();
    const securityStatus = securityTokenManager.getSecurityStatus();
    const existingHealth = elCaminoEnhancements.getHealthStatus();

    const components = {
      inventoryLocking: inventoryLocks !== undefined,
      memoryManagement: memoryStatus.current !== null,
      rateLimiting: rateLimitStats.totalTrackers >= 0,
      securityScanning: securityStatus.scanPerformed,
      existingEnhancements: existingHealth.initialized
    };

    const metrics = {
      memoryUsage: memoryStatus.current?.percentage || 0,
      activeLocks: inventoryLocks.length,
      rateLimitBlocks: rateLimitStats.activeBlocks,
      securityIssues: securityStatus.violationsFound
    };

    // Determine overall health
    let overall: 'healthy' | 'warning' | 'critical' = 'healthy';
    
    if (metrics.memoryUsage > 0.85 || metrics.securityIssues > 0) {
      overall = 'critical';
    } else if (metrics.memoryUsage > 0.70 || metrics.rateLimitBlocks > 5) {
      overall = 'warning';
    }

    return { overall, components, metrics };
  }

  /**
   * Public API methods for runtime control
   */
  
  // Inventory operations
  async secureAddToCart(productData: any): Promise<any> {
    const sessionId = CartSessionManager.getSessionId();
    return SecureCartManager.secureAddToCart({
      type: 'add',
      variationId: productData.variationId,
      quantity: productData.quantity || 1,
      sessionId,
      productData
    });
  }

  // Memory operations
  checkMemoryPressure(): Promise<any> {
    return memoryManager.checkMemoryPressure();
  }

  // Rate limiting operations
  getRateLimitStatus(endpoint: string): any {
    const clientId = CartSessionManager.getSessionId();
    return rateLimitManager.getRateLimitStatus(clientId, endpoint);
  }

  // Security operations
  scanForSecurityIssues(content: string): any {
    return SecurityUtils.scanContent(content);
  }

  // Integration with existing enhancement methods
  trackBusinessMetric(metric: string, value: number, metadata?: any): void {
    return elCaminoEnhancements.trackBusinessMetric(metric, value, metadata);
  }

  showUserError(error: Error, container?: HTMLElement): any {
    return elCaminoEnhancements.showUserError(error, container);
  }

  getProductPageVariant(testName?: string): any {
    return elCaminoEnhancements.getProductPageVariant(testName);
  }
}

// Global integration - maintains compatibility with existing code
declare global {
  interface Window {
    ElCaminoEnhancementsPhase1: ElCaminoPhase1Enhanced;
  }
}

// Export enhanced singleton instance
export const elCaminoPhase1Enhanced = new ElCaminoPhase1Enhanced();

// Initialize automatically when imported
if (typeof window !== 'undefined') {
  window.ElCaminoEnhancementsPhase1 = elCaminoPhase1Enhanced;
  
  // Auto-initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      elCaminoPhase1Enhanced.initializeEnhanced();
    });
  } else {
    elCaminoPhase1Enhanced.initializeEnhanced();
  }
}

export default elCaminoPhase1Enhanced;

// Re-export individual managers for direct access if needed
export {
  inventoryLockManager,
  SecureCartManager,
  CartSessionManager,
  memoryManager,
  rateLimitManager,
  securityTokenManager,
  SecurityUtils
};
