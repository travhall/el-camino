# Plan 188: Scope the pre-commit hook so it stops running the whole suite on every commit

> **Executor instructions**: Follow step by step. Run every verification command.
> If anything in "STOP conditions" occurs, stop and report. When done, update
> this plan's status row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat ad2999d..HEAD -- .husky/pre-commit package.json .github/workflows/ci.yml`
> On any change, compare against the excerpts below; on a mismatch, STOP.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW-MED
- **Depends on**: **158, 159, 160 (hard)** — see Why
- **Category**: dx
- **Planned at**: commit `ad2999d`, 2026-09-05

## Why this matters

The pre-commit hook runs `pnpm test:run` **unconditionally** — the full ~91-file
Vitest suite — on every commit, including docs- and config-only ones. It also
computes a staged-file list and then ignores it: the commands it guards
(`pnpm check`, and `pnpm lint` = `eslint src/`) both scan the entire tree
regardless of what was staged.

So commit latency is bounded by the full suite plus a full `astro check`, on the
loop developers and agents hit most often. Slow hooks get bypassed with
`--no-verify`, which removes the gate entirely — the worst outcome.

**Why the hard dependency**: narrowing the hook shifts responsibility to CI. Right
now **all three CI gates are no-ops** — the e2e job cannot boot its server (158),
`pnpm lint` cannot fail (159), and coverage thresholds are never evaluated (160).
Loosening the hook before CI is real would leave *nothing* checking anything.
**Do not start this plan until 158, 159, and 160 have landed.**

## Current state

`.husky/pre-commit`:

```sh
#!/bin/sh
STAGED=$(git diff --cached --name-only --diff-filter=ACMR | grep -E '\.(ts|astro|tsx)$' || true)
if [ -n "$STAGED" ]; then
  pnpm check
  pnpm lint
fi
pnpm test:run
```

`package.json:22` — `"lint": "eslint src/"` (whole tree; plan 159 widens it
further to the repo root, which makes this worse, not better).

`pnpm check` is `astro check` — whole-project by nature.

## Commands you will need

| Purpose      | Command                        | Expected |
|--------------|--------------------------------|----------|
| Typecheck    | `pnpm check`                   | exit 0   |
| Tests        | `pnpm test:run`                | exit 0   |
| Related only | `pnpm exec vitest related --run <files>` | exit 0 |
| Lint         | `pnpm lint`                    | exit 0   |

Never use `pnpm test` — watch mode, it hangs.

## Scope

**In scope**:
- `.husky/pre-commit`
- `package.json` — only if a helper script for the hook is needed

**Out of scope** (do NOT touch):
- `.github/workflows/ci.yml` — plans 158/159/160. CI must stay the full gate.
- `eslint.config.mjs` and the `lint` script's scope — plan 159.
- `vitest.config.ts`.
- Removing the hook entirely.

## Git workflow

- Branch: `advisor/188-scope-the-pre-commit-hook`
- Conventional commits, e.g. `chore: scope pre-commit checks to staged files`
- Do NOT push or open a PR unless the operator instructs it.

## Steps

### Step 1: Confirm CI is a real gate

```bash
grep -n "continue-on-error" .github/workflows/ci.yml
grep -n "max-warnings" package.json
grep -n "test:coverage\|test:run" .github/workflows/ci.yml
```

**Verify**: no `continue-on-error` on the e2e job (158), `--max-warnings 0` on
lint (159), and CI running a coverage-enabled test command (160).

**If any is missing, STOP.** Narrowing the hook now would leave the repo with no
effective gate at all.

### Step 2: Measure the current hook cost

Time each command on a representative commit:

```bash
time pnpm check
time pnpm lint
time pnpm test:run
```

**Verify**: record all three, and the total, in `plans/README.md`. Without a
baseline there is no way to say whether this plan helped.

### Step 3: Pass staged files to ESLint

ESLint accepts explicit paths. Feed it the already-computed `$STAGED` list rather
than `src/`.

Watch two things: filenames with spaces (quote properly), and the case where
`$STAGED` is empty (do not invoke ESLint with no paths — it would lint
everything or error).

**Verify**: stage one `.ts` file, run the hook, and confirm ESLint reports on
that file only.

### Step 4: Run only related tests

Replace the unconditional `pnpm test:run` with `vitest related --run` against the
staged files. `vitest related` maps changed files to the tests importing them.

Keep it inside a staged-files guard so a docs-only commit runs nothing.

**Important**: `vitest related` is a heuristic. It can miss a test that exercises
a file only indirectly — which is exactly why CI must keep running the full suite.
Add a comment in the hook saying so.

**Verify**: modify `src/lib/cart/index.ts`, stage it, run the hook, and confirm
the cart tests run and unrelated suites do not.

### Step 5: Leave `pnpm check` whole-project

`astro check` is whole-project by design and catches cross-file type breakage —
exactly the class of error a staged-file-only check would miss. **Leave it as is**,
guarded by the staged-files condition it already has.

If Step 2 shows `pnpm check` dominates the hook time, report it rather than
narrowing it; that is a different tradeoff.

**Verify**: `pnpm check` still runs unscoped in the hook.

### Step 6: Verify the hook end to end

Test four commit shapes:

1. docs-only (`README.md`) → hook runs nothing heavy
2. one `.ts` file with a passing test → lint + related tests only
3. one `.ts` file with a **failing** test → **commit blocked**
4. a `.ts` file with a type error → **commit blocked**

**Verify**: all four behave as described. Cases 3 and 4 matter most — a fast hook
that does not block is worse than a slow one.

### Step 7: Measure the improvement

Re-time the hook for each commit shape.

**Verify**: before/after recorded in `plans/README.md`.

## Test plan

- No unit tests — this is developer tooling.
- Verification is Step 6's four commit shapes, especially the two blocking cases.
- Record the timings; the whole point is latency.

## Done criteria

- [ ] Step 1 confirms 158, 159, 160 have all landed
- [ ] Step 2's baseline timings recorded
- [ ] ESLint runs against staged files only
- [ ] `vitest related --run` replaces the unconditional full run, inside a staged guard
- [ ] `pnpm check` still runs whole-project
- [ ] A comment in the hook notes `vitest related` is a heuristic and CI runs everything
- [ ] All four Step 6 commit shapes behave correctly — including both blocking cases
- [ ] Step 7's after-timings recorded
- [ ] `.github/workflows/ci.yml` unmodified (`git status`)

## STOP conditions

Stop and report if:

- **Any of 158/159/160 has not landed.** Hard dependency.
- A failing test or type error does **not** block the commit. That is a worse
  outcome than the slow hook; revert and report.
- `vitest related` misses tests that obviously should run for a given change.
  Report; the mapping may not work well with this repo's import structure, in
  which case keeping the full run is the right answer.
- The improvement is marginal (say <30%) because `pnpm check` dominates. Report
  the numbers — the honest conclusion may be that this is not worth doing.

## Maintenance notes

- **The division of labor**: the hook catches fast, local, obvious breakage; CI is
  the real gate. That only holds while CI is real — if a future change disables a
  CI gate, this hook must widen again.
- `vitest related` is a heuristic, deliberately. The comment in the hook is what
  stops someone concluding "the hook passed, so it's fine."
- Plan 159 widens `pnpm lint` to the repo root, which makes an unscoped hook lint
  even more. That is another reason to land 159 first.
- A reviewer should try to commit a knowingly-broken change and confirm the hook
  blocks it.
