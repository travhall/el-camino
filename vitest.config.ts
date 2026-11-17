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
        '**/.claude/**', // Worktrees and agent state
        '**/.kilo/**', // Worktrees created by other agent tools
        '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*',
        'e2e/**', // Exclude Playwright e2e tests from Vitest
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
          'e2e/**',
        ],
        // Include source files for coverage. src/scripts holds client code that
        // used to live inline in .astro files (plans 181, 225); it counts so that
        // extracting more of it keeps the gate honest.
        include: [
          'src/lib/**/*.{js,ts}',
          'src/pages/api/**/*.ts',
          'src/scripts/**/*.ts',
        ],
        // Enforce coverage thresholds - FAIL build if not met.
        // NOTE: global keys must be flat (statements/branches/functions/lines)
        // directly under `thresholds` — a nested `global: {...}` object is not
        // part of vitest's threshold schema and is silently ignored (treated
        // as an unmatched per-file glob), which let this gate no-op for a long
        // time while actual coverage drifted well below the originally-intended
        // 80%. Re-baselined 2 points under real coverage as of 2026-11-16
        // (79.55% statements / 69.51% branches / 79.93% functions / 80.9%
        // lines; it was 59.86 / 50.25 / 61.58 / 60.94 on 2026-09-04). Set
        // each number 2 points under the measured value, rounded down, and
        // raise them again whenever real coverage has moved up: the gate is
        // only useful while it sits close to reality.
        thresholds: {
          branches: 67,
          functions: 77,
          lines: 78,
          statements: 77,
          // Per-file thresholds for critical modules
          // cart/index.ts: branch ceiling is ~84% — the remaining gap is 2-3
          // branches from `if (import.meta.hot)` HMR guards (always false in
          // Vitest) and one defensive `if (!this.initialized)` that is dead code
          // in practice. v8 ignore directives don't suppress branch counts in
          // this version of Vitest, so 84% is the practical ceiling.
          'src/lib/cart/index.ts': {
            branches: 84,
            functions: 85,
            lines: 85,
            statements: 85,
          },
          'src/lib/square/apiRetry.ts': {
            branches: 90,
            functions: 90,
            lines: 90,
            statements: 90,
          },
          'src/lib/square/inventory.ts': {
            branches: 80,
            functions: 80,
            lines: 80,
            statements: 80,
          },
        },
        // Report uncovered lines
        all: true,
        // Skip lines with coverage ignore comments
        skipFull: false,
      },
    },
  })
);
