# Plan 122: Fix CSP nonce gaps causing console errors (best-practices regression)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. When done, update the status row for this plan in
> `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 354a2a8..HEAD -- src/components/SpeculationRules.astro src/components/AnnouncementBanner.astro src/middleware.ts`
> If any changed since this plan was written, re-read them before proceeding.

## Status

- **Priority**: P1 (bug — regression from a prior clean baseline)
- **Effort**: S
- **Risk**: LOW — CSP nonce plumbing only, no behavior change to the
  scripts themselves
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `354a2a8`, 2026-08-06

## Why this matters

Lighthouse's `best-practices` score dropped from a clean 100 (confirmed via
archived report `lighthouse/archive/www.elcaminoskateshop.com-20260723T114928.json`,
score 1.0, zero console errors) to 0.92 in every current run against the
production domain. Root cause confirmed directly, not inferred: two separate
classes of unnonced inline/dynamically-created `<script>` elements are being
blocked by the site's own CSP header (`script-src 'self' 'nonce-<per-request>'
...`, set in `src/middleware.ts`), logging real browser console errors on
every page load — this is the `errors-in-console` and `inspector-issues`
audits firing, worth 2 full points in the best-practices category.

**Confirmed source #1** — `src/components/SpeculationRules.astro`: the
inline `<script is:inline nonce={nonce}>` block (correctly nonced) itself
creates *additional* `<script type="speculationrules">` elements at runtime
via `document.createElement("script")` — once unconditionally for the base
rules (~line 130-134), and again per-URL during progressive prefetch on
category/shop pages (~line 213-226). Neither dynamically-created script has
`.nonce` set, so the browser blocks both, logging exactly the error
Lighthouse captured: `"Applying inline speculation rules violates the
following Content Security Policy directive 'script-src'..."`.

**Confirmed source #2** — `src/components/AnnouncementBanner.astro`: its
`<script>` block (not marked `is:inline`) is small enough that Astro's
build inlines it directly into the page HTML (`<script type="module">...`)
rather than hoisting it to an external same-origin bundle — confirmed by
fetching the live production HTML directly
(`curl -sL https://elcaminoskateshop.com/`) and finding the compiled
banner-dismiss script inlined with no `nonce` attribute at all. An external
`<script type="module" src="...">` would pass CSP's `'self'` rule without
needing a nonce; an *inlined* one needs a nonce it never gets, so it's
blocked — `"Executing inline script violates the following Content
Security Policy directive 'script-src'..."`, the other error class
Lighthouse captured (this line number will drift between runs since the
page's HTML is dynamic — WordPress/product content shifts line offsets —
don't rely on the exact original line number, verify by content/component
instead).

This is very likely a **general pattern**, not limited to just these two
components — Step 1 below is a repo-wide sweep to confirm there are no other
instances before declaring this done.

## Current state

- `src/middleware.ts` generates a per-request nonce
  (`locals.nonce = randomBytes(16).toString("base64")`) and sets it in the
  CSP header's `script-src` directive. This part is correct and unchanged
  by this plan.
- The established, working pattern elsewhere in the codebase for inline
  scripts is `<script is:inline nonce={nonce}>` with `nonce` read from
  `Astro.locals.nonce` in frontmatter (see `SpeculationRules.astro` line
  11, `Header.astro`, `Breadcrumbs.astro`, etc. — grep `nonce` across
  `src/components` for the full list of components already doing this
  correctly, as a reference pattern).
- **Gap A**: `SpeculationRules.astro`'s dynamically-created script elements
  (inside the already-nonced inline script's own JS body) don't inherit or
  reapply that nonce — the nonce attribute is per-element, not
  ambient/inherited, so each `document.createElement("script")` call needs
  its own explicit `.nonce` assignment.
- **Gap B**: `AnnouncementBanner.astro`'s script tag has no `is:inline` and
  no nonce; Astro's default bundling inlines it into the page without one
  when it's small.

## Commands you will need

| Purpose   | Command          | Expected on success |
|-----------|------------------|----------------------|
| Typecheck | `pnpm check`     | exit 0, "0 errors" |
| Lint      | `pnpm lint`      | exit 0 |
| Tests     | `pnpm test:run`  | all pass |
| Build     | `pnpm build`     | exit 0 |
| Live verification | start a local preview (`pnpm preview-build && pnpm preview-start`, or use available browser-preview tooling) and check the browser console for CSP violation errors on page load, on a category/shop page (to exercise progressive prefetch), and after triggering the announcement banner dismiss | zero CSP-related console errors in any case |

## Scope

**In scope**:
- `src/components/SpeculationRules.astro` — fix both dynamic script
  creation sites to carry the request's nonce.
- `src/components/AnnouncementBanner.astro` — fix the un-nonced inline
  script.
- A repo-wide sweep (Step 1) for any other same-shaped instances
  (`document.createElement("script")` without a `.nonce` assignment
  anywhere in `src/`; any component `<script>` tag without `is:inline`
  that might plausibly get inlined by Astro's bundler — cross-check
  against what actually ships in production HTML, not just source, since
  inlining-vs-hoisting is a build-time decision).

**Out of scope**:
- `src/middleware.ts`'s CSP header itself — it is correct; do not loosen
  it (e.g. do not add `'unsafe-inline'` as a shortcut — that would defeat
  the point of the nonce-based CSP and is a real security regression, not
  a fix).
- Any non-CSP best-practices findings — this plan is scoped to the two
  confirmed audit failures (`errors-in-console`, `inspector-issues`) and
  their root causes only.

## Steps

### Step 1: Repo-wide sweep for the same pattern

```
grep -rn 'createElement("script")\|createElement('"'"'script'"'"')' src/
```
For each match, confirm whether `.nonce` is set on the created element
before it's appended to the DOM. Separately, grep for component
`<script>` tags without `is:inline`:
```
grep -rLn "is:inline" $(grep -rl "^<script>$\|^<script " src --include="*.astro")
```
(adjust the grep as needed — the goal is a list of every non-`is:inline`
script in an `.astro` component, since any of these *could* get inlined by
Astro depending on size). Cross-reference against a fresh
`pnpm build` output or a live preview's rendered HTML to see which ones
actually ship inline vs. hoisted to an external `/_astro/*.js` file — only
the inlined ones are affected by this bug.

### Step 2: Fix `SpeculationRules.astro`

Give the client-side script access to its own nonce so it can apply it to
elements it creates. The already-nonced `<script is:inline nonce={nonce}>`
tag can read its own nonce at runtime via `document.currentScript.nonce`
(the CSP spec exposes the nonce value through the `.nonce` IDL property to
same-document script, even though `getAttribute('nonce')` is hidden).
Capture that once near the top of the script body, then apply it to both
dynamically-created script elements before `appendChild`:

```js
var _nonce = document.currentScript && document.currentScript.nonce;
// ...
const speculationScript = document.createElement("script");
speculationScript.nonce = _nonce;
speculationScript.type = "speculationrules";
// ... (existing code)

// ... and again at the dynamic per-URL prefetch site:
const dynamicScript = document.createElement("script");
dynamicScript.nonce = _nonce;
dynamicScript.type = "speculationrules";
// ... (existing code)
```

Verify `document.currentScript` is actually available in this context (it
is, for a classic synchronously-executing inline script — confirm it isn't
`null` by testing locally rather than assuming).

### Step 3: Fix `AnnouncementBanner.astro`

Convert its `<script>` block to the established `is:inline nonce={nonce}`
pattern used elsewhere (see reference components from "Current state"
above): add `const nonce = Astro.locals.nonce;` to frontmatter, change
`<script>` to `<script is:inline nonce={nonce}>`, and adjust the script
body if needed to remove any TypeScript-only syntax that `is:inline`
scripts can't use (Astro compiles `is:inline` scripts as-is, without
TS stripping) — check the current script body for type annotations first.

### Step 4: Fix any other instances found in Step 1

Apply the same pattern (either explicit `.nonce` assignment for
DOM-created scripts, or `is:inline nonce={nonce}` for template scripts) to
anything else the sweep surfaced.

### Step 5: Verify

Run the full command table above. For the live verification step, exercise:
homepage load (base speculation rules), a category or `/shop/all` page
with scroll (progressive prefetch — dynamic script creation), and clicking
the announcement banner's dismiss button if one is currently active
(otherwise confirm via source that the fix is structurally correct). Zero
CSP console errors in all cases.

## Test plan

No new automated test coverage is expected to be strictly necessary (this
is DOM/CSP wiring, not business logic), but if a existing test file already
covers `SpeculationRules.astro` or `AnnouncementBanner.astro`'s client
script behavior, extend it; otherwise this is fine to verify manually via
the browser console per Step 5.

## Done criteria

- [x] Step 1's sweep completed, findings listed (even if empty beyond the
      two known sites) — findings were much larger than expected: Astro was
      silently inlining `<script>` tags without a nonce sitewide whenever a
      chunk was self-contained and under Vite's `assetsInlineLimit` (4096
      bytes default); confirmed via `node_modules/astro/dist/core/build/plugins/plugin-scripts.js`.
      Fixed globally via `assetsInlineLimit: 0` in `astro.config.mjs`
      instead of hand-editing every affected component. Full list in the
      `plans/README.md` status row.
- [x] `SpeculationRules.astro`'s two dynamic script-creation sites carry
      the request's nonce — **deviation**: the base (synchronous) site is
      nonced and confirmed working live. The progressive-prefetch per-URL
      site (async, via `setTimeout`/scroll) was instead **removed**
      (operator-approved) after live testing confirmed Chromium does not
      honor CSP nonce or `'inline-speculation-rules'` for `speculationrules`
      scripts inserted outside the initiating script's synchronous
      execution — not fixable via CSP/nonce plumbing.
- [x] `AnnouncementBanner.astro`'s script is nonced
- [x] Any additional Step 1 findings fixed (via the global `assetsInlineLimit`
      config fix, not per-file edits)
- [x] Zero CSP-related browser console errors on homepage, a category
      page, and after banner dismiss — verified via live, nonce-filtered
      console checks (not static grep) across homepage, category, the-shop,
      shop/all, shop/sale, news, cart, a product page, and admin login. No
      banner was active during testing, so the dismiss click itself
      couldn't be exercised live; verified structurally instead (the script
      always renders with a correct nonce regardless of whether the banner
      element renders).
- [x] `pnpm check`/`lint`/`test:run`/`build` all exit 0 (866/866 tests
      passing; `test:coverage` also run and exits 0)
- [x] `plans/README.md` status row for 122 updated

## STOP conditions

- If `document.currentScript.nonce` returns empty/undefined in local
  testing (contrary to expectation), stop and report — do not fall back to
  reading the nonce from the CSP header via `document.querySelector`
  tricks or embedding it in a data attribute readable by non-nonced
  scripts, as that could leak the nonce to contexts that shouldn't have it
  depending on how it's done. Report what you found instead.

## Git workflow

- Branch: `advisor/122-fix-csp-nonce-gaps-best-practices-regression`
- Commit message style: conventional commits.
- Do NOT push or open a PR unless the operator instructed it.
