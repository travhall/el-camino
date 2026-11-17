# Plan 230: Stop hiding the first news cards behind JavaScript

> **Executor instructions**: Follow this plan step by step; run every
> verification. If a STOP condition occurs, stop and report. Write the failing
> test first. When done, update this plan's row in `plans/README.md` and
> `git mv` the file to `plans/archive/` in the same PR.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW-MED (entrance animation changes for the first cards; layout shift)
- **Depends on**: —
- **Category**: perf
- **Planned at**: commit `b7bd0c3`, 2026-11-17; from the `/news` LCP investigation

## Why this matters

`/news` LCP is **4.08 s** on staging (mobile, Lighthouse 12.8.2, devtools
throttling, three runs: 4,214 / 4,011 / 4,075 ms, 5% spread). The breakdown is
TTFB 0.4 s, load delay 0.4 s, image download 1.3 s and **element render delay
2.0 s (49%)**. The LCP element is the first card's image, which arrives at
about 2.1 s and then waits.

Cause: `src/components/ArticleGrid.astro` renders every card of the filterable
grid as `class="article-card-wrapper opacity-0 ..."` (line ~130), and
`.article-card-wrapper.opacity-0 { opacity: 0 }` hides it until the inline
`<script>` in the same file runs `initializeArticleAnimations()` on
`astro:page-load` (after a 250 ms mobile `--grid-entrance-delay`) and swaps in
`opacity-100`. Chrome does not count an `opacity: 0` element as an LCP
candidate, so LCP is the moment JavaScript reveals it. That script is one of
39 separate script requests on the page, and it runs only after the ones
before it are fetched and evaluated. Total blocking time is 0, so the delay is
script delivery on the throttled link, not CPU. The filmstrip confirms it: the
grid is blank until all cards appear at once.

Evidence the fix works (not a measurement of the fix itself): through a local
proxy in front of staging, with the first two `opacity-0` classes stripped from
the HTML, the render delay fell from 2,502 ms to **19 ms**, LCP from 6.5 s to
3.2 s (the proxy's single HTTP/1.1 origin exaggerates the script queue, so use
it for the comparison, not the absolute figures) and CLS stayed 0. From the
direct phases, a card visible when its image lands gives LCP about 2.1-2.3 s.

Side effect worth fixing at the same time: with JavaScript off or failing, the
news grid is permanently invisible (no `<noscript>` fallback).

## Current state

- `ArticleGrid.astro:~126-141`: `filterable` branch wraps each card in
  `article-card-wrapper opacity-0`; `shouldPrioritize(index)` already gives the
  first two cards eager, `fetchpriority=high` images.
- `ArticleGrid.astro` `<script>`: `initializeArticleAnimations()` reveals cards
  with an `IntersectionObserver` (`rootMargin: 200px`), staggered by
  `--animation-order`, after `ANIMATION_CONFIG.entranceDelay` on the news page.
- `src/lib/ui/cardEntrance.ts` (`armCardsOnImageReady`) only touches
  `.article-grid .article-card-wrapper` (the home masonry), not this grid.
- The home page already solved this differently (plan 148): CSS animation at
  parse time, armed per card on image readiness.

## Steps

1. **Test first** in `src/components/__tests__/ArticleGrid.test.ts` (it already
   renders the component through the Astro container; note its 20 s timeout):
   with `filterable` and `view="grid"`, the first N wrappers do **not** carry
   `opacity-0` and the rest do; with `view="list"` the same for its first card
   (list shows one card above the fold on mobile, so N = 1 or 2). **Verify**: it
   fails before the change.
2. Render the first N cards without `opacity-0`. Choose N to cover the first
   viewport on mobile (2 columns, about 4 cards); check the xl 4-column first
   row too. Keep `data-initial-index`/`data-variant` so `initializeArticleAnimations`
   and the filter code still see every card (they query `.opacity-0`, so the
   unhidden cards are simply skipped by the reveal and keep working for
   filtering: **check `NewsFilters` and `NewsSearchSort` set/unset the class on
   visible cards and do not assume every card starts hidden**).
3. Add a no-JS fallback: `<noscript><style>.article-card-wrapper.opacity-0
   { opacity: 1; transform: none; }</style></noscript>` in the page `<head>`
   (mind the CSP nonce rules: `plans/archive/217`). **Verify**: with JS
   disabled the grid is visible.
4. Measure as in the investigation: Lighthouse 12.8.2 mobile, devtools
   throttling, three runs, directly against the deployed staging build (the
   proxy cannot apply a source change). **Verify**: LCP drops by 1 s or more
   (target about 2.2 s), CLS stays 0 (the cards are `aspect`-sized and the
   entrance only animates opacity and transform, but check).
5. Gate: `pnpm check && pnpm lint && pnpm format:check && pnpm test:coverage &&
   pnpm test:e2e:stub`. The news page has no stub e2e; say so in the PR.

## STOP conditions

- CLS rises above 0.05 when the first cards are visible from first paint.
- Filtering or view switching breaks for the unhidden cards (they stay visible
  when filtered out, or re-animate oddly).
- Gain under 1 s on the deployed build: report the table and close the plan.

## Maintenance notes

- The 39 separate script requests are what make the reveal late. Plans 226-229
  (extracting inline scripts) do not reduce their count; a separate look at
  bundling the per-component `<script>` tags would shorten every page's script
  queue, not only `/news`. Not planned: measure first.
- `/shop/all` checked in the same pass (staging, three runs, LCP 3,402 / 2,565 /
  1,994 ms): its LCP element is a product image that fell back to the loader
  placeholder (a Sandbox item without an image), not a hidden grid, and TTFB
  varied 137-2,110 ms (cold function, plan 176). No change needed there.
