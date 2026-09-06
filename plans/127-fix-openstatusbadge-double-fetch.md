# Plan 127: Fix OpenStatusBadge firing its status fetch twice on every page load

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 7a943d7..HEAD -- src/components/OpenStatusBadge.astro`
> If the file changed since this plan was written, compare the "Current
> state" excerpt against the live file before proceeding; on a mismatch,
> treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `7a943d7`, 2026-08-17

## Why this matters

A live network trace of the homepage showed `/api/shop-status` fetched
**twice** on a single page load. `src/components/OpenStatusBadge.astro` is
rendered in `src/components/Footer.astro:117`, and `Footer` is part of the
global `Layout` — so this runs on every single page. The component's script
registers the same update function through two independent triggers that
both fire on initial page load:

```js
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", updateOpenStatusBadges);
} else {
  updateOpenStatusBadges();
}

document.addEventListener("astro:page-load", updateOpenStatusBadges);
```

This site uses Astro's View Transitions router (`ClientRouter` imported and
rendered in `src/components/BaseHead.astro:3,244`), and per Astro's
documented behavior, the `astro:page-load` event **fires on the initial
page load as well as every subsequent client-side navigation** — it is not
exclusive to transitions. So on first load, both branches fire: the
immediate/`DOMContentLoaded` call *and* the `astro:page-load` listener,
firing `updateOpenStatusBadges()` (and its `fetch("/api/shop-status")`)
twice. This isn't the dominant contributor to the site's "slow first open"
symptom (Plans 124/125 are), but it's a clear, low-risk, low-effort bug
found during the same investigation: an unnecessary duplicate network
request and duplicate DOM-write on every page view, site-wide.

## Current state

- `src/components/OpenStatusBadge.astro:164-171` (end of the `<script>`
  block) — the double-registration as it stands today:

```js
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", updateOpenStatusBadges);
  } else {
    updateOpenStatusBadges();
  }

  document.addEventListener("astro:page-load", updateOpenStatusBadges);
```

- `updateOpenStatusBadges` (defined earlier in the same file, around line
  71) is an `async function` that calls `fetch("/api/shop-status")` and
  then queries/updates all `[data-open-status-badge]` elements on the page.
  It is idempotent in effect (re-running it just re-fetches and re-applies
  the same badge state) — the bug is redundant *work*, not incorrect
  end-state.
- `src/components/BaseHead.astro:3,244` confirms the router is active
  site-wide:

```ts
import { ClientRouter } from "astro:transitions";
```
```html
<ClientRouter />
```

- `src/layouts/Layout.astro:139-177` independently relies on this same
  "`astro:page-load` fires on initial load too" behavior for its nav
  progress bar, confirming this is an established, relied-upon assumption
  in this codebase already — not a novel claim introduced by this plan.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `pnpm check` | exit 0, no errors |
| Lint | `pnpm lint` | exit 0 |
| Tests | `pnpm test:run` | all pass |

## Scope

**In scope** (the only file you should modify):
- `src/components/OpenStatusBadge.astro` (only the trigger-registration
  block quoted in "Current state" — do not touch
  `updateOpenStatusBadges`'s internal logic, `resolveOverride`,
  `toDateString`, or the markup/props above the `<script>` block)

**Out of scope** (do NOT touch, even though they look related):
- `src/layouts/Layout.astro`'s nav progress bar — it has its own, unrelated
  use of `astro:page-load`/`astro:before-preparation`; do not modify it.
- `src/pages/the-shop/index.astro` — it has its own separate, independent
  inline `fetch("/api/shop-status")` in a different `<script>` block (for
  an hours-override notice). That is a different code path with its own
  single trigger (an IIFE, not a dual-listener pattern) — it is not part of
  this bug and is out of scope for this plan.
- `src/pages/api/shop-status.ts` and `src/lib/shopStatus.ts` — the backend
  is not part of this bug.

## Git workflow

- Branch: `advisor/127-fix-openstatusbadge-double-fetch`
- Single commit is fine for this change.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Remove the redundant immediate/DOMContentLoaded branch

Edit `src/components/OpenStatusBadge.astro`, replacing the block quoted in
"Current state" (currently around lines 164-171) with a single trigger:

```js
  // astro:page-load fires on both the initial page load and every
  // subsequent client-side navigation (this site uses Astro's
  // ClientRouter — see BaseHead.astro), so a single listener here covers
  // both cases without a redundant immediate/DOMContentLoaded call.
  document.addEventListener("astro:page-load", updateOpenStatusBadges);
```

**Verify**: `pnpm check` → exit 0, no errors.

### Step 2: Confirm the build and tests are unaffected

```bash
pnpm lint
pnpm test:run
```

**Verify**: both exit 0.

### Step 3: Confirm no other caller depended on the removed branch

```bash
grep -rn "updateOpenStatusBadges" src/
```

**Verify**: the only remaining reference is the function definition and the
single `astro:page-load` listener you just left in place — no other file
calls this function directly (it's a self-contained component script, not
an exported module function).

## Test plan

There is no existing test file for this component (visual/DOM-driven Astro
component script, not a pure function) — confirm this with
`find src -iname "*OpenStatusBadge*"` before deciding whether to add one.
No new test is required for this plan: the change removes a redundant event
listener registration, verified via code inspection (Step 3) and the
existing test suite staying green (Step 2). If a reviewer wants
future regression coverage for this, that's a candidate for a
Playwright e2e assertion (`pnpm test:e2e`) counting network requests to
`/api/shop-status` on page load — out of scope to add here since this repo
has no existing e2e pattern for asserting request counts to model it after
(don't invent one as a side effect of this plan).

- Verification: `pnpm test:run` → all pass (no new failures introduced).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm check` exits 0
- [ ] `pnpm lint` exits 0
- [ ] `pnpm test:run` exits 0
- [ ] `grep -n "DOMContentLoaded" src/components/OpenStatusBadge.astro`
      returns no matches
- [ ] `grep -c "astro:page-load" src/components/OpenStatusBadge.astro`
      returns `1`
- [ ] No files outside `src/components/OpenStatusBadge.astro` are modified
      (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at `src/components/OpenStatusBadge.astro:164-171` doesn't match
  the "Current state" excerpt (the file has drifted since this plan was
  written).
- `src/components/BaseHead.astro` no longer imports/renders `ClientRouter`
  (i.e. the site no longer uses Astro's View Transitions router) — in that
  case `astro:page-load` may not fire reliably on initial load, and the
  fix in this plan would silently break the badge on first paint. Re-verify
  with `grep -n "ClientRouter" src/components/BaseHead.astro` before
  proceeding; if it's gone, STOP.
- `pnpm test:run` fails after this change.

## Maintenance notes

- Any other component in this codebase using the same
  "`DOMContentLoaded`-or-immediate, plus `astro:page-load`" dual-trigger
  pattern likely has the same duplicate-fire bug — this plan does not audit
  for other instances; a reviewer may want to `grep -rln "astro:page-load"
  src/components/` and spot-check the others as a follow-up (separate plan,
  not part of this one's scope).
- If a future change needs the badge to update *faster* than
  `astro:page-load` allows (e.g. before other page-load work completes),
  that's a reason to revisit this trigger choice — but don't reintroduce
  the dual-listener pattern to solve it; use a single, earlier-firing event
  instead.
