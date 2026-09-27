# Plan 191: Homepage shows a real empty/error state instead of permanent skeletons

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 426d14e..HEAD -- src/components/ArticleGrid.astro src/pages/index.astro src/lib/wordpress/api.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `426d14e`, 2026-09-26

## Why this matters

`ArticleGrid.astro` infers `isLoading` from `!posts.length`. The component is
server-rendered — nothing ever "finishes loading" — so when WordPress is
down or returns zero posts, the homepage's **final HTML** is a wall of skeleton
cards. No error, no empty state, forever. It is silent because
`getNewsPagePosts()` (`src/lib/wordpress/api.ts:617`) catches its own errors and
returns empty arrays, so `index.astro`'s `try/catch` never sets `error`.
Everything else in the app (Shop All, cart, 404) degrades gracefully; the
homepage — the highest-traffic page — does not. This was found in a
design/UX audit (PDF, 2026-09-26) and confirmed against source.

## Current state

- `src/components/ArticleGrid.astro:14-22` — Props destructure:

```astro
const {
  posts,
  error = null,
  isLoading = !posts.length,   // <-- THE BUG (line 20)
  showSidebar = false,
  filterable = false,
  view = 'grid',
} = Astro.props;
```

- `src/components/ArticleGrid.astro:~113-160` — render branch: `isLoading ? skeletons : displayPosts.length > 0 ? cards : <p>No posts found.</p>`. The `No posts found.` branch is **unreachable** whenever `posts` is empty and `isLoading` is not passed.
- `src/components/ArticleGrid.astro:~90-102` — an error banner renders when `error` is set (with "Try again" + "Browse the shop instead" links). Reuse this styling; do not redesign.
- `src/pages/index.astro:1-27` — fetches `getNewsPagePosts()` in a try/catch; sets `error` only if it *throws*. Renders `<ArticleGrid posts={posts} error={error} showSidebar={true} />` (no `isLoading`).
- `src/pages/index.astro` head slot: the `<meta name="description">` is only emitted inside `lcpImageSet && (...)`. `BaseHead.astro:202-206` already emits a `description` meta for every page, so when a featured image exists the homepage has **two** `<meta name="description">` tags. Remove the redundant homepage one.
- Other `ArticleGrid` callers: `src/pages/news/index.astro:284` and `src/pages/news/tag/[slug].astro:120` — both guard with `posts.length > 0` before rendering the grid, so they never hit the skeleton path. They must keep working unchanged.
- Conventions: components use `Astro.props` destructuring with defaults; `error` UI uses `text-state-error-text bg-state-error-surface`. Existing empty-state pattern to mimic (icon + heading + subtext + CTA): `src/pages/shop/all.astro:190-215`. A shared `EmptyState.astro` is being built in plan 192 — **do not depend on it**; write the homepage empty state inline, matching that markup, and note in Maintenance.
- Tests: vitest + happy-dom (`pnpm test:run`); component test precedent: `src/components/__tests__/cardEntrance.test.ts`.

## Commands you will need

| Purpose   | Command                          | Expected on success |
|-----------|----------------------------------|---------------------|
| Typecheck | `pnpm check`                     | exit 0, 0 errors    |
| Tests     | `pnpm test:run`                  | all pass            |
| Lint      | `pnpm lint`                      | exit 0              |
| Build     | `pnpm build`                     | exit 0              |

## Scope

**In scope** (only files you may modify):
- `src/components/ArticleGrid.astro`
- `src/pages/index.astro`
- `src/components/__tests__/ArticleGrid.test.ts` (create)

**Out of scope** (do NOT touch):
- `src/lib/wordpress/api.ts` — its swallow-and-return-empty contract is used by many callers; changing it is a separate decision. Handle the empty case in the page instead.
- `src/pages/news/**` — already guarded.
- The masonry CLS/LCP comments and the 2500ms safety-net script in `ArticleGrid.astro` — leave intact (documented, load-bearing).
- `ArticleCardSkeleton.astro` — keep the component; it just stops being the default.

## Git workflow

- Branch: `advisor/191-fix-homepage-permanent-skeleton`
- Commit style: conventional commits, e.g. `fix: stop inferring ArticleGrid loading state from posts.length`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Make `isLoading` explicit
In `ArticleGrid.astro` change the default to `isLoading = false`. Update the `Props` comment: `isLoading?: boolean; // explicit only — never inferred; SSR has no async resolution`.

**Verify**: `grep -n "isLoading = " src/components/ArticleGrid.astro` → shows `isLoading = false`; `grep -rn "isLoading=" src --include=*.astro` → no caller passes it (skeleton path becomes opt-in and currently unused; that is expected).

### Step 2: Give the "no posts" branch a real empty state
Replace the `<p>No posts found.</p>` fallback with an empty state that matches Shop All's pattern (icon or emoji at `aria-hidden`, `<h2>` heading in `font-display font-bold text-(--content-heading)`, subtext in `text-(--content-meta)`, CTA button classes copied from `src/pages/shop/all.astro:~204-210`). Copy for the homepage variant (when `showSidebar` is true): heading "Nothing new on the wall yet", subtext "Fresh news and shop updates land here. In the meantime, the shop's open.", CTA `Shop All` → `/shop/all`. For non-`showSidebar` callers keep heading "No posts found" with no CTA change. Keep `col-span-full` so it spans the grid. If `error` is set, do **not** also render the empty state (the error banner already shows) — gate the empty branch on `!error`.

**Verify**: `pnpm check` → 0 errors.

### Step 3: Homepage: drop the duplicate meta description
In `src/pages/index.astro`, remove the `<meta name="description" …>` element from the `slot="head"` fragment (BaseHead already emits one for every page). Keep the preload links. If you want a homepage-specific description, check `src/layouts/Layout.astro` props first; if `Layout` accepts a `description` prop, pass the same string there instead of a raw `<meta>`.

**Verify**: run `pnpm dev`, then `curl -s localhost:4321/ | grep -c 'name="description"'` → `1`.

### Step 4: Regression test
Create `src/components/__tests__/ArticleGrid.test.ts` using Astro's container API (`import { experimental_AstroContainer as AstroContainer } from 'astro/container'`) to render `ArticleGrid.astro`:
1. `posts=[]`, no error → output contains the empty-state heading and **does not** contain skeleton markup (read `ArticleCardSkeleton.astro` to pick a stable class/attr).
2. `posts=[]`, `error="x"` → contains the error banner text, no empty-state heading.
3. `posts=[<minimal WordPressPost fixture>]` → renders the card, no empty state.
If `AstroContainer` cannot render this component under the repo's vitest setup (e.g. requires `Astro.locals.nonce`), pass `locals: { nonce: 'test' }`; if it still fails after a reasonable attempt, STOP and report rather than rewriting the component to be testable.

**Verify**: `pnpm test:run src/components/__tests__/ArticleGrid.test.ts` → 3 pass.

## Test plan

Covered by Step 4. Manual check (recommended): run `pnpm dev` with `PUBLIC_WORDPRESS_API_URL` unreachable and confirm `/` shows the empty state, not skeletons.

## Done criteria

- [ ] `pnpm check` exits 0
- [ ] `pnpm lint` exits 0
- [ ] `pnpm test:run` exits 0, new ArticleGrid tests pass
- [ ] `pnpm test:coverage` exits 0 (no threshold regression)
- [ ] `grep -n "isLoading = !posts" src/components/ArticleGrid.astro` returns nothing
- [ ] `git status` shows only the 3 in-scope files changed
- [ ] `plans/README.md` status row updated

## STOP conditions

- Drift check shows `ArticleGrid.astro`/`index.astro` changed and excerpts no longer match.
- `AstroContainer` can't render the component (see Step 4).
- A caller other than `index.astro` turns out to rely on the old `isLoading` default (grep in Step 1 should be empty; if not, stop).
- Fixing the meta description requires editing `Layout.astro` or `BaseHead.astro` (out of scope).

## Maintenance notes

- Plan 192 introduces a shared `EmptyState.astro`; once both land, swap this inline markup for it (trivial follow-up, deliberately not coupled so both can land in parallel).
- If a client-side loading path is ever added to the homepage grid, it must pass `isLoading` explicitly.
- Reviewer: confirm the CLS/LCP-sensitive class string in `getContainerClasses()` and the `opacity: 0.001` keyframes are untouched.
