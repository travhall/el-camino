# Plan 218: Stop the unit tests and type check from calling Square and WordPress

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
> When done, update this plan's status row in `plans/README.md`.

> **Drift check (run first)**:
> `git diff --stat 2ba4b13..HEAD -- astro.config.mjs src/lib/sitemapPages.ts vitest.config.ts`
> If any listed file changed, compare the "Current state" notes against the
> live code first; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: —
- **Category**: dx
- **Planned at**: commit `2ba4b13`, 2026-11-16

## Why this matters

Every `pnpm test:run` prints a Square `401 UNAUTHORIZED` error, and so does
every commit, because the pre-commit hook runs the tests. The tests pass
anyway, so the noise hides real failures and teaches everyone to ignore red
text. It also means a unit test run makes live calls to Square and WordPress
with whatever credentials are in `.env`.

## Current state

`astro.config.mjs:8-17` imports `buildSitemapPages` and awaits it at module
top level, catching the failure and logging
`[sitemap] buildSitemapPages failed, using empty list`. Vitest loads the Astro
config to build its own, so the call runs on every test start. `astro check`
loads the same config.

Seen 2026-11-16: `Status code: 401 ... AUTHENTICATION_ERROR` during
`vitest run`, 1423 tests passing.

## Steps

### Step 1: Confirm who triggers it

Run `pnpm test:run`, `pnpm check` and `pnpm build` separately and record which
print the `[sitemap]` line. Only `pnpm build` should need the sitemap.

### Step 2: Only fetch when building

Skip `buildSitemapPages()` unless the command is a build: gate on
`process.env.VITEST` and on the Astro command (`process.argv` includes
`build`), returning an empty list otherwise. Keep the existing catch for
builds.

**Verify**: `pnpm test:run 2>&1 | grep -c "\[sitemap\]"` prints `0`;
`pnpm check` prints no `[sitemap]` line; `pnpm build` still produces
`dist/` with a sitemap listing product URLs (with valid credentials).

### Step 3: Make a missing sitemap loud in production builds

A build that silently ships an empty sitemap is worse than a failed one. When
the build runs on Netlify with `CONTEXT=production`, rethrow instead of
falling back. **Verify**: unit test for the gating function covering test,
check, local build and production build.

### Step 4: Full gate

`pnpm check && pnpm lint && pnpm test:coverage && pnpm build` all exit 0.

## STOP conditions

- The 401 comes from somewhere other than the sitemap call: stop and report
  the caller; do not suppress the log.
- Local `.env` credentials are simply expired: that is separate. Tell Travis;
  still do Steps 2 and 3.
