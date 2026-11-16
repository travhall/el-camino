# Plan 159: Make `pnpm lint` capable of failing, and widen what it covers

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report. When done, update this
> plan's status row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat ad2999d..HEAD -- eslint.config.mjs package.json .github/workflows/ci.yml .husky/pre-commit`
> On any change, compare the excerpts below against live code first; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW-MED
- **Depends on**: none (shares `.github/workflows/ci.yml` with plans 158, 160)
- **Category**: dx
- **Planned at**: commit `ad2999d`, 2026-09-05

## Why this matters

`pnpm lint` **cannot fail**. Every configured rule is `warn`, and the script has
no `--max-warnings`. Verified:

```
$ pnpm lint; echo "exit=$?"
✖ 25 problems (0 errors, 25 warnings)
exit=0
```

Both gates that run it — CI (`ci.yml:44-45`) and the pre-commit hook
(`.husky/pre-commit:5`) — therefore pass unconditionally. The lint step added in
a previous plan bought nothing enforceable, 25 violations have accumulated
silently, and any rule added at `warn` severity in future will be equally
invisible.

Separately, `lint` and `format:check` only cover `src/`, so `e2e/` (5 spec files
plus helpers), `astro.config.mjs`, `vitest.config.ts`, `playwright.config.ts`,
and `eslint.config.mjs` are never checked — and `format:check` runs in no gate at
all, despite existing.

## Current state

`eslint.config.mjs:13-14` and `:28-29` — the only two rules, both `warn` in both
the `.ts` and `.astro` blocks:

```js
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
```

`eslint.config.mjs:6` — the config's own ignores are already narrow
(`dist/`, `.astro/`, `node_modules/`); only the npm script's path argument
restricts coverage to `src/`.

`package.json:22-24`:

```json
    "lint": "eslint src/",
    "format": "prettier --write src/",
    "format:check": "prettier --check src/",
```

`.github/workflows/ci.yml:44-45`:

```yaml
      - name: Lint
        run: pnpm lint
```

`.husky/pre-commit`:

```sh
STAGED=$(git diff --cached --name-only --diff-filter=ACMR | grep -E '\.(ts|astro|tsx)$' || true)
if [ -n "$STAGED" ]; then
  pnpm check
  pnpm lint
fi
pnpm test:run
```

## Commands you will need

| Purpose      | Command             | Expected             |
|--------------|---------------------|----------------------|
| Lint         | `pnpm lint`         | see Steps            |
| Format check | `pnpm format:check` | see Steps            |
| Typecheck    | `pnpm check`        | exit 0               |
| Tests        | `pnpm test:run`     | exit 0               |
| Build        | `pnpm build`        | exit 0               |

Never use `pnpm test` — watch mode, it hangs.

## Scope

**In scope**:
- `eslint.config.mjs`
- `package.json` (the `lint` / `format` / `format:check` scripts)
- `.github/workflows/ci.yml` (adding a `format:check` step)
- Source files, **only** to clear existing lint/format violations

**Out of scope** (do NOT touch):
- Adding **new** lint rules beyond the two configured. Turning on the existing
  two is already a meaningful change; a rule sweep is separate work.
- `.husky/pre-commit` — plan 188 owns hook scoping. This plan changes what
  `pnpm lint` *does*, which the hook picks up for free.
- The `Playwright e2e` job and the coverage step in `ci.yml` — plans 158 and 160.
- Refactoring code to remove `any` where doing so needs real type work at the
  Square SDK boundary. See Step 2 — those get an explicit disable with a reason,
  not a rushed retype.

## Git workflow

- Branch: `advisor/159-make-lint-able-to-fail`
- Conventional commits, e.g. `ci: make pnpm lint fail on warnings and widen its scope`
- Do NOT push or open a PR unless the operator instructs it.

## Steps

### Step 1: Record the baseline

```bash
pnpm lint 2>&1 | tail -3
```

**Verify**: note the exact violation count (25 at commit `ad2999d`) and record it
in the `plans/README.md` status row. Save the full output — you need the file
list for Step 2.

### Step 2: Clear the existing violations

For each of the 25, either fix it properly or add a targeted
`// eslint-disable-next-line <rule> -- <reason>` with a real reason. Prefer
fixing; use a disable when the honest answer is "this is a Square SDK response
shape we do not model."

Do **not** blanket-disable a rule at file or config level.

**Verify**: `pnpm lint 2>&1 | tail -3` → `0 problems`.

### Step 3: Make the gate enforce

Change the script to fail on any warning:

```json
    "lint": "eslint src/ --max-warnings 0",
```

Add a comment in `eslint.config.mjs` above the rule block explaining that the
rules stay at `warn` severity but `--max-warnings 0` makes them blocking, so the
count can only ratchet down — the same baselining strategy the coverage
thresholds use.

**Verify**:
```bash
pnpm lint; echo "exit=$?"
```
→ `exit=0` with 0 problems. Then temporarily introduce an unused variable in any
`src/` file and re-run → **non-zero exit**. Revert the temporary change.

This second check is the whole point of the plan — do not skip it.

### Step 4: Widen lint and format coverage

Point both at the repo root, relying on `eslint.config.mjs`'s own `ignores`:

```json
    "lint": "eslint . --max-warnings 0",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
```

Confirm Prettier has a `.prettierignore` covering `dist/`, `coverage/`,
`node_modules/`, `playwright-report/`, and `test-results/`; create one if absent,
or the format check will try to parse build output.

Run `pnpm format` once to normalize the newly-covered files, and commit that
normalization **as its own commit** so the functional change stays reviewable.

**Verify**:
```bash
pnpm lint && pnpm format:check
```
→ both exit 0.

### Step 5: Add `format:check` to CI

Add a step to the `Type check, lint, unit tests` job, after the existing Lint
step:

```yaml
      - name: Format check
        run: pnpm format:check
```

**Verify**: `grep -n "format:check" .github/workflows/ci.yml` → present.

### Step 6: Full gate

```bash
pnpm check && pnpm lint && pnpm format:check && pnpm test:run && pnpm build
```
→ all exit 0.

## Test plan

- No unit tests — this plan changes tooling configuration.
- The decisive verification is Step 3's negative test: an introduced violation
  must make `pnpm lint` exit non-zero. Record that you performed it.
- `pnpm test:run` must still pass; Step 2's fixes touch source, so watch for
  behavior changes from an over-eager `any` removal.

## Done criteria

- [ ] Step 1 baseline count recorded in `plans/README.md`
- [ ] `pnpm lint` reports 0 problems and exits 0
- [ ] Step 3 negative test performed: an introduced unused variable makes `pnpm lint` exit non-zero
- [ ] `pnpm lint` and `pnpm format:check` cover the repo root, not just `src/`
- [ ] A `.prettierignore` (or equivalent) excludes `dist/`, `coverage/`, `node_modules/`, `playwright-report/`, `test-results/`
- [ ] `format:check` runs in `.github/workflows/ci.yml`
- [ ] Formatting normalization is a separate commit from the functional change
- [ ] `pnpm check` / `pnpm test:run` / `pnpm build` all exit 0
- [ ] `.husky/pre-commit` unmodified (`git status`)

## STOP conditions

Stop and report if:

- **Clearing a violation requires a non-trivial refactor.** Use a documented
  `eslint-disable-next-line` instead and note it in the status row. Do not
  restructure Square SDK boundary code under a lint plan.
- Step 2's fixes change runtime behavior — e.g. removing a variable that had a
  side effect. Report it; that is a bug found, not a lint fix.
- Widening to the repo root surfaces a very large number of new violations
  (say >100). Report the count; the operator may prefer to widen scope in a
  follow-up rather than in one commit.
- Any verification fails twice after a reasonable fix attempt.

## Maintenance notes

- **The ratchet**: with `--max-warnings 0`, the count can only go down. Adding a
  new rule at `warn` now has teeth immediately, so introduce new rules
  deliberately and clear them in the same change.
- One of three CI findings from the same audit — see plans 158 and 160. **All
  three gates are currently no-ops**; landing one leaves a misleading picture.
- 158, 159, 160 all edit `.github/workflows/ci.yml`. Expect a manual merge on the
  second and third.
- A reviewer should confirm every `eslint-disable` added in Step 2 carries a real
  reason, not just a rule name.
