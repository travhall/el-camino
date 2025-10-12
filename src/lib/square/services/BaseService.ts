// src/lib/square/services/BaseService.ts
import type { Client } from "square/legacy";
import type { CircuitBreaker } from "../apiUtils";
import type { Cache } from "../cacheUtils";
import { processSquareError, logError } from "../errorUtils";

/**
 * Base service class providing common functionality for all Square services
 */
export abstract class BaseService {
  protected client: Client;
  protected circuitBreaker: CircuitBreaker;
  protected cache?: Cache<any>;
  protected serviceName: string;

  constructor(
    client: Client,
    circuitBreaker: CircuitBreaker,
    serviceName: string,
    cache?: Cache<any>
  ) {
    this.client = client;
    this.circuitBreaker = circuitBreaker;
    this.serviceName = serviceName;
    this.cache = cache;
  }

  /**
   * Execute API call with circuit breaker and error handling
   */
  protected async execute<T>(
    operation: () => Promise<T>,
    operationName: string,
    fallback?: () => T
  ): Promise<T> {
    try {
      return await this.circuitBreaker.execute(operation);
    } catch (error) {
      const appError = processSquareError(
        error,
        `${this.serviceName}.${operationName}`
      );
      logError(appError);

      if (fallback) {
        console.log(
          `[${this.serviceName}] Using fallback for ${operationName}`
        );
        return fallback();
      }

      throw appError;
    }
  }

  /**
   * Execute with caching
   */
  protected async executeWithCache<T>(
    cacheKey: string,
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    if (!this.cache) {
      return this.execute(operation, operationName);
    }

    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached !== undefined) {
      console.log(`[${this.serviceName}] Cache hit: ${cacheKey}`);
      return cached;
    }

    // Execute and cache result
    console.log(`[${this.serviceName}] Cache miss: ${cacheKey}`);
    const result = await this.execute(operation, operationName);
    this.cache.set(cacheKey, result);

    return result;
  }

  /**
   * Clear all cache
   */
  protected clearCache(): void {
    if (this.cache) {
      this.cache.clear();
      console.log(`[${this.serviceName}] Cache cleared`);
    }
  }

  /**
   * Clear specific cache key
   */
  protected clearCacheKey(key: string): void {
    if (this.cache) {
      this.cache.delete(key);
      console.log(`[${this.serviceName}] Cache key cleared: ${key}`);
    }
  }

  /**
   * Get cache statistics
   */
  protected getCacheStats() {
    if (!this.cache) {
      return null;
    }
    return {
      name: this.cache.constructor.name,
      hasCache: true,
    };
  }
}
