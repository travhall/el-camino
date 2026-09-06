# Plan 124: Reduce initial-load request fanout from per-component hoisted script chunks

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
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `7a943d7`, 2026-08-17
- **BLOCKED (2026-08-17)**: the `manualChunks` approach in this plan is
  architecturally invalid — see "Execution outcome" at the bottom of this
  file before attempting a revision. Do not re-dispatch this plan as
  written; it will not work.

## Why this matters

A live trace of `https://www.elcaminoskateshop.com/` (Chrome DevTools
`performance` API, homepage, cold-ish load) showed `domContentLoaded` at
1030ms despite a 132ms TTFB. The gap is dominated by ~10+ separate,
individually tiny (a few hundred bytes each) per-component hoisted script
files — `Layout.astro_astro_type_script_index_0_lang.*.js` through `_index_3`,
plus `Modal.astro_..._lang.js`, `Notification.astro_..._lang.js`,
`MiniCart.astro_..._lang.js`, `Footer.astro_..._lang.js`,
`OpenStatusBadge.astro_..._lang.js`, etc. — each taking **590–746ms** to
fetch despite starting in parallel around the 170ms mark. That per-file
latency (far more than the file size justifies) is consistent with cold
edge-cache misses fanning out across many small unique asset URLs instead of
one. Every one of these small files delays `astro:page-load`, which in turn
delays anything gated on it (see Plan 127) and delays the page feeling
"ready" — this is very likely the dominant contributor to the "ton of lag on
first open" the maintainer is seeing, more than any server/function
cold-start (server TTFB measured consistently under 300ms across repeated
tests).

This is a **self-inflicted regression**: `astro.config.mjs` currently has an
empty `rollupOptions.output` with a comment explaining that `manualChunks`
was deliberately removed to fix a prior "massive 369KB ClientRouter script"
problem. That fix traded one oversized bundle for dozens of undersized ones.
The correct fix is neither extreme: group the small, same-purpose hoisted
component scripts into one modestly-sized shared chunk, while leaving
larger/independent chunks (the router, prefetch runtime, cart, page-specific
code) split out as they are today.

## Current state

- `astro.config.mjs:108-120` — the vite build config as it stands today:

```js
    build: {
      sourcemap: process.env.NODE_ENV !== "production",
      minify: true,
      cssMinify: true,
      // 0 disables Vite's "inline small chunks as base64/inline" optimization.
      // Astro's script-hoisting plugin uses this same limit to decide whether
      // a self-contained <script> chunk gets inlined into the page HTML
      // instead of hoisted to an external file (see
      // astro/dist/core/build/plugins/plugin-scripts.js -> shouldInlineAsset).
      // Inlined scripts have no nonce and get blocked by our nonce-based CSP
      // (src/middleware.ts), so this must stay 0.
      assetsInlineLimit: 0,
      rollupOptions: {
        output: {
          // REMOVED manualChunks: Let Vite optimally split chunks
          // to fix massive 369KB ClientRouter script issue.
        },
      },
    },
```

- **`assetsInlineLimit: 0` is a hard constraint, not a style choice.** The
  comment above it explains why: inline scripts have no CSP nonce and get
  blocked by `src/middleware.ts`'s nonce-based `script-src`. **Do not change
  `assetsInlineLimit`.** This plan only touches chunk *grouping*
  (`manualChunks`), not inlining.
- The hoisted scripts you're grouping are Astro's per-component `<script>`
  blocks (e.g. the one in `src/components/OpenStatusBadge.astro`,
  `src/layouts/Layout.astro:80-177`, `src/components/Modal.astro`,
  `src/components/Notification.astro`, `src/components/MiniCart.astro`,
  `src/components/Footer.astro`). You are not editing any of these
  component files — only how their already-hoisted output is bundled.
- Astro's internal client-runtime chunks (the View Transitions router from
  `src/components/BaseHead.astro:3,244` — `import { ClientRouter } from
  "astro:transitions"` — and the prefetch runtime from the `prefetch:` config
  block at `astro.config.mjs:42-46`) are a **separate concern** from the
  per-component hoisted scripts. The prior 369KB regression this comment
  refers to came from over-grouping — don't reintroduce it by lumping the
  router/prefetch runtime in with component scripts, or by using a
  catch-all `manualChunks` that groups everything into one file again.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `pnpm check` | exit 0, no errors |
| Lint | `pnpm lint` | exit 0 |
| Production-shaped build | `PREVIEW=true pnpm run preview-build` | exit 0, `dist/` populated |
| Inspect chunk output | `ls -la dist/client/_astro/*.js \| wc -l` and `ls -la dist/client/_astro/*.js \| sort -k5 -n` | see Steps below |

Note: the `preview-build` script sets `PREVIEW=true`, which switches
`astro.config.mjs` to the `@astrojs/node` adapter (see the `isPreview`
branch, `astro.config.mjs:22-38`) so it can build standalone without Netlify
credentials. This is fine for inspecting chunk output — the Vite/Rollup
build config under test is identical between adapters; only the deploy
adapter differs.

## Scope

**In scope** (the only file you should modify):
- `astro.config.mjs` (only the `vite.build.rollupOptions.output` block)

**Out of scope** (do NOT touch, even though they look related):
- Any individual component's `<script>` content (`OpenStatusBadge.astro`,
  `Modal.astro`, `Notification.astro`, `MiniCart.astro`, `Footer.astro`,
  `Layout.astro`, etc.) — this plan is pure build-config, not component
  logic. Plan 127 separately fixes a duplicate-fetch bug in
  `OpenStatusBadge.astro` — don't do that work here.
- `assetsInlineLimit` — must stay `0` (see "Current state").
- The `prefetch` config block (`astro.config.mjs:42-46`) — that's Plan 125.
- The `experimental.clientPrerender` block (`astro.config.mjs:52-54`) —
  that's Plan 126.

## Git workflow

- Branch: `advisor/124-fix-hoisted-script-chunk-fanout`
- Single commit is fine for this change.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Record the baseline

Run the production-shaped build and count/measure the current hoisted
script chunks before changing anything:

```bash
PREVIEW=true pnpm run preview-build
ls -la dist/client/_astro/*.js | wc -l
ls -la dist/client/_astro/*.js | awk '{print $5, $9}' | sort -n
```

Save this output (paste it into your working notes, not into the repo) —
you'll compare against it in Step 3. Note in particular: how many files
match the pattern `*astro_astro_type_script_index*` or similar
component-hoisted-script naming, and their individual sizes.

**Verify**: build exits 0, `dist/client/_astro/` is non-empty.

### Step 2: Add a targeted `manualChunks` function

Edit `astro.config.mjs`, replacing the empty `output: {}` block at lines
115-119 with a `manualChunks` function that groups only the per-component
hoisted scripts into a single shared chunk, leaving everything else
(vendor/framework code, the router, prefetch runtime, page-specific code)
to Vite's default splitting:

```js
      rollupOptions: {
        output: {
          // Group Astro's per-component hoisted <script> output into one
          // shared chunk instead of one file per component. Previously this
          // was left to Vite's default splitting, which produced 10+
          // separate sub-1KB files — each one a full round trip on first
          // load. A prior attempt at manualChunks over-corrected by lumping
          // everything (including the router) into one 369KB bundle; this
          // scopes the grouping to just the small hoisted component scripts.
          manualChunks(id) {
            if (id.includes("astro_astro_type_script_index")) {
              return "component-scripts";
            }
          },
        },
      },
```

Adjust the `id.includes(...)` match if Step 1's file listing shows a
different naming convention in your build output — inspect the actual
`dist/client/_astro/*.js` filenames from Step 1 and match the pattern that
identifies hoisted component scripts specifically (they'll share a
`*.astro_astro_type_script_index_N_lang.*.js` shape). Do not widen the match
to catch files that aren't hoisted component scripts.

**Verify**: `pnpm check` → exit 0, no errors.

### Step 3: Rebuild and compare

```bash
rm -rf dist
PREVIEW=true pnpm run preview-build
ls -la dist/client/_astro/*.js | wc -l
ls -la dist/client/_astro/*.js | awk '{print $5, $9}' | sort -n
```

Compare against Step 1's baseline:
- The total `.js` file count in `dist/client/_astro/` should be
  **meaningfully lower** (the component-script files should now be merged
  into one `component-scripts.*.js` file instead of 10+ separate files).
- The new `component-scripts.*.js` chunk's size should be small — check it
  against the 369KB figure the removed-manualChunks comment warned about.
  **If the merged chunk exceeds ~150KB, STOP** (see STOP conditions) —
  something unexpected is being swept into the match pattern.
- Chunks unrelated to hoisted component scripts (router, prefetch runtime,
  `cart.*.js`, `events.*.js`, etc.) should be **unchanged in count and
  roughly unchanged in size** — confirming the grouping stayed scoped.

**Verify**: build exits 0; file count dropped; no chunk (including the new
merged one) exceeds 150KB.

## Test plan

This is a build-config change with no new runtime logic — there is no unit
test to add. Verification is the chunk-count/size comparison in Step 3, plus
the existing test suite must stay green (this change shouldn't touch any
tested code path):

- Verification: `pnpm test:run` → all existing tests still pass (this
  change doesn't touch application code, so a regression here would
  indicate the build change broke module resolution somewhere unexpected).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm check` exits 0
- [ ] `pnpm lint` exits 0
- [ ] `PREVIEW=true pnpm run preview-build` exits 0
- [ ] `dist/client/_astro/*.js` file count is lower than the Step 1 baseline
- [ ] No `.js` chunk in `dist/client/_astro/` exceeds 150KB
- [ ] `pnpm test:run` exits 0
- [ ] `grep -n "assetsInlineLimit" astro.config.mjs` still shows `0`
      (unchanged)
- [ ] No files outside `astro.config.mjs` are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at `astro.config.mjs:108-120` doesn't match the "Current state"
  excerpt (the file has drifted since this plan was written).
- The merged `component-scripts` chunk exceeds ~150KB — this suggests the
  `id.includes(...)` match is too broad and is pulling in more than the
  small per-component hoisted scripts; narrow the match rather than
  accepting a large merged bundle (that's the exact regression this plan
  exists to avoid re-introducing).
- `dist/client/_astro/*.js` file count does *not* drop after the change —
  the match pattern isn't catching the intended files; inspect actual
  filenames from Step 1 rather than guessing further.
- Any existing test in `pnpm test:run` starts failing after this change —
  that would be surprising for a pure chunking change and needs
  investigation before proceeding, not a workaround.

## Maintenance notes

- If a future component's hoisted script needs to be large or
  independently cacheable (e.g. it changes far more or less often than the
  others), it may deserve its own chunk again — revisit the match pattern
  rather than assuming "always merge everything."
- This plan doesn't verify real-world latency improvement (that requires a
  deployed preview + a repeat of the DevTools trace from a cold edge
  location) — a reviewer should re-run the live trace described in "Why
  this matters" against a preview deploy of this change before merging to
  confirm the fanout actually shrank in production, not just in local
  build output.
- Plan 127 (OpenStatusBadge duplicate fetch) and Plan 125 (prefetch
  strategy) address separate contributors to the same "slow first open"
  symptom — none of the three alone is the full fix.

## Execution outcome (2026-08-17)

**This plan's approach does not work — confirmed empirically and at the
source level. Do not re-attempt the `manualChunks` fix as written.**

An executor applied Step 2 exactly as written (branch
`advisor/124-fix-hoisted-script-chunk-fanout`,
`.claude/worktrees/advisor-124-fix-hoisted-script-chunk-fanout`, uncommitted).
A clean rebuild (`rm -rf dist && PREVIEW=true pnpm run preview-build`) in
that worktree showed **zero change**: 66 separate
`*.astro_astro_type_script_index_N_lang.*.js` files still present, no
merged `component-scripts.*.js` chunk emitted anywhere.

Root cause, traced through `node_modules/astro/dist/core/build/`:

1. **The match string in Step 2 was wrong.** `plugin-analyzer.js:60-62`
   shows the real Vite/Rollup module ID for a hoisted script is
   `` `${componentPath}?astro&type=script&index=${i}&lang.ts` `` — e.g.
   `.../OpenStatusBadge.astro?astro&type=script&index=0&lang.ts`. The
   string `"astro_astro_type_script_index"` this plan told the executor to
   match on is the *sanitized output filename* Rollup derives from that ID
   (special characters replaced with `_`), not a substring of the ID
   itself. `manualChunks(id)`'s `id.includes("astro_astro_type_script_index")`
   check as written never matches anything real, so it was a no-op even
   taken at face value.

2. **Fixing the match string would not have helped either — this is the
   real finding.** `static-build.js:285-292` (`getClientInput()`) adds
   every one of these `discoveredScripts` module IDs directly into
   Rollup's `input` set — i.e., each hoisted component script is a genuine
   **Rollup entry point**, not a regular imported module reached through
   the dependency graph. Rollup always emits one dedicated output file per
   entry point by design; `manualChunks` only controls how *shared,
   non-entry* code gets split off — it cannot merge multiple entry points
   into a single output file. Even with a correct match string, the best
   case would be N thin facade files (one per entry, each just re-exporting
   from a shared chunk) plus one new shared chunk — the same or a *greater*
   number of browser-visible requests, not fewer.

**Why Astro does this**: hoisting each component's script as its own entry
lets Astro ship a given component's client JS only to the pages that
actually render that component, instead of bundling every component's
script into every page. The fanout this plan set out to fix is a direct,
structural consequence of that per-page-payload optimization — not an
accidental regression fixable by adjusting `rollupOptions.output`.

**What would actually reduce the request count**, none of which this plan
attempted or verified, for a human to decide between:

- **Consolidate multiple components' interaction logic into fewer actual
  component files** (e.g. one shared client controller/script that several
  components import from or defer to, rather than N components each
  owning their own independent `<script>` block). This is a real code
  refactor across multiple component files, not a config change — higher
  effort (L) and real risk of behavior regressions per component; would
  need its own plan, scoped per-component, with its own test coverage.
- **Treat this as a CDN/edge-caching problem instead of a bundling
  problem.** The 590–746ms-per-tiny-file latency this plan's "Why this
  matters" section measured is consistent with cold per-URL edge-cache
  misses on Netlify's CDN, not bandwidth or request-count overhead per se
  (HTTP/2 multiplexes these over one connection already — see the `HTTP/2
  200` response observed against production). If that diagnosis is right,
  fewer files wouldn't eliminate the latency source, only reduce how many
  cold-miss round trips a first-time visitor to a given edge PoP pays.
  Investigating Netlify's asset cache warming/propagation behavior for
  fresh deploys is a different, unstarted line of investigation — not
  something this plan or its executor attempted.
- **Do nothing here and rely on Plan 125** (prefetch strategy) and
  Plan 127 (duplicate fetch) — both independently verified-sound — plus
  re-measuring the live page after they land, before deciding whether this
  fanout is still worth pursuing at all.

The worktree's uncommitted, non-functional change was left in place
(disposable, gitignored `dist/` output only otherwise) rather than
committed. No PR, no merge, nothing landed on any branch that matters.
