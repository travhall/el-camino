import astro from 'eslint-plugin-astro';
import * as astroParser from 'astro-eslint-parser';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

export default [
  {
    // Build output, generated reports, local-only folders and agent worktrees.
    ignores: [
      'dist/',
      '.astro/',
      '.netlify/',
      '.claude/',
      'node_modules/',
      'coverage/',
      'lighthouse/',
      'docs/',
      'playwright-report*/',
      'test-results*/',
    ],
  },
  // Severity stays 'warn' on purpose. `pnpm lint` passes --max-warnings 0, so a
  // warning blocks CI and the pre-commit hook exactly like an error would, and
  // the count can only go down (the same baselining idea as the coverage
  // thresholds in vitest.config.ts). A new rule added at 'warn' is enforced
  // immediately: clear its violations in the same change.
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: { '@typescript-eslint': tseslint },
    languageOptions: { parser: tsparser },
    rules: {
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    files: ['**/*.astro'],
    plugins: { '@typescript-eslint': tseslint },
    languageOptions: {
      parser: astroParser,
      parserOptions: {
        parser: tsparser,
        extraFileExtensions: ['.astro'],
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  ...astro.configs.recommended,
];
