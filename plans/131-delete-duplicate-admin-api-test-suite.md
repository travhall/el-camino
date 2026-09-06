# Plan 131: Delete the duplicate admin API route test suite

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat cdf74a3..HEAD -- src/pages/api/__tests__ src/pages/api/admin/__tests__ src/pages/api/admin`
> If any in-scope file changed since this plan was written, compare the
> "Current state" section against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `cdf74a3`, 2026-09-04

## Why this matters

Every admin API route under `src/pages/api/admin/*.ts` is currently tested
**twice**, in two different directories, by two independently-written test
files that exercise the same route with equivalent coverage. This doubles
the file count and CI time for zero additional coverage, and creates a
maintenance tax: any future change to one of these routes now requires
remembering to update two test files instead of one, and the two copies can
silently drift out of sync with each other (they already have different
mocking styles/quote conventions today). Deleting the redundant set is a
pure cleanup with no coverage loss — confirmed by 1:1 file-name mapping
between the two directories.

## Current state

Two directories both hold tests for the routes in `src/pages/api/admin/`:

- `src/pages/api/__tests__/admin-<name>.test.ts` (flat directory, `admin-`
  prefix) — 17 files.
- `src/pages/api/admin/__tests__/<name>.test.ts` (nested directory, no
  prefix) — 15 files.

15 of the 17 flat-directory files have a same-route counterpart in the nested
directory (verified via `ls` diff of both directories against
`src/pages/api/admin/*.ts`):

| Route (`src/pages/api/admin/*.ts`) | Flat-dir test | Nested-dir test |
|---|---|---|
| `banner.ts` | `admin-banner.test.ts` | `banner.test.ts` |
| `contact.ts` | `admin-contact.test.ts` | `contact.test.ts` |
| `dismiss-order.ts` | `admin-dismiss-order.test.ts` | `dismiss-order.test.ts` |
| `hours.ts` | `admin-hours.test.ts` | `hours.test.ts` |
| `mark-pickedup.ts` | `admin-mark-pickedup.test.ts` | `mark-pickedup.test.ts` |
| `mark-shipped.ts` | `admin-mark-shipped.test.ts` | `mark-shipped.test.ts` |
| `remove-back-in-stock.ts` | `admin-remove-back-in-stock.test.ts` | `remove-back-in-stock.test.ts` |
| `restore-back-in-stock.ts` | `admin-restore-back-in-stock.test.ts` | `restore-back-in-stock.test.ts` |
| `retry-failed-emails.ts` | `admin-retry-failed-emails.test.ts` | `retry-failed-emails.test.ts` |
| `sale-visibility.ts` | `admin-sale-visibility.test.ts` | `sale-visibility.test.ts` |
| `send-back-in-stock.ts` | `admin-send-back-in-stock.test.ts` | `send-back-in-stock.test.ts` |
| `send-pickup-reminder.ts` | `admin-send-pickup-reminder.test.ts` | `send-pickup-reminder.test.ts` |
| `shop-status.ts` | `admin-shop-status.test.ts` | `shop-status.test.ts` |
| `shop-visibility.ts` | `admin-shop-visibility.test.ts` | `shop-visibility.test.ts` |
| `social.ts` | `admin-social.test.ts` | `social.test.ts` |

Example of the duplication (both test `src/pages/api/admin/banner.ts`, same
mocks, same assertions, different formatting):
`src/pages/api/__tests__/admin-banner.test.ts` (71 lines, single-quote style)
vs. `src/pages/api/admin/__tests__/banner.test.ts` (88 lines, double-quote
style, more descriptive `it()` names but the same underlying cases).

Two flat-directory files have **no** nested-directory counterpart and are not
part of the duplication — do not touch these:
- `src/pages/api/__tests__/admin-auth.test.ts` (tests `src/pages/api/admin-auth.ts`,
  a different route, not under `src/pages/api/admin/`)
- `src/pages/api/__tests__/admin-logout.test.ts` (tests
  `src/pages/api/admin-logout.ts`, same situation)

The nested directory (`src/pages/api/admin/__tests__/`) is the one to
**keep** — it mirrors the source layout 1:1 (`src/pages/api/admin/banner.ts`
↔ `src/pages/api/admin/__tests__/banner.test.ts`), which is the pattern this
repo already uses for every other route directory's tests (co-located
`__tests__/` subdirectories, not a single flat top-level test folder). The 15
flat-directory `admin-*.test.ts` files are the ones to **delete**.

## Commands you will need

| Purpose   | Command                                              | Expected on success |
|-----------|--------------------------------------------------------|----------------------|
| Tests     | `pnpm test:run`                                       | all pass             |
| Coverage  | `pnpm test:coverage`                                  | exit 0, thresholds met |
| Typecheck | `pnpm check`                                          | exit 0, no errors    |
| Lint      | `pnpm lint`                                           | exit 0               |

## Scope

**In scope** (delete only):
- `src/pages/api/__tests__/admin-banner.test.ts`
- `src/pages/api/__tests__/admin-contact.test.ts`
- `src/pages/api/__tests__/admin-dismiss-order.test.ts`
- `src/pages/api/__tests__/admin-hours.test.ts`
- `src/pages/api/__tests__/admin-mark-pickedup.test.ts`
- `src/pages/api/__tests__/admin-mark-shipped.test.ts`
- `src/pages/api/__tests__/admin-remove-back-in-stock.test.ts`
- `src/pages/api/__tests__/admin-restore-back-in-stock.test.ts`
- `src/pages/api/__tests__/admin-retry-failed-emails.test.ts`
- `src/pages/api/__tests__/admin-sale-visibility.test.ts`
- `src/pages/api/__tests__/admin-send-back-in-stock.test.ts`
- `src/pages/api/__tests__/admin-send-pickup-reminder.test.ts`
- `src/pages/api/__tests__/admin-shop-status.test.ts`
- `src/pages/api/__tests__/admin-shop-visibility.test.ts`
- `src/pages/api/__tests__/admin-social.test.ts`

**Out of scope** (do NOT touch, even though they look related):
- `src/pages/api/__tests__/admin-auth.test.ts` — no nested-directory
  counterpart; this is the only test for `admin-auth.ts`, deleting it would
  be a real coverage loss.
- `src/pages/api/__tests__/admin-logout.test.ts` — same reasoning, only test
  for `admin-logout.ts`.
- Every file in `src/pages/api/admin/__tests__/` — these are the surviving
  copies; do not edit or rename them, even if you notice a formatting
  inconsistency between the two styles. This plan is deletion-only.
- The route source files themselves (`src/pages/api/admin/*.ts`) — not
  touched by this plan.
- Any other `src/pages/api/__tests__/admin-*.test.ts` file not listed above
  in "In scope" — if you find one this plan didn't account for, treat it as
  a STOP condition (see below) rather than guessing whether it's a duplicate.

## Git workflow

- Branch: `advisor/131-delete-duplicate-admin-api-test-suite`
- Single commit for the whole deletion.
- Commit message style: lowercase, conventional-ish prefix, e.g.
  `test: remove duplicate admin API test suite (superseded by src/pages/api/admin/__tests__)`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Confirm the coverage baseline before deleting anything

Run `pnpm test:coverage` and note the pass/fail counts and overall coverage
percentages. This is your "before" baseline to compare against in Step 3.

**Verify**: exits 0, thresholds met (this is the pre-existing state — it
should already be green before you touch anything).

### Step 2: Delete the 15 duplicate files

Delete exactly the 15 files listed in "In scope" above. Use `git rm` (not a
raw `rm`) so the deletion is staged cleanly:

```
git rm src/pages/api/__tests__/admin-banner.test.ts \
  src/pages/api/__tests__/admin-contact.test.ts \
  src/pages/api/__tests__/admin-dismiss-order.test.ts \
  src/pages/api/__tests__/admin-hours.test.ts \
  src/pages/api/__tests__/admin-mark-pickedup.test.ts \
  src/pages/api/__tests__/admin-mark-shipped.test.ts \
  src/pages/api/__tests__/admin-remove-back-in-stock.test.ts \
  src/pages/api/__tests__/admin-restore-back-in-stock.test.ts \
  src/pages/api/__tests__/admin-retry-failed-emails.test.ts \
  src/pages/api/__tests__/admin-sale-visibility.test.ts \
  src/pages/api/__tests__/admin-send-back-in-stock.test.ts \
  src/pages/api/__tests__/admin-send-pickup-reminder.test.ts \
  src/pages/api/__tests__/admin-shop-status.test.ts \
  src/pages/api/__tests__/admin-shop-visibility.test.ts \
  src/pages/api/__tests__/admin-social.test.ts
```

**Verify**: `ls src/pages/api/__tests__/ | grep -v -E "^(admin-auth|admin-logout)\.test\.ts$" | grep "^admin-"` →
no output (only `admin-auth.test.ts` and `admin-logout.test.ts` remain
matching the `admin-` prefix pattern).

### Step 3: Re-run coverage and compare against the Step 1 baseline

Run `pnpm test:coverage` again.

**Verify**: exits 0, all thresholds still met, and the per-file coverage for
every route in `src/pages/api/admin/*.ts` is unchanged (still covered by the
surviving `src/pages/api/admin/__tests__/*.test.ts` files) — same or better
overall percentages than the Step 1 baseline. If any route's coverage drops,
that's a STOP condition (see below).

## Test plan

No new tests are written — this plan only removes redundant ones. The
"test" for this plan *is* the coverage comparison in Step 3: total repo-wide
test count drops by exactly 15 files' worth of cases, but coverage
percentages for every affected route file must not regress, because the
nested-directory copy already covers the same cases.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm test:run` exits 0
- [ ] `pnpm test:coverage` exits 0, thresholds met, no per-file regression
      vs. the Step 1 baseline
- [ ] `pnpm check` exits 0
- [ ] `pnpm lint` exits 0
- [ ] `find src/pages/api/__tests__ -maxdepth 1 -name "admin-*.test.ts"` lists
      only `admin-auth.test.ts` and `admin-logout.test.ts`
- [ ] `git status` shows only the 15 deletions (no other files modified)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The file lists in "Current state" don't match what's actually on disk
  (drift since this plan was written — e.g. a 16th duplicate pair exists, or
  one of the 15 "in scope" files is missing).
- Any of the 15 flat-directory files being deleted contains a test case with
  **no equivalent** in its nested-directory counterpart (i.e. it's not a pure
  duplicate — it covers something the other file doesn't). If you find this,
  do not delete that specific file; instead port the missing case into the
  nested-directory file first, or report back and ask before proceeding.
- Coverage drops for any route in `src/pages/api/admin/*.ts` after Step 2.

## Maintenance notes

- Going forward, admin API route tests belong in
  `src/pages/api/admin/__tests__/`, matching the source layout — not in the
  flat `src/pages/api/__tests__/` directory. If a future PR adds a new admin
  route test in the flat directory, that's worth flagging in review as a
  reversion to the pattern this plan removed.
- `admin-auth.test.ts` and `admin-logout.test.ts` remain in the flat
  directory because they test routes (`admin-auth.ts`, `admin-logout.ts`)
  that live directly under `src/pages/api/`, not under
  `src/pages/api/admin/` — there is no naming inconsistency here worth
  "fixing" by moving them; they're correctly co-located with their routes.
