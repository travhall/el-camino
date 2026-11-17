# Plan 232: **Investigation**: home page CLS (first article card) and the follow-ups left by plan 231

> **Executor instructions**: This is a finished investigation; no code shipped.
> The record below is what was measured and why nothing was changed.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: 231
- **Category**: perf
- **Planned at**: commit `8a8a0b1`, 2026-11-17
- **Outcome**: REJECTED (not worth shipping), see below

## Why this matters

Plan 231 left three home page leads: the home CLS (0.026 mobile, 0.045
desktop), the Alumni font preload, and the second article card's image still
being `fetchpriority=high`.

## What was measured

Method: Lighthouse 12.8.2, mobile, devtools throttling, through a local proxy
in front of staging (it serves from memory, so fonts arrive before first paint
and **no shift occurs at all by default**: CLS was 0 in 9 of 9 runs). To force
the swap after paint the proxy delayed font responses by 1.5 s.

- **The only shift is the first article card's text block**
  (`section > div.article-grid > a.relative > div.flex`, 0.0257), and
  Lighthouse names `AlumniSans.woff2` as the cause. The same value appears on
  staging.
- **Cabin is not the cause.** Cabin delayed 1.5 s: CLS 0 in 2 of 2 runs. Alumni
  delayed: 0.0257 in the runs that shifted.
- **The Alumni fallback face is badly calibrated, but fixing it does not fix
  the shift.** `Alumni Fallback` renders 8.8% wider and 21% taller than Alumni
  (621.2 x 145.5 px against 571.3 x 120 px for "SPRING DECK DROP" at 100 px).
  Chrome scales `ascent-override` and `descent-override` by `size-adjust`, but
  the overrides in `global.css` were calibrated as plain ratios. A corrected face
  (`size-adjust` 56.8%, `ascent-override` 158.5%, `descent-override` 52.8%)
  matched Alumni exactly (571.3 x 120 px) and CLS was still 0.0283 in 3 of 4
  runs, against 0.0257 in 3 of 4 for the base. Average width matching cannot
  make per-word wrapping identical, so the clamped title and excerpt still
  reflow when Alumni arrives.
- A real fix would change the card layout so its height does not depend on how
  the text wraps. That is invasive for a CLS of 0.026 (the "good" threshold is
  0.1), so it was not attempted.

## Not tried

- Second article card image priority: this is download contention, which the
  proxy cannot test (plan 231), so it needs a deploy preview. The expected gain
  is smaller than plan 231's, since only the hero and this image remain
  `fetchpriority=high`.
- The Alumni fallback calibration in `global.css` is still wrong (see above).
  Correcting it is harmless but changes no measured result; do it only together
  with a change that makes the card layout robust to the swap.

## Measurement mistakes to avoid

The page HTML has no `</head>` (Astro omits it), so a proxy that injects CSS
before `</head>` silently does nothing. Inject before `<body` and verify the
injected text is present before reading any result.
