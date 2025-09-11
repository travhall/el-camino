// src/lib/square/apiRetry.ts - Enhanced API retry logic with exponential backoff and circuit breaker

/**
 * Configuration for API retry behavior
 */
export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  jitterRange: number;
  timeoutMs: number;
}

/**
 * Circuit breaker states
 */
export enum CircuitState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // Failing fast
  HALF_OPEN = 'HALF_OPEN' // Testing recovery
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeoutMs: number;
  monitorWindowMs: number;
}

/**
 * Enhanced API retry client with circuit breaker pattern
 */
export class ApiRetryClient {
  private static instance: ApiRetryClient;
  private circuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private lastFailureTime = 0;
  private successCount = 0;

  private defaultRetryConfig: RetryConfig = {
    maxRetries: parseInt(import.meta.env.SQUARE_MAX_RETRIES || '3'),
    baseDelay: parseInt(import.meta.env.SQUARE_BASE_DELAY || '500'),
    maxDelay: parseInt(import.meta.env.SQUARE_MAX_DELAY || '5000'),
    jitterRange: parseFloat(import.meta.env.SQUARE_JITTER_RANGE || '0.1'),
    timeoutMs: parseInt(import.meta.env.SQUARE_TIMEOUT_MS || '10000')
  };

  private circuitConfig: CircuitBreakerConfig = {
    failureThreshold: parseInt(import.meta.env.SQUARE_CIRCUIT_THRESHOLD || '5'),
    recoveryTimeoutMs: parseInt(import.meta.env.SQUARE_RECOVERY_TIMEOUT || '30000'),
    monitorWindowMs: parseInt(import.meta.env.SQUARE_MONITOR_WINDOW || '60000')
  };

  private constructor() {}

  public static getInstance(): ApiRetryClient {
    if (!ApiRetryClient.instance) {
      ApiRetryClient.instance = new ApiRetryClient();
    }
    return ApiRetryClient.instance;
  }

  /**
   * Execute API call with retry logic and circuit breaker
   */
  public async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: string,
    customConfig?: Partial<RetryConfig>
  ): Promise<T> {
    const config = { ...this.defaultRetryConfig, ...customConfig };

    // Check circuit breaker
    if (this.shouldFailFast()) {
      throw new Error(`Circuit breaker OPEN for ${context} - failing fast`);
    }

    let lastError: Error;

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        // Add timeout wrapper
        const result = await this.withTimeout(operation(), config.timeoutMs);
        
        // Success - record for circuit breaker
        this.recordSuccess();
        return result;
        
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Record failure for circuit breaker
        this.recordFailure();
        
        // Don't retry on final attempt
        if (attempt === config.maxRetries) {
          break;
        }

        // Calculate delay with exponential backoff and jitter
        const delay = this.calculateDelay(attempt, config);
        
        if (import.meta.env.DEV) {
          console.warn(`[ApiRetry] ${context} attempt ${attempt + 1} failed, retrying in ${delay}ms:`, lastError.message);
        }
        
        await this.sleep(delay);
      }
    }

    throw new Error(`${context} failed after ${config.maxRetries + 1} attempts: ${lastError!.message}`);
  }

  /**
   * Check if circuit breaker should fail fast
   */
  private shouldFailFast(): boolean {
    const now = Date.now();

    switch (this.circuitState) {
      case CircuitState.CLOSED:
        return false;

      case CircuitState.OPEN:
        // Check if recovery timeout has passed
        if (now - this.lastFailureTime >= this.circuitConfig.recoveryTimeoutMs) {
          this.circuitState = CircuitState.HALF_OPEN;
          this.successCount = 0;
          return false;
        }
        return true;

      case CircuitState.HALF_OPEN:
        return false;
    }
  }

  /**
   * Record successful API call
   */
  private recordSuccess(): void {
    this.successCount++;

    if (this.circuitState === CircuitState.HALF_OPEN) {
      // After 3 successes in half-open, return to closed
      if (this.successCount >= 3) {
        this.circuitState = CircuitState.CLOSED;
        this.failureCount = 0;
        if (import.meta.env.DEV) {
          console.log('[Circuit] Returned to CLOSED state after recovery');
        }
      }
    }
  }

  /**
   * Record failed API call
   */
  private recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    // Open circuit if threshold exceeded
    if (this.failureCount >= this.circuitConfig.failureThreshold) {
      this.circuitState = CircuitState.OPEN;
      if (import.meta.env.DEV) {
        console.warn(`[Circuit] OPENED after ${this.failureCount} failures`);
      }
    }
  }

  /**
   * Calculate delay with exponential backoff and jitter
   */
  private calculateDelay(attempt: number, config: RetryConfig): number {
    const exponentialDelay = Math.min(
      config.baseDelay * Math.pow(2, attempt),
      config.maxDelay
    );

    // Add jitter to prevent thundering herd
    const jitter = exponentialDelay * config.jitterRange * (Math.random() - 0.5);
    
    return Math.max(0, exponentialDelay + jitter);
  }

  /**
   * Add timeout to any promise
   */
  private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs);
      })
    ]);
  }

  /**
   * Simple sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current circuit breaker status for monitoring
   */
  public getStatus() {
    return {
      circuitState: this.circuitState,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime
    };
  }

  /**
   * Reset circuit breaker (for testing or manual recovery)
   */
  public reset(): void {
    this.circuitState = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
  }
}

// Export singleton instance
export const apiRetryClient = ApiRetryClient.getInstance();
