# Plan 119: Fix stale lint/format/version/LOC claims in CLAUDE.md and README

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 8ff3096..HEAD -- CLAUDE.md README.md`
> If either file changed since this plan was written, compare the "Current
> state" excerpts below against the live files before proceeding; on a
> mismatch, re-run the verification commands in this plan (file
> counts/versions) fresh rather than trusting the numbers below, since
> they may have shifted along with the drift.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: docs
- **Planned at**: commit `8ff3096`, 2026-08-06

## Why this matters

Two project-orientation docs both drifted stale after the ESLint/Prettier
tooling (Plan 101) and several dependency bumps landed without a
corresponding doc update:

1. **`CLAUDE.md` — actively false, not just outdated.** Its own header
   says "Keep this file in sync with reality — if a fact here turns out
   to be wrong, fix this file in the same change that fixes the
   discrepancy." Its Commands section currently states: *"No lint/format
   script exists yet — there is no ESLint or Prettier config in this repo
   as of this writing."* This is false today: `eslint.config.mjs`,
   `.prettierrc.json`, and `package.json`'s `lint`/`format`/`format:check`
   scripts all exist, added in `4774772 chore: add ESLint and Prettier
   with Astro and TypeScript support` — a commit that lands *after*
   CLAUDE.md's own last content edit for that section. An agent reading
   CLAUDE.md today is told to skip a real, enforced check.
2. **`README.md` — several stale numbers, none individually severe, but
   collectively undermine trust in the doc.** Version badges show
   `Astro-7.1.3` (installed: `7.1.6`) and, further down, `@astrojs/netlify
   v8.1.2` (installed: `8.1.3`). The "Codebase Size" line claims
   "~48,894 lines of code across 169 files" — the actual current count
   (`find src -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.astro" \)
   | wc -l` and a line count over those same files) is **281 files,
   64,359 lines**. README also never mentions ESLint, Prettier, or the
   Husky pre-commit hook anywhere in its Development/Testing/Contributing
   sections.

## Current state

- `CLAUDE.md:26-27`:
  ```markdown
  - No lint/format script exists yet — there is no ESLint or Prettier config in
    this repo as of this writing.
  ```
  (This is the last bullet in the "## Commands" section, right after the
  `pnpm build` bullet.)
- `README.md:5` — badge row:
  ```markdown
  ![Astro](https://img.shields.io/badge/Astro-7.1.3-orange?logo=astro&logoColor=white)
  ```
- `README.md:366` (inside a "Netlify Configuration" list):
  ```markdown
  - **Adapter**: @astrojs/netlify v8.1.2 with SSR
  ```
- `README.md:407` (inside a "Performance Metrics" list):
  ```markdown
  - **Codebase Size**: ~48,894 lines of code across 169 files
  ```
- `README.md:470` — a second Astro-adapter version mention:
  ```markdown
  - **@astrojs/netlify 8.1.2** - Deployment adapter with SSR
  ```
- Ground truth, confirmed at commit `8ff3096` (re-run these before
  editing, in case they've shifted since this plan was written):
  ```
  $ node -p "require('./node_modules/astro/package.json').version"
  7.1.6
  $ node -p "require('./node_modules/@astrojs/netlify/package.json').version"
  8.1.3
  $ find src -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.astro" \) | wc -l
  281
  $ find src -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.astro" \) -exec cat {} + | wc -l
  64359
  ```

## Commands you will need

| Purpose   | Command          | Expected on success |
|-----------|------------------|----------------------|
| Re-verify installed versions | `node -p "require('./node_modules/astro/package.json').version"` and the `@astrojs/netlify` equivalent | matches what you write into README (re-run fresh, don't trust the numbers above if drift occurred) |
| Re-verify file/line counts | the two `find`/`wc -l` commands above | matches what you write into README |
| Lint      | `pnpm lint`      | exit 0 |
| Build     | `pnpm build`     | exit 0 (docs-only change, but confirm nothing else broke) |

## Scope

**In scope** (the only files you should modify):
- `CLAUDE.md`
- `README.md`

**Out of scope** (do NOT touch, even though they look related):
- `.husky/pre-commit` — that's `plans/118-wire-lint-into-precommit.md`,
  a code change, not a docs fix. This plan only *documents* that the hook
  exists and what it currently does; it does not change hook behavior.
- Any other section of either file not named above — do not do a general
  README rewrite or restructuring pass; this plan is scoped to the
  specific stale claims identified.
- The "Codebase Size" style/format itself (e.g. don't redesign that whole
  metrics section) — just correct the numbers, or caveat them as
  approximate if you'd rather not hardcode a number that will drift again
  (see Step 3 for the recommended approach).

## Git workflow

- Branch: `advisor/119-fix-stale-tooling-docs`
- Commit message style: conventional commits, e.g. `docs: fix stale
  lint/format claim in CLAUDE.md, update README version/LOC numbers`
  (matches `f4ae5c3 docs: remove dead test-blob-cache.ts script, fix stale
  README content` and `0f4f199 docs: correct type-safety claim in README,
  catalog production any/unknown casts` in `git log` — this repo has an
  established pattern of dedicated docs-fix commits).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Fix CLAUDE.md's lint/format claim

Replace:
```markdown
- No lint/format script exists yet — there is no ESLint or Prettier config in
  this repo as of this writing.
```
with something reflecting current reality, in the same terse
command-reference style as the surrounding bullets:
```markdown
- `pnpm lint` — ESLint (flat config in `eslint.config.mjs`, covers
  `.ts`/`.tsx`/`.astro`)
- `pnpm format` / `pnpm format:check` — Prettier
```
Also add one line to the existing "Gotchas" section (read the current
Gotchas list first — it's a bulleted list further down the file) noting
that `.husky/pre-commit` runs `pnpm check` and `pnpm test:run` on every
commit for staged `.ts`/`.astro`/`.tsx` files, matching whatever the live
hook currently does (re-read `.husky/pre-commit` before writing this line
— if `plans/118-wire-lint-into-precommit.md` has already landed by the
time you execute this plan, the hook will also run `pnpm lint`; describe
whatever is actually there, don't assume).

**Verify**: `grep -n "No lint/format script exists" CLAUDE.md` → no matches. `grep -n "pnpm lint" CLAUDE.md` → at least 1 match.

### Step 2: Fix README's version badges

Update both version mentions to match the installed versions (re-verify
fresh per the Commands table above, don't hardcode the numbers from this
plan without re-checking):
- `README.md:5` badge: `Astro-7.1.3` → `Astro-7.1.6` (or whatever
  `node_modules/astro/package.json`'s version currently reads).
- `README.md:366` and `README.md:470`: `@astrojs/netlify v8.1.2` /
  `@astrojs/netlify 8.1.2` → the currently-installed version (both
  mentions, keep their existing surrounding wording, just correct the
  version number).

**Verify**: `grep -n "8.1.2\|7.1.3" README.md` → no matches (assuming the
re-verified current versions differ from these stale ones — if by the
time you run this the installed versions happen to have drifted back to
these exact numbers, that's fine, just confirm they're *correct*, not
necessarily different from what's written here).

### Step 3: Fix or caveat the Codebase Size claim

Two acceptable approaches — pick one and note which in your commit
message:
1. **Update to the current count**: replace "~48,894 lines of code across
   169 files" with the freshly-measured numbers from the Commands table
   above (e.g. "~64,359 lines of code across 281 files").
2. **Caveat instead of hardcoding** (slightly more maintenance-resistant,
   since this number will drift again): change the line to something like
   "Codebase Size: measured via `find src -type f \( -name "*.ts" -o -name
   "*.tsx" -o -name "*.astro" \) | xargs wc -l` (grows over time; treat as
   approximate)". Either is acceptable — approach 1 matches this file's
   existing style of stating a concrete number, so prefer it unless you
   have a specific reason to prefer the caveat.

**Verify**: `grep -n "48,894\|169 files" README.md` → no matches.

### Step 4: Add a brief mention of lint/format/pre-commit tooling to README

README currently never mentions ESLint, Prettier, or the pre-commit hook
in its Development Tools / Testing / Contributing sections (confirmed via
`grep -n "eslint\|prettier\|husky\|lint\|format" README.md` returning zero
matches before this plan). Add a short bullet or two to whichever existing
section already lists other dev commands (`pnpm dev`, `pnpm check`, etc. —
read the file to find the right section rather than creating a new one),
mentioning `pnpm lint` / `pnpm format` / `pnpm format:check` and that a
pre-commit hook runs checks automatically.

**Verify**: `grep -n "pnpm lint\|pnpm format" README.md` → at least 1 match.

## Test plan

No automated tests apply to documentation content. Verification is via the
grep checks in each step above, plus confirming the repo still builds and
lints cleanly (a docs-only change shouldn't affect either, but confirm
rather than assume).

## Done criteria

Machine-checkable. ALL must hold:

- [x] `grep -n "No lint/format script exists" CLAUDE.md` → no matches
- [x] `grep -n "pnpm lint" CLAUDE.md` → at least 1 match
- [x] `grep -n "48,894\|169 files" README.md` → no matches
- [x] `grep -n "pnpm lint\|pnpm format" README.md` → at least 1 match
- [x] README's Astro and `@astrojs/netlify` version mentions match the
      currently-installed versions (re-verified fresh, not assumed from
      this plan) — versions had drifted further than the plan's numbers
      (Astro `7.2.0`, `@astrojs/netlify` `8.2.0`); all three Astro
      mentions and both netlify mentions updated, including a third stale
      Astro mention (`README.md`'s Dependencies section) not listed in the
      plan's "Current state"
- [x] `pnpm lint` exits 0
- [x] `pnpm build` exits 0
- [x] No files outside `CLAUDE.md`/`README.md` are modified (`git status`)
- [x] `plans/README.md` status row for 119 updated

## STOP conditions

Stop and report back (do not improvise) if:

- Re-running the version/file-count verification commands produces
  numbers meaningfully different from what's cited in "Current state"
  above (expected if time has passed and dependencies were bumped again,
  or more source files were added) — use the freshly-measured numbers,
  not the stale ones baked into this plan; this is expected drift, not an
  error, just don't blindly copy this plan's numbers without re-checking.
- CLAUDE.md's "Gotchas" section (referenced in Step 1) doesn't exist or
  has a substantially different structure than expected — read the live
  file's actual section headings before assuming where to add the
  pre-commit-hook line; add it wherever it fits the file's existing
  organization, don't force a new section for one line.

## Maintenance notes

- The hardcoded file/line-count claim in README (Step 3) will drift again
  as the codebase grows — if this becomes a recurring `/improve docs`
  finding, consider switching to the caveated/formula approach (option 2
  in Step 3) at that point rather than re-fixing the same hardcoded number
  repeatedly.
- A reviewer should confirm both README version-badge mentions were
  updated (there are two separate `@astrojs/netlify` version mentions in
  the file, at different sections — easy to fix one and miss the other).
