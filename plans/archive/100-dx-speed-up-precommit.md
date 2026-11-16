# Plan 100: Speed up pre-commit hook

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `cat .husky/pre-commit`

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: developer experience
- **Planned at**: commit `915a062`, 2026-08-01

## Why this matters

The pre-commit hook (`DX-02`) runs `pnpm check` (full Astro typecheck) on every commit. This is thorough but slow — Astro's type check runs the TypeScript compiler over all `.astro` files which takes 10-30 seconds on a cold run. Developers bypass slow hooks with `--no-verify`, which defeats the purpose.

The fix is to scope the hook to only changed files, or run a faster subset of checks (e.g. `tsc --noEmit` only on changed `.ts` files) while reserving the full `pnpm check` for CI.

## Current state

Read `.husky/pre-commit` to see what currently runs. Then time it:
```bash
time .husky/pre-commit
```

Note: the current pre-commit was added by plan 032.

## Commands

| Purpose | Command | Expected |
|---------|---------|---------|
| Hook time (before) | `time .husky/pre-commit` | record baseline |
| Hook time (after) | `time .husky/pre-commit` | measurably faster |
| Tests | `pnpm test:run` | unaffected |

## Scope

**In scope**: `.husky/pre-commit`

**Out of scope**: `package.json` scripts; CI config; no removal of checks, only faster execution

## Git workflow

- Branch: `advisor/100-dx-speed-up-precommit`
- Commit: `chore: scope pre-commit hook to staged files for faster commits`

## Steps

### Step 1: Read the current hook

Read `.husky/pre-commit`. Note what it runs.

### Step 2: Implement lint-staged or staged-file scoping

**Option A** (preferred if lint-staged not installed): use `git diff --cached --name-only` to get staged files, then run typecheck only if `.ts` or `.astro` files are staged:

```bash
#!/bin/sh
STAGED=$(git diff --cached --name-only --diff-filter=ACMR | grep -E '\.(ts|astro|tsx)$')
if [ -n "$STAGED" ]; then
  pnpm check
fi
pnpm test:run
```

**Option B**: install `lint-staged` and configure it in `package.json` to run `astro check` only when Astro/TS files change.

Choose whichever approach is lighter. If `lint-staged` is already installed (`grep "lint-staged" package.json`), use it.

### Step 3: Time the new hook

```bash
time .husky/pre-commit
```

Should be faster when no `.ts`/`.astro` files are staged.

### Step 4: Test the hook catches real errors

Introduce a deliberate type error in a `.ts` file, stage it, and confirm the hook fails. Revert the error.

## Done criteria

- [ ] Pre-commit is measurably faster when no TS/Astro files are staged
- [ ] Pre-commit still fails when a type error is introduced
- [ ] `pnpm test:run` still runs (don't skip tests)
- [ ] `plans/README.md` updated to DONE

## STOP conditions

- The full typecheck is required by policy (e.g. Astro's type system needs all files) — document why scoping is not possible and mark SKIP

## Maintenance notes

Full `pnpm check` must still run in CI (`pnpm build` calls it). The pre-commit hook is an early-warning device, not the gatekeeper.
