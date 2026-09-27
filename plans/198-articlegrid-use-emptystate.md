# Plan 198: `ArticleGrid` uses the shared `EmptyState` component

> **Executor instructions**: Follow step by step; run every verification command; on any STOP condition stop and report. Do NOT edit `plans/README.md`; report the outcome in your final message.
>
> **Drift check (run first)**: `git diff --stat 1ca06c0..HEAD -- src/components/ArticleGrid.astro src/components/EmptyState.astro src/components/__tests__/ArticleGrid.test.ts` — on any change, re-read the excerpts below; on a mismatch, STOP.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans 191 and 192 (both merged)
- **Category**: tech-debt
- **Planned at**: commit `1ca06c0`, 2026-09-27

## Why this matters

Plan 191 added a hand-rolled empty state to `ArticleGrid.astro` (with a ~200-character pasted button class string) because the shared `EmptyState` component (plan 192) didn't exist yet. Now it does. Swapping removes the copy-paste and keeps the homepage's empty state visually identical to the cart, shop and news ones.

## Current state

`src/components/ArticleGrid.astro` (~lines 166-190) renders, when `posts` is empty and no `error`:

```astro
) : !error ? (
  <div class="text-center py-16 col-span-full">
    <div class="text-6xl mb-4 opacity-20" aria-hidden="true">🛹</div>
    <h2 class="text-2xl font-display font-bold text-(--content-heading) mb-2">
      {showSidebar ? 'Nothing new on the wall yet' : 'No posts found'}
    </h2>
    {showSidebar && (<> <p class="text-(--content-meta) mb-6 max-w-md mx-auto">Fresh news and shop updates land here. In the meantime, the shop's open.</p>
      <a href="/shop/all" class="font-sans font-semibold …pasted classes…">Shop All</a> </>)}
  </div>
) : null
```

`src/components/EmptyState.astro` props: `heading`, `body?`, `icon?`/`emoji?`, `ctaLabel?`, `ctaHref?`, `ctaVariant?` (default `'primary'`), `ctaId?`, `headingLevel?` (default `h2`), `class?`, `fill?`, `compact?`. It renders a wrapper `text-center flex flex-col items-center py-16` — it does NOT include `col-span-full`, which the grid needs (the container is a CSS grid), so pass `class="col-span-full"`.
`src/components/__tests__/ArticleGrid.test.ts` asserts the heading text `Nothing new on the wall yet` and `href="/shop/all"` when `showSidebar: true`, and that the error state hides the empty state — these must keep passing unchanged.

## Commands

`pnpm check` (0 errors), `pnpm lint` (exit 0), `pnpm test:run` (all pass), `pnpm test:coverage` (exit 0).

## Scope

**In scope**: `src/components/ArticleGrid.astro`, and `src/components/__tests__/ArticleGrid.test.ts` only if an assertion needs adjusting.
**Out of scope**: `EmptyState.astro` (do not modify it — if it can't express this, STOP), the masonry CLS/LCP classes and the 2500 ms safety-net script in `ArticleGrid.astro`, the skeleton/loading branch, all other files.

## Git workflow

Branch `advisor/198-articlegrid-use-emptystate`; commit `refactor: use EmptyState in ArticleGrid`. Do NOT push or open a PR.

## Steps

### Step 1: Swap the markup
Add `import EmptyState from './EmptyState.astro';` (the file already uses relative imports for siblings). Replace the `<div class="text-center py-16 col-span-full">…</div>` block with:

```astro
<EmptyState
  class="col-span-full"
  emoji="🛹"
  heading={showSidebar ? 'Nothing new on the wall yet' : 'No posts found'}
  body={showSidebar ? "Fresh news and shop updates land here. In the meantime, the shop's open." : undefined}
  ctaLabel={showSidebar ? 'Shop All' : undefined}
  ctaHref={showSidebar ? '/shop/all' : undefined}
/>
```
Keep the surrounding `!error ? … : null` structure exactly.
**Verify**: `pnpm check` → 0 errors; `grep -c "font-sans font-semibold text-sm" src/components/ArticleGrid.astro` → `0`.

### Step 2: Tests
**Verify**: `pnpm test:run src/components/__tests__/ArticleGrid.test.ts` → all 3 pass with no edits. Add one assertion that the empty state wrapper contains `col-span-full` (regression guard for the grid layout).

## Test plan

The three existing ArticleGrid tests plus the `col-span-full` assertion.

## Done criteria

- [ ] `pnpm check`, `pnpm lint`, `pnpm test:run`, `pnpm test:coverage` exit 0
- [ ] `grep -n "EmptyState" src/components/ArticleGrid.astro` shows the import and one use
- [ ] `git status` shows only in-scope files changed

## STOP conditions

- Drift-check mismatch.
- `EmptyState` cannot render the emoji, body and CTA combination here without editing it.
- Any change would touch the CLS/LCP-sensitive class string or the safety-net script.

## Maintenance notes

Any future empty state in the app should use `EmptyState`. Reviewer: confirm the homepage empty state still spans the full grid width (`col-span-full`) — a visual check on `/` with WordPress unreachable is worthwhile if you have a way to force it.
