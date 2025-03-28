// src/lib/square/apiUtils.ts
interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  circuitOpen: boolean;
}

interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeMs: number;
  name?: string;
}

/**
 * Implements the Circuit Breaker pattern for API calls
 * Prevents cascading failures when an external service is experiencing issues
 */
export class CircuitBreaker {
  private state: CircuitBreakerState;
  private options: CircuitBreakerOptions;

  constructor(options?: Partial<CircuitBreakerOptions>) {
    this.state = {
      failures: 0,
      lastFailure: 0,
      circuitOpen: false,
    };

    this.options = {
      failureThreshold: options?.failureThreshold || 5,
      resetTimeMs: options?.resetTimeMs || 30000, // 30 seconds
      name: options?.name || "default",
    };
  }

  /**
   * Execute a function with circuit breaker protection
   * @param fn Function to execute
   * @returns Result of the function
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit is open
    if (this.state.circuitOpen) {
      const now = Date.now();
      if (now - this.state.lastFailure > this.options.resetTimeMs) {
        // Try to reset circuit
        console.log(
          `[CircuitBreaker:${this.options.name}] Attempting to reset circuit`
        );
        this.state.circuitOpen = false;
        this.state.failures = 0;
      } else {
        throw new Error(
          `[CircuitBreaker:${this.options.name}] Circuit open - too many recent failures`
        );
      }
    }

    try {
      const result = await fn();
      // Success resets failure count
      this.state.failures = 0;
      return result;
    } catch (error) {
      this.state.failures++;
      this.state.lastFailure = Date.now();

      console.error(
        `[CircuitBreaker:${this.options.name}] API call failed (${this.state.failures}/${this.options.failureThreshold}):`,
        error
      );

      if (this.state.failures >= this.options.failureThreshold) {
        console.warn(
          `[CircuitBreaker:${this.options.name}] Circuit opened after ${this.options.failureThreshold} failures`
        );
        this.state.circuitOpen = true;
      }

      throw error;
    }
  }

  /**
   * Reset the circuit breaker state
   */
  reset(): void {
    this.state.failures = 0;
    this.state.circuitOpen = false;
    console.log(`[CircuitBreaker:${this.options.name}] Circuit manually reset`);
  }

  /**
   * Get current circuit breaker state
   */
  getState(): Readonly<CircuitBreakerState> {
    return { ...this.state };
  }
}

// Export a default instance for backward compatibility
export const defaultCircuitBreaker = new CircuitBreaker({ name: "square-api" });

/**
 * Protected API call with circuit breaker pattern (legacy function)
 * @deprecated Use CircuitBreaker class instead
 */
export async function protectedApiCall<T>(
  apiCall: () => Promise<T>
): Promise<T> {
  return defaultCircuitBreaker.execute(apiCall);
}

/**
 * Standard error logging with structured data
 */
export function logApiError(context: string, error: unknown): void {
  if (error instanceof Error) {
    console.error(`[API:${context}] Error:`, {
      message: error.message,
      name: error.name,
      stack: error.stack?.split("\n").slice(0, 3).join("\n"),
      data: (error as any).data || (error as any).response?.data,
    });
  } else {
    console.error(`[API:${context}] Unknown error:`, error);
  }
}
