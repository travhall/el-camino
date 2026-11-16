# Plan 167: Scope the single-item inventory fallback to the configured location

> **Executor instructions**: Follow step by step. Run every verification command
> and confirm the expected result before moving on. If anything in "STOP
> conditions" occurs, stop and report. When done, update this plan's status row
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat ad2999d..HEAD -- src/lib/square/inventoryCore.ts src/lib/square/inventory.ts`
> On any change, compare against the excerpts below; on a mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `ad2999d`, 2026-09-05

## Why this matters

`fetchInventoryCounts` has two paths. The batch path scopes its query to the
configured Square location. The per-ID fallback — used exactly when the batch
call fails or the circuit breaker is open — **does not pass `locationIds` at
all**, so Square returns counts across every location on the account.

`inStockQty` then takes the first `IN_STOCK` row it finds. For a merchant with
more than one location, or any non-storefront stock location, that number is not
sellable stock. Checkout would approve sales against it, and the wrong value gets
written into the shared inventory cache — persisting the error past the outage
that caused it.

The omission is clearly unintentional: `src/lib/square/inventory.ts:23` passes
`locationIds` on the equivalent single-item call.

## Current state

`src/lib/square/inventoryCore.ts:56-66` — the batch path, correctly scoped:

```ts
  const locationId = import.meta.env.PUBLIC_SQUARE_LOCATION_ID;

  try {
    const page = await catalogRetryClient.executeWithRetry(
      () =>
        squareClient.inventory.batchGetCounts({
          catalogObjectIds: ids,
          locationIds: [locationId],
          states: ['IN_STOCK'], // only in-stock quantities matter
          limit: 100,
        }),
```

`src/lib/square/inventoryCore.ts:82-95` — the fallback, unscoped:

```ts
  } catch (batchErr) {
    // Batch failed (error or open circuit) — try each ID individually.
    await Promise.all(
      ids.map(async (id) => {
        try {
          const page = await squareClient.inventory.get({
            catalogObjectId: id,
          });
          counts[id] = inStockQty(page.data || []);
        } catch {
          failed.add(id);
        }
      })
    );
```

`src/lib/square/inventory.ts:21-24` — proof of the intended shape:

```ts
        const inventoryPage = await squareClient.inventory.get({
          catalogObjectId: variationId,
          locationIds: import.meta.env.PUBLIC_SQUARE_LOCATION_ID,
        });
```

Note the two call sites pass `locationIds` differently — an **array** in
`batchGetCounts`, a **bare string** in `inventory.get`. Match `inventory.ts`'s
shape for `inventory.get`, and confirm against the SDK's types.

## Commands you will need

| Purpose   | Command                                | Expected             |
|-----------|----------------------------------------|----------------------|
| Typecheck | `pnpm check`                           | exit 0               |
| Tests     | `pnpm test:run -- inventory`           | all pass             |
| Full      | `pnpm test:run`                        | exit 0               |
| Coverage  | `pnpm test:coverage`                   | exit 0, no regression|
| Lint      | `pnpm lint`                            | exit 0               |

Never use `pnpm test` — watch mode, it hangs.

## Scope

**In scope**:
- `src/lib/square/inventoryCore.ts` (the fallback call only)
- `src/lib/square/__tests__/` — the inventory test file

**Out of scope** (do NOT touch):
- The batch path. It is already correct.
- `src/lib/square/inventory.ts`. It is the reference, not the target.
- `inStockQty`'s "first IN_STOCK row" logic. Once the query is location-scoped
  there should only be one row; changing the reducer is a different fix and would
  mask whether this one worked.
- The circuit-breaker / retry behavior that triggers the fallback (plan 176).

## Git workflow

- Branch: `advisor/167-scope-inventory-fallback-to-location`
- Conventional commits, e.g. `fix: scope the per-item inventory fallback to the configured location`
- Do NOT push or open a PR unless the operator instructs it.

## Steps

### Step 1: Confirm how many locations this account has

The impact depends entirely on this. Check the Square dashboard, or add a
one-off script (not committed) listing locations.

**Verify**: record the location count in the `plans/README.md` status row. If
there is exactly one location today, this is a latent bug — still worth fixing,
but say so rather than overstating the impact.

### Step 2: Pass `locationIds` in the fallback

Add the parameter, matching `inventory.ts:23`'s shape. Add a comment noting that
the fallback must stay scoped identically to the batch path, since it runs
precisely when things are already degraded.

**Verify**:
```bash
grep -n "locationIds" src/lib/square/inventoryCore.ts
```
→ two matches (batch and fallback).

```bash
pnpm check
```
→ exit 0 (this also validates the parameter shape against the SDK types).

### Step 3: Full gate

```bash
pnpm check && pnpm lint && pnpm test:run && pnpm test:coverage
```
→ all exit 0.

## Test plan

Add to the existing inventory test file (find it with
`ls src/lib/square/__tests__/`; model on whichever already mocks
`squareClient.inventory`):

- **The regression proof**: force the batch call to reject, then assert the
  per-ID `inventory.get` mock was called **with** `locationIds` set to the
  configured location.
- A fallback response containing rows from two locations returns the configured
  location's quantity, not the first row's.
- Existing batch-path tests still pass unchanged.

`pnpm test:coverage` → exit 0. `inventory.ts` has a per-file threshold; confirm
`inventoryCore.ts` changes do not drop it.

## Done criteria

- [ ] Step 1's location count recorded in `plans/README.md`
- [ ] `grep -n "locationIds" src/lib/square/inventoryCore.ts` returns two matches
- [ ] A test asserts the fallback passes `locationIds`
- [ ] A test asserts a multi-location response yields the configured location's quantity
- [ ] `src/lib/square/inventory.ts` unmodified (`git status`)
- [ ] `pnpm check` / `pnpm lint` / `pnpm test:run` all exit 0
- [ ] `pnpm test:coverage` exits 0, no threshold regression

## STOP conditions

Stop and report if:

- **`pnpm check` fails on the parameter shape** — the SDK may want an array here
  as it does for `batchGetCounts`. Match the types; if both call sites disagree
  with the SDK, report.
- The account genuinely has multiple sellable locations and stock should be
  aggregated rather than scoped. That is a product decision, not a bug fix.
- Existing tests break, implying something depended on the unscoped behavior.
- Any verification fails twice after a reasonable fix attempt.

## Maintenance notes

- **The rule**: every Square inventory query must be location-scoped. There are
  now three such call sites (`batchGetCounts`, the fallback, and `inventory.ts`);
  a fourth should be reviewed for the same parameter.
- Fallback paths are systematically under-tested because they only run during
  failures. The regression test added here is the only thing that will keep this
  fixed.
- A reviewer should check the parameter shape matches the SDK, not just that the
  word `locationIds` appears.
