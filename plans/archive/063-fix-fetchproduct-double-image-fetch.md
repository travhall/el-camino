# Plan 063: Eliminate duplicate image fetch in fetchProduct

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 9b5556b..HEAD -- src/lib/square/client.ts src/lib/square/imageUtils.ts`
> If any changes appear, compare before proceeding.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: performance
- **Planned at**: commit `9b5556b`, 2026-07-22

## Why this matters

In `src/lib/square/client.ts:fetchProduct`, the first item image is fetched
twice: once via `batchGetImageUrls(allItemImageIds)` (which fetches all item
images including index 0) and once via a separate `getImageUrl(allItemImageIds[0])`
call (lines ~404–412). Both run concurrently, so the primary image URL is
fetched from BlobCache (or Square) twice per PDP load.

The fix: derive the primary image URL from the result of `batchGetImageUrls`
that already runs, instead of firing a second `getImageUrl` call.

## Current state

`src/lib/square/client.ts` (~lines 401–412):

```ts
const allItemImagesPromise =
  allItemImageIds.length > 0
    ? batchGetImageUrls(allItemImageIds)
    : Promise.resolve({} as Record<string, string>);

// Separate call for the same allItemImageIds[0]:
const imagePromise: Promise<string | null> =
  allItemImageIds.length > 0
    ? getImageUrl(allItemImageIds[0])
    : Promise.resolve(null);
```

`imagePromise` is then `await`-ed alongside other promises to get `imageUrl`.

## Commands you will need

| Purpose        | Command              | Expected on success      |
|----------------|----------------------|--------------------------|
| Typecheck      | `pnpm check`         | exit 0, no errors        |
| Unit tests     | `pnpm test:run`      | all pass                 |

## Scope

**In scope**:
- `src/lib/square/client.ts` — the `fetchProduct` function only

**Out of scope**:
- `src/lib/square/imageUtils.ts` — do not modify
- `fetchProducts` (the bulk catalog fetch) — different function, not touched

## Git workflow

- Branch: `advisor/063-fix-fetchproduct-double-image-fetch`
- Commit message: `perf: derive primary image URL from batchGetImageUrls result in fetchProduct`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Read the full fetchProduct image section

```bash
grep -n "imagePromise\|allItemImages\|batchGetImageUrls\|getImageUrl\|imageUrl" src/lib/square/client.ts | grep -A0 ""
```

Read lines ~400–450 in full to understand how `imagePromise` and
`allItemImagesPromise` are awaited and how their results are used.

### Step 2: Remove the redundant `imagePromise`

After identifying how `imageUrl` is set from `imagePromise`, restructure to
derive it from `allItemImagesPromise` after that promise resolves.

The general pattern:

```ts
// Remove imagePromise entirely. Keep allItemImagesPromise.

const [allItemImages, variationImageUrls, measurementUnits] = await Promise.all([
  allItemImagesPromise,
  variationImagePromise,
  measurementUnitPromise,
]);

// Derive primary image from the batch result:
const primaryImageId = allItemImageIds[0];
let imageUrl = primaryImageId ? (allItemImages[primaryImageId] ?? EL_CAMINO_LOGO_DATA_URI) : EL_CAMINO_LOGO_DATA_URI;
```

Adapt the exact variable names to match what you find in Step 1.

**Important**: ensure the fallback to `EL_CAMINO_LOGO_DATA_URI` is preserved
when no image IDs exist or when the image URL is missing from the batch result.

### Step 3: Verify no other uses of `imagePromise`

```bash
grep -n "imagePromise" src/lib/square/client.ts
```

Expected: zero matches after your change.

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
- [ ] `grep "imagePromise" src/lib/square/client.ts` → no matches
- [ ] `grep "getImageUrl(allItemImageIds\[0\])" src/lib/square/client.ts` → no matches
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

- `imagePromise` is used for purposes other than deriving `imageUrl` (e.g. it
  is passed to a sub-function) — report the actual usage and stop.
- The refactor would require restructuring how `Promise.all` aggregates results
  in a complex way — report the exact `await` pattern you find instead of
  improvising.
