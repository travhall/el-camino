/**
 * El Camino Enhanced: Inventory Locking System
 * Prevents race conditions during checkout - integrates with existing Square API architecture
 */

import { requestDeduplicator } from '../requestDeduplication';
import { inventoryCache } from '../cacheUtils';
import { processSquareError, logError, createError, ErrorType } from '../errorUtils';
import { businessMonitor } from '../../monitoring/businessMonitor';

interface InventoryLock {
  variationId: string;
  quantity: number;
  sessionId: string;
  timestamp: number;
  expiresAt: number;
  status: 'pending' | 'confirmed' | 'released' | 'expired';
}

interface LockAttemptResult {
  success: boolean;
  lock?: InventoryLock;
  availableQuantity?: number;
  error?: Error;
}

interface LockValidationResult {
  isValid: boolean;
  lock?: InventoryLock;
  reason?: 'expired' | 'not_found' | 'insufficient_inventory';
}

class InventoryLockManager {
  private locks = new Map<string, InventoryLock>();
  private readonly LOCK_DURATION = 10 * 60 * 1000; // 10 minutes
  private readonly CLEANUP_INTERVAL = 60 * 1000; // 1 minute
  private cleanupTimer?: NodeJS.Timeout;

  constructor() {
    this.startCleanupTimer();
  }

  /**
   * Attempt to acquire inventory lock for checkout
   * Integrates with existing inventory checking and caching systems
   */
  async acquireLock(
    variationId: string, 
    requestedQuantity: number, 
    sessionId: string
  ): Promise<LockAttemptResult> {
    const lockKey = `${variationId}:${sessionId}`;
    
    try {
      // Check for existing lock first
      const existingLock = this.locks.get(lockKey);
      if (existingLock && this.isLockValid(existingLock)) {
        // Extend existing valid lock
        existingLock.expiresAt = Date.now() + this.LOCK_DURATION;
        existingLock.quantity = Math.max(existingLock.quantity, requestedQuantity);
        
        businessMonitor.trackCustomEvent('inventory_lock_extended', {
          variationId,
          sessionId,
          quantity: existingLock.quantity
        });

        return { success: true, lock: existingLock };
      }

      // Get current inventory using existing inventory system
      const availableQuantity = await this.getCurrentInventory(variationId);
      const lockedQuantity = this.getLockedQuantity(variationId, sessionId);
      const actualAvailable = availableQuantity - lockedQuantity;

      if (actualAvailable < requestedQuantity) {
        businessMonitor.trackCustomEvent('inventory_lock_insufficient', {
          variationId,
          requestedQuantity,
          availableQuantity: actualAvailable,
          sessionId
        });

        return { 
          success: false, 
          availableQuantity: actualAvailable,
          error: new Error('Insufficient inventory for lock')
        };
      }

      // Create new lock
      const newLock: InventoryLock = {
        variationId,
        quantity: requestedQuantity,
        sessionId,
        timestamp: Date.now(),
        expiresAt: Date.now() + this.LOCK_DURATION,
        status: 'pending'
      };

      this.locks.set(lockKey, newLock);

      // Invalidate inventory cache to reflect locked quantities  
      inventoryCache.delete(variationId);

      businessMonitor.trackCustomEvent('inventory_lock_acquired', {
        variationId,
        sessionId,
        quantity: requestedQuantity,
        expiresAt: newLock.expiresAt
      });

      return { success: true, lock: newLock };

    } catch (error) {
      const appError = processSquareError(error, 'acquireLock');
      logError(appError);
      
      businessMonitor.trackCustomEvent('inventory_lock_error', {
        variationId,
        sessionId,
        error: appError.message
      });

      return { success: false, error: new Error(appError.message) };
    }
  }

  /**
   * Validate existing lock is still valid and sufficient
   */
  validateLock(variationId: string, sessionId: string, requiredQuantity: number): LockValidationResult {
    const lockKey = `${variationId}:${sessionId}`;
    const lock = this.locks.get(lockKey);

    if (!lock) {
      return { isValid: false, reason: 'not_found' };
    }

    if (!this.isLockValid(lock)) {
      return { isValid: false, reason: 'expired', lock };
    }

    if (lock.quantity < requiredQuantity) {
      return { isValid: false, reason: 'insufficient_inventory', lock };
    }

    return { isValid: true, lock };
  }

  /**
   * Confirm lock during successful purchase - prevents release
   */
  confirmLock(variationId: string, sessionId: string): boolean {
    const lockKey = `${variationId}:${sessionId}`;
    const lock = this.locks.get(lockKey);

    if (lock && this.isLockValid(lock)) {
      lock.status = 'confirmed';
      
      businessMonitor.trackCustomEvent('inventory_lock_confirmed', {
        variationId,
        sessionId,
        quantity: lock.quantity
      });

      return true;
    }

    return false;
  }

  /**
   * Release lock - makes inventory available again
   */
  releaseLock(variationId: string, sessionId: string): boolean {
    const lockKey = `${variationId}:${sessionId}`;
    const lock = this.locks.get(lockKey);

    if (lock) {
      lock.status = 'released';
      this.locks.delete(lockKey);
      
      // Invalidate cache so fresh inventory is fetched
      inventoryCache.delete(variationId);

      businessMonitor.trackCustomEvent('inventory_lock_released', {
        variationId,
        sessionId,
        quantity: lock.quantity,
        wasConfirmed: lock.status === 'released' // Fix comparison logic
      });

      return true;
    }

    return false;
  }

  /**
   * Get total locked quantity for a variation (excluding specific session)
   */
  private getLockedQuantity(variationId: string, excludeSessionId?: string): number {
    let totalLocked = 0;

    for (const lock of this.locks.values()) {
      if (lock.variationId === variationId && 
          lock.sessionId !== excludeSessionId && 
          this.isLockValid(lock)) {
        totalLocked += lock.quantity;
      }
    }

    return totalLocked;
  }

  /**
   * Get current inventory using existing El Camino inventory system
   */
  private async getCurrentInventory(variationId: string): Promise<number> {
    const cacheKey = `inventory_lock:${variationId}`;
    
    return requestDeduplicator.dedupe(cacheKey, async () => {
      // Use existing inventory checking system
      const { checkItemInventory } = await import('../inventory');
      return checkItemInventory(variationId);
    });
  }

  /**
   * Check if lock is still valid (not expired)
   */
  private isLockValid(lock: InventoryLock): boolean {
    return Date.now() < lock.expiresAt && lock.status !== 'released' && lock.status !== 'expired';
  }

  /**
   * Clean up expired locks periodically
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredLocks();
    }, this.CLEANUP_INTERVAL);
  }

  /**
   * Remove expired locks and invalidate caches
   */
  private cleanupExpiredLocks(): void {
    const now = Date.now();
    let cleanedCount = 0;
    const cleanedVariations = new Set<string>();

    for (const [key, lock] of this.locks.entries()) {
      if (now >= lock.expiresAt || lock.status === 'released') {
        lock.status = 'expired';
        this.locks.delete(key);
        cleanedVariations.add(lock.variationId);
        cleanedCount++;

        businessMonitor.trackCustomEvent('inventory_lock_expired', {
          variationId: lock.variationId,
          sessionId: lock.sessionId,
          quantity: lock.quantity
        });
      }
    }

    // Invalidate caches for cleaned variations
    for (const variationId of cleanedVariations) {
      inventoryCache.delete(variationId);
    }

    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} expired inventory locks`);
    }
  }

  /**
   * Get lock status for debugging/monitoring
   */
  getLockStatus(variationId: string, sessionId: string): InventoryLock | null {
    const lockKey = `${variationId}:${sessionId}`;
    return this.locks.get(lockKey) || null;
  }

  /**
   * Get all active locks for monitoring
   */
  getAllActiveLocks(): InventoryLock[] {
    return Array.from(this.locks.values()).filter(lock => this.isLockValid(lock));
  }

  /**
   * Cleanup on shutdown
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.locks.clear();
  }
}

// Export singleton instance - integrates with existing architecture pattern
export const inventoryLockManager = new InventoryLockManager();

// Integration helpers for existing cart and checkout systems
export interface LockProtectedOperation {
  variationId: string;
  quantity: number;
  sessionId: string;
}

/**
 * Wrapper for cart operations that require inventory protection
 */
export async function withInventoryLock<T>(
  operation: LockProtectedOperation,
  callback: (lock: InventoryLock) => Promise<T>
): Promise<T> {
  const { variationId, quantity, sessionId } = operation;

  // Acquire lock
  const lockResult = await inventoryLockManager.acquireLock(variationId, quantity, sessionId);
  
  if (!lockResult.success || !lockResult.lock) {
    throw lockResult.error || createError(ErrorType.API_RESPONSE_ERROR, 'Failed to acquire inventory lock', { source: 'withInventoryLock' });
  }

  try {
    // Execute protected operation
    const result = await callback(lockResult.lock);
    
    // Confirm lock on success
    inventoryLockManager.confirmLock(variationId, sessionId);
    
    return result;
    
  } catch (error) {
    // Release lock on failure
    inventoryLockManager.releaseLock(variationId, sessionId);
    throw error;
  }
}
