# Plan 046: Persist measurementUnit lookups in BlobCache instead of in-memory Map

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 9b5556b..HEAD -- src/lib/square/productUtils.ts src/lib/cache/blobCache.ts`
> If any changes appear, compare the "Current state" excerpts before proceeding.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `9b5556b`, 2026-07-22

## Why this matters

`productUtils.ts` uses an in-memory `Map` with a manual 1-hour TTL for
measurement unit lookups. On Netlify's SSR model every cold function instance
starts with an empty Map, so every PDP page load on a cold instance fetches
measurement units from the Square API even though that data changes almost
never. The rest of the codebase uses `BlobCache` from `src/lib/cache/blobCache.ts`,
which persists across function instances via Netlify Blobs — exactly what
`blobCache.ts`'s header comment describes as the fix for "function-per-route
memory isolation."

## Current state

**`src/lib/square/productUtils.ts`** — measurement unit cache at lines 58–117:

```typescript
// line 58–66
const measurementUnitCache = new Map<
  string,
  { value: Record<string, string>; timestamp: number }
>();
const MEASUREMENT_UNIT_TTL = 3_600_000; // 1 hour in ms

// line 77
const cached = measurementUnitCache.get(cacheKey);
if (cached && Date.now() - cached.timestamp < MEASUREMENT_UNIT_TTL) {
  return cached.value;
}
// ...fetch from Square...
// line 117
measurementUnitCache.set(cacheKey, { value: unitMap, timestamp: Date.now() });
```

**`src/lib/cache/blobCache.ts`** — exports `BlobCache` class and named instances:
```typescript
// Example existing instance pattern:
export const inventoryCache = new BlobCache<...>("inventory-data", TTL_SECONDS);
// BlobCache.getOrCompute(key, fn) is the primary API
```

**`src/lib/square/productUtils.ts`** imports: check the top of the file for
existing imports from `@/lib/cache/blobCache` — if not present, add one.

## Commands you will need

| Purpose   | Command              | Expected on success       |
|-----------|----------------------|---------------------------|
| Typecheck | `pnpm check`         | exit 0, no errors         |
| Unit tests | `pnpm test:run`     | all pass                  |
| Coverage  | `pnpm test:coverage` | thresholds pass           |

## Scope

**In scope**:
- `src/lib/square/productUtils.ts`
- `src/lib/cache/blobCache.ts` — only to add a new named export if the pattern requires it

**Out of scope**:
- `src/lib/square/inventory.ts`, `categories.ts`, `client.ts` — separate caches,
  not touched here

## Git workflow

- Branch: `advisor/046-measurement-unit-blobcache`
- Commit message: `perf: use BlobCache for measurement unit lookups to survive cold starts`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Add a measurementUnitCache BlobCache instance

Open `src/lib/cache/blobCache.ts`. Read the existing named-instance exports
(e.g. `inventoryCache`, `productCache`) to understand the pattern. Add:

```typescript
export const measurementUnitCache = new BlobCache<Record<string, string>>(
  "measurement-unit-data",
  3600  // 1 hour TTL in seconds
);
```

Place it alongside the other named exports. Note the exact generic type:
`Record<string, string>` maps unit ID → abbreviation/name (match what the
existing `unitMap` object in productUtils.ts stores).

**Verify**: `grep -n "measurementUnitCache" src/lib/cache/blobCache.ts` → appears.

### Step 2: Refactor productUtils.ts to use BlobCache

Open `src/lib/square/productUtils.ts`.

1. Add import at the top (if not already present):
   ```typescript
   import { measurementUnitCache } from "@/lib/cache/blobCache";
   ```

2. Delete the in-memory `Map` declaration and `MEASUREMENT_UNIT_TTL` constant
   (lines ~58–65).

3. Replace the manual cache check + set pattern with `BlobCache.getOrCompute`.
   Find the function that checks `measurementUnitCache.get(cacheKey)` and fetches
   from Square on miss. Rewrite it as:

   ```typescript
   const unitMap = await measurementUnitCache.getOrCompute(cacheKey, async () => {
     // ... existing Square API fetch logic that produces unitMap ...
     return unitMap;
   });
   return unitMap;
   ```

   The exact Square fetch logic (the part that calls `squareClient.catalog.list`
   or similar for measurement units) should be inlined as the compute function —
   do not move it elsewhere.

**Verify**: `grep -n "new Map\|MEASUREMENT_UNIT_TTL\|timestamp" src/lib/square/productUtils.ts` → no matches.
**Verify**: `grep -n "measurementUnitCache" src/lib/square/productUtils.ts` → shows the import and `getOrCompute` call.

### Step 3: Typecheck and test

```bash
pnpm check
```
Expected: exit 0, no errors.

```bash
pnpm test:run
```
Expected: all pass. The `inventory.test.ts` BlobCache mock pattern already
in place (`vi.mock("@/lib/cache/blobCache", ...)`) covers this import.

```bash
pnpm test:coverage
```
Expected: thresholds pass (the change does not reduce coverage).

## Done criteria

- [ ] `pnpm check` exits 0
- [ ] `pnpm test:run` exits 0
- [ ] `pnpm test:coverage` exits 0
- [ ] `grep -n "new Map\|MEASUREMENT_UNIT_TTL" src/lib/square/productUtils.ts` → no matches
- [ ] `grep -n "measurementUnitCache" src/lib/cache/blobCache.ts` → appears
- [ ] `grep -n "measurementUnitCache.getOrCompute" src/lib/square/productUtils.ts` → appears
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

- `BlobCache.getOrCompute` does not exist — read `blobCache.ts` to find the
  actual API method name (may be `get`/`set` separately) and adapt.
- The generic type for `measurementUnitCache` doesn't match what `unitMap`
  contains — read the Square fetch function to determine the correct shape.
- `pnpm test:coverage` drops a per-file threshold after the change — check
  `vitest.config.ts`; if `productUtils.ts` has a threshold, verify the new
  code is exercised by existing tests.

## Maintenance notes

- The cache key (cacheKey) used by the old Map is now used as the Blob key.
  Confirm it's a stable string (e.g. a variation ID or "all-units") — if it
  can be user-controlled, sanitize before use as a Blob key.
- If the measurement unit schema changes in the Square API, increment a version
  suffix in the cache name (`"measurement-unit-data-v2"`) to avoid stale-type
  reads from old blobs.
