# Plan 129: Remove the CSP-blocked, non-functional custom SpeculationRules component

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat a2201bc..HEAD -- src/components/SpeculationRules.astro src/components/BaseHead.astro`
> If either file changed since this plan was written, compare the "Current
> state" excerpts against the live files before proceeding; on a mismatch,
> treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW-MED
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `a2201bc`, 2026-08-17

## Why this matters

Live production (`https://www.elcaminoskateshop.com/`, commit `a2201bc`,
confirmed deployed and `ready` via Netlify) logs two console errors on
every page load:

```
Applying inline speculation rules violates the following Content Security
Policy directive 'script-src ... 'nonce-...' ...'. Either the
'unsafe-inline' keyword, a hash (...), or a nonce ('nonce-...') is required
to enable inline execution. The action has been blocked.
```

(Two distinct occurrences per load, with two different `sha256-...` hashes
in the message — confirmed reproducible across multiple fresh loads this
session.)

This was initially misdiagnosed (in an earlier investigation this same
session) as coming from Astro's built-in `experimental.clientPrerender`
feature; that flag was removed (Plan 126, merged, harmless dead config) but
the console errors persisted unchanged after that fix deployed. Re-tracing
against the live HTML and source found the real culprit:
`src/components/SpeculationRules.astro`, a **custom, hand-written
component** (unrelated to Astro's built-in feature) that dynamically
creates a `<script type="speculationrules">` element via
`document.createElement` and assigns it a CSP nonce via
`speculationScript.nonce = _nonce` (`SpeculationRules.astro:131-136`),
where `_nonce` comes from `document.currentScript.nonce`
(`SpeculationRules.astro:118`).

This component's own header comment claims it "Reduces initial network
congestion by 40-60% through smart, context-aware prefetching." Per this
session's live evidence, it currently delivers **zero** of that benefit —
every attempt to insert the dynamic `speculationrules` script is CSP-blocked
before it can take effect, meaning the browser's native Speculation Rules
API is never actually receiving these rules. There is no separate
statically-rendered `<script type="speculationrules">` tag anywhere in the
page output — the dynamic insertion is the *only* mechanism, and it is
fully non-functional.

This is not a new problem: `plans/README.md`'s history for the earlier
"Plan 122" (CSP nonce gaps) documents that this exact component's dynamic
script insertion was investigated once before, and that a related
*progressive* (scroll-triggered, `setTimeout`-deferred) sub-feature was
already removed after live testing showed "Chromium does not honor CSP
nonce/'inline-speculation-rules' authorization for speculationrules scripts
inserted outside the initiating script's synchronous execution" — with the
*base* (synchronous) script reported as "confirmed working live" at the
time. Today's live evidence contradicts that: the base script is now also
blocked (or was never fully fixed). Rather than sink further effort into
debugging Chromium-specific nonce/CSP timing behavior for a feature that
has now failed verification twice, **this plan recommends removing the
component outright**, for three independent reasons:

1. It is currently 100% non-functional (blocked) — removing it loses no
   working prefetch behavior, only the console errors.
2. Even if the CSP issue were fixed, its `/the-shop` and `/news` speculation
   rules on the homepage (`SpeculationRules.astro:20-44`) would reintroduce
   exactly the "eager fetch on page open" problem that Plans 125 and 128
   just fixed via Astro's own, already-working `prefetch` integration —
   fixing this component's CSP issue would work *against* those fixes for
   those two URLs.
3. Astro's first-party `prefetch` integration (configured in
   `astro.config.mjs`, now correctly set to `defaultStrategy: "hover"`) is
   a supported, actively-maintained mechanism already covering the same
   goal (smart, context-aware prefetching) for the whole site, making this
   custom, currently-broken, partially-redundant implementation not worth
   maintaining.

## Current state

- `src/components/SpeculationRules.astro` (full file, 279 lines) — a
  component that: (a) computes page-context-aware speculation rules in
  frontmatter (`generateOptimizedRules()`, lines 14-107), (b) renders a
  `<script type="application/json" id="speculation-rules-data">` holding
  the rules as data (line 113), and (c) renders a
  `<script is:inline nonce={nonce}>` (line 114) that reads that data and
  dynamically inserts a `<script type="speculationrules">` element
  (lines 130-136), plus a `initializeFallbackPrefetch()` fallback for
  browsers without Speculation Rules API support (lines 178-270, dead code
  in practice since `HTMLScriptElement.supports("speculationrules")` is
  `true` in current Chrome/Edge, the majority of this site's traffic).

- `src/components/BaseHead.astro:5,152` — the only place this component is
  imported and used:

```ts
import SpeculationRules from "@/components/SpeculationRules.astro";
```
```astro
<!-- Speculation Rules for Advanced Prefetching -->
<SpeculationRules currentPath={currentPath} eager={isHighTrafficPage} />
```

- `BaseHead.astro`'s `currentPath` and `isHighTrafficPage` values (defined
  elsewhere in that same file) become dead/unused once this is removed —
  check whether they're referenced anywhere else in `BaseHead.astro` before
  deleting them (Step 2 below); if they have no other use after this
  removal, remove them too to avoid leaving unused variables that `pnpm
  lint`'s `no-unused-vars` rule would otherwise flag.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `pnpm check` | exit 0, no errors |
| Lint | `pnpm lint` | exit 0 |
| Tests | `pnpm test:run` | all pass |

## Scope

**In scope**:
- Delete `src/components/SpeculationRules.astro` entirely.
- `src/components/BaseHead.astro`: remove the import (line 5), the
  `<SpeculationRules ... />` usage (line 152) and its preceding comment,
  and — only if Step 2 confirms they become unused as a result — the
  `currentPath`/`isHighTrafficPage` variables that fed its props.

**Out of scope** (do NOT touch, even though they look related):
- `astro.config.mjs`'s `prefetch` block (Plan 125) and
  `src/components/Nav.astro`'s `staticNavItems` (Plan 128) — those are the
  working prefetch mechanism this plan is deliberately *not* touching;
  don't "consolidate" or re-architect prefetch behavior as part of this
  removal, just delete the broken component.
- `src/middleware.ts`'s CSP generation — no change needed; this plan
  removes the thing that was violating CSP, it doesn't loosen the policy.
- Any other component in `BaseHead.astro` (font preloading, meta tags,
  schema.org JSON-LD, `ClientRouter`, etc.) — untouched.

## Git workflow

- Branch: `advisor/129-remove-broken-speculation-rules-component`
- Single commit is fine for this change.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Confirm no other file imports this component

```bash
grep -rln "SpeculationRules" src/
```

**Verify**: only `src/components/SpeculationRules.astro` (the file itself)
and `src/components/BaseHead.astro` appear. If any other file imports it,
STOP — this plan's scope assumes a single call site.

### Step 2: Check whether `currentPath`/`isHighTrafficPage` have other uses

```bash
grep -n "currentPath\|isHighTrafficPage" src/components/BaseHead.astro
```

Read each match. If either variable is used anywhere in `BaseHead.astro`
*besides* the `<SpeculationRules ... />` props being removed (e.g. in a
meta tag, a canonical URL, an og:url, etc.), **keep that variable** — only
remove it if the `SpeculationRules` usage was its sole consumer.

### Step 3: Delete the component file

```bash
rm src/components/SpeculationRules.astro
```

### Step 4: Remove its usage from BaseHead.astro

Edit `src/components/BaseHead.astro`:
- Remove the import line: `import SpeculationRules from "@/components/SpeculationRules.astro";`
- Remove the `<!-- Speculation Rules for Advanced Prefetching -->` comment
  and the `<SpeculationRules currentPath={currentPath} eager={isHighTrafficPage} />` line.
- Remove `currentPath`/`isHighTrafficPage` only if Step 2 found no other
  use.

**Verify**: `pnpm check` → exit 0, no errors (this will catch any
now-unused-import or now-broken-reference issue immediately).

### Step 5: Confirm lint and tests are unaffected

```bash
pnpm lint
pnpm test:run
```

**Verify**: both exit 0. `pnpm lint` in particular will catch any
now-unused variable left behind from Step 2/4.

## Test plan

No test file exists for this component
(`find src -iname "*SpeculationRules*"` to confirm before/after — should
show only the deleted `.astro` file beforehand, nothing afterward). No new
test is needed for a deletion. Verification:

- `pnpm check`/`pnpm lint`/`pnpm test:run` all exit 0.
- `grep -rn "SpeculationRules" src/` returns no matches after the change.
- If browser access is available: reload the homepage, confirm the two
  "Applying inline speculation rules violates..." console errors no longer
  appear, and confirm the page's `<head>` no longer contains a
  `<script type="application/json" id="speculation-rules-data">` element.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm check` exits 0
- [ ] `pnpm lint` exits 0
- [ ] `pnpm test:run` exits 0
- [ ] `test -f src/components/SpeculationRules.astro` fails (file deleted)
- [ ] `grep -rn "SpeculationRules" src/` returns no matches
- [ ] No files outside `src/components/SpeculationRules.astro` (deleted)
      and `src/components/BaseHead.astro` are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code in `SpeculationRules.astro` or `BaseHead.astro:5,152` doesn't
  match the "Current state" description (the files have drifted since this
  plan was written) — in particular, if a *different* fix for the CSP
  nonce issue has already landed and the component is now confirmed
  working (re-verify live console output before assuming removal is still
  the right call).
- Step 1 finds another file importing `SpeculationRules` — this plan's
  scope assumes `BaseHead.astro` is the only call site.
- `pnpm check` fails after Step 4 in a way not explained by a leftover
  unused variable (investigate rather than force-removing more code to
  make the error go away).
- `pnpm test:run` fails after this change — no test currently covers this
  component, so a failure here would indicate an unexpected dependency;
  investigate rather than assuming it's unrelated.

## Maintenance notes

- If context-aware prefetching beyond what Astro's built-in `prefetch`
  integration offers is wanted again in the future (e.g. the
  cart/checkout-specific eager prefetch this component had at
  `SpeculationRules.astro:85-96`), that's better built as a small,
  testable enhancement on top of Astro's supported mechanism (e.g.
  per-link `data-astro-prefetch` overrides, same pattern already used in
  `Nav.astro`) rather than reviving a custom Speculation-Rules-API
  implementation that has now failed CSP verification twice.
- This plan, together with Plans 124-128, closes out the 2026-08-17 "slow
  first open" investigation. After 128 and 129 both land, re-measure the
  live site once more (DevTools console + network trace) to confirm both
  symptoms (eager `/the-shop`/`/news` fetch, CSP console errors) are
  actually gone in production, not just in code review.
