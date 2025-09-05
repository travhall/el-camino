/**
 * Test setup for Vitest
 */

import { vi } from 'vitest';

// Mock environment variables
vi.mock('astro:env/server', () => ({
  SQUARE_ACCESS_TOKEN: 'test-token',
  SQUARE_APPLICATION_ID: 'test-app-id',
  SQUARE_ENVIRONMENT: 'sandbox'
}));

// Mock global performance if not available
if (typeof performance === 'undefined') {
  global.performance = {
    now: () => Date.now(),
    mark: () => {},
    measure: () => {},
    getEntriesByType: () => [],
    getEntriesByName: () => []
  } as any;
}

// Setup DOM globals for happy-dom
global.console = console;
