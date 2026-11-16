# Plan 123: Root-cause and fix intermittent CLS on homepage masonry grid

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. This is a trace-level debugging task — do not guess at a fix
> without reproducing and confirming the root cause first (see Step 1).
> When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 354a2a8..HEAD -- src/components/ArticleGrid.astro src/components/ArticleCard.astro src/styles/global.css`
> If any changed since this plan was written, re-read them before proceeding.

## Status

- **Priority**: P2 (perf, intermittent — not every load, but frequent)
- **Effort**: M — requires trace-level reproduction, not a guessed fix
- **Risk**: LOW-MED — touches a component with documented prior CLS fixes;
  changes must not regress those
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `354a2a8`, 2026-08-06
- **Resolved at**: 2026-08-06, branch `advisor/123-fix-homepage-masonry-cls`
  — root cause: image-triggered auto-sized grid column at the mobile
  breakpoint (see Done criteria below for full trace evidence)

## Why this matters

Lighthouse's `cumulative-layout-shift` score is flipping between 1.0
(CLS=0) and 0.24 (CLS=0.407) across otherwise-identical runs against
production, which is what's driving the performance score's own
run-to-run swing (0.77 vs 0.96 observed across 5 consecutive local runs on
2026-08-06 in `lighthouse/elcaminoskateshop.netlify.app-*.json`). Every
failing run traces to exactly **one** layout-shift event, same element
every time (confirmed via the `layout-shifts` audit's `details.items` in
each report):

```
main#main-content > section > div.article-grid > a.relative
```

— the **featured** (index-0) card in the homepage masonry news grid
(`src/components/ArticleGrid.astro` + `src/components/ArticleCard.astro`),
score `0.4069...` (i.e. this single shift accounts for essentially the
entire CLS penalty).

This is not new tonight — last touched by commit `3cc23fb`, already on
master before this session's plans 106-121 started. It's also not a
first-time issue for this component: `ArticleGrid.astro`'s client script
has a comment documenting a *previous* CLS fix here (score 0.238, "circular
flex/h-full height dependency on the image container — fixed by switching
to absolute inset-0"), and `global.css` has deliberately hand-tuned
fallback-font metrics (`@font-face "Alumni Fallback"` with
`ascent-override`/`descent-override`/`size-adjust` computed against Alumni
Sans's real font metrics) specifically to suppress font-swap-driven CLS.
Despite that existing mitigation work, a new, larger (0.407) shift is
happening on the same card, intermittently.

**This plan does not assume the root cause.** Static code reading turned
up plausible candidates (see "Investigation notes" below) but nothing
confirmed — the intermittency (same URL, same 5-run batch, alternating
pass/fail) means it's timing-sensitive, which static reading alone can't
resolve. Step 1 is a proper trace-level reproduction; do not skip to a fix
based on a guess.

## Current state

- `src/components/ArticleGrid.astro`: renders the masonry grid, container
  classes have `md:auto-rows-[12vw]`-style viewport-relative row sizing at
  `md:` and up, but **no explicit `grid-template-columns`/`auto-rows` at
  all on mobile** (base classes are just `grid justify-center w-full
  gap-1 p-1 pb-0` — everything grid-shape-related is `md:`+ prefixed).
  Lighthouse's mobile form factor (`configSettings.formFactor: "mobile"`
  in every report) means the mobile-only base styling is what's actually
  being measured.
- `src/components/ArticleCard.astro`: featured card (`index === 0`) uses
  `priority={true}` → eager image load, no loading-skeleton overlay, no
  `opacity-0` initial state on the image. Card box sizing is
  `aspect-3/4 md:aspect-video lg:aspect-auto` (masonry variant, via
  `getCardClasses()`) — should give a definite box height from first
  layout on mobile, independent of image/content load timing, *if*
  nothing else overrides it.
- `src/styles/global.css` lines ~292-344: `Alumni`/`Alumni Fallback`
  `@font-face` rules with hand-computed metric-override values, already
  built specifically to prevent font-swap CLS on "article and PDP pages"
  per the comment at line ~286.

## Investigation notes (unconfirmed — verify, don't assume)

Static reading surfaced two candidates worth checking first, but Step 1's
trace is the actual authority:

1. **Font-swap on the featured card's title/excerpt.** The content block
   (`getContentClasses()` for masonry) is `position: absolute`, contains
   `line-clamp-2` title text using `font-family: var(--font-display)`
   (Alumni). Even with metric-matched fallback overrides, a line-count
   difference between fallback and webfont for a specific title's exact
   character count could still shift the box.  Absolutely-positioned
   elements can still register in Lighthouse's CLS measurement if their
   rendered content moves.
2. **A second, delayed layout pass.** `getCardClasses()` has a comment
   describing a known Chrome quirk where `contain: layout` was removed
   from the featured card specifically because "Chrome can resolve it in
   a second layout pass when a style recalculation is triggered later
   (e.g., by will-change removal)." The masonry entrance animation is
   CSS-only (`cardEntranceFeatured` keyframe, fires at parse time, no JS
   class-toggling per the script's own comment) — confirm whether the
   keyframe animation's completion (or something else, e.g. WordPress
   content/image arriving asynchronously) triggers exactly this kind of
   delayed recalculation for the featured card specifically.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Reproduce | Run Lighthouse (CLI or DevTools) against the production homepage 5-10 times in a row, mobile form factor, simulated throttling — matches how the existing reports in `lighthouse/` were generated | reproduce the alternating CLS=0 / CLS=0.407 pattern locally |
| Trace inspection | Lighthouse's own trace data (pass `--save-assets` or inspect the report's `.traces` if present) or Chrome DevTools Performance panel's Experience/Layout Shift track | identify the exact triggering event (paint timing, font load, animation end, image decode) for the 0.407 shift, with a timestamp you can correlate against network/font-load timing in the same trace |
| Typecheck | `pnpm check` | exit 0 |
| Lint | `pnpm lint` | exit 0 |
| Tests | `pnpm test:run` | all pass |
| Build | `pnpm build` | exit 0 |

## Scope

**In scope**:
- `src/components/ArticleCard.astro`, `src/components/ArticleGrid.astro`,
  and (only if the trace implicates it) the `Alumni`/`Alumni Fallback`
  font-face declarations in `src/styles/global.css`.
- Only the featured/masonry-variant card path — do not touch the `grid`
  or `list` variant rendering paths, which aren't implicated by the
  reports.

**Out of scope**:
- Any other component's CLS — this plan is scoped to the one confirmed,
  reproducing element.
- Re-introducing `contain: layout` on the featured card or reverting the
  `block`-instead-of-`flex` fix from the prior 0.238 CLS fix — both are
  explicitly documented as deliberate prior fixes for a *different* CLS
  cause on this same card; don't undo them without understanding why they
  were added (re-read the comments in `getCardClasses()` and the client
  script before touching either).

## Steps

### Step 1: Reproduce and trace the shift (do not skip)

Reproduce the intermittent CLS locally with enough runs to catch a
failing one (the existing reports show it failing 3 of 5 runs, so a
handful of attempts should be enough). Capture a trace for a failing run
and identify precisely what DOM mutation or paint event corresponds to
the 0.4069 layout-shift score at the `a.relative` (featured card) element.
Answer specifically: is it a font swap (webfont finishing load after
first paint), an image-related reflow, or a delayed style
recalc/second-layout-pass as hinted by the existing code comment? Get a
timestamp-correlated answer, not a guess.

### Step 2: Fix the confirmed root cause

Depending on Step 1's finding:
- **If font-swap**: the existing `size-adjust`/`ascent-override`/
  `descent-override` values may need re-tuning for the specific text this
  card renders, or the featured card's title text may need a fixed
  `min-height`/`line-height` reservation independent of which font is
  active (a CSS-only fix, no JS needed, safest option if it works).
- **If a second layout pass / delayed recalc**: identify what triggers
  the recalc (the code comment mentions `will-change` removal as one
  known trigger for this exact pattern elsewhere in the file — check
  whether something equivalent applies to the featured card's animation
  lifecycle) and address that trigger directly, rather than re-adding
  `contain: layout` (already established as unsafe here).
- **If something else entirely**: report what Step 1 found and propose a
  fix scoped to that actual cause.

### Step 3: Verify the fix holds under repetition

Re-run the same reproduction loop from Step 1 enough times (aim for 10+)
to build confidence the shift no longer occurs — a single clean run is
not sufficient given how intermittent this is. Also re-verify the
*previous* 0.238 CLS fix still holds (i.e. you haven't reintroduced the
circular flex/h-full dependency) — visually confirm the featured card
renders and animates correctly, non-featured cards are unaffected.

### Step 4: Full verification

Run the full command table above.

## Test plan

CLS is a runtime/visual metric — there isn't a meaningful unit test for
it. Verification is the repeated-Lighthouse-run approach in Step 3. If the
fix involves a concrete, testable behavior change (e.g. a font-loading
strategy change), add a focused test only if one naturally fits; don't
force one.

## Done criteria

- [x] Step 1: root cause confirmed via trace, not assumed — DevTools
      PerformanceObserver capture against production (mobile emulation,
      Slow 4G, 4x CPU throttle) shows `document.fonts.ready` firing at
      674ms, ~588ms before the 1261.9ms shift (rules out font-swap); the
      featured image's network `responseEnd` is 1255ms, ~7ms before the
      shift (image-triggered). `layout-shift` entry sources show the
      featured card's box literally changing WIDTH (241.57px → 403.99px,
      centered → full-bleed), with height following via `aspect-3/4`
      (322.09 → 538.66, ratio preserved). Root cause: `.article-grid` has
      no explicit `grid-template-columns` at the mobile/base breakpoint
      (only `md:grid-cols-6`), so the single implicit column all
      `col-span-full` masonry cards share defaults to content-based
      (fit-content/auto) sizing instead of stretching to the container.
      Before the featured (LCP) image finishes decoding, the shared
      column's max-content contribution is small; once the image's real
      natural width becomes available for intrinsic sizing, the column
      snaps to full container width, shifting every card sharing it. This
      is the "image-related reflow" candidate from the Investigation
      notes, not font-swap or the documented will-change/contain
      second-pass quirk (masonry entrance is CSS-only with no JS
      class-toggling, confirmed in `initializeArticleAnimations()`).
- [x] Step 2: fix applied, scoped to the confirmed cause — added
      `grid-cols-1` to `.article-grid`'s masonry branch in
      `getContainerClasses()` (`src/components/ArticleGrid.astro`). Only
      touches the mobile/base breakpoint; `md:grid-cols-6`/`3xl:grid-cols-8`
      unchanged. `grid-cols-1` uses `1fr`, which always takes 100% of
      available space regardless of content, eliminating the race
      entirely (no timing/JS fix needed).
- [x] Step 3: verified clean across 10+ repeated runs — 10/10 clean runs
      (0 layout-shift entries each) against a local dev server running the
      fix, same mobile/Slow-4G/4x-CPU emulation used to reproduce the bug.
      Pre-fix, the same setup reproduced the shift on the very first
      attempt (CLS 0.47).
- [x] Prior 0.238 CLS fix confirmed still intact (card layout/animation
      unaffected) — `ArticleCard.astro` untouched by this change (diff is
      `ArticleGrid.astro` only). Verified via computed styles post-fix:
      featured card is `display: block`, `contain: none`,
      `aspect-ratio: 3 / 4`. Verified `md:grid-cols-6` still resolves to 6
      equal ~208.66px columns at a 1280px viewport — desktop/md+ layout
      unaffected.
- [x] `pnpm check`/`lint`/`test:run`/`build` all exit 0 — check: 0
      errors/0 warnings/14 pre-existing hints; lint: 0 errors/38
      pre-existing warnings (none in touched files); test:run: 866/866
      passing; build: exit 0.
- [x] `plans/README.md` status row for 123 updated with the confirmed
      root cause

## STOP conditions

- If Step 1 cannot reliably reproduce the shift after a reasonable number
  of attempts (say, 15-20 runs with zero repro), stop and report — don't
  ship a speculative fix for an unconfirmed cause. Note what was tried.
- If the root cause turns out to require touching the CSS Grid
  auto-rows/columns behavior at the `md:`+ breakpoints (not just the
  mobile-only path implicated by the current reports), stop and report —
  that's a larger-blast-radius change than this plan is scoped for.

## Git workflow

- Branch: `advisor/123-fix-homepage-masonry-cls`
- Commit message style: conventional commits.
- Do NOT push or open a PR unless the operator instructed it.
