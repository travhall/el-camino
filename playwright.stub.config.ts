import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for the Square-stubbed specs (`e2e/*.stub.spec.ts`).
 *
 * The default config can't test product pages in CI: stub credentials return
 * no catalog. Here a second dev server is started with e2e/fixtures/square-stub.mjs
 * preloaded, which answers Square's REST API with a small fixed catalog (see
 * e2e/fixtures/square-catalog.mjs), so the real PDP and QuickView render.
 *
 * - Separate port, so it can run beside the default server.
 * - Doesn't load `.env`; the stub answers every Square request itself, so real
 *   credentials are never used or needed.
 * - Chromium only (the PR gate's browser).
 *
 * Run: pnpm test:e2e:stub
 */
const PORT = 4322;
const stubPreload = path.resolve('e2e/fixtures/square-stub.mjs');

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.stub.spec.ts',

  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  /* Separate output so a run doesn't overwrite the default config's report */
  outputDir: 'test-results-stub',
  reporter: [
    ['html', { outputFolder: 'playwright-report-stub', open: 'never' }],
    ['list'],
  ],

  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: 10000,
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  webServer: {
    /* ASTRO_DEV_BACKGROUND keeps Astro from daemonizing under an agent/CI
       (it would detach from Playwright); --ignore-lock lets this run beside a
       `pnpm dev` already holding the project's dev-server lock. */
    command: `node ./node_modules/astro/bin/astro.mjs dev --port ${PORT} --ignore-lock`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    env: {
      ASTRO_DEV_BACKGROUND: '1',
      NODE_OPTIONS: `--import ${stubPreload}`,
      SQUARE_ACCESS_TOKEN: 'e2e-stub',
      PUBLIC_SQUARE_LOCATION_ID: 'LOC1',
      PUBLIC_SQUARE_ENVIRONMENT: 'sandbox',
    },
  },
});
