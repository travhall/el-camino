# Plan 086: Fill email sender and templates test coverage gaps

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> ```
> git diff --stat 915a062..HEAD -- src/lib/email/sender.ts src/lib/email/templates.ts
> ```
> If either file changed, read it fully before writing tests.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: test-coverage
- **Planned at**: commit `915a062`, 2026-08-01

## Why this matters

`src/lib/email/sender.ts` and `src/lib/email/templates.ts` have test files
(`sender.test.ts`, `templates.test.ts`) created by plan 039, but coverage
has gaps in branches added since then. Specifically:

- `templates.ts` HTML builder functions have untested error branches (what
  happens when order has no `lineItems`, when `totalMoney` is null, when
  `contact.fulfillmentMethod` is an unexpected value)
- `sender.ts` has paths for `sendPickupNotification` and
  `sendShippingOrderNotification` that may lack tests if only
  `sendOrderConfirmation` was tested in plan 039
- `src/lib/email/failedEmails.ts` and `pendingOrders.ts` exist alongside
  their test files — verify coverage on retry/store edge cases

The goal: bring these files to ≥ 80% branch coverage to pass the repo's
global threshold.

## Current state

Read `src/lib/email/sender.ts`, `src/lib/email/templates.ts`,
`src/lib/email/sender.test.ts`, `src/lib/email/templates.test.ts` to
determine which branches are currently covered and which are not.

Run:
```bash
pnpm test:coverage -- --reporter=verbose 2>&1 | grep -A5 "email"
```

to see the current branch coverage percentages for each email file.

## Commands you will need

| Purpose   | Command                        | Expected on success |
|-----------|--------------------------------|---------------------|
| Tests     | `pnpm test:run -- email`       | all pass            |
| Coverage  | `pnpm test:coverage`           | all thresholds met  |

## Scope

**In scope**:
- `src/lib/email/sender.test.ts` (extend existing)
- `src/lib/email/templates.test.ts` (extend existing)
- `src/lib/email/failedEmails.test.ts` (extend if coverage gaps found)

**Out of scope**:
- `src/lib/email/sender.ts`, `templates.ts`, `failedEmails.ts` — tests only
- `src/pages/api/__tests__/webhook-square.test.ts` — already covers the integration

## Git workflow

- Branch: `advisor/086-tst-email-coverage-gaps`
- Commit: `test: fill coverage gaps in email sender and templates`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Run coverage and identify gaps

```bash
pnpm test:coverage -- --reporter=verbose 2>&1 | grep -B2 -A10 "email"
```

For each email file below 80% branch coverage, identify which branches are
uncovered (vitest coverage reporter shows uncovered lines/branches).

### Step 2: Add missing tests

In `src/lib/email/templates.test.ts`, add tests for any uncovered branches:

```typescript
// Examples of likely missing cases:
it('renders minimal order email when lineItems is empty');
it('renders order email when totalMoney is null');
it('renders pickup notification with correct store address');
it('renders shipping notification with tracking placeholder');
it('escapes HTML in customer name to prevent XSS');
```

In `src/lib/email/sender.test.ts`, add tests if `sendPickupNotification`
or `sendShippingOrderNotification` are uncovered:

```typescript
it('sends pickup notification for pickup fulfillment');
it('sends shipping notification for shipping fulfillment');
it('throws when Resend API key is not set');
```

Follow the existing test file structure and mock pattern exactly.

**Verify**: `pnpm test:run -- email` → all pass

### Step 3: Run coverage

```
pnpm test:coverage
```

**Verify**: all email files ≥ 80% branch coverage; global threshold met.

## Done criteria

- [ ] `pnpm test:coverage` exits 0
- [ ] All email lib files (`sender.ts`, `templates.ts`) ≥ 80% branch coverage
- [ ] New tests follow the existing mock pattern in those files
- [ ] No source files are modified
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

- Email files already at ≥ 80% branch coverage — no new tests needed; mark DONE and note it
- The mock for Resend (`@resend/react`, `resend`) doesn't exist in tests — check the existing pattern before writing

## Maintenance notes

- Each new function added to `sender.ts` or `templates.ts` should get a corresponding test in these files.
