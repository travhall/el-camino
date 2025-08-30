/**
 * El Camino Enhanced: Cart Integration with Inventory Locking
 * Seamlessly integrates inventory protection with existing cart system
 */

import { inventoryLockManager, withInventoryLock } from './inventoryLock';
import { processSquareError, AppError, createError, ErrorType } from '../errorUtils';
import { businessMonitor } from '../../monitoring/businessMonitor';

interface CartItem {
  variationId: string;
  quantity: number;
  productId: string;
  title: string;
  price: number;
}

interface SecureCartOperation {
  type: 'add' | 'update' | 'remove';
  variationId: string;
  quantity: number;
  sessionId: string;
  productData?: CartItem;
}

interface CartSecurityResult {
  success: boolean;
  protected: boolean;
  message?: string;
  error?: AppError;
}

/**
 * Enhanced cart operations with inventory protection
 * Integrates with existing El Camino cart system while preventing overselling
 */
export class SecureCartManager {
  
  /**
   * Add item to cart with inventory protection
   */
  static async secureAddToCart(operation: SecureCartOperation): Promise<CartSecurityResult> {
    const { variationId, quantity, sessionId, productData } = operation;

    try {
      // Use inventory lock protection wrapper
      await withInventoryLock(
        { variationId, quantity, sessionId },
        async (lock) => {
          // Execute existing add to cart logic with lock protection
          await this.executeAddToCart(productData!, lock.sessionId);
          
          businessMonitor.trackCustomEvent('secure_cart_add_success', {
            variationId,
            quantity,
            sessionId,
            lockDuration: lock.expiresAt - Date.now()
          });

          return true;
        }
      );

      return { 
        success: true, 
        protected: true,
        message: 'Item securely added to cart with inventory protection'
      };

    } catch (error) {
      const appError = processSquareError(error, 'secureAddToCart');
      
      businessMonitor.trackCustomEvent('secure_cart_add_failed', {
        variationId,
        quantity,
        sessionId,
        error: appError.message
      });

      return { 
        success: false, 
        protected: true,
        error: appError
      };
    }
  }

  /**
   * Update cart item quantity with inventory revalidation
   */
  static async secureUpdateCartItem(operation: SecureCartOperation): Promise<CartSecurityResult> {
    const { variationId, quantity, sessionId } = operation;

    try {
      // Check current lock and update if needed
      const validation = inventoryLockManager.validateLock(variationId, sessionId, quantity);
      
      if (!validation.isValid) {
        // Need new lock for updated quantity
        const lockResult = await inventoryLockManager.acquireLock(variationId, quantity, sessionId);
        
        if (!lockResult.success) {
          return {
            success: false,
            protected: true,
            error: lockResult.error || createError(ErrorType.API_RESPONSE_ERROR, 'Cannot secure inventory for update', { source: 'cartUpdate' })
          };
        }
      }

      // Execute cart update with protection
      await this.executeCartUpdate(variationId, quantity, sessionId);

      businessMonitor.trackCustomEvent('secure_cart_update_success', {
        variationId,
        newQuantity: quantity,
        sessionId
      });

      return { 
        success: true, 
        protected: true,
        message: 'Cart updated with continued inventory protection'
      };

    } catch (error) {
      const appError = processSquareError(error, 'secureUpdateCartItem');
      
      // Release lock on failure
      inventoryLockManager.releaseLock(variationId, sessionId);
      
      return { 
        success: false, 
        protected: true,
        error: appError
      };
    }
  }

  /**
   * Remove item and release inventory lock
   */
  static async secureRemoveFromCart(operation: SecureCartOperation): Promise<CartSecurityResult> {
    const { variationId, sessionId } = operation;

    try {
      // Execute cart removal
      await this.executeCartRemoval(variationId, sessionId);
      
      // Release inventory lock
      inventoryLockManager.releaseLock(variationId, sessionId);

      businessMonitor.trackCustomEvent('secure_cart_remove_success', {
        variationId,
        sessionId
      });

      return { 
        success: true, 
        protected: true,
        message: 'Item removed and inventory lock released'
      };

    } catch (error) {
      const appError = processSquareError(error, 'secureRemoveFromCart');
      
      // Still release lock even on error
      inventoryLockManager.releaseLock(variationId, sessionId);
      
      return { 
        success: false, 
        protected: true,
        error: appError
      };
    }
  }

  /**
   * Validate entire cart before checkout
   */
  static async validateCartInventory(cartItems: CartItem[], sessionId: string): Promise<{
    valid: boolean;
    issues: Array<{ variationId: string; issue: string; availableQuantity?: number }>;
  }> {
    const issues: Array<{ variationId: string; issue: string; availableQuantity?: number }> = [];

    for (const item of cartItems) {
      const validation = inventoryLockManager.validateLock(
        item.variationId, 
        sessionId, 
        item.quantity
      );

      if (!validation.isValid) {
        let issue = 'Unknown validation issue';
        
        switch (validation.reason) {
          case 'expired':
            issue = 'Inventory reservation expired';
            break;
          case 'not_found':
            issue = 'No inventory reservation found';
            break;
          case 'insufficient_inventory':
            issue = 'Insufficient inventory available';
            // Try to get current available quantity
            try {
              const { checkItemInventory } = await import('../inventory');
              const available = await checkItemInventory(item.variationId);
              issues.push({ 
                variationId: item.variationId, 
                issue, 
                availableQuantity: available 
              });
              continue;
            } catch (err) {
              // Fall through to generic issue
            }
            break;
        }
        
        issues.push({ variationId: item.variationId, issue });
      }
    }

    businessMonitor.trackCustomEvent('cart_validation_completed', {
      sessionId,
      totalItems: cartItems.length,
      issuesFound: issues.length,
      valid: issues.length === 0
    });

    return {
      valid: issues.length === 0,
      issues
    };
  }

  /**
   * Confirm all cart locks during checkout completion
   */
  static confirmCartLocks(cartItems: CartItem[], sessionId: string): void {
    let confirmedCount = 0;
    
    for (const item of cartItems) {
      if (inventoryLockManager.confirmLock(item.variationId, sessionId)) {
        confirmedCount++;
      }
    }

    businessMonitor.trackCustomEvent('cart_locks_confirmed', {
      sessionId,
      totalItems: cartItems.length,
      confirmedLocks: confirmedCount
    });
  }

  /**
   * Release all cart locks (on checkout cancellation/failure)
   */
  static releaseCartLocks(cartItems: CartItem[], sessionId: string): void {
    let releasedCount = 0;
    
    for (const item of cartItems) {
      if (inventoryLockManager.releaseLock(item.variationId, sessionId)) {
        releasedCount++;
      }
    }

    businessMonitor.trackCustomEvent('cart_locks_released', {
      sessionId,
      totalItems: cartItems.length,
      releasedLocks: releasedCount
    });
  }

  // Private helper methods that integrate with existing cart system
  
  private static async executeAddToCart(productData: CartItem, sessionId: string): Promise<void> {
    // Integration point: Call existing cart addition logic
    // This would integrate with existing El Camino cart system
    
    // Simulate cart operation (replace with actual cart integration)
    if (typeof window !== 'undefined') {
      // Dispatch custom event for existing cart system to handle
      window.dispatchEvent(new CustomEvent('secure:cart:add', {
        detail: { productData, sessionId }
      }));
    }
  }

  private static async executeCartUpdate(variationId: string, quantity: number, sessionId: string): Promise<void> {
    // Integration point: Call existing cart update logic
    
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('secure:cart:update', {
        detail: { variationId, quantity, sessionId }
      }));
    }
  }

  private static async executeCartRemoval(variationId: string, sessionId: string): Promise<void> {
    // Integration point: Call existing cart removal logic
    
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('secure:cart:remove', {
        detail: { variationId, sessionId }
      }));
    }
  }
}

/**
 * Session management for inventory locks
 */
export class CartSessionManager {
  private static readonly SESSION_KEY = 'el-camino-cart-session';
  
  /**
   * Get or create cart session ID
   */
  static getSessionId(): string {
    if (typeof window === 'undefined') {
      return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    let sessionId = sessionStorage.getItem(this.SESSION_KEY);
    
    if (!sessionId) {
      sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem(this.SESSION_KEY, sessionId);
    }

    return sessionId;
  }

  /**
   * Clear session (on checkout completion or explicit logout)
   */
  static clearSession(): void {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(this.SESSION_KEY);
    }
  }

  /**
   * Extend session expiry
   */
  static touchSession(): void {
    if (typeof window !== 'undefined') {
      const sessionId = this.getSessionId();
      sessionStorage.setItem(this.SESSION_KEY, sessionId);
    }
  }
}

// Export integration helpers for existing cart components
export { inventoryLockManager };
export type { CartSecurityResult, SecureCartOperation };
