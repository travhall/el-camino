# Plan 095: Decompose src/lib/square/client.ts

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `wc -l src/lib/square/client.ts && git diff --stat 915a062..HEAD -- src/lib/square/client.ts`

## Status

- **Priority**: P3
- **Effort**: L
- **Risk**: MED
- **Depends on**: plan 081 (PERF-01 BlobCache wrap), plan 085 (unit tests for client.ts)
- **Category**: architecture
- **Planned at**: commit `915a062`, 2026-08-01

## Why this matters

`src/lib/square/client.ts` mixes several responsibilities: catalog pagination, product enrichment, image URL batching, deduplication, and caching. Earlier plan 050 was "partial" — it decomposed some parts but `client.ts` still carries too many concerns. A single large file is hard to test and hard to evolve independently.

**Do not start this plan until plans 081 and 085 are DONE** — 081 adds caching that changes client.ts, and 085 adds tests that make this refactor safe to perform.

## Current state

Read `src/lib/square/client.ts` fully. Identify logical groupings:
- Catalog pagination (fetching raw objects from Square)
- Product mapping (transforming CatalogObject to Product shape)
- Image enrichment (`batchGetImageUrls`)
- Cache/dedup layer

## Commands

| Purpose | Command | Expected |
|---------|---------|---------|
| Typecheck | `pnpm check` | no errors |
| Tests | `pnpm test:run` | all pass |
| Coverage | `pnpm test:coverage` | thresholds met |

## Scope

**In scope**: `src/lib/square/client.ts` split into 2-3 focused files; all imports updated

**Out of scope**: changing function signatures or behavior; adding new features; touching any page or API route that isn't importing from `client.ts`

## Git workflow

- Branch: `advisor/095-arch-decompose-client-ts`
- Commit: `refactor: decompose client.ts into focused catalog, mapping, and image modules`

## Steps

### Step 1: Read and map

Read `client.ts` fully. Draw a responsibility boundary around each logical group. Proposed split:
- `src/lib/square/catalogFetch.ts` — pagination + raw catalog API calls
- `src/lib/square/productMapper.ts` — CatalogObject → Product transformation
- `src/lib/square/client.ts` — thin orchestrator that re-exports the public API (backward compat)

### Step 2: Extract catalogFetch.ts

Move catalog pagination and raw fetch logic to a new file. Update `client.ts` to import from it.

**Verify**: `pnpm check` passes after each file extraction.

### Step 3: Extract productMapper.ts

Move the product mapping functions. Update `client.ts` to import from it.

**Verify**: `pnpm check` passes.

### Step 4: Update all callers

```bash
grep -rn "from.*lib/square/client" src/ --include="*.ts" --include="*.astro"
```

All callers should continue to import from `client.ts` (which re-exports). If any must be updated, do so.

### Step 5: Typecheck, tests, coverage

```
pnpm check
pnpm test:run
pnpm test:coverage
```

## Done criteria

- [ ] `client.ts` is visibly smaller (responsibility-focused or thin orchestrator)
- [ ] New files each have a single clear responsibility
- [ ] All callers still work (no import path changes required, or all updated)
- [ ] `pnpm check` exits 0
- [ ] `pnpm test:run` exits 0
- [ ] `pnpm test:coverage` exits 0
- [ ] `plans/README.md` updated to DONE

## STOP conditions

- plan 081 or 085 is not DONE — do not start; the refactor would undo 081's changes or remove the test safety net
- The file is already well-decomposed after plan 081 landed — re-evaluate scope and mark SKIP with a note

## Maintenance notes

After this split, each new Square API feature should go in its own focused file, not accumulate in a single `client.ts`.
