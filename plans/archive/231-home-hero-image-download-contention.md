# Plan 231: Test whether other eager images and the font slow the home page hero download

> **Executor instructions**: Follow step by step; run every verification. If a
> STOP condition occurs, stop and report. This is a measure-first plan: do not
> change source until Step 2 shows a gain. When done, update this plan's row in
> `plans/README.md` and `git mv` it to `plans/archive/` in the same PR.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: —
- **Category**: perf
- **Planned at**: commit `c99bba6`, 2026-11-17; from checking the home page after plan 230

## Why this matters

Home LCP on staging is **4.4 s** (mobile, Lighthouse 12.8.2, devtools throttling,
three direct runs: 3,797 / 4,453 / 4,407 ms; Speed Index 4.55-4.69 s; CLS 0.026).
It is **not** a late reveal like `/news` (plan 230): render delay is 21-29 ms and
Speed Index tracks LCP, so the cards appear when their image lands. The cost is
the LCP element's download: the first card's 92 KB AVIF (`w=768 q=75`) is
requested at about 0.7 s and takes **3.1-3.7 s**.

What shares the link with it (run 2, all `High` priority, all started within
about 60 ms of the hero): a second article image (44 KB), two product images
from the Sandbox S3 bucket (30 KB and 19 KB, `fetchpriority=high` but not the
LCP element), the preloaded `AlumniSans.woff2` (56 KB) and `global.css` (20 KB).
About 620 KB moves in total, which on the throttled link (about 200 KB/s) is
roughly the time the hero takes to finish. That points at contention, as plan
220 found on the product page, but it is only a hypothesis.

## What was already tried (inconclusive)

Through the local proxy in front of staging (plan 220's method), demoting the
two product images (`fetchpriority="auto"`, lazy) and demoting everything but the
hero both gave no gain (LCP 2.48 s and 2.36 s against a 2.20 s baseline, two
runs each, within noise). **The proxy cannot answer this**: its baseline LCP was
2.2 s against 4.4 s direct, because it serves from memory over HTTP/1.1 (at most
6 connections), which already limits contention, so it removes the effect being
tested.

## Steps

1. **Baseline on a deploy preview** of an unchanged branch is not needed: use
   staging's three direct runs above. Check first that `/` still reproduces
   about 4.4 s (the Sandbox data can change).
2. **Variant on a deploy preview** (one build): on the home page, keep
   `fetchpriority="high"` and `loading="eager"` for the first card only and make
   the other three images `auto`/lazy (the `shouldPrioritize` rule in
   `ArticleGrid.astro` gives the first two cards priority, and
   `ProductGrid`/`ProductCard` mark two more). Measure three runs, directly
   against the preview, interleaved with a staging control, LCP and Speed Index.
   **Verify**: LCP drops by 200 ms or more. The comment on `shouldPrioritize`
   says the second card is the real LCP on some viewports: check the LCP element
   on desktop too (Lighthouse desktop) before demoting it.
3. If it holds, check the Alumni font preload the same way (plan 220 dropped
   Cabin's preload only; dropping Alumni's raised CLS to 0.019 on the product
   page, so check CLS here).
4. Gate: `pnpm check && pnpm lint && pnpm format:check && pnpm test:coverage &&
   pnpm test:e2e:stub`.

## STOP conditions

- No variant gains 200 ms on the preview: record the table and close the plan.
- LCP element differs between mobile and desktop and demoting hurts one of them.

## Maintenance notes

- The 0.026 CLS on the home page is small but not zero and was not investigated.
- `/news` and the home page share the entrance-animation machinery
  (`ArticleGrid.astro`, `cardEntrance.ts`); plan 230's lessons apply if either is
  touched: check Speed Index as well as LCP, arm entrances from an inline script,
  keep `scale` out of the keyframe.
