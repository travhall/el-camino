# Plan 060: Use eventual consistency for BlobCache reads

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 9b5556b..HEAD -- src/lib/cache/blobCache.ts`
> If any changes appear, compare before proceeding.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: performance
- **Planned at**: commit `9b5556b`, 2026-07-22

## Why this matters

`BlobCache.get` in `src/lib/cache/blobCache.ts:119` uses
`consistency: "strong"` when reading from Netlify Blobs. Strong consistency
routes all reads through Netlify's origin store to guarantee the freshest
value, which adds a round-trip for every cache lookup. For this app's use
cases — catalog data, product images, inventory — a stale cache read is safe
and has no worse outcome than a cache miss (the code already handles misses by
re-fetching from Square). Eventual consistency reads are served from the nearest
edge replica and are substantially faster.

A second `consistency: "strong"` exists at line 322 inside a Blob admin
API read — that one reads mutable admin-configured data (shop hours, settings)
where staleness has meaningful UI consequences. **That occurrence must remain
`"strong"`.**

## Current state

`src/lib/cache/blobCache.ts:119`:

```ts
const raw = await this.store.get(key, { type: "text", consistency: "strong" });
```

`src/lib/cache/blobCache.ts:322` (admin read — DO NOT change):

```ts
const blob = await store.get(key, { type: "text", consistency: "strong" });
```

## Commands you will need

| Purpose        | Command              | Expected on success      |
|----------------|----------------------|--------------------------|
| Typecheck      | `pnpm check`         | exit 0, no errors        |
| Unit tests     | `pnpm test:run`      | all pass                 |

## Scope

**In scope**:
- `src/lib/cache/blobCache.ts` line ~119 — the `BlobCache.get` method's
  consistency option only

**Out of scope**:
- `src/lib/cache/blobCache.ts:322` — the admin Blob read; must remain `"strong"`
- Any other file

## Git workflow

- Branch: `advisor/060-blobcache-eventual-consistency`
- Commit message: `perf: switch BlobCache product reads to eventual consistency`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Locate both occurrences

```bash
grep -n 'consistency.*strong\|strong.*consistency' src/lib/cache/blobCache.ts
```

Expected: two matches. Note their line numbers. The first is in the `get`
method of the `BlobCache` class; the second is in an admin data read lower in
the file.

### Step 2: Read the BlobCache.get method for context

Read ~10 lines around line 119 to confirm:
1. It is the `get` method of the `BlobCache` class (not the admin read).
2. No special comment says strong consistency is required here.

### Step 3: Change consistency in BlobCache.get only

Change the `consistency: "strong"` at the `BlobCache.get` method (~line 119)
to `consistency: "eventual"`:

```ts
// Before
const raw = await this.store.get(key, { type: "text", consistency: "strong" });

// After
const raw = await this.store.get(key, { type: "text", consistency: "eventual" });
```

**Do not touch line 322.**

**Verify**:
```bash
grep -n 'consistency' src/lib/cache/blobCache.ts
```

Expected: one `"eventual"` (line ~119) and one `"strong"` (line ~322).

### Step 4: Typecheck and test

```bash
pnpm check
```

Expected: exit 0.

```bash
pnpm test:run
```

Expected: all pass.

## Done criteria

- [ ] `pnpm check` exits 0
- [ ] `pnpm test:run` exits 0
- [ ] Exactly one `consistency: "eventual"` and one `consistency: "strong"` in `blobCache.ts`
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

- You cannot determine which consistency call is the admin data read and which
  is the product cache read — read the surrounding method signatures to tell
  them apart; do not guess.
- `pnpm test:run` has a test asserting strong consistency — review the failing
  test; if it validates this specific call, update the assertion; if it tests
  admin data, stop and report.
