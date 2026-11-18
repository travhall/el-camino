# Plan 234: Close the issues recorded, not fixed, during plan 226

> **Executor instructions**: Finished; the record below is what was fixed, how
> each item was tested and how it was verified.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: 226
- **Category**: tech-debt
- **Planned at**: commit `bc62fd9`, 2026-11-18
- **Outcome**: DONE

## Why this matters

Plan 226 moved five inline scripts into `src/scripts` as a pure move and recorded
what it found instead of fixing it. Eight items were left; all are small, and the
tests that plan added made each one cheap to fix.

## The items, and what was done

`ProductFilters` (`product-filters-client.ts`, `ProductFilters.astro`)

1. **Timers outliving the page.** The phone submit (300 ms) and the mobile
   Clear Filters (100 ms) used bare `setTimeout`s that `destroy()` did not cancel,
   so a navigation inside that window could still submit a detached form. Both now
   go through a tracked `later()` that `destroy()` clears. Two tests failed first.
2. **First-paint count.** The mobile result count always rendered "N of M
   products", the desktop one "M products" when nothing was filtered out, so a
   phone showed "34 of 34 products" until the first filter event. The mobile
   paragraph now uses the same condition. Failed first (container render).

`NewsFilters` (`news-filters-client.ts`, `NewsFilters.astro`)

3. **Debounce outliving the page.** The 150 ms debounce was not cancelled by
   `destroy()`. It is now. Failed first.
4. **`removeTag` selector.** It built `[data-tag-input="${slug}"]` from the slug,
   so a quote or backslash threw a `SyntaxError` and the tag could not be removed.
   It now compares the attribute value. Failed first with the exact error.
5. **The `window.newsFilterOptions` bridge.** `NewsFilters.astro` serialised the
   whole filter-options JSON into every `/news` page and an inline script copied
   it onto a window global once per full page load (so it was stale after a soft
   navigation). Its only reader filled a `tagCounts` map that nothing read. The
   JSON element, the bridge script, `tagCounts`, `storeTagCountsFromServerData`,
   the `safeJsonForScript` import and the `Window.newsFilterOptions` type are
   removed, and the plan 175 note in `news/index.astro` now says so. Failed first
   (the page still shipped `id="news-filter-options"`).

`ArticleGrid` (`article-grid-client.ts`)

6. **Unused CSS values.** `rowStaggerDelay` and `priorityDuration` were parsed from
   `--row-stagger-delay` and `--card-entrance-priority-duration` and never read.
   Removed.
7. **`getCardsPerRow`.** Its `list` and `masonry` branches were never used:
   `cardsPerRow` is read only by the grid branch. Reduced to the grid breakpoints.
8. **Lazy-image observer.** It was constructed even when six or fewer images were
   loaded directly. It is now built only when it is used. The test that had pinned
   the old behaviour was changed first and failed against the old code.

## Verification

- 7 tests failed against the old code for the right reasons, then passed (items 1,
  2, 3, 4, 5, 8; items 6 and 7 are dead-code removals guarded by the existing 30
  `article-grid-client` tests).
- Mutation check: seven deliberate breaks (destroy clearing the timers, tracking
  them, the news debounce clear, `removeTag` inverted and emptied, the lazy
  observer built unconditionally, the mobile count condition) each fail a test. A
  first attempt at the observer mutation broke the syntax and was redone.
- Gate: check, lint, format:check, coverage 84.26 / 72.61 / 84.13 / 85.79, build
  and `test:e2e:stub` (117) pass.
- Browser, dev server: at 390 px the first-paint counts both read "34 products",
  and a phone Apply still waits out the 300 ms close delay before applying
  (`?brands=Krooked+Skateboards`, "4 of 34 products"); on `/news` there is no
  `#news-filter-options` and `window.newsFilterOptions` is undefined; adding and
  then removing a tag navigates softly in the same document with all three router
  events, the hidden input is removed at once, and there are no CSP violations or
  page errors.

## Not verified

A production-mode server, tablet or touch behaviour, and the cancelled-timer cases
on a real navigation inside the 100-300 ms windows (covered by unit tests only).
