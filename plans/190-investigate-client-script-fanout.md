# Plan 190: Investigation — the ~40-chunk client script fan-out on every page

> **Executor instructions**: This is an **investigation plan**, not a build
> plan. Its deliverable is measurements and a recommended sequence, written
> into this file and summarized in `plans/README.md`. **Write no production
> code** except a disposable, uncommitted experiment if Step 3 calls for one.
> If anything in "STOP conditions" occurs, stop and report.
>
> **Drift check (run first)**:
> `git diff --stat ad2999d..HEAD -- astro.config.mjs`
> On any change, re-verify the excerpt below before relying on it.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW (investigation only; any resulting build plan carries its own risk)
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `0e5fb4f`, 2026-09-06

## Why this matters

A live Chrome DevTools trace against the deployed staging build
(https://elcaminoskateshop.netlify.app/, Slow 4G + 4x CPU throttle, taken
after plan 189 landed) shows the network dependency tree fanning out to
**~40 separate JS chunks** immediately after the page's HTML and the client
router script arrive — one chunk per Astro component that has a `<script>`
block (`Header.astro`, `Nav.astro`, `Footer.astro`, `MiniCart.astro`,
`QuickView.astro`, `ArticleGrid.astro`, `Sidebar.astro`, `Modal.astro`,
`CartButton.astro`, `ThemeToggle.astro`, and roughly 30 more), each fetched
and executed close together on the main thread. This is the most likely
remaining source of the "still a bit of lag on initial load" the operator
reported after plans 146-151 (image/font loading) and plan 189 (the
shop-status client fetch) both landed — those fixed genuine measured
bottlenecks, but the felt sluggishness didn't fully go away, and this
fan-out is the next largest thing visible in the trace.

**This is not a fresh discovery** — it is a **known, already-adjusted
tradeoff**, not virgin territory:

`astro.config.mjs`'s `vite.build.assetsInlineLimit: 0` has a comment
explaining that Astro's script-hoisting plugin uses this same limit to
decide whether a component's `<script>` gets inlined into the page HTML or
hoisted to its own external chunk — and inlined scripts have no CSP nonce, so
`src/middleware.ts`'s nonce-based CSP would block every one of them. Setting
it to `0` forces every component script into its own external, nonce-able
chunk **on purpose**.

Separately, `vite.build.rollupOptions.output` has a `manualChunks` entry that
was **removed**, with a comment: *"Let Vite optimally split chunks to fix
massive 369KB ClientRouter script issue."* Someone already tried
consolidating chunks and hit a regression — a single oversized chunk
blocking the client router — and reverted.

So the question this plan answers is **not** "should we bundle these
scripts" (that was tried and reverted) but: **is there a middle ground —
consolidating some but not all, using route-based or async/defer loading
instead of consolidation, or moving less-critical components off `client:load`
equivalents — that avoids both the current 40-chunk fan-out and the previous
369KB monolith regression?**

## Current state

`astro.config.mjs` (relevant excerpt):

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

The live trace's critical-path chain (captured via
`performance_start_trace`/`performance_analyze_insight` against
`https://elcaminoskateshop.netlify.app/`, Slow 4G + 4x CPU, 2026-09-06,
deploy `0e5fb4f`) shows the pattern — abbreviated, the full chain has ~40
entries, all requested within roughly 100ms of each other once
`ClientRouter.astro..._script...js` and `prefetch...js` resolve:

```
/ (804 ms, longest chain)
  ClientRouter.astro_astro_type_script_index_0...js (688 ms)
    prefetch.t_...js (767 ms)
      client...js (782 ms)
    client...js (767 ms)
  QuickView.astro_astro_type_script_index_0...js (827 ms)
    pdpUI...js (844 ms)
      money...js (848 ms)
  Layout.astro_astro_type_script_index_3...js (834 ms)
    imageShimmer...js (847 ms)
  MiniCart.astro_astro_type_script_index_0...js (832 ms)
    assets...js (845 ms)
    slugUtils...js (845 ms)
  Footer.astro_astro_type_script_index_0...js (806 ms)
    events...js (843 ms)
  Layout.astro_astro_type_script_index_{0,1,2}...js (832-834 ms each)
  Modal.astro_astro_type_script_index_0...js (834 ms)
  Notification.astro_astro_type_script_index_0...js (832 ms)
  OpenStatusBadge.astro_astro_type_script_index_0...js (806 ms)
  ThemeToggle.astro_astro_type_script_index_0...js (806 ms)
  CartButtonMobile.astro_astro_type_script_index_0...js (737 ms)
    cart...js (775 ms)
  ArticleGrid.astro_astro_type_script_index_0...js (769 ms)
  Sidebar.astro_astro_type_script_index_0...js (769 ms)
  ArticleCard.astro_astro_type_script_index_0...js (768 ms)
  Tag.astro_astro_type_script_index_0...js (768 ms)
  Header.astro_astro_type_script_index_0...js (738 ms)
  CartButton.astro_astro_type_script_index_0...js (738 ms)
  Nav.astro_astro_type_script_index_0...js (737 ms)
  ... (plus several CSS chunks: Tag/global/BaseHead/ThemeToggle/Layout/ArticleGrid)
```

`NetworkDependencyTree`'s insight also reported: **no origins were
preconnected** — zero `<link rel="preconnect">` hints for same-origin `_astro/`
asset requests exist (this is separate from the WordPress/CrUX preconnects
plan 149 already evaluated and removed for being unused; this is about
whether preconnecting the site's own asset origin would help, which for a
same-origin `_astro/` path is likely a no-op — verify rather than assume in
Step 4).

Measured lab metrics on that same trace (for reference, not the primary
target of this plan): LCP 1,210 ms, TTFB 42 ms, CLS 0.04. This plan is about
main-thread/network contention *after* first paint, which lab LCP does not
fully capture — the "lag" being chased here is closer to Time to Interactive
/ Total Blocking Time than to LCP.

## Commands you will need

| Purpose    | Command       | Expected        |
|------------|---------------|-----------------|
| Typecheck  | `pnpm check`  | exit 0          |
| Build      | `pnpm build`  | exit 0          |
| Dev server | `pnpm dev`    | serves on :4321 |

Never use `pnpm test` — watch mode, it hangs. This plan does not need
`pnpm test:run` for its own deliverable (no source changes expected), but run
it before finishing if Step 3's disposable experiment touched anything that
could regress a test, then revert the experiment anyway per Scope.

## Scope

**In scope**:
- This plan file (write findings into it)
- `plans/README.md` (summary + the recommended sequence)
- **Temporary, uncommitted** experiments (e.g. a scratch `manualChunks`
  config, a `client:idle`/`client:visible` swap on a low-priority component)
  to measure whether a specific mitigation helps — must be reverted before
  finishing
- Optionally: new plan files for the sequence you recommend

**Out of scope** (do NOT do):
- **Any committed production code change.** If you find a specific fix
  worth making, write it down as a recommended follow-up plan instead.
- Weakening or working around the CSP nonce requirement in
  `src/middleware.ts` to make inlining viable again — that trade was made
  deliberately for security reasons and is not this plan's call to reverse.
- Re-attempting the exact `manualChunks` consolidation that was already
  tried and reverted, without first understanding *why* it produced a 369KB
  chunk and *what* that config actually was (check git history/blame on
  `astro.config.mjs` for the removed lines if still recoverable — if the
  actual removed config can't be found, say so and treat this as a fresh
  unknown rather than assuming you know what was tried).

## Git workflow

- Branch: `advisor/190-investigate-client-script-fanout`
- Commit only this plan file and `plans/README.md` (plus, if applicable, any
  new plan files this investigation produces).
- Do NOT push or open a PR unless the operator instructs it.

## Steps

### Step 1: Find out what `manualChunks` config was actually removed

`git log -p -- astro.config.mjs` (or `git log --all --source -p -- astro.config.mjs`
if the removal predates the current history's root) to find the commit that
removed the `manualChunks` entry and read its actual content and the commit
message/PR description for *why* it produced a 369KB chunk. This is real
prior art — do not re-derive from scratch if it's recoverable.

**Verify**: either the historical config is found and quoted here, or its
absence is confirmed and stated plainly (checked back to the repo's first
commit / as far as `git log` goes).

### Step 2: Quantify the actual cost of the fan-out

Using the trace evidence already gathered (reproduce it yourself against
either the staging deploy or a local `pnpm build && pnpm preview` — a
throttled trace of a local `pnpm dev` server is not representative, since dev
mode doesn't bundle/hoist the same way production does):

- Total number of `_astro/*.js` chunk requests on a cold homepage load.
- Total transferred bytes across all of them (compare to the previous 369KB
  single-chunk regression — is 40 small chunks actually *worse* in bytes, or
  only worse in request-count/main-thread-scheduling overhead?).
- Main-thread busy time attributable to script evaluation in this window
  (the trace's call-tree data covers this — look for `Evaluate Script`/
  parse/compile time summed across the fan-out).
- HTTP/2 or HTTP/3 in use? (check `protocol` field in the network request
  data) — request multiplexing cost is very different under H2/H3 vs H1.1.

**Verify**: concrete numbers for each of the four bullets above, not
estimates.

### Step 3: Test one or two disposable mitigations, measure, then revert

Candidates, in rough order of risk (cheapest/safest first):

(a) Add `<link rel="modulepreload">` or reorder script priority hints for
    the highest-priority chunks (client router, page-critical islands) so
    the browser fetches them with better prioritization without changing
    chunk boundaries at all.
(b) Swap a handful of clearly-non-critical, always-hydrated components
    (e.g. `Modal.astro`, `Notification.astro` — check whether these actually
    need `client:load`-equivalent hydration timing or could defer) to a
    lazier hydration strategy, if Astro's directive model supports it for
    hoisted-script components (verify this is even applicable — some of
    these scripts may not use a client directive at all and just run via
    plain `<script>` hoisting, in which case "hydration timing" doesn't
    apply and the lever is different — check before assuming).
(c) A scoped `manualChunks` experiment that groups a *subset* of
    always-needed components (e.g. everything in `Layout.astro`'s direct
    children) into one chunk, while leaving route-specific/conditional
    components (QuickView, Modal) separate — testing whether a partial
    consolidation avoids both the 40-chunk fan-out and the previous
    all-in-one 369KB regression.

For whichever you try, measure before/after with the same trace methodology
as Step 2. **Revert every experiment before finishing** — this plan produces
no committed code change.

**Verify**: for each candidate tried, before/after numbers for the four Step
2 metrics, and `git status` clean (or only this plan file + `plans/README.md`
modified) once you're done.

### Step 4: Evaluate preconnect / resource hints properly

`NetworkDependencyTree`'s insight flagged zero preconnects. Same-origin
`_astro/` requests don't benefit from `preconnect` (the connection to the
origin is already open from the HTML request itself) — confirm this
understanding is correct for this specific setup before recommending
anything, rather than reflexively adding preconnect hints that would be a
no-op. If there's a genuinely separate origin in the critical path (there
does not appear to be one from the chain above — check current state, not
this plan's memory of it), that would be the actual candidate.

**Verify**: a clear statement of whether preconnect hints would help here,
with reasoning, not just "the insight flagged it so let's add one."

### Step 5: Write the recommendation

Based on Steps 1-4, write a clear recommendation: is this fan-out worth
fixing given its actual measured cost (Step 2), is there a viable mitigation
(Step 3) that doesn't repeat the 369KB regression, and if so, spec it out as
a new numbered build plan (or explicitly recommend **no action**, if the
measured cost turns out to be small relative to the LCP/TTFB numbers that
matter more — that is a valid outcome, same as plan 176's own STOP condition
for an analogous case).

**Verify**: recommendation written into this file and summarized in
`plans/README.md`; if a follow-up plan is warranted, it exists as a new file
with the next available plan number.

## Test plan

No tests — this plan changes no shipped code. If Step 3's disposable
experiment is complex enough that you want to sanity-check it doesn't break
anything before reverting, run `pnpm test:run` against it, but the revert
happens regardless of the result.

## Done criteria

- [ ] Step 1's historical `manualChunks` config found and quoted, or its
      absence confirmed
- [ ] Step 2's four metrics (chunk count, total bytes, main-thread script
      time, protocol) measured and recorded
- [ ] Step 3: at least one mitigation candidate measured before/after, then
      reverted
- [ ] Step 4's preconnect question answered with reasoning, not assumption
- [ ] Step 5's recommendation written here and in `plans/README.md`
- [ ] **No production file modified** (`git status` shows only this plan
      file, `plans/README.md`, and possibly new plan files)
- [ ] `pnpm check` and `pnpm build` exit 0

## STOP conditions

Stop and report if:

- **The previous `manualChunks` removal can't be found or understood**, and
  you're tempted to guess at what config caused the 369KB regression. Say
  so and treat the space as unexplored rather than assuming you know the
  failure mode.
- Step 2's measurements show the fan-out's actual main-thread/byte cost is
  small relative to LCP/TTFB (i.e. this isn't actually where the felt lag is
  coming from). **That is a valid and valuable result** — report it and do
  not manufacture a fix for a problem that measurement doesn't support.
- Any experiment in Step 3 risks being left uncommitted-but-not-reverted —
  double check `git status` is clean before finishing regardless of how the
  investigation concludes.
- You are tempted to make this plan's own experiment the shipped fix rather
  than writing it up as a separate, reviewable build plan.

## Maintenance notes

- **Why an investigation rather than a direct fix**: the previous
  `manualChunks` attempt was reverted for a real regression (369KB chunk),
  and the CSP nonce constraint on inlining is a deliberate security
  tradeoff, not an oversight. A plan that just says "bundle the scripts"
  without accounting for both of those would likely re-cause the same
  problem or silently reopen a CSP gap.
- This plan is the client-side counterpart to plan 176 (server-side cold-SSR
  fan-out, still TODO) — the two are independent axes of the same "initial
  load feels slow despite good Lighthouse/LCP numbers" complaint that
  originally kicked off this whole investigation thread. Keep them separate;
  don't merge their findings into one build plan, since one is server
  render time and the other is client hydration/network scheduling.
- If the answer turns out to be "the fan-out costs little relative to
  LCP/TTFB, this doesn't matter," that is worth recording permanently so it
  isn't re-investigated from scratch later.
