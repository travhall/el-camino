/**
 * ApiRetryClient Tests - Circuit breaker and retry logic
 * Tests exponential backoff, jitter, timeout, and circuit breaker pattern
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApiRetryClient, CircuitState } from '../apiRetry';

describe('ApiRetryClient', () => {
  let client: ApiRetryClient;
  let mockOperation: any;

  beforeEach(() => {
    vi.useFakeTimers();
    client = ApiRetryClient.getInstance();
    client.reset();
    mockOperation = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
    client.reset();
  });

  describe('Basic Retry Logic', () => {
    it('should succeed on first attempt', async () => {
      mockOperation.mockResolvedValue('success');

      const result = await client.executeWithRetry(
        mockOperation,
        'test-operation'
      );

      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure', async () => {
      mockOperation
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce('success');

      const promise = client.executeWithRetry(
        mockOperation,
        'test-operation'
      );

      // Fast-forward through the delay
      await vi.runAllTimersAsync();

      const result = await promise;

      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(2);
    });

    it('should fail after max retries', async () => {
      mockOperation.mockRejectedValue(new Error('Persistent failure'));

      const promise = client.executeWithRetry(
        mockOperation,
        'test-operation',
        { maxRetries: 2 }
      );

      // Run timers and catch rejection simultaneously
      const [result] = await Promise.all([
        expect(promise).rejects.toThrow('failed after 3 attempts'),
        vi.runAllTimersAsync()
      ]);

      expect(mockOperation).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('should not retry on final attempt', async () => {
      mockOperation.mockRejectedValue(new Error('Failure'));

      const promise = client.executeWithRetry(
        mockOperation,
        'test-operation',
        { maxRetries: 0 }
      );

      // Run timers and catch rejection simultaneously
      await Promise.all([
        expect(promise).rejects.toThrow(),
        vi.runAllTimersAsync()
      ]);

      expect(mockOperation).toHaveBeenCalledTimes(1); // No retries
    });
  });

  describe('Exponential Backoff', () => {
    it('should increase delay exponentially', async () => {
      mockOperation.mockRejectedValue(new Error('Failure'));

      const promise = client.executeWithRetry(
        mockOperation,
        'test-operation',
        {
          maxRetries: 3,
          baseDelay: 100,
          maxDelay: 10000,
          jitterRange: 0 // No jitter for predictable testing
        }
      );

      // First retry: 100ms delay
      await vi.advanceTimersByTimeAsync(100);
      expect(mockOperation).toHaveBeenCalledTimes(2);

      // Second retry: 200ms delay
      await vi.advanceTimersByTimeAsync(200);
      expect(mockOperation).toHaveBeenCalledTimes(3);

      // Third retry: 400ms delay
      await vi.advanceTimersByTimeAsync(400);
      expect(mockOperation).toHaveBeenCalledTimes(4);

      // Run timers and catch rejection simultaneously
      await Promise.all([
        expect(promise).rejects.toThrow(),
        vi.runAllTimersAsync()
      ]);
    });

    it('should cap delay at maxDelay', async () => {
      mockOperation.mockRejectedValue(new Error('Failure'));

      const promise = client.executeWithRetry(
        mockOperation,
        'test-operation',
        {
          maxRetries: 10,
          baseDelay: 100,
          maxDelay: 500,
          jitterRange: 0
        }
      );

      // Even after many retries, delay should not exceed maxDelay
      for (let i = 0; i < 10; i++) {
        await vi.advanceTimersByTimeAsync(500);
      }

      // Run timers and catch rejection simultaneously
      await Promise.all([
        expect(promise).rejects.toThrow(),
        vi.runAllTimersAsync()
      ]);
    });

    it('should apply jitter to delays', async () => {
      mockOperation.mockRejectedValue(new Error('Failure'));

      // Run multiple times to verify jitter randomness
      const delays: number[] = [];

      for (let i = 0; i < 5; i++) {
        client.reset();
        mockOperation.mockClear();
        mockOperation.mockRejectedValue(new Error('Failure'));

        const startTime = Date.now();
        const promise = client.executeWithRetry(
          mockOperation,
          'test-operation',
          {
            maxRetries: 1,
            baseDelay: 100,
            jitterRange: 0.1 // 10% jitter
          }
        );

        // Run timers and catch rejection simultaneously
        await Promise.all([
          expect(promise).rejects.toThrow(),
          vi.runAllTimersAsync()
        ]);

        const endTime = Date.now();
        delays.push(endTime - startTime);
      }

      // Delays should vary due to jitter (not all the same)
      const uniqueDelays = new Set(delays);
      expect(uniqueDelays.size).toBeGreaterThan(1);
    });
  });

  describe('Timeout Handling', () => {
    it('should timeout long-running operations', async () => {
      mockOperation.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 20000))
      );

      const promise = client.executeWithRetry(
        mockOperation,
        'test-operation',
        { timeoutMs: 1000 }
      );

      // Run timers and catch rejection simultaneously
      await Promise.all([
        expect(promise).rejects.toThrow('timed out after 1000ms'),
        vi.advanceTimersByTimeAsync(1000)
      ]);
    });

    it('should succeed if operation completes before timeout', async () => {
      mockOperation.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve('success'), 500))
      );

      const promise = client.executeWithRetry(
        mockOperation,
        'test-operation',
        { timeoutMs: 1000 }
      );

      await vi.advanceTimersByTimeAsync(500);

      const result = await promise;
      expect(result).toBe('success');
    });
  });

  describe('Circuit Breaker', () => {
    it('should open circuit after failure threshold', async () => {
      mockOperation.mockRejectedValue(new Error('Service unavailable'));

      // Trigger failures to open circuit
      for (let i = 0; i < 5; i++) {
        const promise = client.executeWithRetry(
          mockOperation,
          'test-operation',
          { maxRetries: 0 }
        );
        // Run timers and catch rejection simultaneously
        await Promise.all([
          expect(promise).rejects.toThrow(),
          vi.runAllTimersAsync()
        ]);
      }

      const status = client.getStatus();
      expect(status.circuitState).toBe(CircuitState.OPEN);
      expect(status.failureCount).toBeGreaterThanOrEqual(5);
    });

    it('should fail fast when circuit is open', async () => {
      mockOperation.mockRejectedValue(new Error('Service unavailable'));

      // Open the circuit
      for (let i = 0; i < 5; i++) {
        const promise = client.executeWithRetry(
          mockOperation,
          'test-operation',
          { maxRetries: 0 }
        );
        // Run timers and catch rejection simultaneously
        await Promise.all([
          expect(promise).rejects.toThrow(),
          vi.runAllTimersAsync()
        ]);
      }

      // Circuit should now be open
      mockOperation.mockClear();

      // Next call should fail fast without calling operation
      await expect(
        client.executeWithRetry(mockOperation, 'test-operation')
      ).rejects.toThrow('Circuit breaker OPEN');

      expect(mockOperation).not.toHaveBeenCalled();
    });

    it('should transition to half-open after recovery timeout', async () => {
      mockOperation.mockRejectedValue(new Error('Service unavailable'));

      // Open the circuit
      for (let i = 0; i < 5; i++) {
        const promise = client.executeWithRetry(
          mockOperation,
          'test-operation',
          { maxRetries: 0 }
        );
        // Run timers and catch rejection simultaneously
        await Promise.all([
          expect(promise).rejects.toThrow(),
          vi.runAllTimersAsync()
        ]);
      }

      expect(client.getStatus().circuitState).toBe(CircuitState.OPEN);

      // Fast-forward past recovery timeout (default 30 seconds)
      await vi.advanceTimersByTimeAsync(30000);

      mockOperation.mockClear();
      mockOperation.mockResolvedValue('recovered');

      // Should now allow requests (half-open)
      const result = await client.executeWithRetry(
        mockOperation,
        'test-operation'
      );

      expect(result).toBe('recovered');
      expect(mockOperation).toHaveBeenCalled();
    });

    it('should close circuit after successful requests in half-open', async () => {
      mockOperation.mockRejectedValue(new Error('Failure'));

      // Open circuit
      for (let i = 0; i < 5; i++) {
        const promise = client.executeWithRetry(
          mockOperation,
          'test-operation',
          { maxRetries: 0 }
        );
        // Run timers and catch rejection simultaneously
        await Promise.all([
          expect(promise).rejects.toThrow(),
          vi.runAllTimersAsync()
        ]);
      }

      // Move to half-open
      await vi.advanceTimersByTimeAsync(30000);

      mockOperation.mockClear();
      mockOperation.mockResolvedValue('success');

      // Make 3 successful requests to close circuit
      for (let i = 0; i < 3; i++) {
        await client.executeWithRetry(mockOperation, 'test-operation');
      }

      const status = client.getStatus();
      expect(status.circuitState).toBe(CircuitState.CLOSED);
    });

    it('should reopen circuit on failure in half-open state', async () => {
      mockOperation.mockRejectedValue(new Error('Failure'));

      // Open circuit
      for (let i = 0; i < 5; i++) {
        const promise = client.executeWithRetry(
          mockOperation,
          'test-operation',
          { maxRetries: 0 }
        );
        // Run timers and catch rejection simultaneously
        await Promise.all([
          expect(promise).rejects.toThrow(),
          vi.runAllTimersAsync()
        ]);
      }

      // Move to half-open
      await vi.advanceTimersByTimeAsync(30000);

      mockOperation.mockClear();
      mockOperation.mockRejectedValue(new Error('Still failing'));

      // Failure in half-open should increase failure count
      const promise = client.executeWithRetry(
        mockOperation,
        'test-operation',
        { maxRetries: 0 }
      );
      // Run timers and catch rejection simultaneously
      await Promise.all([
        expect(promise).rejects.toThrow(),
        vi.runAllTimersAsync()
      ]);

      const status = client.getStatus();
      expect(status.failureCount).toBeGreaterThan(0);
    });
  });

  describe('Status Monitoring', () => {
    it('should return circuit status', () => {
      const status = client.getStatus();

      expect(status).toHaveProperty('circuitState');
      expect(status).toHaveProperty('failureCount');
      expect(status).toHaveProperty('successCount');
      expect(status).toHaveProperty('lastFailureTime');
    });

    it('should track failure count', async () => {
      mockOperation.mockRejectedValue(new Error('Failure'));

      const promise = client.executeWithRetry(
        mockOperation,
        'test-operation',
        { maxRetries: 0 }
      );
      // Run timers and catch rejection simultaneously
      await Promise.all([
        expect(promise).rejects.toThrow(),
        vi.runAllTimersAsync()
      ]);

      const status = client.getStatus();
      expect(status.failureCount).toBe(1);
    });

    it('should track success count in half-open', async () => {
      mockOperation.mockRejectedValue(new Error('Failure'));

      // Open circuit
      for (let i = 0; i < 5; i++) {
        const promise = client.executeWithRetry(
          mockOperation,
          'test-operation',
          { maxRetries: 0 }
        );
        // Run timers and catch rejection simultaneously
        await Promise.all([
          expect(promise).rejects.toThrow(),
          vi.runAllTimersAsync()
        ]);
      }

      // Move to half-open
      await vi.advanceTimersByTimeAsync(30000);

      mockOperation.mockClear();
      mockOperation.mockResolvedValue('success');

      await client.executeWithRetry(mockOperation, 'test-operation');

      const status = client.getStatus();
      expect(status.successCount).toBeGreaterThan(0);
    });

    it('should record last failure time', async () => {
      mockOperation.mockRejectedValue(new Error('Failure'));

      const beforeTime = Date.now();

      const promise = client.executeWithRetry(
        mockOperation,
        'test-operation',
        { maxRetries: 0 }
      );
      // Run timers and catch rejection simultaneously
      await Promise.all([
        expect(promise).rejects.toThrow(),
        vi.runAllTimersAsync()
      ]);

      const status = client.getStatus();
      expect(status.lastFailureTime).toBeGreaterThanOrEqual(beforeTime);
    });
  });

  describe('Reset Functionality', () => {
    it('should reset circuit breaker state', async () => {
      mockOperation.mockRejectedValue(new Error('Failure'));

      // Open circuit
      for (let i = 0; i < 5; i++) {
        const promise = client.executeWithRetry(
          mockOperation,
          'test-operation',
          { maxRetries: 0 }
        );
        // Run timers and catch rejection simultaneously
        await Promise.all([
          expect(promise).rejects.toThrow(),
          vi.runAllTimersAsync()
        ]);
      }

      expect(client.getStatus().circuitState).toBe(CircuitState.OPEN);

      client.reset();

      const status = client.getStatus();
      expect(status.circuitState).toBe(CircuitState.CLOSED);
      expect(status.failureCount).toBe(0);
      expect(status.successCount).toBe(0);
      expect(status.lastFailureTime).toBe(0);
    });
  });

  describe('Custom Configuration', () => {
    it('should accept custom retry config', async () => {
      mockOperation
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValueOnce('success');

      const promise = client.executeWithRetry(
        mockOperation,
        'test-operation',
        {
          maxRetries: 5,
          baseDelay: 50,
          maxDelay: 1000,
          jitterRange: 0,
          timeoutMs: 5000
        }
      );

      await vi.runAllTimersAsync();

      const result = await promise;
      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(3);
    });
  });

  describe('Error Message Handling', () => {
    it('should preserve original error message', async () => {
      const customError = new Error('Custom error message');
      mockOperation.mockRejectedValue(customError);

      const promise = client.executeWithRetry(
        mockOperation,
        'test-operation',
        { maxRetries: 0 }
      );

      // Run timers and catch rejection simultaneously
      await Promise.all([
        expect(promise).rejects.toThrow('Custom error message'),
        vi.runAllTimersAsync()
      ]);
    });

    it('should include context in final error', async () => {
      mockOperation.mockRejectedValue(new Error('Original error'));

      const promise = client.executeWithRetry(
        mockOperation,
        'my-custom-operation',
        { maxRetries: 1 }
      );

      // Run timers and catch rejection simultaneously
      await Promise.all([
        expect(promise).rejects.toThrow('my-custom-operation'),
        vi.runAllTimersAsync()
      ]);
    });

    it('should handle non-Error rejections', async () => {
      mockOperation.mockRejectedValue('string error');

      const promise = client.executeWithRetry(
        mockOperation,
        'test-operation',
        { maxRetries: 0 }
      );

      // Run timers and catch rejection simultaneously
      await Promise.all([
        expect(promise).rejects.toThrow('string error'),
        vi.runAllTimersAsync()
      ]);
    });
  });

  describe('Singleton Pattern', () => {
    it('should return same instance', () => {
      const instance1 = ApiRetryClient.getInstance();
      const instance2 = ApiRetryClient.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should share state across getInstance calls', async () => {
      const instance1 = ApiRetryClient.getInstance();
      instance1.reset();

      mockOperation.mockRejectedValue(new Error('Failure'));

      // Open circuit using instance1
      for (let i = 0; i < 5; i++) {
        const promise = instance1.executeWithRetry(
          mockOperation,
          'test-operation',
          { maxRetries: 0 }
        );
        // Run timers and catch rejection simultaneously
        await Promise.all([
          expect(promise).rejects.toThrow(),
          vi.runAllTimersAsync()
        ]);
      }

      // Get instance2 and check state
      const instance2 = ApiRetryClient.getInstance();
      const status = instance2.getStatus();

      expect(status.circuitState).toBe(CircuitState.OPEN);
      expect(status.failureCount).toBeGreaterThanOrEqual(5);
    });
  });
});
