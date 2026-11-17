# Plan 220: Stop the two preloaded fonts competing with the product page hero image

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
> When done, update this plan's status row in `plans/README.md`.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW-MED (font swap flashes, CLS)
- **Depends on**: —
- **Category**: perf
- **Planned at**: commit `051257c`, 2026-11-16; found by plan 214

## Why this matters

Plan 214 measured the product page (staging, mobile, applied throttling,
median of three): LCP 3.95 s, of which 2.91 s is the hero image's download
and 0.49 s is the wait before it starts. With both `*.woff2` requests blocked,
LCP fell to 3.33 s, a gain of about 0.6 s (16%) and the only candidate in
plan 214 above the 200 ms bar. That is an upper bound, since the fonts still
have to arrive in a real fix. Two font files (`Cabin.woff2` 62.7 KB,
`AlumniSans.woff2` 57 KB, 120 KB together, more than the 28 KB + 17 KB of
thumbnails) are preloaded at high priority in `<head>` and share the
bottleneck link with the 170 KB hero.

## Current state

- `src/components/BaseHead.astro:161-171` preloads both fonts
  (`as="font" crossorigin`).
- `src/styles/global.css:357-395` declares four `@font-face` rules, all
  `font-display: swap`.
- The hero is already preloaded with `imagesrcset`, `fetchpriority=high`,
  eager and discoverable (Lighthouse `lcp-discovery-insight` passes), so there
  is nothing left to gain from preloading it.

## Steps

### Step 1: Reproduce the baseline

Same method as plan 214: Lighthouse 12.8, mobile, `--throttling-method=devtools`,
`--only-categories=performance`, three runs, median, against a product page
whose hero is a real image (the stub catalog's images do not load). Record LCP
and the four phase durations. **Verify**: run-to-run spread under 15%.

### Step 2: Try each change alone on a scratch branch, measured as Step 1

(a) Drop the preload of the font that is not used above the fold (check which
weight each element at first paint uses). (b) Subset both files to Latin
(`pyftsubset` or similar) and compare bytes. (c) only if (a) and (b) fall short: a
`fetchpriority="low"` hint on the font preloads (browser support varies, so
check it takes effect in the trace).
**Verify**: a table of LCP per variant. Keep a change only if it gains 200 ms
or more.

### Step 3: Check the cost

For each kept change, check layout shift on first load (Lighthouse CLS, plus a
screenshot of the first paint on a throttled connection) and the h1 opacity
guard in `BaseHead.astro` (`fonts-loading` / `fonts-failed`). **Verify**: CLS
stays at 0.

### Step 4: Ship the winners, one PR

Gate: `pnpm check && pnpm lint && pnpm test:coverage && pnpm test:e2e:stub`.

## STOP conditions

- CLS rises above 0.05 or text visibly reflows after first paint.
- No variant gains 200 ms. Report the table and close the plan.

## Maintenance notes

- Plan 151 (hero weight) is the other lever on the same phase: 170 KB WebP at
  q85, with Lighthouse estimating 147 KB of savings. Measure the two
  independently; they both shorten "resource load duration".
