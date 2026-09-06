# Plan 132: Collapse `apiRetry.ts`'s always-default env knobs into constants

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat cdf74a3..HEAD -- src/lib/square/apiRetry.ts`
> If the file changed since this plan was written, compare the "Current
> state" excerpt against the live code before proceeding; on a mismatch,
> treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `cdf74a3`, 2026-09-04

## Why this matters

`ApiRetryClient`'s default retry/circuit-breaker configuration reads from 7
environment variables, but none of them has ever actually varied: 3 are set
in `.env`/`.env.production` to exactly the value the code would use anyway if
the variable were absent, and the other 4 are never set anywhere in the repo
at all. This is configurability nobody uses, on a checkout-critical file that
also carries an enforced 90% coverage threshold in `vitest.config.ts` —
every one of these `parseInt(import.meta.env.X || 'default')` reads is a
branch the test suite has to cover for no operational benefit. Replacing them
with plain constants removes dead surface area without changing behavior:
the resolved values today are identical to the hardcoded defaults.

**Explicitly not in scope**: `executeWithRetry`'s third parameter,
`customConfig` (`apiRetry.ts:72`), is a *separate* mechanism — a per-call
override merged on top of the instance's default config
(`{ ...this.defaultRetryConfig, ...customConfig }`). It has no production
caller, but `src/lib/square/__tests__/apiRetry.test.ts` uses it extensively
(30+ call sites) to exercise retry/backoff/circuit-breaker behavior with
short delays instead of the real ~10s defaults. That is exactly what a
per-call config override is for — a legitimate test-speed use, not dead code.
Do not remove `customConfig` or touch its call sites; this plan is scoped to
the environment-variable defaults only.

## Current state

`src/lib/square/apiRetry.ts:43-55`, inside the `ApiRetryClient` class:

```ts
  private defaultRetryConfig: RetryConfig = {
    maxRetries: parseInt(import.meta.env.SQUARE_MAX_RETRIES || '3'),
    baseDelay: parseInt(import.meta.env.SQUARE_BASE_DELAY || '500'),
    maxDelay: parseInt(import.meta.env.SQUARE_MAX_DELAY || '5000'),
    jitterRange: parseFloat(import.meta.env.SQUARE_JITTER_RANGE || '0.1'),
    timeoutMs: parseInt(import.meta.env.SQUARE_TIMEOUT_MS || '10000')
  };

  private circuitConfig: CircuitBreakerConfig = {
    failureThreshold: parseInt(import.meta.env.SQUARE_CIRCUIT_THRESHOLD || '5'),
    recoveryTimeoutMs: parseInt(import.meta.env.SQUARE_RECOVERY_TIMEOUT || '30000'),
    monitorWindowMs: parseInt(import.meta.env.SQUARE_MONITOR_WINDOW || '60000')
  };
```

Verified via `grep -rn "SQUARE_MAX_RETRIES\|SQUARE_BASE_DELAY\|SQUARE_MAX_DELAY\|SQUARE_JITTER_RANGE\|SQUARE_TIMEOUT_MS\|SQUARE_CIRCUIT_THRESHOLD\|SQUARE_RECOVERY_TIMEOUT\|SQUARE_MONITOR_WINDOW" .env .env.production`:
only `SQUARE_MAX_RETRIES=3`, `SQUARE_BASE_DELAY=500`, and
`SQUARE_CIRCUIT_THRESHOLD=5` are set — each equal to the hardcoded fallback
already in the code above. `SQUARE_MAX_DELAY`, `SQUARE_JITTER_RANGE`,
`SQUARE_TIMEOUT_MS`, `SQUARE_RECOVERY_TIMEOUT`, and `SQUARE_MONITOR_WINDOW`
are not set in either file (or anywhere else in the repo — there is no
`.env.example` currently tracked, so there's no third place to check). There
is no evidence any deployment target (Netlify env vars are configured
outside this repo and out of reach here) sets these to anything different —
and even if one did, the code has no operational reason documented anywhere
(no comment, no ADR, no plan) for why these specific values would ever need
to differ per-environment; they describe Square's own API retry
characteristics, not something that changes between dev/staging/prod.

`import.meta.env` reads only work through Vite's env replacement — both
`.env` and `.env.production` are gitignored, untracked, developer-local
files (confirmed via `git ls-files | grep -i env` returning nothing for
either). This plan only touches `apiRetry.ts`; it does not edit `.env` or
`.env.production` (out of scope, see below) and does not touch any Netlify
dashboard configuration.

## Commands you will need

| Purpose   | Command                                                        | Expected on success |
|-----------|--------------------------------------------------------------------|----------------------|
| Typecheck | `pnpm check`                                                    | exit 0, no errors    |
| Tests     | `pnpm test:run`                                                 | all pass             |
| Coverage  | `pnpm test:coverage`                                             | exit 0, `apiRetry.ts` still ≥ 90% branches/functions/lines/statements |
| Lint      | `pnpm lint`                                                      | exit 0               |

## Scope

**In scope**:
- `src/lib/square/apiRetry.ts` — only the `defaultRetryConfig` and
  `circuitConfig` field initializers (lines 43-55).

**Out of scope**:
- `executeWithRetry`'s `customConfig` parameter and every call site that uses
  it (see "Why this matters" above) — do not remove or modify.
- `.env`, `.env.production` — these are local/gitignored files, not part of
  the repo's tracked source; removing the now-inert `SQUARE_MAX_RETRIES`,
  `SQUARE_BASE_DELAY`, `SQUARE_CIRCUIT_THRESHOLD` lines from them is optional
  developer housekeeping, not something this plan requires or verifies.
- Any Netlify/deployment dashboard configuration — outside this repo,
  outside this plan's reach.
- Every other file in `src/lib/square/` — none of them reference these env
  vars (confirmed via the same grep above); this is a single-file change.

## Git workflow

- Branch: `advisor/132-collapse-apiretry-dead-env-knobs`
- Single commit.
- Commit message style: lowercase, conventional-ish prefix, e.g.
  `chore: replace apiRetry.ts's always-default env knobs with constants`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Replace the env-var reads with plain constants

Replace the two field initializers at `apiRetry.ts:43-55` with:

```ts
  private defaultRetryConfig: RetryConfig = {
    maxRetries: 3,
    baseDelay: 500,
    maxDelay: 5000,
    jitterRange: 0.1,
    timeoutMs: 10000,
  };

  private circuitConfig: CircuitBreakerConfig = {
    failureThreshold: 5,
    recoveryTimeoutMs: 30000,
    monitorWindowMs: 60000,
  };
```

Every numeric value is unchanged from what `import.meta.env` already resolved
to today (see "Current state") — this is a pure simplification, not a
behavior change.

**Verify**: `grep -n "import.meta.env.SQUARE_" src/lib/square/apiRetry.ts` →
no matches.

## Test plan

No new tests — this is a refactor of dead configurability with identical
resolved values, not a behavior change. `src/lib/square/__tests__/apiRetry.test.ts`
already exercises `defaultRetryConfig`'s effective values indirectly (e.g.
tests that don't pass `customConfig` and rely on defaults); those must
continue to pass unchanged since the constants match the values those tests
were already observing.

- Verification: `pnpm test:run` → same pass count as before this plan.
- Verification: `pnpm test:coverage` → `src/lib/square/apiRetry.ts` still
  meets its `vitest.config.ts` per-file thresholds (branches/functions/
  lines/statements all ≥ 90%). Removing dead `parseInt(... || ...)` branches
  should make this easier to hit, not harder — if it regresses, something
  else about the file changed since this plan was written (drift).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm check` exits 0
- [ ] `pnpm lint` exits 0
- [ ] `pnpm test:run` exits 0, same pass count as pre-change baseline
- [ ] `pnpm test:coverage` exits 0; `src/lib/square/apiRetry.ts` still meets
      its 90%/90%/90%/90% per-file threshold in `vitest.config.ts`
- [ ] `grep -n "import.meta.env.SQUARE_" src/lib/square/apiRetry.ts` returns
      no matches
- [ ] `grep -n "customConfig" src/lib/square/apiRetry.ts` still shows the
      parameter unchanged (confirms Step 1 didn't touch it)
- [ ] Only `src/lib/square/apiRetry.ts` modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The live `defaultRetryConfig`/`circuitConfig` excerpt doesn't match
  "Current state" (drift).
- `.env` or `.env.production` (if you can read them) set any of the 7
  variables to a value *different* from this plan's assumed defaults
  (3 / 500 / 5000 / 0.1 / 10000 / 5 / 30000 / 60000) — that would mean the
  "always-default" premise is wrong for this deployment, and the constants
  should use that different value instead, or the plan should be reconsidered
  entirely.
- Coverage on `apiRetry.ts` drops below its `vitest.config.ts` threshold
  after Step 1.

## Maintenance notes

- If a real future need arises to tune Square retry behavior per-environment
  (e.g. a slower staging API), reintroducing environment-variable overrides
  is a small, well-understood change — but should come with an actual
  documented reason at that time, not speculative "might need it later"
  configurability.
- `catalogRetryClient` and `checkoutRetryClient` (the two exported singleton
  instances at the bottom of the file, added by
  `plans/064-split-api-retry-circuit-breaker.md`) both construct their own
  `defaultRetryConfig`/`circuitConfig` from these same class field
  initializers — this change affects both instances identically, which
  matches today's behavior (both already resolved to the same values).
