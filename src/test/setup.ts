/**
 * Test setup configuration for El Camino
 * Implements Phase 1 testing infrastructure per technical assessment
 */

import { beforeEach, vi } from 'vitest';

// Global test configuration
beforeEach(() => {
  // Clear all mocks between tests
  vi.clearAllMocks();
  
  // Reset environment variables to known state
  vi.stubEnv('SQUARE_ACCESS_TOKEN', 'test_token');
  vi.stubEnv('SQUARE_APPLICATION_ID', 'test_app_id');
  vi.stubEnv('SQUARE_ENVIRONMENT', 'sandbox');
});

// Mock fetch globally for API tests
global.fetch = vi.fn();

// Mock web-vitals for performance tests
vi.mock('web-vitals', () => ({
  onCLS: vi.fn((callback) => callback({ value: 0.1, name: 'CLS' })),
  onFCP: vi.fn((callback) => callback({ value: 1200, name: 'FCP' })),
  onLCP: vi.fn((callback) => callback({ value: 2100, name: 'LCP' })),
  onINP: vi.fn((callback) => callback({ value: 150, name: 'INP' })),
  onTTFB: vi.fn((callback) => callback({ value: 600, name: 'TTFB' })),
  getCLS: vi.fn(),
  getFCP: vi.fn(),
  getLCP: vi.fn(),
  getINP: vi.fn(),
  getTTFB: vi.fn(),
}));

// Mock DOM APIs used by enhancements
Object.defineProperty(window, 'navigator', {
  writable: true,
  value: {
    userAgent: 'Mozilla/5.0 (test)',
    vibrate: vi.fn(),
    connection: {
      effectiveType: '4g',
      saveData: false
    }
  }
});

Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  value: vi.fn(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }))
});

Object.defineProperty(window, 'localStorage', {
  writable: true,
  value: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  }
});

// Mock business monitor to prevent initialization issues
vi.mock('../lib/monitoring/businessMonitor', () => ({
  businessMonitor: {
    trackCustomEvent: vi.fn(),
    getBusinessMetrics: vi.fn(() => ({}))
  }
}));

// Add businessMonitor to window for abTesting integration
Object.defineProperty(window, 'businessMonitor', {
  writable: true,
  value: {
    trackCustomEvent: vi.fn(),
    getBusinessMetrics: vi.fn(() => ({}))
  }
});

// Console error suppression for expected test errors
const originalError = console.error;
beforeEach(() => {
  console.error = (...args: any[]) => {
    if (args[0]?.includes?.('test error') || args[0]?.includes?.('Test:')) {
      return; // Suppress expected test errors
    }
    originalError.apply(console, args);
  };
});
