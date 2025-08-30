/**
 * El Camino Enhanced: Rate Limiting System
 * Protects Square API and prevents abuse - integrates with existing request architecture
 */

import { processSquareError, logError, AppError } from '../errorUtils';
import { businessMonitor } from '../../monitoring/businessMonitor';
import { requestDeduplicator } from '../requestDeduplication';

interface RateLimit {
  requests: number;
  windowMs: number;
  maxRequests: number;
  blockDurationMs?: number;
}

interface RateLimitTracker {
  requests: Array<{ timestamp: number; endpoint: string; clientId: string }>;
  violations: number;
  blockedUntil?: number;
  firstRequest?: number;
}

interface RateLimitConfig {
  // Per-client limits
  clientLimits: {
    anonymous: RateLimit;
    authenticated: RateLimit;
    admin: RateLimit;
  };
  // Per-endpoint limits
  endpointLimits: Record<string, RateLimit>;
  // Global protection
  globalLimit: RateLimit;
  // Violation handling
  violationThresholds: {
    warning: number;
    temporary_block: number;
    extended_block: number;
  };
}

class RateLimitManager {
  private readonly config: RateLimitConfig = {
    clientLimits: {
      anonymous: {
        requests: 0,
        windowMs: 60000, // 1 minute
        maxRequests: 60, // 60 requests per minute
        blockDurationMs: 5 * 60000 // 5 minutes
      },
      authenticated: {
        requests: 0,
        windowMs: 60000,
        maxRequests: 120, // Higher limit for authenticated users
        blockDurationMs: 2 * 60000 // 2 minutes
      },
      admin: {
        requests: 0,
        windowMs: 60000,
        maxRequests: 300, // Much higher for admin operations
        blockDurationMs: 60000 // 1 minute
      }
    },
    endpointLimits: {
      // Inventory checking - frequent but should be limited
      '/inventory': {
        requests: 0,
        windowMs: 60000,
        maxRequests: 100,
        blockDurationMs: 2 * 60000
      },
      // Cart operations - moderate limits
      '/cart': {
        requests: 0,
        windowMs: 60000,
        maxRequests: 30,
        blockDurationMs: 5 * 60000
      },
      // Product fetching - higher limits
      '/products': {
        requests: 0,
        windowMs: 60000,
        maxRequests: 200,
        blockDurationMs: 60000
      },
      // Checkout - strict limits
      '/checkout': {
        requests: 0,
        windowMs: 300000, // 5 minutes
        maxRequests: 5, // Only 5 checkout attempts per 5 minutes
        blockDurationMs: 15 * 60000 // 15 minutes
      }
    },
    globalLimit: {
      requests: 0,
      windowMs: 60000,
      maxRequests: 500, // Global protection
      blockDurationMs: 10 * 60000
    },
    violationThresholds: {
      warning: 3,
      temporary_block: 5,
      extended_block: 10
    }
  };

  private trackers = new Map<string, RateLimitTracker>();
  private readonly cleanupInterval = 5 * 60000; // 5 minutes
  private cleanupTimer?: NodeJS.Timeout;

  constructor() {
    this.startCleanupTimer();
  }

  /**
   * Check if request is allowed under rate limits
   * Integrates with existing El Camino request architecture
   */
  async checkRateLimit(
    clientId: string,
    endpoint: string,
    clientType: 'anonymous' | 'authenticated' | 'admin' = 'anonymous'
  ): Promise<{ allowed: boolean; reason?: string; retryAfter?: number }> {
    try {
      const now = Date.now();
      const trackerId = `${clientId}:${endpoint}`;

      // Get or create tracker
      let tracker = this.trackers.get(trackerId);
      if (!tracker) {
        tracker = {
          requests: [],
          violations: 0
        };
        this.trackers.set(trackerId, tracker);
      }

      // Check if currently blocked
      if (tracker.blockedUntil && now < tracker.blockedUntil) {
        const retryAfter = Math.ceil((tracker.blockedUntil - now) / 1000);
        
        businessMonitor.trackCustomEvent('rate_limit_blocked_request', {
          clientId,
          endpoint,
          clientType,
          retryAfter
        });

        return {
          allowed: false,
          reason: 'Rate limit exceeded - client blocked',
          retryAfter
        };
      }

      // Clear block if expired
      if (tracker.blockedUntil && now >= tracker.blockedUntil) {
        tracker.blockedUntil = undefined;
      }

      // Check multiple rate limit layers
      const limitChecks = [
        await this.checkClientLimit(clientId, clientType, tracker, now),
        await this.checkEndpointLimit(endpoint, tracker, now),
        await this.checkGlobalLimit(tracker, now)
      ];

      // Find the most restrictive limit
      const violation = limitChecks.find(check => !check.allowed);
      
      if (violation) {
        await this.handleViolation(clientId, endpoint, clientType, tracker);
        return violation;
      }

      // All checks passed - record the request
      tracker.requests.push({
        timestamp: now,
        endpoint,
        clientId
      });

      if (!tracker.firstRequest) {
        tracker.firstRequest = now;
      }

      // Clean old requests
      this.cleanupOldRequests(tracker, now);

      businessMonitor.trackCustomEvent('rate_limit_request_allowed', {
        clientId,
        endpoint,
        clientType,
        totalRequests: tracker.requests.length
      });

      return { allowed: true };

    } catch (error) {
      const appError = processSquareError(error, 'checkRateLimit');
      logError(appError);
      
      // Fail open for errors to maintain service availability
      return { allowed: true };
    }
  }

  /**
   * Check client-specific rate limits
   */
  private async checkClientLimit(
    clientId: string,
    clientType: 'anonymous' | 'authenticated' | 'admin',
    tracker: RateLimitTracker,
    now: number
  ): Promise<{ allowed: boolean; reason?: string; retryAfter?: number }> {
    const limit = this.config.clientLimits[clientType];
    const windowStart = now - limit.windowMs;
    
    const requestsInWindow = tracker.requests.filter(
      req => req.timestamp > windowStart
    ).length;

    if (requestsInWindow >= limit.maxRequests) {
      const retryAfter = Math.ceil(limit.windowMs / 1000);
      
      return {
        allowed: false,
        reason: `Client rate limit exceeded (${clientType})`,
        retryAfter
      };
    }

    return { allowed: true };
  }

  /**
   * Check endpoint-specific rate limits
   */
  private async checkEndpointLimit(
    endpoint: string,
    tracker: RateLimitTracker,
    now: number
  ): Promise<{ allowed: boolean; reason?: string; retryAfter?: number }> {
    const limit = this.config.endpointLimits[endpoint];
    if (!limit) return { allowed: true };

    const windowStart = now - limit.windowMs;
    
    const requestsInWindow = tracker.requests.filter(
      req => req.timestamp > windowStart && req.endpoint === endpoint
    ).length;

    if (requestsInWindow >= limit.maxRequests) {
      const retryAfter = Math.ceil(limit.windowMs / 1000);
      
      return {
        allowed: false,
        reason: `Endpoint rate limit exceeded (${endpoint})`,
        retryAfter
      };
    }

    return { allowed: true };
  }

  /**
   * Check global rate limits
   */
  private async checkGlobalLimit(
    tracker: RateLimitTracker,
    now: number
  ): Promise<{ allowed: boolean; reason?: string; retryAfter?: number }> {
    const limit = this.config.globalLimit;
    const windowStart = now - limit.windowMs;
    
    // Count all requests across all trackers in the window
    let globalRequestsInWindow = 0;
    for (const otherTracker of this.trackers.values()) {
      globalRequestsInWindow += otherTracker.requests.filter(
        req => req.timestamp > windowStart
      ).length;
    }

    if (globalRequestsInWindow >= limit.maxRequests) {
      const retryAfter = Math.ceil(limit.windowMs / 1000);
      
      return {
        allowed: false,
        reason: 'Global rate limit exceeded',
        retryAfter
      };
    }

    return { allowed: true };
  }

  /**
   * Handle rate limit violations
   */
  private async handleViolation(
    clientId: string,
    endpoint: string,
    clientType: string,
    tracker: RateLimitTracker
  ): Promise<void> {
    tracker.violations++;
    const violations = tracker.violations;

    let blockDuration = 0;
    let severityLevel = 'warning';

    if (violations >= this.config.violationThresholds.extended_block) {
      blockDuration = 30 * 60000; // 30 minutes
      severityLevel = 'extended_block';
    } else if (violations >= this.config.violationThresholds.temporary_block) {
      blockDuration = 10 * 60000; // 10 minutes
      severityLevel = 'temporary_block';
    } else if (violations >= this.config.violationThresholds.warning) {
      blockDuration = 2 * 60000; // 2 minutes
      severityLevel = 'warning_block';
    }

    if (blockDuration > 0) {
      tracker.blockedUntil = Date.now() + blockDuration;
    }

    businessMonitor.trackCustomEvent('rate_limit_violation', {
      clientId,
      endpoint,
      clientType,
      violations,
      severityLevel,
      blockDuration: blockDuration / 1000 / 60, // in minutes
      blockedUntil: tracker.blockedUntil
    });

    // Escalate severe violations
    if (severityLevel === 'extended_block') {
      console.warn(`🚨 Extended rate limit block for client ${clientId} on ${endpoint}`);
      
      // Consider additional protective measures
      this.triggerSecurityAlert(clientId, endpoint, violations);
    }
  }

  /**
   * Integration with existing Square API client
   * Wraps API calls with rate limit protection
   */
  async withRateLimit<T>(
    operation: () => Promise<T>,
    options: {
      clientId: string;
      endpoint: string;
      clientType?: 'anonymous' | 'authenticated' | 'admin';
      fallback?: () => Promise<T>;
    }
  ): Promise<T> {
    const { clientId, endpoint, clientType = 'anonymous', fallback } = options;

    // Check rate limits first
    const rateLimitCheck = await this.checkRateLimit(clientId, endpoint, clientType);

    if (!rateLimitCheck.allowed) {
      // Rate limited - handle based on endpoint criticality
      if (fallback) {
        businessMonitor.trackCustomEvent('rate_limit_fallback_used', {
          clientId,
          endpoint,
          reason: rateLimitCheck.reason
        });
        
        return await fallback();
      }

      // No fallback - throw rate limit error
      throw new AppError(
        rateLimitCheck.reason || 'Rate limit exceeded',
        'RATE_LIMIT_EXCEEDED',
        {
          endpoint,
          retryAfter: rateLimitCheck.retryAfter,
          clientId: clientId.substring(0, 8) // Partial for privacy
        }
      );
    }

    // Execute the operation
    try {
      return await operation();
    } catch (error) {
      // Don't count failed requests against rate limits for server errors
      if (error && typeof error === 'object' && 'type' in error && 
          typeof (error as AppError).type === 'string' && 
          (error as AppError).type.includes('API_')) {
        // Remove the request from tracking
        const trackerId = `${clientId}:${endpoint}`;
        const tracker = this.trackers.get(trackerId);
        if (tracker && tracker.requests.length > 0) {
          tracker.requests.pop(); // Remove the last request
        }
      }
      throw error;
    }
  }

  /**
   * Get rate limit status for a client
   */
  getRateLimitStatus(clientId: string, endpoint?: string): {
    remaining: number;
    resetTime: number;
    isBlocked: boolean;
    violations: number;
  } {
    const trackerId = endpoint ? `${clientId}:${endpoint}` : clientId;
    const tracker = this.trackers.get(trackerId);

    if (!tracker) {
      return {
        remaining: this.config.clientLimits.anonymous.maxRequests,
        resetTime: Date.now() + this.config.clientLimits.anonymous.windowMs,
        isBlocked: false,
        violations: 0
      };
    }

    const now = Date.now();
    const isBlocked = tracker.blockedUntil ? now < tracker.blockedUntil : false;
    
    // Calculate remaining requests in current window
    const windowStart = now - this.config.clientLimits.anonymous.windowMs;
    const requestsInWindow = tracker.requests.filter(
      req => req.timestamp > windowStart
    ).length;
    
    const remaining = Math.max(0, this.config.clientLimits.anonymous.maxRequests - requestsInWindow);
    const resetTime = windowStart + this.config.clientLimits.anonymous.windowMs;

    return {
      remaining,
      resetTime,
      isBlocked,
      violations: tracker.violations
    };
  }

  /**
   * Clean up old request records
   */
  private cleanupOldRequests(tracker: RateLimitTracker, now: number): void {
    const oldestAllowed = now - Math.max(
      this.config.clientLimits.anonymous.windowMs,
      this.config.globalLimit.windowMs
    );

    tracker.requests = tracker.requests.filter(
      req => req.timestamp > oldestAllowed
    );
  }

  /**
   * Start cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.performCleanup();
    }, this.cleanupInterval);
  }

  /**
   * Perform periodic cleanup
   */
  private performCleanup(): void {
    const now = Date.now();
    const trackersBefore = this.trackers.size;
    
    for (const [trackerId, tracker] of this.trackers.entries()) {
      // Clean old requests
      this.cleanupOldRequests(tracker, now);
      
      // Remove empty trackers that haven't been used recently
      const lastRequest = Math.max(...tracker.requests.map(r => r.timestamp), 0);
      const isStale = now - lastRequest > 30 * 60000; // 30 minutes
      
      if (tracker.requests.length === 0 && isStale && !tracker.blockedUntil) {
        this.trackers.delete(trackerId);
      }
    }

    const cleaned = trackersBefore - this.trackers.size;
    if (cleaned > 0) {
      console.log(`🧹 Rate limiter cleaned up ${cleaned} stale trackers`);
    }
  }

  /**
   * Trigger security alert for severe violations
   */
  private triggerSecurityAlert(clientId: string, endpoint: string, violations: number): void {
    businessMonitor.trackCustomEvent('security_alert_rate_limit', {
      clientId: clientId.substring(0, 8), // Partial for privacy
      endpoint,
      violations,
      timestamp: Date.now(),
      alertLevel: 'high'
    });

    // In production, this might trigger additional security measures
    console.warn(`🚨 Security Alert: Client ${clientId.substring(0, 8)} has ${violations} rate limit violations on ${endpoint}`);
  }

  /**
   * Reset rate limits for a client (admin function)
   */
  resetClientLimits(clientId: string): boolean {
    let reset = false;
    
    for (const [trackerId, tracker] of this.trackers.entries()) {
      if (trackerId.startsWith(clientId)) {
        tracker.requests = [];
        tracker.violations = 0;
        tracker.blockedUntil = undefined;
        reset = true;
      }
    }

    if (reset) {
      businessMonitor.trackCustomEvent('rate_limit_reset', {
        clientId: clientId.substring(0, 8),
        timestamp: Date.now()
      });
    }

    return reset;
  }

  /**
   * Get overall rate limiting statistics
   */
  getStatistics(): {
    totalTrackers: number;
    activeBlocks: number;
    recentRequests: number;
    topEndpoints: Array<{ endpoint: string; requests: number }>;
  } {
    const now = Date.now();
    const recentWindow = now - 60000; // Last minute
    
    let activeBlocks = 0;
    let recentRequests = 0;
    const endpointCounts = new Map<string, number>();

    for (const tracker of this.trackers.values()) {
      if (tracker.blockedUntil && now < tracker.blockedUntil) {
        activeBlocks++;
      }

      for (const request of tracker.requests) {
        if (request.timestamp > recentWindow) {
          recentRequests++;
          
          const count = endpointCounts.get(request.endpoint) || 0;
          endpointCounts.set(request.endpoint, count + 1);
        }
      }
    }

    const topEndpoints = Array.from(endpointCounts.entries())
      .map(([endpoint, requests]) => ({ endpoint, requests }))
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 5);

    return {
      totalTrackers: this.trackers.size,
      activeBlocks,
      recentRequests,
      topEndpoints
    };
  }

  /**
   * Destroy and cleanup
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.trackers.clear();
  }
}

// Export singleton instance integrating with El Camino architecture
export const rateLimitManager = new RateLimitManager();

// Integration helper for existing Square API client
export async function withSquareRateLimit<T>(
  operation: () => Promise<T>,
  options: {
    endpoint: string;
    clientId?: string;
    clientType?: 'anonymous' | 'authenticated' | 'admin';
    fallback?: () => Promise<T>;
  }
): Promise<T> {
  const clientId = options.clientId || 'anonymous-client';
  
  return rateLimitManager.withRateLimit(operation, {
    ...options,
    clientId
  });
}

// Export types for integration
export type { RateLimit, RateLimitConfig, RateLimitTracker };
