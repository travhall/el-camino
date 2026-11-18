# Plan 233: Fix news AJAX pagination (invalid summary selector, and a hand-rolled swap that bypassed the script lifecycle)

> **Executor instructions**: Finished; the record below is what was found, what
> was changed and how it was verified.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: 226 (the script had to be in `src/scripts` to be tested)
- **Category**: bug
- **Planned at**: commit `a031083`, 2026-11-18
- **Outcome**: DONE

## Why this matters

Plan 226's extraction of `NewsPaginationControls.astro`'s script exposed that
its AJAX pagination never worked: `updatePageContent` looks up the results
summary with `'.text-sm.text-(--content-meta)'`, which is not valid CSS, so every
load threw a `SyntaxError` after `<main>` and the controls had been swapped and
before `history.pushState`, and the `catch` fell back to a full page navigation.
It was dormant in production only because `/news` had 11 posts and
`POSTS_PER_PAGE` is 12, so the controls did not render; it would have shown as
a content flash and a reload at 13 posts.

## What was found, and why the selector was not the whole bug

- The element the selector was meant to update is the pagination's own
  "Showing X-Y of N articles" line, which sits inside `#news-pagination-controls`.
  That is replaced by the `<main>` swap and again by the controls swap just before,
  so the summary step was redundant even if the selector had been valid. Escaped
  (`.text-sm.text-\(--content-meta\)`) it matches 7 elements on `/news`, so
  `querySelector` would have taken the first of 7.
- **Removing only the throw makes things worse.** Tried locally (with
  `POSTS_PER_PAGE` temporarily 4, reverted): AJAX pagination then "succeeded"
  (same document, URL `?page=2`, page 2 marked current), but all four cards stayed
  at `opacity: 0.001` with `entrance-armed` false (the arming script from plan 230
  runs at page load and nothing re-ran it), leaving an empty grid, and the filters
  were dead (a ticked box did nothing, no lifecycle event fired) because their
  script was bound to the form the hand-rolled swap had replaced. The fallback
  reload had been masking both.

## Fix

Pagination now navigates with `navigate()` from `astro:transitions/client`, as
`NewsFilters` does, instead of fetching the HTML and rewriting `<main>` by hand.
The router owns the swap and fires `astro:before-preparation`, `astro:after-swap`
and `astro:page-load`, so every script on the page re-initialises for the new
content. `src/scripts/news-pagination-client.ts` went from 174 to 61 lines: the
fetch, DOM-diff, loading state and error state are gone (the error message in the
loader was removed in the same tick it was written, so it was never visible).
URL building is unchanged: current filters, `page` replaced or dropped for page 1,
through `createNewsAwareURL`.

## Verification

- Tests first: the old fetch-path tests were replaced by 11 tests for the new
  behaviour (init and its guard, no controls, ignoring non-link clicks, child
  clicks, navigating through the router, no `fetch` and no DOM rewrite, keeping
  filters and replacing `page` in `createNewsAwareURL`'s fixed order, keeping
  view/search/sort/date range, page 1 and a missing page number dropping the
  param, a page-load after a swap). 7 of them failed against the old code for
  the right reasons, then passed.
- Mutation check: ten deliberate breaks (init guard, `page > 1`, the default
  page, the non-link guard, `preventDefault`, the `navigate` call, `closest`,
  reading the current params, `createNewsAwareURL`, the container guard) each fail
  a test.
- Gate: check, lint, format:check, coverage 83.97 / 72.30 / 83.76 / 85.52, build
  and `test:e2e:stub` (117) pass.
- Browser, dev server, `POSTS_PER_PAGE` temporarily 4 (reverted, not committed):
  clicking page 2 stays in the same document, fires `before-preparation`,
  `before-swap`, `after-swap` and `page-load`, shows "Showing 5-8 of 11
  articles" with page 2 current, all four cards armed at opacity 1; ticking a
  category afterwards navigates softly with all four events and keeps the box
  ticked; no `securitypolicyviolation`, no page errors.

## Not verified

A production-mode server, tablet or touch behaviour, and the view-transition
animation between pages (the pane was hidden, so `requestAnimationFrame` was
polyfilled).
