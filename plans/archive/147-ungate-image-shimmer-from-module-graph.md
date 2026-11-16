# Plan 147: Remove image placeholders as soon as images decode, not after the whole JS module graph loads

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat ad2999d..HEAD -- src/scripts/imageShimmer.ts src/layouts/Layout.astro src/components/BaseHead.astro`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: MED
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `ad2999d`, 2026-09-05

## Why this matters

Every image on the site renders behind a skeleton placeholder that is removed
by JavaScript. That JavaScript is a bundled ES module that only acts on the
`astro:page-load` event — which means it cannot run until Astro's
`ClientRouter` bundle has downloaded, parsed, and dispatched.

On a Chrome DevTools trace of production at Slow 4G + 4x CPU throttling,
`imageShimmer.*.js` was **request 51 of 54**. The LCP image finished decoding at
1265 ms; the placeholder covering it was not removed until the tail of a
~40-chunk module waterfall had settled. The user sees a loading skeleton over
an image that is already fully decoded and sitting in memory.

This is the direct cause of the "takes a long time to render" half of the
reported symptom. On a warm cache the whole module graph is local and the gap
collapses to nothing — which is exactly why the problem only shows up on the
initial load.

After this plan, placeholders are removed by a tiny inline script the moment
each image fires `load`, independent of the module graph.

## Current state

### The gate

`src/layouts/Layout.astro:177` loads the shimmer logic as a bundled module:

```astro
    <!-- Image shimmer: attaches load/error handlers via data-shimmer-* attributes -->
    <script src="../scripts/imageShimmer.ts"></script>
```

Astro compiles this to a hoisted `<script type="module">` (deferred by
definition), and it is the last of several such scripts in the layout.

`src/scripts/imageShimmer.ts:88-96` — the only entry point is `astro:page-load`:

```ts
// astro:page-load fires on initial load AND after every View Transition navigation
document.addEventListener("astro:page-load", () => {
  initShimmer();
  if (!observerStarted) {
    // Observe the document root so the observer survives body replacements
    observer.observe(document.documentElement, { childList: true, subtree: true });
    observerStarted = true;
  }
});
```

`astro:page-load` is dispatched by `ClientRouter` (imported in
`src/components/BaseHead.astro`), so this handler is transitively blocked on
the router bundle.

`src/scripts/imageShimmer.ts:58-68` — `attach()` already handles the
already-complete case correctly, it is simply called too late:

```ts
function attach(img: HTMLImageElement): void {
  // Guard against double-binding (matters for astro:page-load re-runs and observer overlap)
  if (img.dataset.shimmerAttached) return;
  img.dataset.shimmerAttached = "1";

  if (img.complete) {
    // Image already settled (cached hit or error before script ran)
    settle(img, img.naturalWidth === 0);
  } else {
    img.addEventListener("load",  () => settle(img, false), { once: true });
    img.addEventListener("error", () => settle(img, true),  { once: true });
  }
}
```

### The markup contract

Images opt in via data attributes. `src/components/ArticleCard.astro:333-338`:

```astro
          data-placeholder-id={`article-placeholder-${post.id}`}
          data-shimmer-placeholder={`article-placeholder-${post.id}`}
          data-shimmer-load-add="loaded"
          data-shimmer-error-add="error"
          data-shimmer-load-opacity={(variant === "masonry" && !featured) ? "" : "1"}
          data-shimmer-error-opacity={(variant === "masonry" && !featured) ? "" : "1"}
```

The placeholder element itself, `src/components/ArticleCard.astro:300-308`, is
an absolutely-positioned div carrying a background-image loader graphic.

The full attribute contract is documented in the header comment of
`src/scripts/imageShimmer.ts:1-19` — read it before starting.

### Repo conventions for inline scripts

This repo uses a **nonce-based CSP** set per request in `src/middleware.ts`.
Inline scripts must therefore be `is:inline` **and** carry the nonce. The
exemplar is `src/components/BaseHead.astro:24-25`:

```astro
const nonce = Astro.locals.nonce;
---
<meta charset="UTF-8" />
<script is:inline nonce={nonce}>
```

Note also `astro.config.mjs` sets `vite.build.assetsInlineLimit: 0` specifically
because *auto*-inlined scripts get no nonce and are blocked by that CSP. An
`is:inline` script with an explicit nonce is the supported pattern and is
unaffected by that setting.

## Commands you will need

| Purpose   | Command              | Expected on success             |
|-----------|----------------------|---------------------------------|
| Typecheck | `pnpm check`         | exit 0, 0 errors                |
| Tests     | `pnpm test:run`      | exit 0, all pass                |
| Coverage  | `pnpm test:coverage` | exit 0, no threshold regression |
| Lint      | `pnpm lint`          | exit 0                          |
| Build     | `pnpm build`         | exit 0                          |
| Dev server| `pnpm dev`           | serves on :4321                 |

Do **not** use `pnpm test` — watch mode, it will hang.

## Scope

**In scope**:
- `src/components/BaseHead.astro` (add the early inline handler)
- `src/scripts/imageShimmer.ts` (make it idempotent with the inline handler)

**Out of scope** (do NOT touch):
- `src/components/ArticleCard.astro` and every other component that emits
  `data-shimmer-*` attributes. The attribute contract does not change. If you
  find yourself editing markup, you have misread the plan.
- The `MutationObserver` in `imageShimmer.ts:76-86` — it exists for images
  injected after paint (cart items, QuickView swaps). It must keep working and
  must stay in the module, not the inline script.
- `src/layouts/Layout.astro:174` (`initDeviceDetection.ts`) — different
  concern, leave it alone.
- The card entrance animation. Plan 148 owns that; do not touch
  `src/components/ArticleGrid.astro`.

## Git workflow

- Branch: `advisor/147-ungate-image-shimmer-from-module-graph`
- Conventional commits, e.g.
  `fix(perf): settle image placeholders inline instead of waiting on astro:page-load`
- Do NOT push or open a PR unless the operator instructs it.

## Steps

### Step 1: Add an early inline settle handler in `BaseHead.astro`

Add an `is:inline` script carrying the nonce. Place it **after** the existing
theme/font inline script block (which ends at `src/components/BaseHead.astro:66`)
and **before** the `<meta name="viewport">` line — early in `<head>`, so it is
parsed and executing before the body's images are even created.

It must use event **delegation on the document in the capture phase**, because
`load` does not bubble. That single listener catches every image's `load` and
`error` regardless of when the element is parsed, with no per-element wiring
and no polling:

```astro
<script is:inline nonce={nonce}>
    // Placeholder settling runs here, inline and early, rather than waiting
    // for src/scripts/imageShimmer.ts — that module is deferred and only acts
    // on astro:page-load, so on a cold load it landed at the tail of a
    // ~40-chunk waterfall and skeletons stayed up over images that had already
    // decoded. `load`/`error` don't bubble, hence capture-phase delegation on
    // document. The module still owns View Transitions and the MutationObserver
    // for post-paint images; both paths guard on data-shimmer-attached.
    (function () {
        function settleEarly(img) {
            if (!img || !img.dataset || !img.dataset.shimmerPlaceholder) return;
            if (img.dataset.shimmerAttached) return;
            img.dataset.shimmerAttached = "1";
            var isError = img.naturalWidth === 0;
            var ph = document.getElementById(img.dataset.shimmerPlaceholder);
            if (ph) ph.remove();
            var opacityKey = isError ? "shimmerErrorOpacity" : "shimmerLoadOpacity";
            var addKey = isError ? "shimmerErrorAdd" : "shimmerLoadAdd";
            var removeKey = isError ? "shimmerErrorRemove" : "shimmerLoadRemove";
            if (opacityKey in img.dataset) img.style.opacity = img.dataset[opacityKey] || "";
            var rm = img.dataset[removeKey];
            if (rm) rm.split(" ").filter(Boolean).forEach(function (c) { img.classList.remove(c); });
            if (!isError && "shimmerStock" in img.dataset) {
                img.classList.add(img.dataset.inStock === "true" ? "opacity-100" : "opacity-75");
            } else {
                var ad = img.dataset[addKey];
                if (ad) ad.split(" ").filter(Boolean).forEach(function (c) { img.classList.add(c); });
            }
        }
        document.addEventListener("load", function (e) {
            if (e.target instanceof HTMLImageElement) settleEarly(e.target);
        }, true);
        document.addEventListener("error", function (e) {
            if (e.target instanceof HTMLImageElement) settleEarly(e.target);
        }, true);
    })();
</script>
```

Two deliberate divergences from the module's `settle()`, both required:

- **No error-fallback `src` swap.** The module sets
  `img.src = EL_CAMINO_LOGO_DATA_URI` on error; that constant lives in
  `src/lib/constants/assets.ts` and inlining it here would duplicate a large
  data URI into every page's HTML. The module still performs the swap when it
  runs. Broken images therefore lose their placeholder immediately but get
  their fallback graphic slightly later — strictly better than today, where
  both wait.
- **`var` and `function`, no optional chaining.** This script is not
  transpiled. Keep it ES5-compatible.

**Verify**: `pnpm check` → exit 0, 0 errors.

### Step 2: Make the module cooperate rather than double-settle

`src/scripts/imageShimmer.ts` already guards on `img.dataset.shimmerAttached`
at line 60, and the inline script sets that same flag — so an image settled
inline is correctly skipped by the module. Confirm this by reading `attach()`;
**no code change should be needed** in that function.

The one gap: an image the inline script settled as an **error** never gets its
fallback `src`. Extend `attach()` so that when it encounters an
already-attached image, it still applies the fallback if the image is broken
and no fallback has been applied yet. Add a distinct guard flag (e.g.
`data-shimmer-fallback-applied`) so this cannot loop — setting `img.src` fires
another `error` event.

**Verify**: `pnpm check` → exit 0. `pnpm test:run` → exit 0, all pass.

### Step 3: Verify in a browser against the dev server

Start `pnpm dev` and load `http://localhost:4321/`. In DevTools:

1. Network tab → throttle to **Slow 4G**, Performance tab → **4x CPU** slowdown.
2. Hard-reload with cache disabled.
3. Watch the article cards.

**Verify**, all three:
- No loader/skeleton graphic remains visible over any article image once that
  image has painted.
- `document.querySelectorAll('[id^="article-placeholder-"]').length` → `0`
  once the page has settled.
- Console shows **no CSP violation** for the new inline script. (If it does,
  the nonce is not being applied — see STOP conditions.)

Then navigate to another page and back using the site nav (exercises
`ClientRouter` / View Transitions) and re-run the `querySelectorAll` check →
still `0`. This confirms the module path still works for client-side nav.

### Step 4: Verify the post-paint path still works

Open a product page, add an item to the cart, and open the mini-cart. Its
images are injected after paint and are handled by the module's
`MutationObserver`, not the inline script.

**Verify**: mini-cart product thumbnails render with no stuck placeholder.

### Step 5: Full gate

**Verify**, all four exit 0:
```bash
pnpm check && pnpm lint && pnpm test:run && pnpm build
```

## Test plan

- The existing suite has no coverage of `imageShimmer.ts` (it is DOM-glue that
  runs only in a browser). This plan does not add unit tests for the inline
  script — it is inline HTML in an `.astro` file and is not importable.
- **If** you add the fallback-guard logic in Step 2 as an exported helper in
  `src/scripts/imageShimmer.ts`, add a Vitest case for it under
  `src/scripts/__tests__/` using happy-dom, modelled structurally on
  `src/lib/product/__tests__/pdpUI.test.ts` (real DOM, no mocking).
- Primary verification for this plan is the manual browser check in Steps 3–4.
  Record what you observed in the `plans/README.md` status row.
- Run `pnpm test:coverage` and confirm exit 0, no threshold regression.

## Done criteria

ALL must hold:

- [ ] `grep -n "shimmerPlaceholder" src/components/BaseHead.astro` returns at least one match
- [ ] The new script block in `BaseHead.astro` is `is:inline` and carries `nonce={nonce}`
- [ ] Step 3's browser check: zero `[id^="article-placeholder-"]` elements remain after load, at Slow 4G + 4x CPU
- [ ] Step 3's browser check: no CSP violation in console
- [ ] Step 3's client-side-nav re-check also yields zero remaining placeholders
- [ ] Step 4: mini-cart thumbnails render with no stuck placeholder
- [ ] `pnpm check` exits 0
- [ ] `pnpm lint` exits 0
- [ ] `pnpm test:run` exits 0, test count not lower than baseline
- [ ] `pnpm test:coverage` exits 0, no threshold regression
- [ ] `pnpm build` exits 0
- [ ] Only `src/components/BaseHead.astro` and `src/scripts/imageShimmer.ts` modified (`git status`)

## STOP conditions

Stop and report back (do not improvise) if:

- A **CSP violation** appears for the new inline script. Do not "fix" it by
  weakening `src/middleware.ts` — the nonce mechanism is the security control
  here. Report what the console said; the likely cause is a missing
  `nonce={nonce}` or `Astro.locals.nonce` not being set on that route.
- Placeholders now disappear **before** their image paints, producing a visible
  flash of empty card. That would mean the capture-phase delegation is firing
  on something other than the `<img>` — report it rather than adding timers.
- The mini-cart / QuickView post-paint images regress (Step 4 fails). The
  `MutationObserver` path must keep working; if the inline script has broken
  it, report rather than deleting the observer.
- You find yourself needing to edit `ArticleCard.astro` or any other component
  emitting `data-shimmer-*`. The attribute contract is fixed.
- Any verification fails twice after a reasonable fix attempt.

## Maintenance notes

- There are now **two** implementations of the settle logic: the inline one in
  `BaseHead.astro` and `settle()` in `src/scripts/imageShimmer.ts`. This
  duplication is intentional — the inline copy must not import anything — but
  it is a real drift hazard. **If the `data-shimmer-*` attribute contract
  changes, both copies must change together.** Note that in a comment on both.
- A reviewer should scrutinize: the `shimmerAttached` flag is set by the inline
  script *before* any DOM mutation, so the module can never double-settle; and
  the error path cannot loop on repeated `src` assignment.
- If a future change removes `ClientRouter` from `BaseHead.astro`,
  `astro:page-load` stops firing entirely and the module becomes dead — but the
  inline script keeps working, so images would still settle. Worth knowing.
- **Deliberately deferred**: consolidating the two copies behind a build-time
  macro or a shared inlined string. Not worth the machinery for ~30 lines.
