# Plan 101: Add ESLint and Prettier

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `ls eslint.config.* .eslintrc.* .prettierrc* prettier.config.* 2>/dev/null`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: plan 100 (pre-commit hook) — integrate lint into hook
- **Category**: developer experience
- **Planned at**: commit `915a062`, 2026-08-01

## Why this matters

The repo has no ESLint or Prettier configuration (confirmed: not in `devDependencies`). Without a linter:
- Code style diverges between contributors
- Common JS/TS bugs (unused variables, implicit any, missing awaits) go undetected until runtime
- There's no automated formatting gate

Astro has first-party ESLint support via `eslint-plugin-astro` and TypeScript support via `@typescript-eslint`. The combination covers `.astro`, `.ts`, and `.tsx` files.

## Current state

Confirm no existing config:
```bash
ls eslint.config.* .eslintrc.* .prettierrc* prettier.config.* 2>/dev/null
cat package.json | grep -E '"eslint|prettier'
```

## Commands

| Purpose | Command | Expected |
|---------|---------|---------|
| Lint | `pnpm lint` | exits 0 (after config) |
| Format check | `pnpm format:check` | exits 0 |
| Typecheck | `pnpm check` | no errors |

## Scope

**In scope**:
- `eslint.config.mjs` (flat config, ESLint 9+)
- `.prettierrc.json`
- `package.json` — add `lint` and `format` scripts; add dev dependencies
- `.husky/pre-commit` — add `pnpm lint` call (after plan 100 lands)

**Out of scope**: fixing existing lint errors in a single PR — that's a separate cleanup commit. This plan only installs and configures the tools.

## Git workflow

- Branch: `advisor/101-dx-eslint-prettier`
- Commit: `chore: add ESLint and Prettier with Astro and TypeScript support`

## Steps

### Step 1: Install packages

```bash
pnpm add -D eslint eslint-plugin-astro @typescript-eslint/eslint-plugin @typescript-eslint/parser prettier prettier-plugin-astro
```

### Step 2: Create eslint.config.mjs

```js
import astro from 'eslint-plugin-astro';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

export default [
  { ignores: ['dist/', '.astro/', 'node_modules/'] },
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: { '@typescript-eslint': tseslint },
    languageOptions: { parser: tsparser },
    rules: {
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  ...astro.configs.recommended,
];
```

### Step 3: Create .prettierrc.json

```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "plugins": ["prettier-plugin-astro"],
  "overrides": [
    { "files": "*.astro", "options": { "parser": "astro" } }
  ]
}
```

### Step 4: Add scripts to package.json

```json
"lint": "eslint src/",
"format": "prettier --write src/",
"format:check": "prettier --check src/"
```

### Step 5: Run and check baseline

```bash
pnpm lint
```

Expect lint warnings/errors on existing code — that's fine, document the count. Do NOT auto-fix or auto-format existing code in this PR.

```
pnpm check
pnpm test:run
```

## Done criteria

- [ ] `eslint.config.mjs` exists
- [ ] `.prettierrc.json` exists
- [ ] `pnpm lint` runs (exit 0 or 1 with warnings — no crash)
- [ ] `pnpm format:check` runs without error
- [ ] `pnpm check` still exits 0
- [ ] `pnpm test:run` still passes
- [ ] `plans/README.md` updated to DONE

## STOP conditions

- ESLint 9 flat config is incompatible with `eslint-plugin-astro` — fall back to ESLint 8 with `.eslintrc.cjs`; document the version pinning reason

## Maintenance notes

After this plan lands, file a separate follow-up to fix existing lint warnings (don't bundle that work here — it would make the PR enormous). Add `pnpm lint` to the pre-commit hook (plan 100 integration) in the next pass.
