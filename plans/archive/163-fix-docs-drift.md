# Plan 163: Correct the false claims in CLAUDE.md and README.md

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report. When done, update this
> plan's status row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat ad2999d..HEAD -- CLAUDE.md README.md vitest.config.ts package.json`
> On any change, re-derive the live values before editing; on a mismatch, treat
> it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: docs
- **Planned at**: commit `ad2999d`, 2026-09-05

## Why this matters

Both orientation documents make claims that are false, and one of them is the
file coding agents are told to trust.

- **`CLAUDE.md:21-24`** states coverage thresholds of "50%/45%/55%/50%
  statements/branches/functions/lines global — baselined … as of 2026-08-16".
  `vitest.config.ts:45-49` actually sets **branches 47, functions 59, lines 58,
  statements 57**, baselined 2026-09-04. An agent reading CLAUDE.md believes it
  has ~10 points of coverage headroom it does not have, and will be surprised by
  a threshold failure it was told could not happen yet.
- **`README.md:447`** still claims "**Test Coverage**: 80% threshold with
  Vitest" — the gate that `vitest.config.ts`'s own comments document as having
  been silently no-op'd by a schema bug and replaced.
- **`README.md`** documents three API routes that do not exist, omits nine that
  do, lists two source files that were deleted, and points readers at a
  gitignored `docs/` directory and a `LICENSE` file that is not in the repo.

`CLAUDE.md:3-5` explicitly instructs that the file be corrected in the same
change that invalidates it. The threshold bump did not do so. This plan is the
catch-up — and the process gap is worth noting in review.

## Current state

### CLAUDE.md

`CLAUDE.md:20-24`:

```
- `pnpm test:coverage` — unit tests with coverage; thresholds are enforced
  repo-wide in `vitest.config.ts` (50%/45%/55%/50% statements/branches/
  functions/lines global — baselined just under real coverage as of
  2026-08-16 ...
```

Live values, `vitest.config.ts:45-49`:

```ts
        thresholds: {
          branches: 47,
          functions: 59,
          lines: 58,
          statements: 57,
```

### README.md — verified false claims

| Claim | Location | Reality |
|---|---|---|
| `80% threshold with Vitest` | `README.md:447` | 57/47/59/58 |
| `/api/list-catalog` | `:189`, `:303` | `src/pages/api/list-catalog.ts` does not exist |
| `/api/load-more-products` | `:195`, `:309` | does not exist |
| `POST /api/admin/navigation` | `:327` | does not exist (settings page posts to `sale-visibility` / `shop-visibility`) |
| `src/lib/cart/cartHelpers.ts` | `:158` | does not exist |
| `src/lib/wordpress/block-config.ts` | `:177` | does not exist |
| `apiUtils.ts` = "Circuit breaker & utilities" | `:165` | that file has only `logApiError`; the breaker is in `apiRetry.ts` |
| "Check project documentation in `/docs`" | `:565` | `docs/` is gitignored; CLAUDE.md says it is unmaintained and untrustworthy |
| `MIT License - see [LICENSE](LICENSE)` | `:599` | no `LICENSE` file at repo root |
| Astro 7.2.0 badge | `:5` | `package.json` is `^7.3.1` |
| "Node Version: 20.x" | `:403` | `netlify.toml` sets `NODE_VERSION = "22"` |
| adapter v8.2.0 | `:404` | `package.json` is `^8.2.5` |

Routes that exist but are undocumented: `/api/admin-auth`, `/api/admin-logout`,
`/api/hours`, `/api/shop-status`, `/api/webhooks/square`,
`/api/admin/sale-visibility`, `/api/admin/retry-failed-emails`,
`/api/admin/remove-back-in-stock`, `/api/admin/restore-back-in-stock`.

**Verify every row yourself in Step 1.** This table was derived at commit
`ad2999d`; treat it as a lead list, not fact.

## Commands you will need

| Purpose   | Command         | Expected |
|-----------|-----------------|----------|
| Typecheck | `pnpm check`    | exit 0   |
| Tests     | `pnpm test:run` | exit 0   |
| Lint      | `pnpm lint`     | exit 0   |

Never use `pnpm test` — watch mode, it hangs.

## Scope

**In scope**:
- `CLAUDE.md`
- `README.md`
- `LICENSE` (create, only if Step 5 confirms MIT is intended)

**Out of scope** (do NOT touch):
- **Any source file, config file, or test.** This is a documentation-only plan.
  If a doc claim is wrong because the *code* is wrong, report it — do not change
  code to match the docs.
- `vitest.config.ts` — it is the source of truth here, not a thing to edit.
- `plans/README.md` beyond this plan's own status row.
- `docs/` — gitignored and unmaintained by design.

## Git workflow

- Branch: `advisor/163-fix-docs-drift`
- Conventional commits, e.g. `docs: correct stale coverage, route and structure claims`
- Do NOT push or open a PR unless the operator instructs it.

## Steps

### Step 1: Re-derive every claim from the live repo

Do not trust the table above. Generate the ground truth:

```bash
# Actual API routes
find src/pages/api -name '*.ts' | sort
# Actual coverage thresholds
sed -n '40,60p' vitest.config.ts
# Versions
grep -n '"astro"\|"@astrojs/netlify"' package.json
grep -n 'NODE_VERSION' netlify.toml
# Files README claims exist
for f in src/lib/cart/cartHelpers.ts src/lib/wordpress/block-config.ts; do
  printf "%-40s " "$f"; test -f "$f" && echo EXISTS || echo MISSING; done
test -f LICENSE && echo "LICENSE exists" || echo "LICENSE MISSING"
```

**Verify**: you have a current, self-derived list. Note any row where reality
differs from the table above and say so in the status row.

### Step 2: Fix CLAUDE.md's coverage claim

Replace the hardcoded percentages with the live values **and** a pointer to
`vitest.config.ts` as the source of truth, so the next bump cannot desync the
prose. The config's own comment block is already the good explanation — refer to
it rather than duplicating it.

**Verify**:
```bash
grep -n "50%/45%/55%/50%" CLAUDE.md
```
→ no match.

### Step 3: Fix README's coverage claim

Replace the "80% threshold" claim at `README.md:447` the same way. Do not restate
percentages in a second place; point at `vitest.config.ts`.

**Verify**: `grep -n "80%" README.md` → no match, or only in an unrelated context
you have verified is correct.

### Step 4: Regenerate the API table and prune the structure tree

Rebuild the API endpoint table from Step 1's `find` output — every route present,
none absent. Remove the three phantom routes.

For the project-structure tree, prune to **directories plus genuinely
load-bearing files**. A tree that lists every file guarantees future drift; one
that lists directories degrades gracefully. Remove `cartHelpers.ts` and
`block-config.ts`, and correct the `apiUtils.ts` description (it contains
`logApiError`; the circuit breaker lives in `apiRetry.ts`, which the tree should
mention).

**Verify**:
```bash
for r in list-catalog load-more-products; do grep -n "$r" README.md; done
grep -n "cartHelpers\|block-config" README.md
```
→ all return nothing.

### Step 5: Resolve the license and the `/docs` pointer

- **License**: `README.md:599` claims MIT with a link to a nonexistent file.
  Either add a standard MIT `LICENSE` file, or remove the claim. **Ask the
  operator which** — a license is a legal statement, not an executor's call.
  Note that `package.json` may declare a license field; check it for the
  intended answer, and report the conflict if it disagrees.
- **`/docs` pointer** at `README.md:565`: remove it, or mirror CLAUDE.md's
  caveat verbatim. It currently sends contributors to a directory they cannot
  clone, contradicting CLAUDE.md.

**Verify**: `grep -n "LICENSE\|/docs" README.md` → each remaining mention is
accurate.

### Step 6: Fix the version claims

Update the Astro badge (`:5`), the Node version (`:403`), and the adapter version
(`:404`) from Step 1's output. Consider expressing them as ranges or removing the
patch digit so routine bumps do not re-break them.

**Verify**: each version in README matches `package.json` / `netlify.toml`.

### Step 7: Gate

```bash
pnpm check && pnpm lint && pnpm test:run
```
→ all exit 0 (nothing should have changed, but confirm you touched no code).

## Test plan

- No tests — documentation only.
- Verification is the greps in Steps 2–6 plus Step 1's self-derived ground truth.
- `git status` must show only `CLAUDE.md`, `README.md`, and possibly `LICENSE`.

## Done criteria

- [ ] Step 1's self-derived ground truth recorded in `plans/README.md`
- [ ] `grep -n "50%/45%/55%/50%" CLAUDE.md` → no match
- [ ] `grep -n "80%" README.md` → no stale coverage claim
- [ ] `grep -n "list-catalog\|load-more-products\|cartHelpers\|block-config" README.md` → no matches
- [ ] All nine previously-undocumented API routes appear in the table
- [ ] LICENSE resolved (file added, or claim removed) per the operator's answer
- [ ] The `/docs` pointer removed or carries CLAUDE.md's caveat
- [ ] Astro / Node / adapter versions match `package.json` and `netlify.toml`
- [ ] **No source, config, or test file modified** (`git status`)
- [ ] `pnpm check` / `pnpm lint` / `pnpm test:run` all exit 0

## STOP conditions

Stop and report if:

- **A documented feature does not exist in code and its absence looks like a
  bug** rather than stale docs — e.g. the settings page referencing an admin
  capability that was never wired. Report; do not silently delete the row.
- The license question cannot be resolved from `package.json`. It needs the
  operator's answer.
- You find yourself wanting to change code so the docs become true. Wrong
  direction — report instead.
- Step 1's ground truth differs substantially from the table in this plan (more
  than a couple of rows). That means significant drift since `ad2999d`; report
  before proceeding.

## Maintenance notes

- **The process gap worth naming in review**: `CLAUDE.md:3-5` requires the file
  to be corrected in the same change that invalidates it, and the coverage-bump
  plan did not do it. Anything that changes a number CLAUDE.md quotes should
  treat the doc edit as part of the change, not a follow-up.
- Prefer **pointers over duplicated values** in both docs. The coverage numbers
  drifted precisely because they were restated in two places; the API table will
  drift again unless it is regenerated rather than hand-maintained.
- A reviewer should spot-check three or four rows against the filesystem rather
  than trusting the diff.
- **Deliberately deferred**: automating the API table's generation, and deciding
  whether `docs/` should be maintained or deleted.
