# Plan 219: Raise the coverage gate to match real coverage and stop it sliding

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
> When done, update this plan's status row in `plans/README.md`.

> **Drift check (run first)**:
> `git diff --stat 2ba4b13..HEAD -- vitest.config.ts`
> If any listed file changed, compare the "Current state" notes against the
> live code first; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: 184 (soft)
- **Category**: dx
- **Planned at**: commit `2ba4b13`, 2026-11-16

## Why this matters

The global coverage gate was baselined on 2026-09-04 at 57% statements, 47%
branches, 59% functions, 58% lines, just under what coverage was that day.
About 150 commits and several hundred tests later the gate has not moved, so
coverage could fall a long way before anything fails.

## Current state

`vitest.config.ts:46-50` holds the four global numbers; the comment above
them explains the baseline and says to ratchet upward. Per-file thresholds
follow for `cart/index.ts` and `square/apiRetry.ts`.

## Steps

### Step 1: Measure

`pnpm test:coverage`. Record the four global percentages.

### Step 2: Set each global threshold 2 points under the measured value

Rounded down. Update the dated comment above `thresholds` with the new
measured numbers. Per `CLAUDE.md`, that comment is the place for these
numbers, not `CLAUDE.md` itself.

### Step 3: List the worst uncovered files that matter

From the report, list files under `src/lib/checkout/`, `src/lib/cart/`,
`src/lib/email/` and `src/pages/api/` below 60% lines. `mini-cart-client.ts`
(779 lines) is outside the coverage `include` entirely: say so in the row.
Do not write tests in this plan; the list feeds the next audit.

**Verify**: `pnpm test:coverage` exits 0 with the new thresholds.

## STOP conditions

- Measured coverage is below the current thresholds: the gate is already
  failing; stop and report instead of lowering anything.
