# Plan 214: **Investigation**: why the product page takes 5.4 s to show its main image on mobile

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
> When done, update this plan's status row in `plans/README.md`.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: 176 (soft)
- **Category**: perf
- **Planned at**: commit `2ba4b13`, 2026-11-16

## Why this matters

Target agreed 2026-11-16: largest contentful paint (LCP) under 2.5 s on the
product page (mobile, simulated). Measured 2026-11-03: Lighthouse 70, LCP
5.4 s, with `global.css` blocking render for about 2.2 s simulated. Plans 146
and 151 (image caching and weight) should wait for this, since the bottleneck
may not be images.

## Current state

- `src/styles/global.css` is 1,167 lines and is imported once in
  `src/components/BaseHead.astro:5`, so every page loads all of it before
  first paint.
- Plan 176 (cold server-render fan-out) is TODO and overlaps: run it in the
  same session and report both.
- Plan 124 (script chunk fan-out) is BLOCKED with an invalid approach; read its
  "Execution outcome" before proposing anything script-related.

## Steps

### Step 1: Baseline, three runs, median

Production build served locally, Lighthouse mobile, product page backed by the
stubbed catalog (`e2e/fixtures/`). Record LCP, total blocking time, and the
LCP phase breakdown (time to first byte, load delay, load time, render delay).

### Step 2: Attribute the 5.4 s

From the trace: bytes and blocking time of the CSS file(s), which element is
the LCP element, whether its request starts late and what delays its render.
**Verify**: a table adding up to the measured LCP within 10%.

### Step 3: Size the CSS

Report transferred and unused bytes of the built stylesheet on the product
page, and how much comes from admin-only or WordPress-only rules that the
product page never uses.

### Step 4: Test the cheapest candidate fixes on a scratch branch

One at a time, measured the same way as Step 1: (a) preload the LCP image with
high priority; (b) split admin and WordPress block styles out of `global.css`;
(c) inline critical CSS. Record the LCP change for each.

### Step 5: Write follow-up plans

One plan per candidate that moved LCP by 200 ms or more, with the measured
gain in its "Why this matters". State whether 146 and 151 are still worth
doing.

## STOP conditions

- Lighthouse variance between identical runs exceeds 15%: fix the measurement
  setup first; do not report gains inside the noise.

## Done when

The README row holds the attribution table and the list of follow-up plan
numbers. No source change is merged by this plan.
