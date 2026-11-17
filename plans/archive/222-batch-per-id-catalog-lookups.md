# Plan 222: Replace the per-id catalog GETs on the cold render with batch calls

> **Executor instructions**: Follow step by step; run every verification. If a
> STOP condition occurs, stop and report. When done, update this plan's row in
> `plans/README.md`.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (touches `src/lib/square/`)
- **Depends on**: —
- **Category**: perf
- **Planned at**: commit `051257c`, 2026-11-16; from plan 176 Steps 2 and 4

## Why this matters

Every cold render, on every route, issues about 114 individual
`GET /v2/catalog/object/{id}` calls (image URLs, `imageUtils.ts:69`, and
measurement units, `productUtils.ts:22`), all at once (observed concurrency
114, average 378 ms each). Wall cost is about 514 ms of a ~1.9 s cold render;
one `batch-retrieve` took 159-164 ms in the same runs, so the saving is about
350 ms (19%). The bigger reason is that concurrency grows with the catalog and
with the number of cold instances, so this is where rate limiting would show
first. Measured on 95 items / 120 images / 3 units.

## Steps

1. Reproduce the baseline: build with `PREVIEW=true astro build`, count
   `catalog/object/{id}` calls on a cold `/` with a fetch-logging preload.
   **Verify**: about 114.
2. Write a failing unit test: resolving N uncached image ids makes
   ceil(N / 1000) `batchRetrieve` calls, not N `object.get` calls, and returns
   the same URL map. Same for measurement units.
3. Implement in `imageUtils.ts` and `productUtils.ts`, keeping the cache
   read/write behaviour and the per-id fallback when a batch call fails.
   **Verify**: tests pass; the cold `/` makes at most 3 such calls.
4. Re-measure the cold render. **Verify**: gain of 200 ms or more, else
   report and stop.
5. Gate: `pnpm check && pnpm lint && pnpm test:coverage`.

## STOP conditions

- `batchRetrieve` returns fewer objects than requested for ids that
  `object.get` resolves (compare on the Sandbox catalog): stop and report.
- Interacts with plan 024 (consolidate Square resilience layer): read its
  status row first.
