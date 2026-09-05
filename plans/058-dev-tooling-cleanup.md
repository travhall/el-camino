# Plan 058: Remove dead dev utilities and fix stale README content

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 9b5556b..HEAD -- src/scripts/ README.md`
> If any changes appear, compare before proceeding.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `9b5556b`, 2026-07-22

## Why this matters

Two minor DX cleanups:

1. `src/scripts/test-blob-cache.ts` is a dead dev utility with broken import
   paths (it was written to test BlobCache manually but the paths have since
   changed). It appears in the file tree and confuses contributors about what
   it does or whether it's needed.

2. `README.md` contains "Last updated: April 2026" (stale) and a link to
   `docs/TYPE_SAFETY_NOTES.md` which is in `.gitignore` and doesn't exist in
   the repo. The dead link breaks `README.md` as a trustworthy onboarding document.

## Current state

**`src/scripts/test-blob-cache.ts`** — verify it exists and its imports are broken:
```bash
cat src/scripts/test-blob-cache.ts
```
Expected: file exists with import paths that no longer resolve.

**`README.md`** — check for the stale date and dead link:
```bash
grep -n "Last updated\|TYPE_SAFETY_NOTES\|docs/" README.md
```

## Commands you will need

| Purpose   | Command              | Expected on success       |
|-----------|----------------------|---------------------------|
| Typecheck | `pnpm check`         | exit 0, no errors         |

## Scope

**In scope**:
- `src/scripts/test-blob-cache.ts` — delete
- `README.md` — fix stale date and dead link

**Out of scope**:
- `CLAUDE.md` — separate document; only `README.md` here
- Any test file
- Any source file in `src/lib/`

## Git workflow

- Branch: `advisor/058-dev-tooling-cleanup`
- Commit message: `docs: remove dead test-blob-cache.ts script, fix stale README content`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Verify test-blob-cache.ts is truly dead

```bash
grep -rn "test-blob-cache" src/ .github/ package.json
```

If any caller references it (a script entry, a workflow, an import), STOP and
report — do not delete.

If no callers found:
```bash
rm src/scripts/test-blob-cache.ts
```

**Verify**: `ls src/scripts/test-blob-cache.ts` → "No such file or directory".

### Step 2: Update README.md stale date

Read `README.md` and find the "Last updated" line. Change it to today's date
(2026-07-22) or remove the date line if it will just become stale again
(removing is preferred).

**Verify**: `grep "Last updated.*April 2026" README.md` → no match.

### Step 3: Remove dead link to docs/TYPE_SAFETY_NOTES.md

In `README.md`, find the link to `docs/TYPE_SAFETY_NOTES.md` (or any link to
a path under `docs/` that doesn't exist in the repo). Either:
- Remove the sentence/section containing the dead link, or
- Replace with a note that type safety notes are tracked inline in CLAUDE.md

**Verify**: `grep "TYPE_SAFETY_NOTES\|docs/TYPE" README.md` → no match.

### Step 4: Typecheck

```bash
pnpm check
```
Expected: exit 0. (Deleting a `.ts` file from `src/scripts/` should not affect
`pnpm check` if no other file imports it.)

## Done criteria

- [ ] `pnpm check` exits 0
- [ ] `ls src/scripts/test-blob-cache.ts` → file does not exist
- [ ] `grep "Last updated.*April 2026" README.md` → no match
- [ ] `grep "TYPE_SAFETY_NOTES" README.md` → no match
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

- `test-blob-cache.ts` is referenced from a script entry or GitHub Actions
  workflow — do not delete; note the caller and report.
- `pnpm check` emits errors after deletion — `test-blob-cache.ts` was being
  included in the TypeScript project; check `tsconfig.json` include patterns.
