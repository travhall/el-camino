# Plan 128: Remove the hardcoded `"viewport"` prefetch override on the always-visible nav items

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat a2201bc..HEAD -- src/components/Nav.astro`
> If the file changed since this plan was written, compare the "Current
> state" excerpt against the live file before proceeding; on a mismatch,
> treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (completes the intent of already-merged Plan 125)
- **Category**: perf
- **Planned at**: commit `a2201bc`, 2026-08-17

## Why this matters

Plan 125 (merged, commit `c5f6589`, now on master) changed
`astro.config.mjs`'s global `prefetch.defaultStrategy` from `"viewport"` to
`"hover"`, specifically to stop the site's nav links from firing full-page
SSR prefetches the instant the homepage opens (nav links are always
in-viewport on load, so `"viewport"` strategy behaved like "prefetch
immediately"). Live re-measurement of production after that plan shipped
showed `/the-shop` and `/news` **still prefetching immediately on page
open** — the symptom Plan 125 was supposed to fix is still visible to the
maintainer ("initial opening ... looks bad ... reload ... looks better",
2026-08-17).

Root cause, confirmed by reading the live code: `src/components/Nav.astro`
builds its nav items from a `staticNavItems` array that **hardcodes**
`prefetchStrategy: "viewport"` for exactly the two items that render as
persistent, always-in-viewport links — "The Shop" and "News"
(`Nav.astro:68-91`). Each nav item's prefetch strategy is applied per-link
via `data-astro-prefetch={item.prefetchStrategy || "hover"}`
(`Nav.astro:211`) — the `|| "hover"` fallback only applies when
`prefetchStrategy` is falsy, and for these two items it is explicitly set,
so it never falls through to the (now-fixed) global default. Plan 125's own
executor found this override during its Step 0 check but concluded (per its
status-row note) that "Nav.astro already explicit (`hover`/
`item.prefetchStrategy`)" — a shallow read of the *mechanism* without
checking the actual *value* passed for these two specific items, which is
`"viewport"`, not `"hover"`. This plan is the correction: these two items
need their hardcoded value changed to match the intent Plan 125 already
established for the rest of the site.

## Current state

- `src/components/Nav.astro:67-91` — the array as it stands today:

```js
// Static navigation items with prefetch configuration
const staticNavItems = [
  {
    category: {
      id: "the-shop",
      name: "The Shop",
      slug: "the-shop",
      isTopLevel: true,
      parentCategoryId: undefined,
      rootCategoryId: undefined,
    },
    subcategories: [],
    prefetchStrategy: "viewport", // High priority - prefetch when visible
  },
  {
    category: {
      id: "news",
      name: "News",
      slug: "news",
      isTopLevel: true,
      parentCategoryId: undefined,
      rootCategoryId: undefined,
    },
    subcategories: [],
    prefetchStrategy: "viewport", // High priority - prefetch when visible
  },
];
```

- `Nav.astro:211` — how the value gets applied (do not change this line;
  quoted only as evidence the fix belongs in the array above):

```jsx
data-astro-prefetch={item.prefetchStrategy || "hover"}
```

- `Nav.astro:54-58` — `getPrefetchStrategyForCategory()`, the function that
  assigns per-category strategies for the *dynamic* category nav items
  (unrelated to `staticNavItems`, not in scope, shown only so the executor
  can see the existing convention for strategy values used elsewhere in
  this same file — `"hover"`, `"tap"` are both already in use):

```js
  } else if (mediumPriorityCategories.includes(categoryName)) {
    return "tap"; // Prefetch on interaction for medium priority
  }

  return "hover"; // Default hover strategy
```

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `pnpm check` | exit 0, no errors |
| Lint | `pnpm lint` | exit 0 |
| Tests | `pnpm test:run` | all pass |

## Scope

**In scope** (the only file you should modify):
- `src/components/Nav.astro` (only the two `prefetchStrategy` values inside
  `staticNavItems`, lines 68-91, and their now-inaccurate comments)

**Out of scope** (do NOT touch, even though they look related):
- `astro.config.mjs`'s `prefetch` block — already correctly fixed by Plan
  125; nothing to change there.
- `Nav.astro:211`'s `data-astro-prefetch={item.prefetchStrategy || "hover"}`
  expression itself — the bug is the *value* fed into it, not the
  expression.
- `getPrefetchStrategyForCategory()` (`Nav.astro:54-64`) and the dynamic
  `categoryHierarchy`-derived nav items — unrelated code path, not part of
  this bug.
- `src/components/SpeculationRules.astro` — a separate, unrelated bug (CSP
  console errors); that's Plan 129.

## Git workflow

- Branch: `advisor/128-fix-nav-hardcoded-viewport-prefetch`
- Single commit is fine for this change.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Change both hardcoded strategies to `"hover"`

Edit `src/components/Nav.astro:68-91`, changing both
`prefetchStrategy: "viewport"` values to `"hover"`, and updating the
now-inaccurate comments to reflect why:

```js
// Static navigation items with prefetch configuration
const staticNavItems = [
  {
    category: {
      id: "the-shop",
      name: "The Shop",
      slug: "the-shop",
      isTopLevel: true,
      parentCategoryId: undefined,
      rootCategoryId: undefined,
    },
    subcategories: [],
    // Always in-viewport (persistent nav) — "viewport" strategy prefetched
    // this immediately on every page open. "hover" prefetches on real
    // navigation intent instead. See Plan 125/128.
    prefetchStrategy: "hover",
  },
  {
    category: {
      id: "news",
      name: "News",
      slug: "news",
      isTopLevel: true,
      parentCategoryId: undefined,
      rootCategoryId: undefined,
    },
    subcategories: [],
    prefetchStrategy: "hover",
  },
];
```

**Verify**: `pnpm check` → exit 0, no errors.

### Step 2: Confirm the build and tests are unaffected

```bash
pnpm lint
pnpm test:run
```

**Verify**: both exit 0.

## Test plan

No unit test applies — this is a hardcoded config-value change with no
branching logic to test. Verification is:

- `pnpm check`/`pnpm lint`/`pnpm test:run` all exit 0 (Step 2).
- `grep -n '"viewport"' src/components/Nav.astro` returns no matches.
- If browser access is available: load the homepage, open DevTools Network
  tab, confirm `/the-shop` and `/news` do **not** fire automatically on
  page load, and instead fire only when hovering/focusing those nav links.
  This is the direct behavioral confirmation of the fix; include it in your
  report if you have browser access, but it is not required for Done
  criteria below (not all executor environments have one).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm check` exits 0
- [ ] `pnpm lint` exits 0
- [ ] `pnpm test:run` exits 0
- [ ] `grep -n '"viewport"' src/components/Nav.astro` returns no matches
- [ ] `grep -c '"hover"' src/components/Nav.astro` shows at least 2 more
      matches than before this change (the two new values; exact count
      depends on how many `"hover"` strings already existed elsewhere in
      the file — compare against a pre-change `grep -c` if unsure)
- [ ] No files outside `src/components/Nav.astro` are modified
      (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at `Nav.astro:67-91` doesn't match the "Current state" excerpt
  (the file has drifted since this plan was written).
- `astro.config.mjs`'s `prefetch.defaultStrategy` is no longer `"hover"`
  (i.e. Plan 125 was reverted) — in that case, changing these two items to
  `"hover"` would make them *diverge* from the (reverted) global default
  rather than match it; re-read the current global default and match these
  two items to it instead of blindly using `"hover"`.
- `pnpm test:run` fails after this change — a hardcoded-value change should
  not affect any test; investigate before assuming it's unrelated.

## Maintenance notes

- If a future nav item genuinely needs `"viewport"` prefetching (e.g. a
  seasonal promo link that's usually below the fold but should prefetch
  eagerly once scrolled into view), that's a legitimate use of the
  `"viewport"` strategy — the problem this plan fixes is specifically
  applying it to links that are *always* in the initial viewport, not the
  strategy itself being wrong in general.
- This plan, together with the already-merged Plans 125/126/127, closes out
  the "slow first open" investigation from 2026-08-17 — after this lands,
  re-measure the live site once more (DevTools trace, confirm
  `/the-shop`/`/news` no longer fire on load) before considering that
  investigation fully resolved.
