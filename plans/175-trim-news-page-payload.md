# Plan 175: Stop inlining every blog post's full body into the news page — twice

> **Executor instructions**: Follow step by step. Run every verification command
> and confirm the expected result. If anything in "STOP conditions" occurs, stop
> and report. When done, update this plan's status row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat ad2999d..HEAD -- src/pages/news/index.astro src/lib/wordpress/types.ts src/lib/wordpress/api.ts`
> On any change, compare against the excerpts below; on a mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `ad2999d`, 2026-09-05

## Why this matters

The news page ships every post's complete rendered body to the browser **twice**
— once inside `allPosts`, and again flattened into `searchIndex.searchableContent`
— on top of the 12 cards actually visible.

That inflates HTML transfer, HTML parse time, and the main-thread cost of the
`JSON.parse` that runs on load. It hits hardest on the page where visitors are
most likely to be on mobile. The same oversized payload is also what gets written
to and read back from `wordpressCache` on every miss.

## Current state

`src/pages/news/index.astro:249-251`:

```astro
    <script type="application/json" id="news-data" set:html={JSON.stringify({ allPosts, searchIndex, filterOptions })} />
    <script is:inline nonce={nonce}>
      window.newsData = JSON.parse(document.getElementById('news-data').textContent);
    </script>
```

`src/lib/wordpress/types.ts:560-576` — the index copies each full body:

```ts
export function buildSearchIndex(posts: WordPressPost[]): NewsSearchIndex {
  return {
    posts: posts.map((post) => ({
      id: post.id,
      slug: post.slug,
      title: post.title.rendered,
      excerpt: sanitizeHtmlContent(post.excerpt.rendered),
      searchableContent: [
        post.title.rendered,
        sanitizeHtmlContent(post.excerpt.rendered),
        sanitizeHtmlContent(post.content.rendered),
      ]
        .join(' ')
        .toLowerCase(),
    })),
  };
}
```

`src/lib/wordpress/api.ts:305` — `getPosts()` requests `content` among its
`fields`, so `allPosts` carries every body as well.

### The consumers you must not break

The client filter/search code reads `window.newsData`. **Find every field it
touches before trimming anything** — that is Step 1, and it is the whole risk of
this plan.

## Commands you will need

| Purpose   | Command                              | Expected             |
|-----------|--------------------------------------|----------------------|
| Typecheck | `pnpm check`                         | exit 0               |
| Tests     | `pnpm test:run -- wordpress news`    | all pass             |
| Full      | `pnpm test:run`                      | exit 0               |
| Coverage  | `pnpm test:coverage`                 | exit 0, no regression|
| Lint      | `pnpm lint`                          | exit 0               |
| Build     | `pnpm build`                         | exit 0               |
| Dev server| `pnpm dev`                           | serves on :4321      |

Never use `pnpm test` — watch mode, it hangs.

## Scope

**In scope**:
- `src/pages/news/index.astro` (the payload construction and its client script)
- `src/lib/wordpress/types.ts` (`buildSearchIndex`)
- `src/lib/wordpress/__tests__/`

**Out of scope** (do NOT touch):
- `src/lib/wordpress/api.ts`'s `fields` parameter. `getPosts()` is shared with
  `/news/[slug]` and the homepage, which **do** need `content`. Trim at the
  payload boundary, not at the fetch. Changing the fetch would break the article
  pages.
- `src/pages/news/[slug].astro` — individual articles legitimately render bodies.
- `sanitizeHtmlContent`'s behavior.
- Moving search to a server API route. That is the better long-term design but a
  much larger change — see Maintenance notes.

## Git workflow

- Branch: `advisor/175-trim-news-page-payload`
- Conventional commits, e.g. `perf: stop shipping full post bodies in the news page payload`
- Do NOT push or open a PR unless the operator instructs it.

## Steps

### Step 1: Enumerate what the client actually reads

```bash
grep -rn "newsData" src/pages/news/index.astro src/components/NewsFilters.astro src/components/NewsSearchSort.astro src/components/ArticleGrid.astro
```

Read every hit and list each field accessed on `allPosts[]`, `searchIndex.posts[]`,
and `filterOptions`.

**Verify**: produce that field list in the `plans/README.md` status row. This
list defines the new payload shape. Do not proceed without it.

### Step 2: Measure the baseline

With `pnpm dev`, load `/news` and record:
- total HTML transfer size
- the byte length of the `#news-data` script content
- number of posts included

**Verify**: all three recorded. You need them to prove the improvement.

### Step 3: Trim the search index

`searchableContent` is used for substring matching. Full bodies are the bulk of
the payload for a feature that mostly matches titles and excerpts.

Replace the full `content.rendered` with a **bounded** slice — e.g. the first
~500 characters of sanitized body text — so search still finds body terms near
the top of an article without shipping entire posts.

Document the tradeoff in a comment: deep-body matches are no longer found
client-side. **If that is unacceptable, STOP** — it means search must move
server-side, which is out of scope here.

**Verify**: `pnpm check` → exit 0.

### Step 4: Trim `allPosts` to the fields Step 1 identified

Build an explicit projection — do not pass whole `WordPressPost` objects. Include
only the listed fields (id, slug, title, excerpt, terms, date, featured-media URL,
and whatever else Step 1 found).

Give the projection a named type so a future field addition is deliberate.

**Verify**: `grep -n "allPosts" src/pages/news/index.astro` → the serialized value
is the projection, not the raw array.

### Step 5: Verify every client feature still works

With `pnpm dev` on `/news`:

- search by a word in a **title** → matches
- search by a word in an **excerpt** → matches
- search by a word early in a **body** → matches (per Step 3's bound)
- each category/tag filter → correct results
- the `event` tag filter → correct results
- sort controls → correct order
- pagination → works
- an article card still renders title, excerpt, image, date, tags

**Verify**: every one confirmed. Record any behavior change.

### Step 6: Measure the improvement

Repeat Step 2's measurements.

**Verify**: record before/after. Target a substantial reduction in the
`#news-data` payload; state the actual numbers rather than a claim.

### Step 7: Full gate

```bash
pnpm check && pnpm lint && pnpm test:run && pnpm build
```
→ all exit 0.

## Test plan

Add to `src/lib/wordpress/__tests__/`:

- `buildSearchIndex` truncates `searchableContent` to the bound
- a term in the title is still findable; a term within the bound is findable
- a term beyond the bound is **not** in the index (documents the tradeoff)
- the projection helper emits exactly the expected keys and no others — the
  payload-size regression guard

Model on the existing `content-utils.test.ts` style.

`pnpm test:coverage` → exit 0, no threshold regression.

## Done criteria

- [ ] Step 1's client field list recorded in `plans/README.md`
- [ ] Before/after HTML transfer and `#news-data` byte sizes recorded
- [ ] `searchableContent` is bounded; the bound is a named constant with a comment
- [ ] `allPosts` is an explicit projection with a named type, not raw posts
- [ ] All Step 5 client features verified working
- [ ] `src/lib/wordpress/api.ts` unmodified (`git status`)
- [ ] `src/pages/news/[slug].astro` unmodified (`git status`)
- [ ] `pnpm check` / `pnpm lint` / `pnpm test:run` / `pnpm build` all exit 0

## STOP conditions

Stop and report if:

- **Losing deep-body search is unacceptable.** Then the answer is a server-side
  search endpoint, not a truncated index — a different, larger plan. Report
  rather than shipping a search that silently finds less.
- Step 1 shows the client reads a field you cannot cheaply project (something
  derived from full content).
- Any Step 5 feature breaks and the cause is not obvious from the field list.
- The payload reduction is small (<30%), meaning the bulk was never the bodies.
  Report the measurements; the effort is not worth it.

## Maintenance notes

- **The rule**: what gets serialized into the page is a deliberate projection,
  not "whatever the API returned". The named type in Step 4 is what enforces it —
  adding a field becomes a visible decision.
- The truncation bound is a genuine functionality tradeoff, documented in code
  and in tests. If someone later reports "search can't find X", this is why.
- Because `getPosts()` still fetches `content` (correctly — other pages need it),
  `wordpressCache` still stores full bodies. That is fine; the cost this plan
  removes is transfer and client parse, not cache size.
- **Deliberately deferred**: moving search behind an API route, which would
  remove the tradeoff entirely and shrink the payload further.
