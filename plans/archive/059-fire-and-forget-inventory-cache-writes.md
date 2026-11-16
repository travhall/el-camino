# Plan 059: Fire-and-forget inventory cache writes

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 9b5556b..HEAD -- src/lib/square/inventoryCore.ts`
> If any changes appear, compare before proceeding.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: performance
- **Planned at**: commit `9b5556b`, 2026-07-22

## Why this matters

`inventoryCore.ts` batches inventory checks in groups of 10 Square catalog IDs
per API call, then caches every result. The cache-write step uses
`await Promise.all(cacheWrites)` — it blocks the HTTP response while waiting
for **every single Blob write to complete** before returning stock levels to
the caller.

In practice the inventory fetch is already done by this point; the caller only
needs the return value. Waiting for cache commits adds latency proportional to
the number of unique product IDs, for zero user-visible benefit. Making these
writes fire-and-forget reduces response time without changing correctness: any
cache miss on the next request simply re-fetches from Square.

## Current state

`src/lib/square/inventoryCore.ts:133-141`:

```ts
const cacheWrites: Promise<void>[] = [];
// … for each inventory result:
cacheWrites.push(inventoryCache.set(id, qty));

await Promise.all(cacheWrites);  // ← blocks response
```

## Commands you will need

| Purpose        | Command              | Expected on success      |
|----------------|----------------------|--------------------------|
| Typecheck      | `pnpm check`         | exit 0, no errors        |
| Unit tests     | `pnpm test:run`      | all pass                 |

## Scope

**In scope**:
- `src/lib/square/inventoryCore.ts` — the `await Promise.all(cacheWrites)` line only

**Out of scope**:
- Any other `await Promise.all` in the same file (lines 83 and 118 guard
  the actual API calls and chunk results — those must remain awaited)
- Any other file

## Git workflow

- Branch: `advisor/059-fire-and-forget-inventory-cache`
- Commit message: `perf: fire-and-forget inventory cache writes to reduce response latency`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Read the file

```bash
grep -n "cacheWrites\|Promise.all" src/lib/square/inventoryCore.ts
```

Confirm you see the three `Promise.all` calls. The one at the end (after
`cacheWrites.push(...)`) is the target.

### Step 2: Change await to fire-and-forget

In `src/lib/square/inventoryCore.ts`, change:

```ts
await Promise.all(cacheWrites);
```

to:

```ts
void Promise.all(cacheWrites);
```

`void` is the idiomatic TypeScript expression to intentionally discard a
promise. The ESLint `no-floating-promises` rule (if added in future) will
accept this; a bare `Promise.all(cacheWrites)` without `void` would trigger it.

**Verify**: `grep -n "cacheWrites" src/lib/square/inventoryCore.ts` →
confirm the line now reads `void Promise.all(cacheWrites)`.

### Step 3: Typecheck and test

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
- [ ] `grep "await Promise.all(cacheWrites)" src/lib/square/inventoryCore.ts` → no match
- [ ] `grep "void Promise.all(cacheWrites)" src/lib/square/inventoryCore.ts` → 1 match
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

- More than one `await Promise.all(cacheWrites)` exists in the file — confirm
  which one follows the `cacheWrites.push(...)` loop and change only that one.
- `pnpm test:run` fails with inventory-related test failures — the tests may be
  asserting the cache is populated synchronously; if so, report and do not merge.
