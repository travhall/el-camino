/**
 * Enhanced Error Handling with Circuit Breaker Pattern
 * Phase 1 Critical Foundation - API failure recovery mechanisms
 */

export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  monitoringWindow: number;
}

export enum CircuitState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // Failing fast
  HALF_OPEN = 'HALF_OPEN' // Testing recovery
}

export class APICircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private lastFailureTime = 0;
  private successCount = 0;
  
  constructor(
    private config: CircuitBreakerConfig = {
      failureThreshold: 5,
      recoveryTimeout: 30000, // 30 seconds
      monitoringWindow: 60000  // 1 minute
    }
  ) {}

  async execute<T>(operation: () => Promise<T>, fallback?: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (this.canAttemptReset()) {
        this.state = CircuitState.HALF_OPEN;
      } else {
        throw new APIError('Circuit breaker is OPEN', 'CIRCUIT_OPEN', fallback);
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      
      if (fallback) {
        try {
          return await fallback();
        } catch (fallbackError) {
          throw new APIError(
            `Primary and fallback failed: ${(error as Error).message}`,
            'COMPLETE_FAILURE'
          );
        }
      }
      
      throw error;
    }
  }

  private canAttemptReset(): boolean {
    return Date.now() - this.lastFailureTime >= this.config.recoveryTimeout;
  }

  private onSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= 3) {
        this.reset();
      }
    } else {
      this.failureCount = 0;
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.OPEN;
    } else if (this.failureCount >= this.config.failureThreshold) {
      this.state = CircuitState.OPEN;
    }
  }

  private reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
  }

  getState(): CircuitState {
    return this.state;
  }

  getMetrics() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
      successCount: this.successCount
    };
  }
}

export class APIError extends Error {
  constructor(
    message: string,
    public code: string,
    public fallback?: () => Promise<any>
  ) {
    super(message);
    this.name = 'APIError';
  }
}

/**
 * Enhanced error utilities with recovery strategies
 */
export class ErrorRecoveryManager {
  private circuitBreakers = new Map<string, APICircuitBreaker>();
  private retryStrategies = new Map<string, RetryConfig>();

  getCircuitBreaker(apiEndpoint: string): APICircuitBreaker {
    if (!this.circuitBreakers.has(apiEndpoint)) {
      this.circuitBreakers.set(apiEndpoint, new APICircuitBreaker());
    }
    return this.circuitBreakers.get(apiEndpoint)!;
  }

  async withRetry<T>(
    operation: () => Promise<T>,
    config: RetryConfig = { maxAttempts: 3, backoffMs: 1000 }
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === config.maxAttempts) break;
        
        // Exponential backoff
        const delay = config.backoffMs * Math.pow(2, attempt - 1);
        await this.sleep(delay);
      }
    }
    
    throw new APIError(
      `Operation failed after ${config.maxAttempts} attempts: ${lastError!.message}`,
      'RETRY_EXHAUSTED'
    );
  }

  async withFallback<T>(
    primary: () => Promise<T>,
    fallback: () => Promise<T>,
    description: string
  ): Promise<T> {
    try {
      return await primary();
    } catch (primaryError) {
      console.warn(`Primary operation failed (${description}), using fallback:`, primaryError);
      
      try {
        return await fallback();
      } catch (fallbackError) {
        throw new APIError(
          `Both primary and fallback failed for ${description}`,
          'COMPLETE_FAILURE'
        );
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Error categorization for better handling
  categorizeError(error: Error): ErrorCategory {
    const message = error.message.toLowerCase();
    
    if (message.includes('network') || message.includes('fetch')) {
      return 'NETWORK';
    }
    if (message.includes('timeout')) {
      return 'TIMEOUT';
    }
    if (message.includes('auth') || message.includes('unauthorized')) {
      return 'AUTH';
    }
    if (message.includes('rate limit') || message.includes('too many')) {
      return 'RATE_LIMIT';
    }
    if (message.includes('validation') || message.includes('invalid')) {
      return 'VALIDATION';
    }
    
    return 'UNKNOWN';
  }

  // User-friendly error messages
  getUserFriendlyMessage(error: Error): string {
    const category = this.categorizeError(error);
    
    switch (category) {
      case 'NETWORK':
        return 'Unable to connect to our services. Please check your internet connection and try again.';
      case 'TIMEOUT':
        return 'The request is taking longer than expected. Please try again in a moment.';
      case 'AUTH':
        return 'Authentication required. Please refresh the page and try again.';
      case 'RATE_LIMIT':
        return 'Too many requests. Please wait a moment before trying again.';
      case 'VALIDATION':
        return 'The information provided appears to be invalid. Please check your input.';
      default:
        return 'An unexpected error occurred. Our team has been notified and is working on a fix.';
    }
  }

  // Recovery guidance for users
  getRecoveryGuidance(error: Error): RecoveryGuidance {
    const category = this.categorizeError(error);
    
    const guidanceMap: Record<ErrorCategory, RecoveryGuidance> = {
      NETWORK: {
        primaryAction: 'Check your internet connection',
        secondaryActions: ['Try refreshing the page', 'Switch to mobile data if on WiFi'],
        canRetry: true,
        estimatedRecoveryTime: 30000
      },
      TIMEOUT: {
        primaryAction: 'Wait a moment and try again',
        secondaryActions: ['Check if other parts of the site are working'],
        canRetry: true,
        estimatedRecoveryTime: 15000
      },
      AUTH: {
        primaryAction: 'Refresh the page',
        secondaryActions: ['Clear browser cache', 'Try in an incognito window'],
        canRetry: true,
        estimatedRecoveryTime: 0
      },
      RATE_LIMIT: {
        primaryAction: 'Wait before trying again',
        secondaryActions: ['Reduce the frequency of your requests'],
        canRetry: true,
        estimatedRecoveryTime: 60000
      },
      VALIDATION: {
        primaryAction: 'Check your input and try again',
        secondaryActions: ['Ensure all required fields are filled correctly'],
        canRetry: true,
        estimatedRecoveryTime: 0
      },
      UNKNOWN: {
        primaryAction: 'Try refreshing the page',
        secondaryActions: ['Contact support if the problem persists'],
        canRetry: false,
        estimatedRecoveryTime: 0
      }
    };
    
    return guidanceMap[category];
  }
}

export interface RetryConfig {
  maxAttempts: number;
  backoffMs: number;
}

export type ErrorCategory = 
  | 'NETWORK' 
  | 'TIMEOUT' 
  | 'AUTH' 
  | 'RATE_LIMIT' 
  | 'VALIDATION' 
  | 'UNKNOWN';

export interface RecoveryGuidance {
  primaryAction: string;
  secondaryActions: string[];
  canRetry: boolean;
  estimatedRecoveryTime: number; // milliseconds
}

// Global error recovery instance
export const errorRecovery = new ErrorRecoveryManager();
