# Plan 138: Add `pnpm lint` to the CI workflow

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat cdf74a3..HEAD -- .github/workflows/ci.yml`
> If the file changed since this plan was written, compare the "Current
> state" excerpt against the live file before proceeding; on a mismatch,
> treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `cdf74a3`, 2026-09-04

## Why this matters

`.github/workflows/ci.yml`'s `test` job is literally named
**"Type check, lint, unit tests"** but never actually runs `pnpm lint` — it
only runs `pnpm check`, `pnpm test:run`, and `pnpm build`. Lint is currently
enforced only through the local `.husky/pre-commit` hook (wired in by
Plans 100/118), which is bypassable (`--no-verify`, a machine without
`pnpm install`'s hook setup, a fork PR). There are 26 pre-existing
`no-explicit-any` ESLint warnings already in the codebase (per several
prior plans' verification logs) — proof CI isn't actually watching this
surface, not a hypothetical gap.

## Current state

`.github/workflows/ci.yml`, the `test` job (full job shown, current commands
only):
```yaml
  test:
    name: Type check, lint, unit tests
    runs-on: ubuntu-latest
    timeout-minutes: 15
    env:
      # Stub values so module-load env checks pass during CI.
      # Real secrets live in Netlify; CI only needs to type-check and unit-test.
      SQUARE_ACCESS_TOKEN: ci-stub
      PUBLIC_SQUARE_APP_ID: ci-stub
      PUBLIC_SQUARE_LOCATION_ID: ci-stub
      PUBLIC_SQUARE_ENVIRONMENT: sandbox
      ADMIN_SECRET: ci-stub-admin-secret-do-not-use
      ADMIN_PASSWORD: ci-stub
      RESEND_API_KEY: ci-stub
      EMAIL_FROM: noreply@example.com
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - name: Astro check (type check)
        run: pnpm check

      - name: Unit tests
        run: pnpm test:run

      - name: Build
        run: pnpm build
```
There is no `- name: Lint` step anywhere in this file (confirmed via full
read of `ci.yml`, both the `test` and `e2e` jobs). `pnpm lint` currently
exits 0 with 0 errors, 26 pre-existing `no-explicit-any` warnings (per the
repo's `eslint.config.mjs` rules) — adding it as a CI step will not break
the pipeline in its current state.

## Commands you will need

| Purpose | Command       | Expected on success |
|---------|-------------------|----------------------|
| Lint    | `pnpm lint`      | exit 0 (26 pre-existing warnings, 0 errors) |

(No install/typecheck/test commands needed locally for this change — it's a
single-file CI config edit. The real verification happens on the next CI
run, see STOP conditions.)

## Scope

**In scope**:
- `.github/workflows/ci.yml` — add one step to the `test` job.

**Out of scope**:
- The `e2e` job — unrelated, no lint step needed there.
- `.husky/pre-commit` — already runs lint locally (Plans 100/118); untouched.
- Fixing any of the 26 pre-existing `no-explicit-any` warnings — out of
  scope; this plan only makes CI *observe* the existing lint state, not
  clean it up.

## Git workflow

- Branch: `advisor/138-add-lint-to-ci`
- Single commit.
- Commit message style: lowercase, conventional-ish prefix, e.g.
  `ci: run pnpm lint in the test job`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add the lint step

In `.github/workflows/ci.yml`'s `test` job, add a `- name: Lint` step. Place
it right after `Astro check (type check)` and before `Unit tests` — lint is
cheap and fails fast, matching the "cheapest check first" ordering already
used (typecheck before tests before build):

```yaml
      - name: Astro check (type check)
        run: pnpm check

      - name: Lint
        run: pnpm lint

      - name: Unit tests
        run: pnpm test:run
```

**Verify**: `grep -A1 "name: Lint" .github/workflows/ci.yml` shows
`run: pnpm lint` on the next line.

### Step 2: Run lint locally to confirm it would pass in CI

Run `pnpm lint` in the repo (same command CI will now run).

**Verify**: exits 0. If it exits non-zero, do NOT proceed — see STOP
conditions; the whole point of this plan is to add a gate that's
already green, not to introduce a new CI failure.

## Test plan

No application test changes — this is a CI configuration change. The "test"
for this plan is the next CI run itself (or a local dry-run of the same
command, per Step 2) succeeding with the new step present.

- Verification: `pnpm lint` locally → exit 0 (matches what CI will now run).
- If the operator can trigger a CI run (e.g. by pushing the branch), confirm
  the Actions log shows a "Lint" step that passed. If not observable in this
  environment, the local `pnpm lint` exit-0 result is sufficient evidence.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm lint` exits 0 locally
- [ ] `grep -c "name: Lint" .github/workflows/ci.yml` → `1`
- [ ] `grep -A1 "name: Lint" .github/workflows/ci.yml` shows `run: pnpm lint`
- [ ] The new step appears inside the `test` job, before `Unit tests` (visual check of the YAML)
- [ ] Only `.github/workflows/ci.yml` modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The live `ci.yml` doesn't match "Current state" (drift — e.g. a lint step
  already exists somewhere this plan's recon missed).
- `pnpm lint` exits non-zero locally — do not add the CI step while lint is
  red; report the failure instead, since adding a failing gate to CI blocks
  every future PR, which is a much bigger, different decision than this
  plan is scoped to make.

## Maintenance notes

- Once this lands, any future PR that introduces a new ESLint error will
  fail CI — this is the intended effect. The 26 pre-existing warnings
  (`no-explicit-any`) do not fail the build (ESLint warnings vs. errors),
  so this doesn't retroactively block anything already in the codebase.
- If a future plan wants to also fail CI on warnings (not just errors),
  that's a separate, more disruptive decision (would need to either fix all
  26 warnings first or explicitly accept the churn) — not in scope here.
