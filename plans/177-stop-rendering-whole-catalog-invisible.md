# Plan 177: Stop server-rendering the whole catalog into a grid that is invisible until JS runs

> **Executor instructions**: Follow step by step. Run every verification command
> and confirm the expected result. If anything in "STOP conditions" occurs, stop
> and report. When done, update this plan's status row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat ad2999d..HEAD -- src/components/ProductGrid.astro src/pages/category/[...slug].astro src/pages/shop/all.astro`
> On any change, compare against the excerpts below; on a mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: 148 (soft — same defect class, different page)
- **Category**: perf
- **Planned at**: commit `ad2999d`, 2026-09-05

## Why this matters

`ProductGrid` renders a full `<article>` card for **every** product — each with a
`<picture>` and multi-format `srcset` — then uses `initialCardsToShow = 16` only
to add a *hiding class* to the rest. Category pages pass up to 200 products;
`/shop/all` passes the entire catalog.

Two compounding costs:

1. **Transfer and parse.** Hundreds of image-bearing cards are sent and parsed so
   sixteen can be shown.
2. **Perceived jank.** Every card ships as `class="product-card-wrapper grid
   opacity-0"` and is only revealed by a hoisted module script. The whole grid is
   invisible in the initial paint, so the page renders blank and then pops once
   the module graph settles — and it delays the LCP candidate.

That second cost is **the same defect as plan 148** (card entrance keyed to JS
rather than content) on a different page. Plan 148 fixed the homepage masonry
grid; this is the shop/category equivalent. Read 148 before starting — its
approach and its four-guarantee visibility invariant apply here too.

## Current state

`src/components/ProductGrid.astro:28-32`:

```astro
// Server-side: which cards should be filter-hidden vs scroll-hidden
const filteredIdSet = filteredIds ? new Set(filteredIds) : null;
const initialCardsToShow = 16;

let productsWithInventory: ProductWithInventory[] = initialProducts;
```

`src/components/ProductGrid.astro:162-172` — every product rendered, hidden by class:

```astro
        filteredIdSet !== null && !filteredIdSet.has(product.id);
      const isScrollHidden =
        filteredIdSet === null && index >= initialCardsToShow;
      const shouldHide = isFilterHidden || isScrollHidden;

      return (
        <article
          role="article"
          class="product-card-wrapper grid opacity-0"
          aria-labelledby={`product-title-${product.id}`}
```

Note `opacity-0` is unconditional — even the sixteen visible cards start hidden
and depend on JS.

The reveal happens in the component's hoisted script (around `:338-352` and
`:501-526`). `src/components/ProductGrid.astro` is 1,011 lines, most of it that
script — which is outside `vitest.config.ts`'s coverage include (plan 181).

## The two halves — you may do only the first

**Half A (recommended, lower risk): make the reveal CSS-only.** Stop depending on
JS for initial visibility. The sixteen initial cards render visible; hidden ones
are hidden by a server-rendered class, not by JS. This fixes the blank-then-pop
and the LCP delay, and it is largely independent of infinite scroll and filtering.

**Half B (higher risk): stop rendering all products server-side.** Render the
initial batch and fetch subsequent batches from an API route. This is where the
transfer saving is — but infinite scroll, filtering, and the view-transition
animations all key off the pre-rendered DOM, so it touches all three.

**Do Half A first and verify it independently.** Only attempt Half B in the same
change if Half A goes cleanly and Step 1's measurements justify it. Splitting is
fine and expected — say which you did in the status row.

## Commands you will need

| Purpose   | Command                                | Expected             |
|-----------|----------------------------------------|----------------------|
| Typecheck | `pnpm check`                           | exit 0               |
| Tests     | `pnpm test:run`                        | exit 0               |
| Coverage  | `pnpm test:coverage`                   | exit 0, no regression|
| Lint      | `pnpm lint`                            | exit 0               |
| Build     | `pnpm build`                           | exit 0               |
| E2E       | `pnpm test:e2e:chromium`               | see Steps            |
| Dev server| `pnpm dev`                             | serves on :4321      |

Never use `pnpm test` — watch mode, it hangs.

## Scope

**In scope**:
- `src/components/ProductGrid.astro`
- For Half B only: a new API route under `src/pages/api/`, and the category /
  shop pages that pass `products`

**Out of scope** (do NOT touch):
- `src/components/ArticleGrid.astro` — plan 148 owns it.
- `src/components/ProductCard.astro` internals.
- The filter logic in `src/lib/square/filterUtils.ts`.
- `Netlify-Vary` on category pages — plan 155.
- The `s-max-age` typo on shop routes — plan 154.

## Git workflow

- Branch: `advisor/177-stop-rendering-whole-catalog-invisible`
- Conventional commits, e.g. `perf: make product grid visible without JS`
- Do NOT push or open a PR unless the operator instructs it.

## Steps

### Step 1: Measure the baseline

With `pnpm dev`, on a category page with many products and on `/shop/all`, record:

- HTML transfer size
- number of `<article>` elements rendered
- First Contentful Paint and LCP at **Slow 4G + 4x CPU**
- the gap between HTML parse completing and cards becoming visible

**Verify**: all recorded for both pages. The last number is the one Half A fixes.

### Step 2 (Half A): Make initial visibility CSS-only

Remove the unconditional `opacity-0`. Cards that should be visible render
visible; cards hidden by filter or by the scroll threshold get a server-rendered
hiding class.

Keep any entrance animation, but follow plan 148's pattern: it must never be able
to leave a card permanently invisible. Include a `@media (scripting: none)`
fallback and honor `prefers-reduced-motion`.

**Verify**:
```bash
grep -n "opacity-0" src/components/ProductGrid.astro
```
→ no unconditional `opacity-0` on the wrapper.

### Step 3 (Half A): Verify visibility on every path

With `pnpm dev`, Slow 4G + 4x CPU, cache disabled:

- cards are visible in the **initial paint**, before the module script runs
- with **JavaScript disabled**, the first 16 cards are visible
- with `prefers-reduced-motion: reduce`, cards appear immediately
- infinite scroll still reveals more cards
- filtering still hides and shows correctly
- no card is left invisible after any interaction:
  `[...document.querySelectorAll('.product-card-wrapper')].filter(el => +getComputedStyle(el).opacity < 0.99 && !el.classList.contains('<your-hidden-class>')).length` → `0`

**Verify**: every one confirmed. Record LCP before/after.

### Step 4 (Half B, optional): Paginate the server render

Only if Step 1 justifies it. Render the initial batch; add an API route for
subsequent batches; update the infinite-scroll script to fetch rather than unhide.

Filtering must keep working — decide whether filtering happens server-side or the
client requests a filtered batch, and write down which.

**Verify**: `pnpm test:e2e:chromium` passes (note: the e2e job is currently
broken — **plan 158** fixes it. If it has not landed, verify manually and say so).

### Step 5: Full gate

```bash
pnpm check && pnpm lint && pnpm test:run && pnpm build
```
→ all exit 0.

## Test plan

- `ProductGrid.astro`'s logic is inline script, outside the coverage include
  (plan 181), so unit tests are limited.
- **If you extract the visibility/reveal logic** into `src/lib/ui/` (recommended),
  test it there with happy-dom, modelled on `src/lib/product/__tests__/pdpUI.test.ts`:
  initial-batch visibility, filter hide/show, scroll reveal, idempotent reveal.
- For Half B, add tests for the batch API route, modelled on the existing
  `src/pages/api/__tests__/` suites.
- Primary verification is Step 3's browser checks. Record them.

## Done criteria

- [ ] Step 1's baseline measurements recorded in `plans/README.md`
- [ ] Which half(s) you did, recorded
- [ ] No unconditional `opacity-0` on the product card wrapper
- [ ] Cards visible in the initial paint at Slow 4G + 4x CPU
- [ ] Cards visible with **JavaScript disabled**
- [ ] Reduced-motion path shows cards immediately
- [ ] Infinite scroll and filtering both still work
- [ ] Zero unintentionally-invisible cards after interaction
- [ ] LCP before/after recorded
- [ ] `pnpm check` / `pnpm lint` / `pnpm test:run` / `pnpm build` all exit 0

## STOP conditions

Stop and report if:

- **Any card can end up permanently invisible.** Same primary risk as plan 148 —
  and here it would hide products, i.e. hide the things being sold.
- Filtering or infinite scroll regresses in a way that is not obviously fixable.
  Half A should not affect them; if it does, you have found a hidden coupling —
  report it.
- CLS gets worse. Cards becoming visible earlier changes layout timing; measure
  before and after.
- Half B's batch API would need to duplicate the filter logic. That is a design
  decision about where filtering lives — report rather than duplicating.

## Maintenance notes

- **The invariant** (shared with plan 148): server-rendered content must be
  visible without JavaScript. JS may *enhance* — animate, lazy-load, reveal more —
  but must never be required for the initial content to appear.
- This is the second instance of this defect class found in one audit
  (`ArticleGrid` was the first). If a third grid is added, check it before merge.
- `ProductGrid.astro` is 1,011 lines, mostly inline script. Plan 181 covers
  extracting these blocks so they can be tested at all — worth coordinating if
  both are in flight.
- A reviewer should test with JS disabled. That single check catches the whole
  defect class.
