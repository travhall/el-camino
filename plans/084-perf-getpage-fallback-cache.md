# Plan 084: Cache getPage fallback result to avoid redundant getPages() calls

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 915a062..HEAD -- src/lib/wordpress/api.ts`
> If the file changed, compare the excerpt before proceeding.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: performance
- **Planned at**: commit `915a062`, 2026-08-01

## Why this matters

`getPage(slug)` in `src/lib/wordpress/api.ts` has a two-path fetch strategy:

1. **Direct slug lookup**: fast, slug-specific API call with BlobCache backing
2. **Fallback**: calls `getPages()` (full page list) and finds the slug with `.find()`

The fallback is triggered when the direct lookup fails (e.g. WordPress API quirk,
slug casing mismatch). When the fallback succeeds and finds the page, the result
is returned — but it is NOT stored in the `page_${slug}` cache. The next call
to `getPage(slug)` will attempt the direct fetch again, fail again, and fall
back to `getPages()` again. If `getPages()` is cached, this is fast but
unnecessary; if `getPages()` is not yet cached (cold start), it's a full list
fetch on every call.

Fix: after a successful fallback find, store the result in `wordpressCache`
under the same `page_${slug}` key so the next call hits the cache directly.

## Current state

**File**: `src/lib/wordpress/api.ts`, lines 368–401:

```typescript
export async function getPage(slug: string): Promise<WordPressPage | null> {
  if (!slug) {
    return null;
  }

  try {
    const cacheKey = `page_${slug}`;

    // Try direct fetch first
    try {
      const page = await fetchWithCache<any>(
        `/posts/slug:${slug}?type=page&fields=ID,title,date,content,slug,featured_image`,
        cacheKey
      );

      if (page) {
        return processPage(page);
      }
    } catch (directFetchError) {
      console.warn(
        `Direct page fetch failed for "${slug}", trying fallback...`
      );
    }

    // Fallback: search through all pages
    const allPages = await getPages();
    const page = allPages.find((p) => p.slug === slug);

    return page || null;   // ← result not cached under page_${slug}
  } catch (error) {
    const appError = processWordPressError(error, `getPage:${slug}`);
    return handleError<WordPressPage | null>(appError, null);
  }
}
```

Also read `fetchWithCache` (earlier in the same file) to confirm its caching
mechanism before adding a manual cache write.

## Commands you will need

| Purpose   | Command      | Expected on success |
|-----------|--------------|---------------------|
| Typecheck | `pnpm check` | exit 0, no errors   |

## Scope

**In scope**:
- `src/lib/wordpress/api.ts`

**Out of scope**:
- `src/lib/cache/blobCache.ts`
- Callers of `getPage` — behavior is unchanged (same return value, just faster on repeat calls)

## Git workflow

- Branch: `advisor/084-perf-getpage-fallback-cache`
- Commit: `perf: cache getPage fallback result to avoid redundant getPages calls`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Cache the fallback result

In `src/lib/wordpress/api.ts`, change the fallback section at lines 392–396 from:

```typescript
// Fallback: search through all pages
const allPages = await getPages();
const page = allPages.find((p) => p.slug === slug);

return page || null;
```

to:

```typescript
// Fallback: search through all pages
const allPages = await getPages();
const page = allPages.find((p) => p.slug === slug) || null;

// Cache the found page so the next call for this slug hits the cache directly
// instead of falling through to the fallback again.
if (page) {
  await wordpressCache.set(cacheKey, page).catch(() => {
    // Non-fatal — proceed without caching
  });
}

return page;
```

Confirm the `wordpressCache` instance is already imported/available in scope
(it should be at the top of the file). Confirm `wordpressCache.set(key, value)`
exists on the `BlobCache` type — read `src/lib/cache/blobCache.ts` to verify
the method signature.

**Verify**: `pnpm check` → exit 0

### Step 2: Suppress the console.warn on expected fallback

The `console.warn` at line 387–389 currently fires whenever the direct fetch
fails. If the direct fetch consistently fails for certain slugs (expected
behavior), this warning floods logs. Consider downgrading to `console.debug`
or removing it after confirming the fallback works:

```typescript
// Before:
console.warn(`Direct page fetch failed for "${slug}", trying fallback...`);

// After — change to debug level (or remove entirely if fallback is expected):
// console.debug(`Direct page fetch for "${slug}" unavailable, using fallback`);
```

Use project-standard `logger.debug` from `@/lib/logger` if available. Do not
add a logger import if the function doesn't already use one — match the file's
existing pattern.

**Verify**: `pnpm check` → exit 0

## Done criteria

- [ ] `pnpm check` exits 0
- [ ] After fallback finds a page, `wordpressCache.set(cacheKey, page)` is called
- [ ] The `set` failure is caught and swallowed (non-fatal)
- [ ] No files outside the in-scope list are modified
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

- `wordpressCache.set` doesn't exist on `BlobCache` (only `getOrCompute`) — find the correct write method
- `fetchWithCache` stores raw API response objects, not `WordPressPage` types; storing a processed `page` under the same key would corrupt the next `fetchWithCache` call — in that case, skip this plan and investigate the cache structure first

## Maintenance notes

- If WordPress ever changes its slug API behavior and the direct fetch starts
  succeeding, the fallback path becomes dead code. The cache write in the fallback
  becomes inert but harmless.
- The TTL for the cached fallback result uses `wordpressCache`'s default TTL
  (set in `blobCache.ts`). This is intentional — same freshness as direct-fetch results.
