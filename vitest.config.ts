import { defineConfig } from 'vitest/config';
import { getViteConfig } from 'astro/config';

export default defineConfig(
  getViteConfig({
    test: {
      globals: true,
      environment: 'happy-dom',
      setupFiles: ['./src/test/setup.ts'],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/.{idea,git,cache,output,temp}/**',
        '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*',
        'e2e/**' // Exclude Playwright e2e tests from Vitest
      ],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html', 'lcov'],
        // Exclude files from coverage
        exclude: [
          'node_modules/**',
          'dist/**',
          '.astro/**',
          '**/*.config.{js,ts}',
          '**/types.ts',
          '**/*.d.ts',
          'src/test/**',
          'src/env.d.ts',
          'e2e/**'
        ],
        // Include source files for coverage
        include: [
          'src/lib/**/*.{js,ts}',
          'src/pages/api/**/*.ts'
        ],
        // Enforce coverage thresholds - FAIL build if not met
        thresholds: {
          // Global thresholds for all files
          global: {
            branches: 80,
            functions: 80,
            lines: 80,
            statements: 80
          },
          // Per-file thresholds for critical modules
          'src/lib/cart/index.ts': {
            branches: 85,
            functions: 85,
            lines: 85,
            statements: 85
          },
          'src/lib/square/apiRetry.ts': {
            branches: 90,
            functions: 90,
            lines: 90,
            statements: 90
          },
          'src/lib/square/inventory.ts': {
            branches: 80,
            functions: 80,
            lines: 80,
            statements: 80
          }
        },
        // Report uncovered lines
        all: true,
        // Skip lines with coverage ignore comments
        skipFull: false
      }
    }
  })
);
