# Plan 112: Clear the timeout timer in ApiRetryClient.withTimeout

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 8ff3096..HEAD -- src/lib/square/apiRetry.ts`
> If this file changed since this plan was written, compare the "Current
> state" excerpt below against the live file before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `8ff3096`, 2026-08-06

## Why this matters

`ApiRetryClient` wraps every retried Square API call (used throughout
`create-checkout.ts`, `calculate-cart.ts`, and the catalog/inventory layer)
in a timeout via `withTimeout()`:

```ts
private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs);
    })
  ]);
}
```

The `setTimeout` handle here is never captured, so it's never cleared. On
the **successful** path — the common case, where `promise` resolves before
`timeoutMs` elapses — the losing timer from `Promise.race` keeps running in
the background for up to `timeoutMs` (default configured per-call, commonly
several seconds to `config.timeoutMs`) after the result has already been
used and returned. In a long-lived warm Netlify function instance handling
many requests, this means every successful retried call leaves a dangling
timer alive briefly — unnecessary event-loop work and, in aggregate under
load, timer accumulation that serves no purpose once the real result is
already in hand.

This is a small, low-risk fix: capture the timer handle and clear it
whichever way the race resolves.

## Current state

- `src/lib/square/apiRetry.ts:36` — `export class ApiRetryClient {`
- `src/lib/square/apiRetry.ts:69-99` — `executeWithRetry()`, the only
  caller of `withTimeout()`:
  ```ts
    public async executeWithRetry<T>(
      operation: () => Promise<T>,
      context: string,
      customConfig?: Partial<RetryConfig>
    ): Promise<T> {
      const config = { ...this.defaultRetryConfig, ...customConfig };

      // Check circuit breaker
      if (this.shouldFailFast()) {
        throw new Error(`Circuit breaker OPEN for ${context} - failing fast`);
      }

      let lastError: Error;

      for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
        try {
          // Add timeout wrapper
          const result = await this.withTimeout(operation(), config.timeoutMs);

          // Success - record for circuit breaker
          this.recordSuccess();
          return result;

        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          // Record failure for circuit breaker
          this.recordFailure();
          // Don't retry on final attempt
          if (attempt === config.maxRetries) {
            break;
          ...
  ```
- `src/lib/square/apiRetry.ts:193-200` — `withTimeout()`, the method to
  fix:
  ```ts
    private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
      return Promise.race([
        promise,
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs);
        })
      ]);
    }
  ```
- `src/lib/square/__tests__/apiRetry.test.ts` — existing test suite, uses
  `vi.useFakeTimers()`/`vi.useRealTimers()` in `beforeEach`/`afterEach` and
  constructs the client via `ApiRetryClient.getInstance()` +
  `client.reset()`. This file has a **higher-than-global** coverage
  threshold enforced in `vitest.config.ts` — any new branch must stay
  covered.

## Commands you will need

| Purpose   | Command          | Expected on success |
|-----------|------------------|----------------------|
| Typecheck | `pnpm check`     | exit 0, "0 errors" |
| Tests     | `pnpm test:run -- apiRetry` | all pass |
| Coverage  | `pnpm test:coverage` | exit 0 — `src/lib/square/apiRetry.ts` has an enforced per-file threshold in `vitest.config.ts`, higher than the 80% global |
| Lint      | `pnpm lint`      | exit 0 |
| Build     | `pnpm build`     | exit 0 |

## Scope

**In scope** (the only files you should modify):
- `src/lib/square/apiRetry.ts`
- `src/lib/square/__tests__/apiRetry.test.ts`

**Out of scope** (do NOT touch, even though they look related):
- The circuit-breaker logic (`shouldFailFast`, `recordSuccess`,
  `recordFailure`) — unrelated to this timer-leak fix, don't touch.
- `src/lib/square/apiUtils.ts` — a different, older, already-mostly-dead
  utility per prior plans (024/041) — irrelevant here.
- Any change to the *default* timeout values or retry counts
  (`RetryConfig`) — out of scope, this plan only fixes the timer cleanup,
  not the timing policy itself.

## Git workflow

- Branch: `advisor/112-fix-apiretry-timer-leak`
- Commit message style: conventional commits, e.g. `fix: clear pending
  timeout timer in ApiRetryClient.withTimeout` (matches
  `ae873b6 fix: prevent stale sale prices from overwriting cart after
  navigation` in `git log` for a similarly-scoped internal-state fix).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Capture and clear the timer handle

Replace `withTimeout()` with a version that stores the `setTimeout` handle
and clears it once the race settles, regardless of which side won:

```ts
private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(
      () => reject(new Error(`Operation timed out after ${timeoutMs}ms`)),
      timeoutMs
    );
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutHandle);
  });
}
```

Notes for the executor:
- `.finally()` on the `Promise.race` result runs once the race settles
  either way (whichever promise wins), so `clearTimeout` always fires
  exactly once per call — this is the key change from the current code,
  which never calls `clearTimeout` at all.
- Keep the method's public signature and return type identical
  (`Promise<T>`) — callers (`executeWithRetry`) don't need to change.
- TypeScript's `ReturnType<typeof setTimeout>` is the correct
  cross-environment timer-handle type for this codebase's Node/Netlify
  runtime (avoids assuming browser `number` vs Node `Timeout` object) —
  use it rather than `any` or a hardcoded type (this codebase's ESLint
  config warns on `@typescript-eslint/no-explicit-any`).

**Verify**: `pnpm check` → 0 errors. `grep -n "clearTimeout" src/lib/square/apiRetry.ts` → 1 match.

### Step 2: Add a regression test

Using the existing `vi.useFakeTimers()` setup already in
`apiRetry.test.ts`'s `beforeEach`, add a test that: calls
`executeWithRetry` with an operation that resolves immediately, then
asserts no pending timer remains — Vitest's fake timers expose
`vi.getTimerCount()` for this. Model the test's setup/teardown exactly on
the existing tests in this file (same `beforeEach`/`afterEach`,
`ApiRetryClient.getInstance()` + `client.reset()` pattern already visible
in the file's `describe('ApiRetryClient', ...)` block).

Example shape (adapt variable names to match the file's existing
conventions — read the surrounding tests first):
```ts
it('clears the timeout timer after a successful call', async () => {
  mockOperation.mockResolvedValue('ok');
  await client.executeWithRetry(mockOperation, 'test-context');
  expect(vi.getTimerCount()).toBe(0);
});
```

**Verify**: `pnpm test:run -- apiRetry` → all pass, including the new case.

## Test plan

- New test in `src/lib/square/__tests__/apiRetry.test.ts`: successful call
  → `vi.getTimerCount()` is `0` after the call resolves (proves the timer
  was cleared, not just that the call succeeded — the old code would also
  pass a naive "does it resolve" test while still leaking the timer).
- Optionally (not required, but strengthens the test if the existing suite
  already has a timeout-triggering test to model from): a case where the
  operation times out — assert the rejection still happens with the
  correct error message, unchanged from before this fix (confirms
  `.finally()` didn't swallow the timeout's own rejection).
- Verification: `pnpm test:run -- apiRetry` → all pass;
  `pnpm test:coverage` → exit 0, per-file threshold for
  `src/lib/square/apiRetry.ts` still met.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm check` exits 0, "0 errors"
- [ ] `pnpm test:run -- apiRetry` exits 0, new test passing
- [ ] `pnpm test:coverage` exits 0, `apiRetry.ts` per-file threshold met
- [ ] `pnpm lint` exits 0
- [ ] `pnpm build` exits 0
- [ ] `grep -n "clearTimeout" src/lib/square/apiRetry.ts` → 1 match
- [ ] No files outside the Scope list are modified (`git status`)
- [ ] `plans/README.md` status row for 112 updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at `apiRetry.ts:193-200` doesn't match the excerpt above (drift
  since this plan was written).
- Adding `.finally()` changes the resolved/rejected value or type in a way
  `pnpm check` flags — `.finally()` should be transparent to the
  settled value, but if TypeScript disagrees, investigate rather than
  cast around it.
- The existing test suite's fake-timer setup doesn't expose
  `vi.getTimerCount()` as expected (e.g. a Vitest version mismatch) —
  check the installed Vitest version and its docs for the equivalent API
  in that version rather than guessing.

## Maintenance notes

- A reviewer should confirm the fix applies uniformly regardless of which
  side of the `Promise.race` wins — both the success path and the
  already-correct timeout-rejection path should end with zero pending
  timers.
- No behavior change for callers: `executeWithRetry`'s retry loop, circuit
  breaker, and backoff/jitter logic are untouched — this is purely an
  internal resource-cleanup fix.
