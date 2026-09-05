# Plan 162: Make the documented `SQUARE_*` tuning env vars actually work

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report. When done, update this
> plan's status row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat ad2999d..HEAD -- src/lib/square/apiRetry.ts README.md`
> On any change, compare the excerpts below against live code first; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `ad2999d`, 2026-09-05

## Why this matters

`README.md:100-110` documents eight environment variables under
*"Optional — Square retry/circuit-breaker tuning (sane defaults if unset)"*:

```
SQUARE_MAX_RETRIES, SQUARE_BASE_DELAY, SQUARE_MAX_DELAY, SQUARE_JITTER_RANGE,
SQUARE_TIMEOUT_MS, SQUARE_CIRCUIT_THRESHOLD, SQUARE_RECOVERY_TIMEOUT,
SQUARE_MONITOR_WINDOW
```

**No code reads any of them.** Verified:

```
$ grep -rn "SQUARE_MAX_RETRIES\|SQUARE_BASE_DELAY\|SQUARE_TIMEOUT_MS\|SQUARE_CIRCUIT_THRESHOLD" src/ astro.config.mjs netlify.toml | wc -l
0
```

This is a documented production tuning knob for the circuit breaker guarding
**all** Square catalog and checkout traffic. During a Square incident an operator
would set `SQUARE_MAX_RETRIES` or `SQUARE_TIMEOUT_MS` in Netlify, redeploy, and
believe they had changed the retry budget — having changed nothing. That is the
worst possible time to discover a phantom control.

The values in the README exactly match the hardcoded defaults, so wiring them up
is behavior-preserving when unset.

## Current state

`src/lib/square/apiRetry.ts:43-56` — the literals, in the shape the env vars
would populate:

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

The README's documented values (`README.md:98-101` and above) match these
exactly — `SQUARE_TIMEOUT_MS=10000`, `SQUARE_CIRCUIT_THRESHOLD=5`,
`SQUARE_RECOVERY_TIMEOUT=30000`, `SQUARE_MONITOR_WINDOW=60000`.

`src/lib/square/apiRetry.ts:58` — `constructor() {}` is currently empty, which is
where the env reads belong.

### Repo conventions

- Server-side env is read via `process.env` (see `src/lib/square/squareInstance.ts:10`
  for the module-load validation pattern). Only `PUBLIC_`-prefixed vars reach the
  client (`astro.config.mjs` `envPrefix`), and none of these are public.
- Per-file coverage thresholds in `vitest.config.ts` apply to
  `src/lib/square/apiRetry.ts` — adding uncovered branches here can fail the
  build. Tests are mandatory, not optional.

## Commands you will need

| Purpose   | Command                       | Expected             |
|-----------|-------------------------------|----------------------|
| Typecheck | `pnpm check`                  | exit 0               |
| Tests     | `pnpm test:run -- apiRetry`   | all pass             |
| Coverage  | `pnpm test:coverage`          | exit 0, no regression|
| Lint      | `pnpm lint`                   | exit 0               |

Never use `pnpm test` — watch mode, it hangs.

## Scope

**In scope**:
- `src/lib/square/apiRetry.ts`
- `src/lib/square/__tests__/apiRetry.test.ts`
- `README.md` (only to correct the documented block if Step 1 changes anything)

**Out of scope** (do NOT touch):
- The **default values**. Unset env must produce byte-identical behavior to today.
- The retry/circuit-breaker **algorithm** — backoff shape, state transitions,
  timeout handling. A previous plan deliberately collapsed some dead knobs here;
  read `git log -- src/lib/square/apiRetry.ts` before assuming any knob is
  vestigial.
- Where retry is *applied*. The composite-operation retry amplification is a real
  separate finding (plan 176's cluster) — this plan only makes existing config
  reachable.
- Other `SQUARE_*` variables (`SQUARE_ACCESS_TOKEN` etc.) — those already work.

## Git workflow

- Branch: `advisor/162-wire-square-tuning-env-vars`
- Conventional commits, e.g. `fix: read the documented SQUARE_* tuning vars instead of ignoring them`
- Do NOT push or open a PR unless the operator instructs it.

## Steps

### Step 1: Confirm the gap and the intended names

```bash
grep -rn "SQUARE_" README.md | sed -n '1,20p'
grep -rn "SQUARE_MAX_RETRIES\|SQUARE_BASE_DELAY\|SQUARE_MAX_DELAY\|SQUARE_JITTER_RANGE\|SQUARE_TIMEOUT_MS\|SQUARE_CIRCUIT_THRESHOLD\|SQUARE_RECOVERY_TIMEOUT\|SQUARE_MONITOR_WINDOW" src/ astro.config.mjs netlify.toml
```

**Verify**: the README lists eight names; the source grep returns **zero** matches.
If any are already wired, this plan's premise is partly wrong — report which.

### Step 2: Read them in the constructor, defaulting to today's literals

Populate both config objects from env with the current literals as fallbacks.
Parse defensively — an unparseable or non-positive value must fall back to the
default rather than producing `NaN`, which would silently break backoff maths.

Write one small helper for numeric env parsing rather than repeating
`Number(...) || default` eight times, and note in a comment that `||` is
deliberate over `??` here because `0` is not a valid value for any of these.

`SQUARE_JITTER_RANGE` is a fraction (0.1), not an integer — make sure the parse
handles decimals.

**Verify**: `pnpm check` → exit 0.

### Step 3: Log the effective configuration once at startup

On first construction, log the resolved config at info level (matching the
repo's existing logging style — see `src/lib/logger.ts`). Without this, an
operator still cannot confirm their setting took effect, which is the exact
failure this plan exists to prevent.

**Verify**: covered by Step 4's tests plus a manual `pnpm dev` check.

### Step 4: Full gate

```bash
pnpm check && pnpm lint && pnpm test:run && pnpm test:coverage
```
→ all exit 0.

## Test plan

Add to `src/lib/square/__tests__/apiRetry.test.ts`, following its existing style.
Because the class is a singleton (`getInstance()`), you will need to reset it
between cases — check how the existing tests handle that; if they do not, use
`vi.resetModules()` with a dynamic import per case.

Cases:
- no env set → config equals the documented defaults (the behavior-preservation proof)
- each of the eight vars set to a valid value → that value appears in the config
- a var set to a non-numeric string → falls back to the default, no `NaN`
- a var set to `0` or a negative number → falls back to the default
- `SQUARE_JITTER_RANGE=0.25` → parsed as `0.25`, not `0`

`pnpm test:coverage` → exit 0. `apiRetry.ts` has a per-file threshold; confirm it
still passes after adding branches.

## Done criteria

- [ ] All eight documented vars are read by `src/lib/square/apiRetry.ts`
- [ ] `grep -c "SQUARE_MAX_RETRIES\|SQUARE_BASE_DELAY\|SQUARE_MAX_DELAY\|SQUARE_JITTER_RANGE\|SQUARE_TIMEOUT_MS\|SQUARE_CIRCUIT_THRESHOLD\|SQUARE_RECOVERY_TIMEOUT\|SQUARE_MONITOR_WINDOW" src/lib/square/apiRetry.ts` returns 8
- [ ] With no env set, the resolved config equals the documented defaults (test asserts this)
- [ ] Invalid / zero / negative values fall back to defaults, never `NaN`
- [ ] Effective config is logged once at startup
- [ ] `pnpm check` / `pnpm lint` / `pnpm test:run` all exit 0
- [ ] `pnpm test:coverage` exits 0, `apiRetry.ts` per-file threshold still met
- [ ] Only in-scope files modified (`git status`)

## STOP conditions

Stop and report if:

- **A documented var has no corresponding config field.** Do not invent a new
  knob to match the README — report the mismatch; deleting the README line may be
  the right answer for that one.
- Wiring a var changes behavior when unset. The no-env case must be byte-identical.
- The singleton makes per-test env variation impractical without restructuring
  `getInstance()`. Report rather than refactoring the singleton under this plan.
- Any verification fails twice after a reasonable fix attempt.

## Maintenance notes

- **The rule**: a documented env var must be read by code, or it must not be
  documented. This is the same silent-config class as the dead `netlify.toml`
  image rule (plan 146), the `s-max-age` typo (plan 154), and the wrong
  `Netlify-Vary` keys (plan 155) — configuration that looks active and does
  nothing. Worth a standing check across the repo.
- The startup log in Step 3 is the cheap defense: it makes "my setting did
  nothing" immediately visible instead of invisible.
- A reviewer should verify the defaults are unchanged by diffing the resolved
  config in the no-env test against the literals at `apiRetry.ts:43-56`.
- **Deliberately deferred**: whether these timeouts are the *right* values, and
  the retry-amplification problem where the whole composite catalog fetch is
  retried rather than individual calls (plan 176's cluster).
