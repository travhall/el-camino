# Plan 057: Fix .env.example inaccuracies and add missing DX documentation

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 9b5556b..HEAD -- .env.example package.json`
> If any changes appear, compare before proceeding.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `9b5556b`, 2026-07-22

## Why this matters

Three DX gaps that mislead new contributors:

1. `ASTRO_NODE_ENV` is referenced in the source code but is absent from
   `.env.example` — a new developer copying `.env.example` won't know this var
   exists.

2. `HOST` and `PORT` appear in `.env.example` with the implication they
   configure the dev server, but Astro's dev server is configured via
   `server.host`/`server.port` in `astro.config.mjs`, not environment variables.
   Leaving them in `.env.example` misleads contributors into setting them and
   wondering why nothing changes.

3. The `dev` npm script contains `rm -rf .astro && sleep 1` with no comment
   explaining why. Contributors will either be confused by it or delete it
   during cleanup, reintroducing whatever bug it worked around.

## Current state

**`.env.example`**: Contains `HOST=...` and `PORT=...` entries. Does NOT contain
`ASTRO_NODE_ENV`.

**`package.json` dev script**: Contains `rm -rf .astro && sleep 1` — read the
exact current form with:
```bash
grep -n '"dev"' package.json
```

**Source reference for ASTRO_NODE_ENV**: Find where it's used:
```bash
grep -rn "ASTRO_NODE_ENV" src/
```

## Commands you will need

| Purpose   | Command              | Expected on success       |
|-----------|----------------------|---------------------------|
| Typecheck | `pnpm check`         | exit 0                    |

## Scope

**In scope**:
- `.env.example`
- `package.json` — dev script comment only

**Out of scope**:
- `astro.config.mjs` — no changes
- Any source file

## Git workflow

- Branch: `advisor/057-env-example-dx-fixes`
- Commit message: `docs: fix .env.example misleading entries, document dev script workaround`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Find where ASTRO_NODE_ENV is used

```bash
grep -rn "ASTRO_NODE_ENV" src/
```

Note which file(s) use it and what it controls (e.g. "production" vs "development"
behavior). Use that information in the `.env.example` comment.

### Step 2: Add ASTRO_NODE_ENV to .env.example

Read `.env.example` to find the appropriate section (likely near other
`NODE_ENV`-style variables). Add:

```
# Node environment for Astro SSR — set to "production" to simulate prod behavior locally
# ASTRO_NODE_ENV=development
```

Adjust the comment based on what you found in Step 1.

**Verify**: `grep "ASTRO_NODE_ENV" .env.example` → appears.

### Step 3: Fix or remove HOST and PORT from .env.example

Read the current `HOST` and `PORT` entries in `.env.example`. Either:

**Option A (preferred)**: Replace with a comment explaining they have no effect:
```
# Note: HOST and PORT are NOT read by Astro's dev server.
# Configure the dev server in astro.config.mjs under the `server` key instead.
```

**Option B**: Remove the entries entirely if they serve no purpose.

**Verify**: `grep -n "^HOST=\|^PORT=" .env.example` → no matches (or replaced by comment).

### Step 4: Document the rm -rf .astro workaround in package.json

Read the current dev script. Add a comment in `package.json` is not possible
(JSON doesn't support comments), so instead rename the `dev` script temporarily
and add a `// NOTE` approach won't work. Instead, add a brief note in the
`CLAUDE.md` or a code comment inside `astro.config.mjs` is also not ideal.

The right place is the project's `CLAUDE.md`. Open `CLAUDE.md` and add a note
in the Gotchas section:

```markdown
- `pnpm dev` runs `rm -rf .astro && sleep 1` before starting — this clears the
  Astro dev cache directory. The workaround was added to fix a stale-cache issue
  where the dev server started with an incorrect module graph; the `sleep 1` gives
  the filesystem time to complete the deletion. Remove it only if you've confirmed
  Astro's cache invalidation is fixed in the current version.
```

**Verify**: `grep "rm -rf .astro" CLAUDE.md` → appears.

### Step 5: Verify no breakage

```bash
pnpm check
```
Expected: exit 0 (these are doc-only changes; typecheck should not be affected).

## Done criteria

- [ ] `pnpm check` exits 0
- [ ] `grep "ASTRO_NODE_ENV" .env.example` → appears
- [ ] `grep -n "^HOST=\|^PORT=" .env.example` → no matches (or replaced with explanatory comment)
- [ ] `grep "rm -rf .astro" CLAUDE.md` → appears with explanation
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

- `ASTRO_NODE_ENV` is found nowhere in the source — it may have been removed;
  skip Step 2 and note that it's absent.
- `CLAUDE.md` cannot be found — add the note to `README.md` instead.
