# Plan 148: Start the card entrance animation when its image is ready, not at CSS parse time

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat ad2999d..HEAD -- src/components/ArticleGrid.astro src/components/ArticleCard.astro src/styles/global.css`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: 147 (soft — see Dependency notes)
- **Category**: perf
- **Planned at**: commit `ad2999d`, 2026-09-05

## Why this matters

The shop owner's report is precise: *"the animations run fine if the page has
already loaded or is cached, but the initial page load is always choppy."*
This plan fixes the mechanism behind exactly that.

The homepage masonry cards animate in via a pure-CSS entrance animation. A CSS
animation's clock starts when the element's style is first resolved — i.e. at
first render — **not** when the card's content is ready. Measured on a Chrome
DevTools trace of production at Slow 4G + 4x CPU throttling:

- First render (and therefore animation start): ~830 ms
- Last card's entrance animation finishes: ~1780 ms
- The featured card's LCP image finishes downloading: **1265 ms**

So the cards fade and scale in while empty, and the images land *during and
after* the animation, popping into already-settled boxes. On a warm cache the
images are available instantly, animation and content coincide, and it looks
correct — which is why the defect is invisible on every load except the one
that matters.

After this plan, a card's entrance animation begins when its image is ready
(or after a short bounded timeout), so the animation always carries content.

## Current state

### The animation, keyed to parse time

`src/components/ArticleGrid.astro:249-264`:

```css
  /* Non-featured cards: staggered entrance, offset by 200ms so the header
     animation (0.2s delay) leads before secondary cards begin appearing.
     The featured card (card-entrance-ready) is excluded from this offset
     so it starts immediately — it's the LCP element and must not be delayed. */
  .article-grid .article-card-wrapper {
    animation: cardEntrance var(--card-transition-duration, 0.5s) ease-out both;
    animation-delay: calc(200ms + var(--animation-order, 0) * var(--card-stagger-delay));
  }

  /* Featured card: starts immediately — LCP-critical, no offset applied */
  .article-grid .article-card-wrapper.card-entrance-ready {
    animation: cardEntranceFeatured var(--card-entrance-priority-duration, 800ms) ease-out both;
    animation-delay: 0s;
  }
```

Timing variables, `src/styles/global.css:440-465` (three responsive tiers):

```css
  --card-transition-duration: 0.5s;
  --card-entrance-priority-duration: 0.75s;
  --card-stagger-delay: 50ms;
```

The keyframes, `src/components/ArticleGrid.astro:184-211`, deliberately start
at `opacity: 0.001` rather than `0`:

```css
  @keyframes cardEntrance {
    from {
      opacity: 0.001;
      transform: scale(0.95) translate3d(0, 10px, 0);
    }
    to {
      opacity: 1;
      transform: scale(1) translate3d(0, 0, 0);
    }
  }
```

The header comment above them explains why, and **that constraint is
load-bearing**: Chrome's LCP algorithm excludes `opacity: 0` elements from
candidacy, so a true `0` produces a `NO_LCP` error in Lighthouse. Preserve
`0.001`.

### Where the classes come from

`src/components/ArticleCard.astro:279`:

```astro
  class={`${getCardClasses()} ${shouldAnimate ? `article-card-wrapper${featured ? " card-entrance-ready" : ""}` : ""}`}
```

`src/components/ArticleGrid.astro:151` sets the stagger index:

```astro
                style={`--animation-order: ${index};`}
```

### The reduced-motion branch — must be preserved

`src/components/ArticleGrid.astro:266-272`:

```css
  @media (prefers-reduced-motion: reduce) {
    .article-grid .article-card-wrapper,
    .article-grid .article-card-wrapper.card-entrance-ready {
      animation: none;
      opacity: 1;
      transform: none;
    }
  }
```

### The image-readiness signal that already exists

Every card image carries `data-shimmer-load-add="loaded"`
(`src/components/ArticleCard.astro:335`), so a `loaded` class lands on the
`<img>` when it settles. Plan 147 makes that happen early and inline; without
147 it still happens, just late. This plan uses the image's own `load`/
`complete` state directly rather than depending on that class, so it is
correct either way — but it delivers its full benefit only once 147 has landed.

### Repo conventions

- Astro 7 SSR, TypeScript, Tailwind v4.
- Component-scoped `<style>` blocks live inside the `.astro` file; global
  animation timing variables live in `src/styles/global.css`.
- Nonce-based CSP: inline scripts must be `is:inline` **and** carry
  `nonce={Astro.locals.nonce}`. Exemplar: `src/components/BaseHead.astro:24-25`.
  Astro's compiled (hoisted, non-inline) `<script>` blocks are fine as-is —
  `src/components/ArticleGrid.astro` already has one at line ~290.

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
- `src/components/ArticleGrid.astro` (the masonry `<style>` block and its script)
- `src/components/ArticleCard.astro` (only if a class hook must be added)

**Out of scope** (do NOT touch):
- The `@keyframes` definitions themselves, including the `opacity: 0.001`
  start values. They are correct and load-bearing for LCP candidacy.
- The **filterable** grid path — `.article-card-wrapper.opacity-0` /
  `.opacity-100` at `src/components/ArticleGrid.astro:221-247`. That is the
  news-page grid, JS/transition-driven, and already gated on JS. It is a
  different code path with a different trigger; changing it is out of scope.
- `src/styles/global.css` timing variables (`--card-transition-duration`,
  `--card-stagger-delay`, `--card-entrance-priority-duration`). Durations are
  fine; only the *trigger* is wrong.
- `.article-grid`'s `grid-cols-1` (`getContainerClasses()`,
  `src/components/ArticleGrid.astro:72`). That is plan 123's merged CLS fix.
  **Do not remove or reorder it.**
- `src/components/Header.astro`'s `fadeInHeader` animation. Separate concern.
- Image URL generation and `sizes` attributes — plans 146, 150, 151 own those.

## Git workflow

- Branch: `advisor/148-gate-card-entrance-on-image-readiness`
- Conventional commits, e.g.
  `fix(perf): start card entrance animation on image readiness instead of parse time`
- Do NOT push or open a PR unless the operator instructs it.

## Steps

### Step 1: Pause the entrance animation until a card is marked ready

In `src/components/ArticleGrid.astro`'s masonry `<style is:global>` block,
change the trigger — not the keyframes, not the durations.

Add `animation-play-state: paused` to both masonry rules at lines 255-264, and
a rule that resumes it when the wrapper carries a new `entrance-armed` class:

```css
  /* The entrance animation is paused until JS marks the card armed (its image
     is ready, or a bounded timeout elapsed). A CSS animation's clock otherwise
     starts at first style resolution, so on a cold load the cards animated in
     empty and the images popped in afterwards. `both` fill-mode holds the
     `from` keyframe while paused, so a paused card is invisible-but-LCP-eligible
     (opacity 0.001), exactly as before. */
  .article-grid .article-card-wrapper {
    animation: cardEntrance var(--card-transition-duration, 0.5s) ease-out both;
    animation-delay: calc(200ms + var(--animation-order, 0) * var(--card-stagger-delay));
    animation-play-state: paused;
  }

  .article-grid .article-card-wrapper.card-entrance-ready {
    animation: cardEntranceFeatured var(--card-entrance-priority-duration, 800ms) ease-out both;
    animation-delay: 0s;
    animation-play-state: paused;
  }

  .article-grid .article-card-wrapper.entrance-armed {
    animation-play-state: running;
  }
```

**Critical**: add a no-JS fallback so the cards can never be permanently
invisible if JavaScript fails to run. Immediately after the rules above:

```css
  /* If JS never arms the cards (script error, JS disabled), reveal them.
     Without this, a paused `both`-filled animation would hold opacity 0.001
     forever and the page would look empty. */
  @media (scripting: none) {
    .article-grid .article-card-wrapper {
      animation: none;
      opacity: 1;
      transform: none;
    }
  }
```

Leave the existing `prefers-reduced-motion` block at lines 266-272 exactly as
it is — `animation: none` there already wins over `animation-play-state`.

**Verify**: `pnpm check` → exit 0.

### Step 2: Arm each card when its image is ready

In `src/components/ArticleGrid.astro`'s existing `<script>` block, add logic
that runs on `astro:page-load` (matching the file's existing convention — see
the listener already in that block) and, for each `.article-grid
.article-card-wrapper`:

1. Find its `<img>` (`wrapper.querySelector("img")`).
2. If there is no image, arm the wrapper immediately.
3. If `img.complete` is true, arm immediately.
4. Otherwise arm on the image's `load` **or** `error`, whichever fires first
   (`{ once: true }` on both).
5. **Always** also arm on a bounded timeout, so a hung image can never strand a
   card. Use **1200 ms**, measured from when the script runs.

"Arm" means `wrapper.classList.add("entrance-armed")`, guarded so it happens at
most once per wrapper.

Additionally, add a **belt-and-braces safety net** that does not depend on this
script's own success: an `is:inline` nonce-carrying script that arms every
wrapper after 2500 ms unconditionally. Put it in
`src/components/ArticleGrid.astro`'s markup. This exists so that a bundling or
CSP failure in the hoisted script cannot leave the homepage visually blank.

**Verify**: `pnpm check` → exit 0. `pnpm lint` → exit 0.

### Step 3: Preserve the stagger relationship

The non-featured cards carry `animation-delay: calc(200ms + order * stagger)`.
Because the animation is now paused until armed, and each card arms
independently when *its own* image is ready, that delay now runs from each
card's arm point.

Decide and implement one of these, and **write which one you chose and why in
the `plans/README.md` status row**:

- **(a) Keep per-card arming** (recommended). Cards appear as their images
  arrive — naturally staggered by network order. Reduce the base offset in the
  `animation-delay` from `200ms` to `0ms` for the non-featured rule, since the
  stagger is now provided by arrival order rather than a fixed offset. Keep the
  `var(--animation-order) * var(--card-stagger-delay)` term.
- **(b) Arm the whole grid at once** when the *featured* image is ready (or the
  timeout fires), leaving the existing `animation-delay` stagger to sequence
  them. More faithful to the current choreography, less responsive to slow
  trailing images.

Do not implement both. Do not add a config flag.

**Verify**: `pnpm check` → exit 0.

### Step 4: Verify in a browser against the dev server

Start `pnpm dev`, open `http://localhost:4321/`. In DevTools:

1. Network → **Slow 4G**; Performance → **4x CPU** slowdown.
2. Hard-reload with cache disabled.
3. Record a Performance trace across the load.

**Verify**, all of:
- Cards visibly animate in **carrying their images**, not as empty boxes
  followed by a separate image pop.
- No card remains at low opacity once the page has settled:
  `[...document.querySelectorAll('.article-grid .article-card-wrapper')].filter(el => +getComputedStyle(el).opacity < 0.99).length`
  → `0`.
- CLS in the trace is **not worse** than the pre-change baseline. Record both
  numbers. Baseline on production at this throttle was **0.07**.
- Console shows no CSP violation.

Then, in DevTools Rendering, enable **Emulate CSS prefers-reduced-motion:
reduce**, hard-reload, and confirm cards appear immediately with no animation.

Then set the Network throttle to **Offline** *after* the HTML has loaded but
before images finish (or block the image URLs via request blocking) and confirm
the cards still become visible within ~2.5 s. This exercises the timeout path.

### Step 5: Full gate

**Verify**, all four exit 0:
```bash
pnpm check && pnpm lint && pnpm test:run && pnpm build
```

## Test plan

- Add a Vitest suite at `src/components/__tests__/cardEntrance.test.ts` **only
  if** you extract the arming logic into an importable helper (recommended:
  export an `armCardsOnImageReady(root: ParentNode, timeoutMs: number)` from a
  new `src/lib/ui/cardEntrance.ts` and call it from the component script).
  Cases to cover:
  - wrapper with no `<img>` → armed synchronously
  - wrapper whose `img.complete` is already `true` → armed synchronously
  - wrapper whose image fires `load` → armed
  - wrapper whose image fires `error` → armed
  - wrapper whose image never settles → armed after the timeout (use
    `vi.useFakeTimers()`)
  - arming is idempotent (class added once)
- Use real happy-dom DOM with no mocking, modelled structurally on
  `src/lib/product/__tests__/pdpUI.test.ts`.
- If you keep the logic inline in the `.astro` file instead, say so in the
  status row and rely on Step 4's browser verification.
- Run `pnpm test:coverage` → exit 0, no threshold regression.

## Done criteria

ALL must hold:

- [ ] `grep -n "animation-play-state" src/components/ArticleGrid.astro` returns the paused + running rules
- [ ] `grep -n "entrance-armed" src/components/ArticleGrid.astro` returns both the CSS rule and the JS that adds it
- [ ] `grep -n "scripting: none" src/components/ArticleGrid.astro` returns the no-JS fallback
- [ ] The `prefers-reduced-motion` block at `ArticleGrid.astro:266-272` is unchanged
- [ ] The `@keyframes` `opacity: 0.001` start values are unchanged
- [ ] `grep -n "grid-cols-1" src/components/ArticleGrid.astro` still returns plan 123's fix
- [ ] Step 4 browser check: cards animate carrying images; zero cards below opacity 0.99 after settle
- [ ] Step 4: CLS not worse than the 0.07 baseline (both numbers recorded in the status row)
- [ ] Step 4: reduced-motion path shows cards immediately, no animation
- [ ] Step 4: blocked-image path still reveals cards within ~2.5 s
- [ ] Step 3's choice (a) or (b) recorded in `plans/README.md`
- [ ] `pnpm check` / `pnpm lint` / `pnpm test:run` / `pnpm build` all exit 0
- [ ] `pnpm test:coverage` exits 0, no threshold regression
- [ ] Only in-scope files modified (`git status`)

## STOP conditions

Stop and report back (do not improvise) if:

- **Any card can end up permanently invisible** in any path you test. This is
  the primary risk of this plan — a paused, `both`-filled animation holds
  `opacity: 0.001` indefinitely. If the fallbacks in Steps 1 and 2 do not fully
  close this, report rather than shipping.
- **CLS gets worse.** Plan 123 already fixed an intermittent masonry CLS by
  adding `grid-cols-1`; if delaying the entrance re-introduces shift, the
  interaction needs thought, not a nudge. Report both trace numbers.
- **Lighthouse starts reporting `NO_LCP`** or the LCP element changes identity.
  The `opacity: 0.001` convention exists precisely to prevent this; if pausing
  the animation defeats LCP candidacy, that is a real finding — report it.
- The reduced-motion path regresses.
- You find you need to edit the `@keyframes`, `src/styles/global.css`, or the
  filterable-grid path to make this work.
- Any verification fails twice after a reasonable fix attempt.

## Maintenance notes

- **The invariant to protect forever**: a card wrapper must always end up
  visible, on every path — image loads, image errors, image never resolves, JS
  fails to run, JS runs but throws, reduced-motion. There are now four
  independent guarantees (per-image arm, 1200 ms per-card timeout, 2500 ms
  inline sweep, `@media (scripting: none)`). A future refactor that removes any
  of them should replace it, not just delete it.
- A reviewer should scrutinize: that `prefers-reduced-motion` still wins
  (`animation: none` beats `animation-play-state`), and that the `opacity: 0.001`
  keyframe values survived untouched.
- This interacts with plan 147: once placeholders settle early, the perceived
  effect of this change is much stronger. If 148 lands first, expect a smaller
  visible improvement until 147 also lands.
- If the homepage ever renders more than ~6 cards above the fold, revisit the
  stagger math — `order * 50ms` grows linearly and a 12th card would arm very
  late under option (b).
- **Deliberately deferred**: applying the same treatment to the news-page
  filterable grid. It is already JS-gated and does not exhibit the bug.
