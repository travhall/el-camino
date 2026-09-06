# Plan 155: Fix the `Netlify-Vary` query keys so filtered category pages aren't served to the wrong users

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report. When done, update this
> plan's status row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat ad2999d..HEAD -- netlify.toml src/lib/square/filterUtils.ts src/pages/category/[...slug].astro`
> On any change, compare the excerpts below against live code first; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (but see Dependency notes — shares `netlify.toml` with 146, 149, 156)
- **Category**: bug
- **Planned at**: commit `ad2999d`, 2026-09-05

## Why this matters

`netlify.toml` tells Netlify's CDN which query parameters are part of the cache
key for `/category/*`. It names **`brand`** — a parameter that does not exist
anywhere in this codebase. The real filter parameters are `brands` (plural),
`categories`, `availability`, and `onSale`.

Two consequences, and the first is a correctness bug, not a performance one:

1. **Users are served each other's filtered results.** Because `brands`,
   `categories`, and `onSale` are absent from the cache key, every filter
   permutation of a category page collapses onto one cached entry. A visitor
   filtering by one brand can be served the page another visitor generated with
   a different filter.
2. Every genuinely distinct filter view is also a cache miss requiring a full
   SSR render — the opposite of the intent.

## Current state

`netlify.toml:44-46`:

```toml
[[headers]]
for = "/category/*"
[headers.values]
Netlify-Vary = "query=brand,query=availability"
```

The actual parameter names, `src/lib/square/filterUtils.ts` — read
`filtersToURLParams` (around `:256`) and the parsing that feeds
`filterProductsWithCache` to confirm the full set before editing. The four
filter dimensions the code uses are `brands`, `categories`, `availability`, and
`onSale`. **`brand` (singular) appears nowhere.**

`src/pages/category/[...slug].astro:67-73` sets the caching this interacts with:

```astro
  "public, no-cache, s-maxage=300, stale-while-revalidate=0"
...
  "public, s-maxage=300, stale-while-revalidate=0"
```

### Verify the parameter names yourself first

Do **not** take the list above on faith. `filterUtils.ts` is the authority, and
the page may read parameters directly too. Step 1 is a discovery step for
exactly this reason.

## Commands you will need

| Purpose   | Command         | Expected         |
|-----------|-----------------|------------------|
| Typecheck | `pnpm check`    | exit 0, 0 errors |
| Tests     | `pnpm test:run` | exit 0           |
| Lint      | `pnpm lint`     | exit 0           |
| Build     | `pnpm build`    | exit 0           |
| Dev server| `pnpm dev`      | serves on :4321  |

Never use `pnpm test` — watch mode, it hangs.

## Scope

**In scope**:
- `netlify.toml` (the `for = "/category/*"` block only)

**Out of scope** (do NOT touch):
- Any other block in `netlify.toml`. Plans 146, 149, and 156 each edit different
  blocks of this file; staying inside your own block is what makes them
  mergeable.
- `src/lib/square/filterUtils.ts` — you are reading it, not changing it.
- The `Cache-Control` / `stale-while-revalidate=0` values on the category page.
  The `swr=0` choice interacts with cache stampedes and is plan 176's territory.
- Renaming any query parameter in the application code. Fix the header to match
  the code, never the reverse — the parameter names are in user-visible URLs and
  possibly in existing links.

## Git workflow

- Branch: `advisor/155-fix-netlify-vary-query-keys`
- Conventional commits, e.g. `fix: vary category CDN cache on the real filter query params`
- Do NOT push or open a PR unless the operator instructs it.

## Steps

### Step 1: Enumerate the real filter parameters

Read `src/lib/square/filterUtils.ts` and `src/pages/category/[...slug].astro`
and list every query parameter the category route reads.

```bash
grep -rn "searchParams.get\|URLSearchParams" src/pages/category/ src/lib/square/filterUtils.ts
```

Write the resulting list into the `plans/README.md` status row. If it differs
from `brands` / `categories` / `availability` / `onSale`, use **your** list —
it is derived from the code, this plan's is derived from a read at commit
`ad2999d`.

**Verify**: you have an explicit list, and `brand` (singular) is not in it.

### Step 2: Correct the header

Replace the `Netlify-Vary` value with one `query=` entry per parameter from
Step 1, and add a comment tying it to `filterUtils.ts` so the two stay in sync:

```toml
# Cache key must include every filter query param the category route reads —
# see filtersToURLParams in src/lib/square/filterUtils.ts. A param missing here
# collapses distinct filter results onto one cache entry, so users can be served
# someone else's filtered page. Adding a filter param to the code means adding
# it here.
Netlify-Vary = "query=brands,query=categories,query=availability,query=onSale"
```

**Verify**:
```bash
grep -n "Netlify-Vary" netlify.toml
```
→ the corrected value; no `query=brand,` (singular followed by comma) remains.

### Step 3: Confirm on a deploy preview

Cache-key behavior is not reproducible locally. On a preview:

```bash
for q in "brands=nike" "brands=adidas" ""; do
  curl -sSI "https://<PREVIEW_HOST>/category/decks?$q" | grep -iE "cache-status|netlify-vary"
done
```

Then request each URL twice.

**Verify**: distinct filter values produce distinct cache entries — the second
request for a given filter shows a hit, while switching filters shows a miss
rather than serving the previous filter's cached body. Confirm visually that
`?brands=<x>` renders products matching `<x>`.

If you cannot produce a deploy preview, STOP — the whole point of this change is
CDN behavior, and the failure mode (users seeing wrong products) is worse than
the status quo if the header is malformed.

### Step 4: Full gate

```bash
pnpm check && pnpm lint && pnpm test:run && pnpm build
```
→ all exit 0.

## Test plan

- No unit tests apply — this is a CDN configuration header.
- **Optional but valuable**: add a test in
  `src/lib/square/__tests__/filterUtils.test.ts` asserting the exact set of
  parameter names `filtersToURLParams` emits, with a comment pointing at this
  `netlify.toml` block. That converts a silent config drift into a visible test
  failure the next time a filter is added.
- `pnpm test:run` → exit 0.

## Done criteria

- [ ] Step 1's parameter list recorded in `plans/README.md`
- [ ] `grep -n "Netlify-Vary" netlify.toml` shows one `query=` entry per real parameter
- [ ] No `query=brand,` (singular) remains
- [ ] Deploy-preview check: distinct filter values yield distinct cached responses with correct products
- [ ] Only the `for = "/category/*"` block of `netlify.toml` modified (`git diff`)
- [ ] `pnpm check` / `pnpm lint` / `pnpm test:run` / `pnpm build` all exit 0

## STOP conditions

Stop and report if:

- **You cannot produce a deploy preview.** Do not ship a cache-key change blind.
- Step 1 finds filter parameters with high cardinality (a free-text search box,
  a per-user token). Adding those to the cache key would fragment the cache to
  near-uselessness — that is a design decision for the operator.
- The category page turns out to read filters from something other than query
  parameters (a cookie, a header). `Netlify-Vary` supports those but with
  different syntax, and the blast radius changes.
- Any verification fails twice after a reasonable fix attempt.

## Maintenance notes

- **The sync rule**: adding a filter parameter to `filterUtils.ts` requires
  adding it to this header. Nothing enforces this — the optional test in the
  Test plan is the only mechanism that would.
- This is the same silent-config-failure class as the `s-max-age` typo
  (plan 154), the dead image-header rule (plan 146), and the unread `SQUARE_*`
  env vars (plan 162): configuration that looks active and does nothing. Worth
  a standing audit rather than four separate fixes.
- A reviewer should confirm the header names match the code exactly, including
  plurals and camelCase (`onSale`, not `onsale` — query parameters are
  case-sensitive).
