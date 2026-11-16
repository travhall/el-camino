# Plan 118: Wire pnpm lint into the pre-commit hook

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 8ff3096..HEAD -- .husky/pre-commit`
> If this file changed since this plan was written, compare the "Current
> state" excerpt below against the live file before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `8ff3096`, 2026-08-06

## Why this matters

`plans/101-dx-eslint-prettier.md` (marked DONE in `plans/README.md`) added
ESLint and Prettier to this repo and explicitly scoped wiring `pnpm lint`
into the pre-commit hook as in-scope work, with its own Maintenance notes
saying to "Add `pnpm lint` to the pre-commit hook (plan 100 integration) in
the next pass." That follow-up never happened. Today, `.husky/pre-commit`
runs `pnpm check` (typecheck) and `pnpm test:run` on every commit, but
never `pnpm lint` — meaning ESLint is fully installed, configured, and
currently clean repo-wide, but nothing enforces it at commit time. A
contributor can introduce a new lint violation and every commit will pass
silently until someone runs `pnpm lint` manually.

## Current state

- `.husky/pre-commit` (full file):
  ```sh
  #!/bin/sh
  STAGED=$(git diff --cached --name-only --diff-filter=ACMR | grep -E '\.(ts|astro|tsx)$' || true)
  if [ -n "$STAGED" ]; then
    pnpm check
  fi
  pnpm test:run
  ```
- `package.json`'s `"lint": "eslint src/"` script.
- `plans/100-dx-speed-up-precommit.md` (DONE) established the
  staged-file-scoping pattern this hook currently uses for `pnpm check` —
  `pnpm lint` should follow the same scoping convention, gated on the same
  `$STAGED` check, for consistency and to keep the hook fast (matching the
  whole reason Plan 100 exists).

## Commands you will need

| Purpose   | Command          | Expected on success |
|-----------|------------------|----------------------|
| Lint      | `pnpm lint`      | exit 0 (repo is currently clean) |
| Manual hook test | `git commit` (in a scratch/test scenario — see Step 2) | hook runs lint on staged `.ts`/`.astro`/`.tsx` files |

## Scope

**In scope** (the only files you should modify):
- `.husky/pre-commit`

**Out of scope** (do NOT touch, even though they look related):
- `eslint.config.mjs` — no rule changes needed, this plan only wires the
  existing, already-clean `pnpm lint` command into the hook.
- `package.json`'s `lint` script definition — unchanged, already correct.
- Adding `pnpm format:check` to the hook — not requested by this finding;
  if a future pass wants that too, it should be its own considered
  decision (format-check failures are noisier/more opinionated than lint
  failures and weren't part of Plan 101's stated scope gap).

## Git workflow

- Branch: `advisor/118-wire-lint-into-precommit`
- Commit message style: conventional commits, e.g. `chore: run pnpm lint
  in pre-commit hook for staged files` (matches `26f42a8 chore: fix
  pre-commit hook grep exit code and add .tsp/ to .gitignore` in
  `git log`, a prior commit touching this exact file).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add `pnpm lint` inside the existing staged-file guard

Change:
```sh
#!/bin/sh
STAGED=$(git diff --cached --name-only --diff-filter=ACMR | grep -E '\.(ts|astro|tsx)$' || true)
if [ -n "$STAGED" ]; then
  pnpm check
fi
pnpm test:run
```
to:
```sh
#!/bin/sh
STAGED=$(git diff --cached --name-only --diff-filter=ACMR | grep -E '\.(ts|astro|tsx)$' || true)
if [ -n "$STAGED" ]; then
  pnpm check
  pnpm lint
fi
pnpm test:run
```

Notes for the executor:
- `pnpm lint` runs `eslint src/` (the whole `src/` tree, per its
  `package.json` definition), not just the staged files — this matches
  how `pnpm check` already behaves in this hook (also whole-tree, not
  file-scoped, despite the `$STAGED` gate only controlling *whether* it
  runs, not *what* it checks). Do not attempt to scope ESLint itself to
  just the staged files' paths (e.g. `eslint $STAGED`) — that would be a
  larger behavioral change than what Plan 101's maintenance note asked
  for, and would diverge from the `pnpm check` precedent already set in
  this same hook. Keep the fix minimal and consistent with the existing
  pattern.
- Both `pnpm check` and `pnpm lint` only run when `.ts`/`.astro`/`.tsx`
  files are staged, matching Plan 100's original scoping intent (skip the
  gate entirely on commits that don't touch those file types, e.g. a
  docs-only or config-only commit).

**Verify**: `grep -A3 'if \[ -n "\$STAGED" \]' .husky/pre-commit` → shows both `pnpm check` and `pnpm lint`.

### Step 2: Manually verify the hook actually runs lint

Since this is a shell script, not something `pnpm test:run` can directly
unit test, verify by exercising it directly. Stage a `.ts` file (any
existing tracked file works — touch it with a no-op change like adding
and removing a blank line, or use a real change if you have one pending)
and either:
- Run `.husky/pre-commit` directly as a script (`sh .husky/pre-commit`),
  or
- Perform an actual `git commit` in a way that's easy to amend/undo
  afterward (confirm with the user/operator before committing anything
  real if this plan is being executed outside a disposable worktree — in
  an isolated worktree, a real test commit is fine and easy to reset).

Confirm the hook's output includes ESLint running (even if it reports 0
problems, since the repo is currently clean) — the goal is confirming the
hook *invokes* lint, not that lint finds anything.

**Verify**: hook output shows `pnpm lint` executing (e.g. a line
resembling `> el-camino@0.0.1 lint` / `> eslint src/` in the output),
exiting 0.

## Test plan

No automated test suite covers shell hook scripts in this repo — this is
a manual verification (Step 2). No new test file is needed.

## Done criteria

Machine-checkable. ALL must hold:

- [x] `grep -c "pnpm lint" .husky/pre-commit` → 1
- [x] `pnpm lint` exits 0 when run standalone (confirms the repo is still
      lint-clean, so wiring it in won't immediately block every future
      commit)
- [x] Manual verification (Step 2) confirms the hook actually invokes
      `pnpm lint` when `.ts`/`.astro`/`.tsx` files are staged
- [x] No files outside `.husky/pre-commit` are modified (`git status`)
- [x] `plans/README.md` status row for 118 updated

## STOP conditions

Stop and report back (do not improvise) if:

- `.husky/pre-commit` doesn't match the "Current state" excerpt above
  (drift since this plan was written) — re-read the live file and adapt
  the insertion point, but keep the same principle (lint gated on the
  same staged-file check as typecheck).
- `pnpm lint` is not actually clean when you run it standalone before
  making this change (contradicting the "repo is currently clean" premise
  this plan is based on) — if it now reports violations, this plan's
  premise has changed; report back rather than either suppressing the
  violations or silently fixing unrelated code to force it clean (that
  would be a different, larger change than this plan's scope).

## Maintenance notes

- This closes the exact gap `plans/101-dx-eslint-prettier.md`'s own
  maintenance notes flagged as deferred — a reviewer familiar with that
  plan's history should recognize this as closing that loop, not a new
  independent decision.
- Future contributors adding a fifth staged-file-gated check to this hook
  should follow the same pattern (inside the `if [ -n "$STAGED" ]` block,
  after the existing checks) rather than inventing a new gating mechanism.
