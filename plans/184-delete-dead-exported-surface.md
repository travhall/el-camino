# Plan 184: Delete the dead exported surface — and re-baseline coverage in the same commit

> **Executor instructions**: Follow step by step. Run every verification command.
> If anything in "STOP conditions" occurs, stop and report. When done, update
> this plan's status row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat ad2999d..HEAD -- src/lib/wordpress/ src/lib/square/filterUtils.ts src/lib/square/imageUtils.ts src/lib/admin/auth.ts src/lib/constants/pagination.ts vitest.config.ts`
> On any change, re-run Step 1's verification for every symbol.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: LOW (deletion) / MED (coverage sequencing)
- **Depends on**: 160 (hard — see Why)
- **Category**: tech-debt
- **Planned at**: commit `ad2999d`, 2026-09-05

## Why this matters

Roughly 700 lines of exported code have no production caller. Agents and humans
read past it on every pass through `src/lib/wordpress/` and `src/lib/square/`.

The sequencing trap: three of these functions are kept alive **only by their own
tests**, added in a recent coverage-raising plan. So dead code is currently
propping up the coverage number that gates the build. Deleting it will **lower**
measured coverage and can trip the thresholds — which is why this plan
re-baselines `vitest.config.ts` in the same commit.

That matters more once **plan 160** lands and coverage is actually enforced in
CI. Before 160, thresholds are never evaluated; after it, this deletion turns CI
red unless the re-baseline is in the same change. **Land 160 first.**

## Current state — verified symbol by symbol

**Genuinely dead** (the only occurrence in `src/` is the definition itself):

| Symbol | File |
|---|---|
| `isValidWordPressPost` | `src/lib/wordpress/types.ts:178` |
| `generateStructuredData` | `src/lib/wordpress/types.ts:358` |
| `estimateReadingTime` | `src/lib/wordpress/types.ts:403` |
| `generateSlugFromTitle` | `src/lib/wordpress/types.ts:419` |
| `getFeaturedImageUrl` | `src/lib/wordpress/types.ts:438` |
| `getAuthorAvatar` | `src/lib/wordpress/types.ts:449` |
| `formatPublishDate` | `src/lib/wordpress/types.ts:474` |
| `updateURLWithFilters` | `src/lib/square/filterUtils.ts:281` |
| `clearImageCache` | `src/lib/square/imageUtils.ts:82` |
| `INITIAL_PAGE_SIZE`, `INFINITE_SCROLL_THRESHOLD` | `src/lib/constants/pagination.ts` (whole module) |

**Dead but kept alive by their own tests** (no production caller; test references
only):

| Symbol | File | Test refs |
|---|---|---|
| `optimizeWordPressImage` | `src/lib/wordpress/content-utils.ts:69` | 6 |
| `generateWordPressSrcSet` | `src/lib/wordpress/content-utils.ts:113` | 5 |
| `sanitizeWordPressContent` | `src/lib/wordpress/content-utils.ts:44` | 9 |
| `getActiveFiltersCount` | `src/lib/square/filterUtils.ts:293` | 4 |

**NOT dead — the independent scan got these wrong. Do not delete them:**

| Symbol | Reality |
|---|---|
| `isAuthenticated` (`src/lib/admin/auth.ts:74`) | **Called by `isAdminAuthenticated` at `auth.ts:90`.** It is the implementation, not a superseded duplicate. |
| `getImageUrl` (`src/lib/square/imageUtils.ts:10`) | **Called by `batchGetImageUrls` at `imageUtils.ts:69`.** |
| `getPrimaryCategory` (`src/lib/wordpress/types.ts:205`) | Called at `types.ts:253` — transitively dead only if its caller also goes. |
| `filtersToURLParams` (`src/lib/square/filterUtils.ts:256`) | Called by `updateURLWithFilters` at `:282` — transitively dead only if that goes too. |

**Treat the whole table above as leads, not facts.** Two of the scan's claims
were outright wrong; re-verify every symbol yourself in Step 1 before deleting a
line.

## Commands you will need

| Purpose   | Command              | Expected             |
|-----------|----------------------|----------------------|
| Typecheck | `pnpm check`         | exit 0               |
| Tests     | `pnpm test:run`      | exit 0               |
| Coverage  | `pnpm test:coverage` | exit 0 after re-baseline |
| Lint      | `pnpm lint`          | exit 0               |
| Build     | `pnpm build`         | exit 0               |

Never use `pnpm test` — watch mode, it hangs.

## Scope

**In scope**:
- `src/lib/wordpress/types.ts`, `src/lib/wordpress/content-utils.ts`
- `src/lib/square/filterUtils.ts`, `src/lib/square/imageUtils.ts`
- `src/lib/constants/pagination.ts` (delete the module if fully dead)
- the corresponding `__tests__/` files (remove tests for deleted symbols)
- `vitest.config.ts` — **thresholds only**, re-baselined in this same commit

**Out of scope** (do NOT touch):
- `isAuthenticated` and `getImageUrl`. They have callers. Confirmed.
- Any symbol Step 1 cannot prove dead.
- Refactoring what remains. Delete only.
- The per-file thresholds for `cart/index.ts`, `apiRetry.ts`, `inventory.ts`
  unless the deletion actually moves them.

## Git workflow

- Branch: `advisor/184-delete-dead-exported-surface`
- Conventional commits, e.g. `chore: delete unused exports and re-baseline coverage`
- **The deletion and the threshold re-baseline must be in the same commit** —
  otherwise the intermediate state has a red build.
- Do NOT push or open a PR unless the operator instructs it.

## Steps

### Step 1: Re-verify every symbol yourself

For each candidate:

```bash
S=<symbol>
grep -rn "\b$S\b" src/
```

Classify: **dead** (definition only), **test-only** (definition + `__tests__/`
references), or **live** (any other reference). For anything test-only, check
whether its *caller* is also dying — transitively dead is still dead, but only if
you delete both.

**Verify**: a table of symbol → classification → evidence, recorded in
`plans/README.md`. This table, not this plan's, governs what you delete.

### Step 2: Record the coverage baseline

```bash
pnpm test:coverage
```

**Verify**: the four global percentages and the current thresholds recorded.

### Step 3: Delete the genuinely dead symbols

Start with the pure-dead list from Step 1. After each file, run `pnpm check` —
`astro check` will surface anything that was actually imported somewhere you
missed.

Delete `src/lib/constants/pagination.ts` entirely only if **both** constants are
dead.

**Verify**: `pnpm check` → exit 0. `pnpm test:run` → exit 0.

### Step 4: Delete the test-only symbols and their tests

Remove the four test-only functions and the tests that exercise them. Deleting
the function without its tests breaks the build; deleting tests without the
function leaves untested dead code.

`sanitizeWordPressContent` has 9 test references — check whether any *other*
tested function calls it before removing.

**Verify**: `pnpm check` → exit 0. `pnpm test:run` → exit 0, with a lower test
count (expected — record the delta).

### Step 5: Re-baseline the thresholds in the same commit

```bash
pnpm test:coverage
```

It will likely fail now. Set each global threshold **2–3 points below** the newly
measured value, matching the existing baselining convention documented in
`vitest.config.ts`. Update the dated comment there.

**Do not lower a threshold further than the measurement requires**, and do not
raise it to look good.

**Verify**: `pnpm test:coverage` → exit 0. Record before/after thresholds and
measured percentages.

### Step 6: Full gate

```bash
pnpm check && pnpm lint && pnpm test:run && pnpm test:coverage && pnpm build
```
→ all exit 0.

## Test plan

- No new tests. This plan removes code and the tests that only existed for it.
- The safety net is `pnpm check` (`astro check` catches broken imports across
  `.astro` too) plus the full suite.
- Record the test-count delta so the drop is visibly intentional.

## Done criteria

- [ ] Step 1's own symbol classification table recorded in `plans/README.md`
- [ ] `isAuthenticated` and `getImageUrl` **still present** (`git diff`)
- [ ] Only symbols Step 1 proved dead were deleted
- [ ] Tests for deleted symbols removed; test-count delta recorded
- [ ] Coverage thresholds re-baselined **in the same commit** as the deletion
- [ ] Before/after coverage percentages and thresholds recorded
- [ ] `pnpm check` / `pnpm lint` / `pnpm test:run` / `pnpm build` all exit 0
- [ ] `pnpm test:coverage` exits 0

## STOP conditions

Stop and report if:

- **Step 1 shows a symbol this plan lists as dead is actually live.** Expected —
  two of the scan's claims were already wrong. Skip it and note it; do not
  reconcile by deleting anyway.
- `pnpm check` fails after a deletion in a way you cannot trace to that symbol.
  A `.astro` file may import it in a way grep missed.
- Coverage drops so far that re-baselining would put thresholds below where the
  operator wants them. Report the numbers — they may prefer to keep some code and
  add real callers instead.
- **Plan 160 has not landed.** Then the thresholds are not enforced, this plan's
  re-baseline is unverifiable, and the sequencing risk is invisible rather than
  absent. Land 160 first.

## Maintenance notes

- **The lesson worth keeping**: a coverage-raising plan added tests to functions
  nobody called, which made dead code contribute to the gate. Adding tests to an
  uncovered symbol should include checking that it has a production caller.
- Consider adding `knip` or `ts-prune` to CI so this does not re-accumulate. Not
  in this plan's scope — it needs its own baselining pass — but it is the durable
  fix.
- A reviewer should spot-check two or three deletions with their own grep, and
  confirm the threshold change matches the measured drop rather than exceeding it.
