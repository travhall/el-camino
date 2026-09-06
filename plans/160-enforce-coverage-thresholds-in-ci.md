# Plan 160: Actually run coverage in CI so the thresholds mean something

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report. When done, update this
> plan's status row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat ad2999d..HEAD -- .github/workflows/ci.yml vitest.config.ts package.json`
> On any change, compare the excerpts below against live code first; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (shares `.github/workflows/ci.yml` with plans 158, 159)
- **Category**: dx
- **Planned at**: commit `ad2999d`, 2026-09-05

## Why this matters

`vitest.config.ts` carries carefully baselined coverage thresholds — statements
57, branches 47, functions 59, lines 58, plus per-file minimums for
`src/lib/cart/index.ts`, `src/lib/square/apiRetry.ts`, and
`src/lib/square/inventory.ts`. Getting those numbers right was its own plan.

**Nothing ever evaluates them.** Vitest only checks `thresholds` when coverage is
enabled, and no gate enables it:

- `.github/workflows/ci.yml:48` runs `pnpm test:run` = `vitest run` (no coverage)
- `.husky/pre-commit:7` runs the same command
- `package.json:25` defines `test:ci` (`vitest run --coverage --reporter=verbose`)
  which is referenced by **no** workflow, hook, or doc

So coverage can regress arbitrarily on any PR and nothing notices. This is the
same failure mode `vitest.config.ts`'s own comments describe having already
suffered once — a nested `global: {}` key that silently disabled the originally
intended 80% gate. The gate was fixed; the fact that nothing runs it was not.

## Current state

`vitest.config.ts:45-49`:

```ts
        thresholds: {
          branches: 47,
          functions: 59,
          lines: 58,
          statements: 57,
```

`.github/workflows/ci.yml:47-48`:

```yaml
      - name: Unit tests
        run: pnpm test:run
```

`package.json:19-25` (relevant scripts):

```json
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage",
    ...
    "test:ci": "vitest run --coverage --reporter=verbose",
```

## Commands you will need

| Purpose  | Command              | Expected                        |
|----------|----------------------|---------------------------------|
| Coverage | `pnpm test:coverage` | exit 0, thresholds met          |
| Tests    | `pnpm test:run`      | exit 0                          |
| Typecheck| `pnpm check`         | exit 0                          |
| Lint     | `pnpm lint`          | exit 0                          |

Never use `pnpm test` — watch mode, it hangs.

## Scope

**In scope**:
- `.github/workflows/ci.yml` (the `Unit tests` step in the first job only)

**Out of scope** (do NOT touch):
- The threshold **values** in `vitest.config.ts`. If current coverage is below
  them, that is a finding to report, not a number to lower. See STOP conditions.
- `.husky/pre-commit` — keep the fast `pnpm test:run` there. Plan 188 owns hook
  scoping; running coverage on every commit would make the hook slow enough that
  people bypass it.
- The `Playwright e2e` job (plan 158) and the `Lint` step (plan 159).
- Coverage `include` patterns. Widening them to cover `src/scripts/**` or
  `.astro` files is plan 181's territory and would change the measured numbers.

## Git workflow

- Branch: `advisor/160-enforce-coverage-thresholds-in-ci`
- Conventional commits, e.g. `ci: run coverage so vitest thresholds are enforced`
- Do NOT push or open a PR unless the operator instructs it.

## Steps

### Step 1: Confirm coverage currently passes its own thresholds

```bash
pnpm test:coverage; echo "exit=$?"
```

**Verify**: `exit=0`. Record the four measured percentages in the
`plans/README.md` status row.

If this exits non-zero, the thresholds are already unmet and this plan turns CI
red on the first run — that is a STOP condition, not something to fix by
lowering numbers.

### Step 2: Point the CI step at coverage

Change `.github/workflows/ci.yml:47-48` to run the coverage-enabled command, and
comment why:

```yaml
      # Coverage-enabled: vitest only evaluates the `thresholds` in
      # vitest.config.ts when coverage is on. Running plain `vitest run` here
      # (as this step used to) meant the thresholds were never checked.
      - name: Unit tests (with coverage)
        run: pnpm test:coverage
```

Use `test:coverage` rather than `test:ci` — `--reporter=verbose` produces very
noisy CI logs for no gate benefit. If you prefer `test:ci`, say why in the status
row.

**Verify**: `grep -n "test:coverage\|test:run" .github/workflows/ci.yml` → the
unit-test step uses the coverage command.

### Step 3: Prove the gate has teeth

Temporarily lower a threshold's satisfaction — the cleanest way is to bump one
threshold in `vitest.config.ts` far above current coverage (e.g. `statements: 95`)
and confirm the command fails:

```bash
pnpm test:coverage; echo "exit=$?"
```
→ **non-zero**, with a threshold error naming `statements`.

Then **revert the threshold change**. This is a negative test, not a
configuration change.

**Verify**: after reverting, `git diff vitest.config.ts` is empty, and
`pnpm test:coverage` exits 0 again.

### Step 4: Confirm in real CI

Push the branch and watch the workflow.

**Verify**: the unit-test job reports coverage output and passes. Record the run
URL in the status row.

### Step 5: Full gate

```bash
pnpm check && pnpm lint && pnpm test:coverage
```
→ all exit 0.

## Test plan

- No new tests — this plan wires an existing gate to an existing command.
- The decisive verification is Step 3's negative test: an unmeetable threshold
  must fail the command. Record that you performed it and reverted.

## Done criteria

- [ ] Step 1's four measured coverage percentages recorded in `plans/README.md`
- [ ] `.github/workflows/ci.yml`'s unit-test step runs a coverage-enabled command
- [ ] Step 3 negative test performed and **reverted** (`git diff vitest.config.ts` empty)
- [ ] A real CI run passes with coverage output; run URL recorded
- [ ] `vitest.config.ts` threshold values unchanged (`git status`)
- [ ] `.husky/pre-commit` unmodified (`git status`)
- [ ] Only `.github/workflows/ci.yml` modified (`git status`)

## STOP conditions

Stop and report if:

- **Step 1 fails** — current coverage is already below the configured thresholds.
  Do **not** lower the thresholds to make CI green. Report the measured numbers
  and the gap; the operator decides between raising coverage and re-baselining.
- Coverage runs materially slower than the plain test run (say >3× wall clock),
  making the PR gate painful. Report the timings.
- The coverage run is flaky — passing and failing across identical runs. That
  indicates non-deterministic tests and is a bigger problem than this plan.
- Any verification fails twice after a reasonable fix attempt.

## Maintenance notes

- **The ratchet, now real**: with coverage enforced, raising the thresholds
  actually protects the gain. Plans that add tests should bump the thresholds in
  the same change, as a previous plan did.
- **Deleting dead code will lower measured coverage** if that code was tested —
  plan 184 flags exactly this for `src/lib/wordpress/content-utils.ts`. Once this
  plan lands, that deletion must re-baseline the thresholds in the same commit or
  it will turn CI red.
- One of three CI findings from the same audit (plans 158, 159, 160). **All three
  gates are currently no-ops.** Landing one leaves a misleading picture.
- 158, 159, 160 all edit `.github/workflows/ci.yml`. Expect a manual merge on the
  second and third.
- `CLAUDE.md` documents stale threshold numbers — plan 163 fixes that. Coordinate
  if both land close together.
