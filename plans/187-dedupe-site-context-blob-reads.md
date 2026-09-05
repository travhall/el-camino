# Plan 187: Stop `getStructuredData` re-reading the three blobs `getSiteContext` already fetched

> **Executor instructions**: Follow step by step. Run every verification command.
> If anything in "STOP conditions" occurs, stop and report. When done, update
> this plan's status row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat ad2999d..HEAD -- src/lib/siteContext.ts src/lib/structuredData.ts src/lib/contactInfo.ts src/lib/socialLinks.ts src/lib/shopHours.ts src/pages/the-shop/index.astro`
> On any change, compare against the excerpts below; on a mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `ad2999d`, 2026-09-05

## Why this matters

`getSiteContext` fetches six values in parallel — and one of them,
`getStructuredData()`, internally re-fetches three of the other five. None of the
three memoize, so each call hits Netlify Blobs again.

That means **every SSR request** performs three redundant Blobs reads before any
page-specific work starts. `/the-shop` adds more by re-fetching the same three
values that `Layout` already resolved for the same request.

The fix is threading already-resolved values through instead of refetching —
small, low-risk, and it removes work from every single request on the site.

The comment at `src/lib/siteContext.ts:3` claiming "6 blob reads" is already
inaccurate and should be corrected as part of this.

## Current state

`src/lib/siteContext.ts:43-52`:

```ts
  memo.siteContextPromise = (async () => {
    const [contact, social, hours, structured, salePageVisible, shopPageVisible] =
      await Promise.all([
        getContactInfo(),
        getSocialLinks(),
        getShopHours(),
        getStructuredData(),
        getSalePageVisible(),
        getShopPageVisible(),
      ]);
```

`src/lib/structuredData.ts:11-16` — the same three again:

```ts
export async function getStructuredData(): Promise<object> {
  const [contact, social, hours] = await Promise.all([
    getContactInfo(),
    getSocialLinks(),
    getShopHours(),
  ]);
```

Neither `getContactInfo` nor its siblings memoize — each goes to the store.

Additional reads worth checking in Step 1:
- `src/lib/pageVisibility.ts` and `src/lib/shopHours.ts` use
  `consistency: "strong"`, the slower uncached Blobs read path. For read-only
  page rendering, eventual consistency is very likely fine — but **confirm what
  writes them** before changing it.
- `src/pages/the-shop/index.astro:19-23` re-fetches values `Layout` already has
  via `getSiteContext(Astro.locals)`.

## Commands you will need

| Purpose   | Command                                    | Expected             |
|-----------|--------------------------------------------|----------------------|
| Typecheck | `pnpm check`                               | exit 0               |
| Tests     | `pnpm test:run -- siteContext structured`  | all pass             |
| Full      | `pnpm test:run`                            | exit 0               |
| Coverage  | `pnpm test:coverage`                       | exit 0, no regression|
| Lint      | `pnpm lint`                                | exit 0               |
| Dev server| `pnpm dev`                                 | serves on :4321      |

Never use `pnpm test` — watch mode, it hangs.

## Scope

**In scope**:
- `src/lib/structuredData.ts` (accept its inputs)
- `src/lib/siteContext.ts` (pass them; fix the stale comment)
- `src/pages/the-shop/index.astro` (read from `getSiteContext`)
- the corresponding test files

**Out of scope** (do NOT touch):
- `src/lib/contactInfo.ts`, `socialLinks.ts`, `shopHours.ts` internals. Do **not**
  add module-level memoization to them — a module-level cache in a long-lived
  Lambda would serve stale admin-edited values with no invalidation path. The
  per-request memo in `siteContext.ts` is the right layer.
- The org-schema JSON shape. Byte-identical output is required.
- `src/lib/cache/blobCache.ts` — plan 166.
- The wider cold-path work — plan 176.

## Git workflow

- Branch: `advisor/187-dedupe-site-context-blob-reads`
- Conventional commits, e.g. `perf: pass resolved site config into getStructuredData`
- Do NOT push or open a PR unless the operator instructs it.

## Steps

### Step 1: Count the actual blob reads per request

Add temporary instrumentation (a counter in `getStore` usage, or a log per read)
and load `/`, `/the-shop`, and a PDP with a cold in-memory cache.

**Verify**: record reads per route in `plans/README.md`, and note how many use
`consistency: "strong"`. This is the before number.

### Step 2: Make `getStructuredData` accept its inputs

Change the signature to take `contact`, `social`, and `hours`. Keep the schema
construction identical.

Find every caller (`grep -rn "getStructuredData" src/`) and update them.

**Verify**: `grep -n "getContactInfo\|getSocialLinks\|getShopHours" src/lib/structuredData.ts`
→ no matches. `pnpm check` → exit 0.

### Step 3: Thread them through `getSiteContext`

Resolve the five independent values in one `Promise.all`, then build the
structured data from the results. Correct the stale "6 blob reads" comment to
describe what now happens.

**Verify**: `pnpm check` → exit 0.

### Step 4: Have `/the-shop` reuse the request context

Replace its direct fetches with reads from `getSiteContext(Astro.locals)`.

**Verify**: `grep -n "getContactInfo\|getSocialLinks\|getShopHours" src/pages/the-shop/index.astro`
→ no matches.

### Step 5: Evaluate the strong-consistency reads — carefully

Check what writes `pageVisibility` and `shopHours`. If they are admin-panel
writes whose effect can be visible a moment later, eventual consistency is fine
and faster.

**If an admin write must be reflected immediately on the next page load, leave
them alone** and say so. Do not trade admin correctness for a few milliseconds.

**Verify**: decision recorded with reasoning.

### Step 6: Confirm identical output and measure

```bash
curl -s http://localhost:4321/ | grep -o '<script[^>]*application/ld+json[^>]*>[^<]*</script>' > /tmp/schema-after.txt
```

Compare against `master`.

**Verify**: the org schema JSON is **byte-identical**. Then re-run Step 1's count
and record before/after. Remove all instrumentation.

### Step 7: Full gate

```bash
pnpm check && pnpm lint && pnpm test:run && pnpm test:coverage
```
→ all exit 0.

## Test plan

- `src/lib/__tests__/` for `structuredData`: given fixed contact/social/hours
  inputs, the emitted schema matches a snapshot — and the function makes **no**
  blob reads (assert the store mock was not called). That second assertion is the
  regression guard.
- `siteContext`: each underlying getter is called **exactly once** per request.
- Model on `src/lib/__tests__/shopHours.test.ts`.

`pnpm test:coverage` → exit 0, no threshold regression.

## Done criteria

- [ ] Step 1's before/after blob-read counts per route recorded
- [ ] `getStructuredData` performs no blob reads (asserted by test)
- [ ] Each site-config getter called exactly once per request (asserted by test)
- [ ] `/the-shop` reads from `getSiteContext`
- [ ] Org schema JSON byte-identical to `master`
- [ ] Step 5's consistency decision recorded with reasoning
- [ ] No module-level memoization added to the getters (`git diff` review)
- [ ] All instrumentation removed (`git status`)
- [ ] `pnpm check` / `pnpm lint` / `pnpm test:run` all exit 0

## STOP conditions

Stop and report if:

- **The org schema output changes at all.** It is SEO-visible; byte-identical or
  stop.
- Threading the values requires changing `getSiteContext`'s public shape in a way
  that ripples into `Layout`, `Footer`, and `Nav`. There is a way to avoid that;
  find it or report.
- You conclude module-level memoization on the getters is the cleaner fix. It is
  not — it would serve stale admin edits with no invalidation. Report if you
  disagree; don't just do it.
- An admin write must be immediately visible and you have already relaxed
  consistency. Revert that part.

## Maintenance notes

- **The layering rule**: per-request memoization belongs in `siteContext.ts`.
  Anything wanting site config during a request reads from there, not from the
  getters directly. A new component fetching `getContactInfo()` itself
  reintroduces this.
- The "6 blob reads" comment was wrong before this change. Keep whatever you
  replace it with accurate, or drop the count entirely — a number in a comment
  drifts.
- A reviewer should check the schema diff is empty and that no getter gained a
  module-level cache.
