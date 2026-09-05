# Plan 143: Bump global coverage thresholds to match measured reality

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat cdf74a3..HEAD -- vitest.config.ts`
> If the file changed since this plan was written, re-run `pnpm test:coverage`
> before proceeding — the measured percentages below may be stale; on a
> mismatch, treat it as a STOP condition.
>
> **Sequencing note**: if any of `plans/139-...md`, `plans/140-...md`,
> `plans/141-...md`, `plans/142-...md` (the new test-coverage plans from this
> same audit round) have already landed when you execute this plan, coverage
> will be measurably higher than the numbers in "Current state" below —
> re-run `pnpm test:coverage` fresh and use the live numbers instead of this
> plan's stale ones. Landing this plan *after* those is preferable (gives a
> tighter, more accurate floor) but not required — either order works.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (soft: land after 139-142 if run in the same session, see Sequencing note above)
- **Category**: dx
- **Planned at**: commit `cdf74a3`, 2026-09-04

## Why this matters

`vitest.config.ts`'s global coverage thresholds were "baselined just under
real coverage as of 2026-08-16" (per the file's own comment) after fixing a
schema bug that had silently disabled the originally-intended 80% gate.
Nearly three weeks and ~15 commits of test-coverage work later (Plans
069-071, 085-090, and this same audit round's 139-142), real coverage has
risen well above that baseline, but the gate itself was never bumped. A
coverage gate exists to catch regressions — a floor sitting 5-10 points
below actual coverage means a real regression has to eat that whole buffer
before the gate notices anything.

## Current state

`vitest.config.ts:44-49`:
```ts
        thresholds: {
          branches: 45,
          functions: 55,
          lines: 50,
          statements: 50,
```
(Full surrounding context, lines 35-73, includes the "don't restore 80%
without first getting real coverage there" comment and per-file overrides
for `src/lib/cart/index.ts`, `src/lib/square/apiRetry.ts`,
`src/lib/square/inventory.ts` — none of those three per-file blocks are
touched by this plan.)

A direct `pnpm test:coverage` run (not a subagent's summary — run it
yourself before editing anything) measured actual repo-wide coverage at:
**59.86% statements / 50.25% branches / 61.58% functions / 60.94% lines** —
5 to 10+ points above every one of the four global floors above.

## Commands you will need

| Purpose  | Command                | Expected on success |
|----------|----------------------------|----------------------|
| Coverage | `pnpm test:coverage`      | exit 0, thresholds met |

## Scope

**In scope**:
- `vitest.config.ts` — only the 4 global threshold numbers (lines 46-49).

**Out of scope**:
- The three per-file threshold overrides (`cart/index.ts`, `apiRetry.ts`,
  `inventory.ts`) — untouched, they already have their own justified,
  higher floors.
- Any test file — this plan doesn't add coverage, it just raises the gate
  to reflect coverage that (by the time this executes) already exists.

## Git workflow

- Branch: `advisor/143-bump-coverage-thresholds`
- Single commit.
- Commit message style: lowercase, conventional-ish prefix, e.g.
  `chore: bump global coverage thresholds to match measured reality`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Measure current real coverage

Run `pnpm test:coverage` and record the four repo-wide percentages
(statements/branches/functions/lines) from its summary output. If Plans
139-142 have already landed in this worktree, these numbers will be higher
than this plan's "Current state" section — use whatever you measure now,
not this plan's stale numbers.

**Verify**: command exits 0 (thresholds still pass against the *current*,
lower gate before you touch it).

### Step 2: Set new thresholds 2-3 points below the measured numbers

In `vitest.config.ts`, update the four global threshold values to
approximately 2-3 percentage points below what Step 1 measured — enough
margin that normal, non-regressive test-count fluctuation (a skipped edge
case, a slightly-different code path exercised) doesn't spuriously fail CI,
but tight enough that a real coverage drop gets caught quickly. Using this
plan's measured baseline as an example (if you didn't need to re-measure in
Step 1): `branches: 47, functions: 59, lines: 58, statements: 57`.

Update the comment above the thresholds block to note the new baseline date
(today) instead of leaving the stale "as of 2026-08-16" reference — keep
the rest of the comment's guidance ("ratchet up as coverage improves, don't
restore 80% without first getting real coverage there") since it's still
correct advice.

**Verify**: `grep -A5 "thresholds:" vitest.config.ts` shows the new numbers.

### Step 3: Confirm the new thresholds pass

Run `pnpm test:coverage` again.

**Verify**: exits 0, all four global thresholds pass with the current test
suite.

## Test plan

No new tests — this plan only tightens an existing gate to match reality.

- Verification: `pnpm test:coverage` → exits 0 both before (Step 1, old
  thresholds) and after (Step 3, new thresholds) the change.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm test:coverage` exits 0 with the new thresholds in place
- [ ] The four global threshold numbers in `vitest.config.ts` are each
      within ~2-3 points of measured coverage at the time this plan executes
      (not necessarily this plan's stated 47/59/58/57 — see Sequencing note)
- [ ] The three per-file threshold overrides (`cart/index.ts`,
      `apiRetry.ts`, `inventory.ts`) are unchanged
- [ ] Only `vitest.config.ts` modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `pnpm test:coverage` fails against the *current* (pre-change) thresholds
  before you've made any edit — would mean coverage has regressed since
  this plan was written; investigate why before raising the bar further.
- After Step 2's bump, `pnpm test:coverage` fails — the new numbers were
  set too aggressively (too close to or above actual coverage); back off by
  another point or two rather than reverting the whole plan.

## Maintenance notes

- This is a "ratchet," not a one-time fix — the file's own comment already
  says to bump these as coverage improves. Whoever next does a significant
  test-coverage push should repeat this same measure-then-bump exercise
  rather than leaving the gate to drift stale again.
- Do not jump straight to 80% (the pre-2026-08-16 aspirational value) in one
  step — that number was proven to not reflect real coverage once already;
  each bump should be grounded in a fresh `pnpm test:coverage` measurement,
  per this plan's own Step 1.
