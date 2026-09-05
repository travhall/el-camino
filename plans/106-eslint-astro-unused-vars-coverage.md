# Plan 106: Enable no-unused-vars/no-explicit-any linting for .astro frontmatter

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 8ff3096..HEAD -- eslint.config.mjs`
> If this file changed since this plan was written, compare the "Current
> state" excerpt below against the live file before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `8ff3096`, 2026-08-05

## Why this matters

`eslint.config.mjs` scopes the `@typescript-eslint/no-unused-vars` and
`@typescript-eslint/no-explicit-any` rules to `**/*.ts` and `**/*.tsx` only.
`.astro` files get `astro.configs.recommended`, which covers Astro-specific
concerns (component structure, accessibility) but does **not** apply those
two TypeScript rules to the TypeScript code inside an Astro component's
frontmatter (`---` fenced) script block. As a result, dead imports and unused
`const`/`let` declarations accumulate silently in `.astro` files — `pnpm
lint` reports 0 problems while `pnpm check` (which runs `astro check`, a
separate tsc-backed tool) currently reports 25 such hints across 21 `.astro`
files (see Plan 107, which removes the current backlog). Once this plan
closes the gap, `pnpm lint` will catch new instances of this class going
forward, in the same PR that introduces them, instead of leaving them for the
next `/improve` audit to find via `astro check`.

## Current state

- `eslint.config.mjs` — the ESLint flat config for this repo. Full contents
  today:

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

- `eslint-plugin-astro` is already a dependency (used above). It bundles
  `astro-eslint-parser`, which extracts the frontmatter script block from
  `.astro` files so that other plugins' rules — including
  `@typescript-eslint`'s — can run against it. This is the plugin's
  documented mechanism for applying TypeScript rules to Astro frontmatter.
  The gap in this repo's config is simply that it never adds a
  `files: ['**/*.astro']` block wiring `@typescript-eslint`'s plugin/rules
  through that parser; it only has the `**/*.ts`/`**/*.tsx` block above.
- Repo convention: rules are set to `'warn'`, not `'error'` (see the
  existing block above) — match that severity, don't escalate to `'error'`.

## Commands you will need

| Purpose   | Command          | Expected on success |
|-----------|------------------|----------------------|
| Lint      | `pnpm lint`      | exit 0 (warnings are fine, this repo uses `'warn'` severity — see Done criteria for the exact expected count) |
| Typecheck | `pnpm check`     | exit 0, "0 errors" |
| Build     | `pnpm build`     | exit 0 |

## Scope

**In scope** (the only files you should modify):
- `eslint.config.mjs`

**Out of scope** (do NOT touch, even though they look related):
- Any `.astro` file's actual content — this plan only changes lint
  configuration. Do not "fix" any warnings this change surfaces; that is
  Plan 107's job (it has already been vetted file-by-file, including two
  cases that turned out to be a real bug rather than dead code — do not
  duplicate or pre-empt that work here).
- `eslint-plugin-astro`'s own rule set (`astro.configs.recommended`) — leave
  as-is.

## Git workflow

- Branch: `advisor/106-eslint-astro-unused-vars-coverage`
- Commit message style: conventional commits, e.g. `chore: extend ESLint
  no-unused-vars/no-explicit-any to .astro frontmatter` (matches
  `4774772 chore: add ESLint and Prettier with Astro and TypeScript support`
  in `git log`).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add a `**/*.astro` rule block to `eslint.config.mjs`

Add a new block to the exported array that applies the same
`@typescript-eslint` plugin, parser, and rules to `.astro` files. Use
`eslint-plugin-astro`'s documented pattern: set the parser to
`astro-eslint-parser` with `parserOptions.parser` pointing at
`@typescript-eslint/parser` (check the exact shape in
`node_modules/eslint-plugin-astro/README.md`'s "TypeScript" section for the
installed version, since `@typescript-eslint` needs to run *inside* the
frontmatter block that `astro-eslint-parser` extracts) so that
`@typescript-eslint/no-unused-vars` and `@typescript-eslint/no-explicit-any`
apply to the frontmatter TypeScript, not the Astro template syntax. The
resulting file should have three rule blocks in this order: the existing
`**/*.ts`/`**/*.tsx` block, a new `**/*.astro` block with the same two rules
at `'warn'`, then `...astro.configs.recommended` last (so the recommended
Astro rules aren't overridden).

**Verify**: `pnpm lint` → exits 0 (some new warnings are expected and
correct — see Step 2).

### Step 2: Confirm the rule actually activates on known-dead code

Before touching any `.astro` source (out of scope for this plan), confirm
the new rule fires on at least one of the known-unused declarations from
Plan 107's list — e.g. `EL_CAMINO_LOGO_DATA_URI` in
`src/components/Sidebar.astro:6`.

**Verify**: `pnpm lint 2>&1 | grep -c "no-unused-vars"` → returns a number
≥ 20 (Plan 107 catalogs 25 genuine astro-frontmatter unused-declaration
sites at the time this plan was written; some may already be fixed if Plan
107 landed first — either way this count should be non-zero, confirming the
rule is active). If the count is 0, the rule did not activate — this is a
STOP condition, not something to work around.

## Test plan

No new automated tests — this is a lint-config change. Verification is
`pnpm lint` correctly flagging the known-dead declarations (Step 2) and
`pnpm build` still succeeding (lint is not currently wired into the build
script, so a new warning cannot break `pnpm build`, but confirm anyway to
catch a config typo that breaks parsing).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm lint` exits 0
- [ ] `pnpm lint 2>&1 | grep -c "no-unused-vars"` returns ≥ 20 (confirms the
      rule is active against `.astro` frontmatter — see Step 2)
- [ ] `pnpm check` exits 0, "0 errors" (unchanged — this plan doesn't touch
      typecheck)
- [ ] `pnpm build` exits 0
- [ ] No files outside `eslint.config.mjs` are modified (`git status`)
- [ ] `plans/README.md` status row for 106 updated

## STOP conditions

Stop and report back (do not improvise) if:

- `eslint.config.mjs` doesn't match the "Current state" excerpt above (the
  config has drifted since this plan was written — re-read it and adjust,
  or stop if the change no longer makes sense).
- `@typescript-eslint` rules cannot be made to fire inside `.astro`
  frontmatter using `eslint-plugin-astro`'s documented mechanism (check the
  installed version's docs first — `cat node_modules/eslint-plugin-astro/package.json`
  for the version, then its README) — if the plugin version installed
  genuinely doesn't support this, report back rather than reaching for an
  unmaintained workaround.
- Step 2's verification returns 0 after a correctly-configured rule block —
  this means either the rule isn't wired up right, or all 25 dead
  declarations from Plan 107 already got fixed by something else (check
  `git log --oneline -10` for a Plan 107 commit before concluding it's a
  misconfiguration).

## Maintenance notes

- This closes the gap for **imports, top-level `const`/`let`, and unused
  type imports** in `.astro` frontmatter — the two dominant categories in
  Plan 107's list. It does **not** catch unused *private class members*
  (TypeScript `private` fields/methods with no `#`-prefix) in `.ts` files —
  `@typescript-eslint/no-unused-vars` doesn't check those by default (three
  such cases are in Plan 107: `pdpController.ts`'s `isInitialLoad`,
  `quickViewController.ts`'s `setActiveThumbnail`,
  `slugResolver.ts`'s `initializing`). Those remain visible only via `pnpm
  check`'s hint output, which doesn't fail CI. If this class of dead code
  recurs, the next `/improve tech-debt` pass should consider whether a
  stricter TS compiler option or a dedicated ESLint rule justifies the
  noise it would also add for the ~20 pre-existing `is:inline` script hints
  that are unrelated and expected.
- A reviewer should scrutinize: that the new rule block's `files` glob
  doesn't accidentally also match `**/*.ts` (double-applying the rule is
  harmless but sloppy — keep the blocks disjoint by glob).
