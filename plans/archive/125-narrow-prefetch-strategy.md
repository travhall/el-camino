# Plan 125: Stop eager viewport-triggered full-page prefetch from competing with initial load

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 7a943d7..HEAD -- astro.config.mjs`
> If `astro.config.mjs` changed since this plan was written, compare the
> "Current state" excerpt against the live file before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `7a943d7`, 2026-08-17

## Why this matters

A live DevTools trace of the homepage (`https://www.elcaminoskateshop.com/`)
showed a request to `/the-shop` completing in **1731ms**, starting at
~1024ms into the page load — a full SSR page fetch, not a static asset.
This is Astro's `prefetch` feature: `astro.config.mjs` sets
`defaultStrategy: "viewport"`, which prefetches the full HTML of any link as
soon as it scrolls into the viewport. The site's nav links (`/the-shop`,
`/news`) live in the header/footer, which are **always in the viewport on
initial load** on every page. So "viewport" strategy behaves like "prefetch
immediately on page open" for these links — kicking off one or more full
SSR page renders that compete for the same connection pool and server
capacity as the actual critical-path resources (CSS, the opening
animation's own JS, images) at the exact moment those resources matter most.

Prefetching itself is a reasonable feature — it's the *trigger condition*
that's wrong for this site's layout, where the prefetchable links are never
"below the fold, then scrolled into view." Switching to Astro's `"hover"`
strategy keeps the benefit for actual navigation intent (mouse-over or
focus before a click) without front-loading page-open with speculative full
-page fetches.

## Current state

- `astro.config.mjs:42-46` — the prefetch config as it stands today:

```js
  // ENHANCED: Prefetch configuration for navigation performance
  prefetch: {
    prefetchAll: false, // Selective prefetching for performance
    defaultStrategy: "viewport", // Prefetch when visible in viewport - better for mobile
  },
```

- Astro's built-in `defaultStrategy` options are `"tap"`, `"hover"`,
  `"viewport"`, and `"load"` (docs:
  https://docs.astro.build/en/guides/prefetch/). `"hover"` prefetches on
  `mouseover`/`focus` with a short delay, and also handles touch (`tap` is
  a subset of what `"hover"` covers on touch devices per Astro's
  implementation) — it is the standard "prefetch on likely intent" choice
  and is what Astro recommends when `"viewport"` is too aggressive for a
  given layout.
- No component in this repo overrides prefetch per-link with
  `data-astro-prefetch="..."` — confirm this is still true in Step 1 before
  changing the global default, since a per-link override would change the
  blast radius of this fix.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `pnpm check` | exit 0, no errors |
| Lint | `pnpm lint` | exit 0 |
| Tests | `pnpm test:run` | all pass |

## Scope

**In scope** (the only file you should modify):
- `astro.config.mjs` (only the `prefetch` block, lines 42-46)

**Out of scope** (do NOT touch, even though they look related):
- `rollupOptions`/`manualChunks` — that's Plan 124.
- `experimental.clientPrerender` — that's Plan 126. Note: this is a
  *different* mechanism (Speculation Rules API) from the `prefetch` config
  changed here (Astro's own prefetch runtime, `<link rel="prefetch">` /
  fetch-based). Don't conflate them or try to fix both in one edit.
- Any individual page or component file, unless Step 1 finds a per-link
  `data-astro-prefetch` override — in that case, STOP and report rather
  than deciding unilaterally whether to change it too.

## Git workflow

- Branch: `advisor/125-narrow-prefetch-strategy`
- Single commit is fine for this change.
- Do NOT push or open a PR unless the operator instructed it.

### Step 0: Confirm no per-link overrides exist

```bash
grep -rn "data-astro-prefetch" src/
```

**Verify**: no matches (or, if there are matches, read each one and note
what strategy it sets — this changes what the global default fix actually
affects). If matches exist, treat as informational for the plan but do not
STOP solely because of this — only STOP if a per-link override appears to
depend on `"viewport"` semantics specifically in a way `"hover"` would
break (e.g. a touch-only mobile interaction with no hover path — see STOP
conditions).

## Steps

### Step 1: Change the default prefetch strategy

Edit `astro.config.mjs:42-46`:

```js
  // Prefetch on hover/focus intent rather than viewport visibility — the
  // site's nav links are always in the viewport on initial load, so
  // "viewport" strategy was firing full-page SSR prefetches immediately on
  // page open, competing with critical-path resources for bandwidth.
  prefetch: {
    prefetchAll: false, // Selective prefetching for performance
    defaultStrategy: "hover",
  },
```

**Verify**: `pnpm check` → exit 0, no errors.

### Step 2: Confirm the build is unaffected

```bash
pnpm lint
pnpm test:run
```

**Verify**: both exit 0.

## Test plan

This is a single-value config change with no new application logic — no
unit test applies. Verification is:

- `pnpm check` and `pnpm lint` pass (config is valid).
- `pnpm test:run` stays green (nothing in the test suite should reference
  prefetch strategy directly; a failure here would be unexpected and worth
  investigating before proceeding).
- Manual/reviewer follow-up (not required for this plan's done criteria,
  but note it for the maintainer): after deploy, confirm in DevTools Network
  tab that `/the-shop` and `/news` no longer fire automatically on homepage
  load, and instead fire on hovering/focusing those nav links.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm check` exits 0
- [ ] `pnpm lint` exits 0
- [ ] `pnpm test:run` exits 0
- [ ] `grep -n 'defaultStrategy' astro.config.mjs` shows `"hover"`
- [ ] No files outside `astro.config.mjs` are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at `astro.config.mjs:42-46` doesn't match the "Current state"
  excerpt (the file has drifted since this plan was written).
- Step 0 finds a per-link `data-astro-prefetch="viewport"` override on a
  link that has no realistic hover/focus path (e.g. it's only reachable via
  touch-scroll on mobile with no equivalent affordance) — changing the
  global default won't affect that link, but if the plan's intent (stop
  eager viewport prefetch) needs to reach it too, that's a judgment call
  for a human, not something to improvise here.
- `pnpm test:run` fails after this change — a config-only prefetch-strategy
  change should not affect any test; investigate before assuming it's
  unrelated.

## Maintenance notes

- If a future page adds a link that genuinely benefits from
  viewport-triggered prefetch (e.g. a "read next" link at the bottom of a
  long article, clearly below the fold on load), that's a good candidate
  for a per-link `data-astro-prefetch="viewport"` override rather than
  reverting the global default — the problem this plan fixes is specific to
  always-above-the-fold nav links, not prefetching in general.
- This plan, Plan 124 (chunk fanout), and Plan 127 (duplicate fetch) each
  address a distinct contributor to the same "slow first open" symptom
  reported by the maintainer — re-measure the live page after all three
  land before deciding whether a loading indicator is still warranted.
