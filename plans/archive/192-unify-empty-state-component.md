# Plan 192: One shared `EmptyState` component; cart's empty state gets brought up to brand

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 426d14e..HEAD -- src/pages/cart.astro src/components/MiniCart.astro src/pages/shop/all.astro src/pages/news/index.astro "src/pages/news/tag/[slug].astro" src/components/Button.astro`
> On any change, compare against the excerpts below; on a mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none (plan 191 touches `ArticleGrid.astro`/`index.astro`, which this plan does not)
- **Category**: tech-debt (UX consistency)
- **Planned at**: commit `426d14e`, 2026-09-26

## Why this matters

A design audit found the app's empty states are inconsistent: Shop All has a
considered one (emoji/icon, display-font heading, subtext, CTA), the mini-cart
has an icon + text + ghost button, but the full **Cart page's** empty state is
one bare sentence and one outlined button — the flattest moment in an app whose
404 ("Bailed") and The Shop page have real brand voice. Each empty state is also
hand-copied markup with a 200-char button class string pasted inline. One
component fixes the inconsistency and stops the copy-paste.

## Current state

- `src/pages/cart.astro:22-28` — full-page empty state (toggled client-side via `#empty-cart` `hidden` class at lines ~1076-1092):

```astro
<div id="empty-cart" class="hidden">
  <div class="flex flex-col lg:min-h-[90dvh] items-center justify-center">
    <p class="text-lg mb-6 text-(--content-body)">Your cart is empty</p>
    <Button href="/shop/all" variant="outline"> Continue Shopping </Button>
  </div>
</div>
```

- `src/components/MiniCart.astro:90-103` — `#mini-cart-empty`: `<Icon name="uil:shopping-cart" class="w-16 h-16 …"/>`, `<p>Your cart is empty</p>`, `<Button id="continue-shopping" variant="ghost">`. The button has an `id` used by client JS — must be preserved.
- `src/pages/shop/all.astro:190-215` — canonical pattern (the design target): 6xl emoji at `opacity-20`, `<h2 class="text-2xl font-display font-bold text-(--content-heading) mb-2">`, `<p class="text-(--content-meta) mb-6 max-w-md mx-auto">`, then an `<a>` with a long pasted button class string (should be `<Button>` — see `src/components/Button.astro` for variants).
- `src/pages/news/index.astro` (~line 296) and `src/pages/news/tag/[slug].astro` have their own copies of the same pattern (📰 emoji block).
- `src/pages/404.astro` — brand voice reference ("Bailed"); read it for tone. Do not modify.
- `Icon` comes from `astro-icon` (`import { Icon } from 'astro-icon/components'`), used in MiniCart.
- Conventions: Tailwind v4 with semantic tokens via `text-(--content-heading)` syntax; props via `Astro.props` interface. Model the new component on a small existing one, e.g. `src/components/Tag.astro` or `Button.astro`.

## Commands you will need

| Purpose   | Command             | Expected      |
|-----------|---------------------|---------------|
| Typecheck | `pnpm check`        | 0 errors      |
| Lint      | `pnpm lint`         | exit 0        |
| Format    | `pnpm format:check` | exit 0        |
| Tests     | `pnpm test:run`     | all pass      |
| E2E (opt) | `pnpm exec playwright test e2e/mini-cart-accessibility.spec.ts` | pass (needs dev server) |

## Scope

**In scope**:
- `src/components/EmptyState.astro` (create)
- `src/pages/cart.astro` (only the `#empty-cart` block)
- `src/components/MiniCart.astro` (only the `#mini-cart-empty` block)
- `src/pages/shop/all.astro` (only the empty-state ternary branch)
- `src/pages/news/index.astro`, `src/pages/news/tag/[slug].astro` (only their empty-state blocks)
- `src/components/__tests__/EmptyState.test.ts` (create)

**Out of scope**:
- `src/components/ArticleGrid.astro`, `src/pages/index.astro` (plan 191 owns them; a follow-up swaps its inline markup to `EmptyState`)
- Any cart JS logic — visibility toggling by `#empty-cart` / `#mini-cart-empty` ids must keep working
- `RecentlyViewed.astro`, admin pages

## Git workflow

- Branch: `advisor/192-unify-empty-state`
- Commits: conventional (`feat: add shared EmptyState component`, `refactor: adopt EmptyState in cart/shop/news`)
- Do NOT push or open a PR.

## Steps

### Step 1: Create `EmptyState.astro`
Props: `heading: string`, `body?: string`, `icon?: string` (astro-icon name) **or** `emoji?: string` (mutually exclusive; if neither, render no glyph), `ctaLabel?: string`, `ctaHref?: string`, `ctaVariant?: 'primary'|'outline'|'ghost'` (check `Button.astro` for the real variant names and use those), `ctaId?: string`, `headingLevel?: 'h1'|'h2'|'h3'` (default `'h2'`), `class?: string`, `fill?: boolean` (when true adds `lg:min-h-[90dvh]` vertical centering as the cart page uses). Markup follows Shop All: decorative icon/emoji `aria-hidden="true"` at `opacity-20`, heading in display font, subtext in meta color capped `max-w-md`, CTA via existing `Button.astro` (check its props for `href`/`id`/`variant`). Wrapper `text-center py-16 flex flex-col items-center`.

**Verify**: `pnpm check` → 0 errors.

### Step 2: Adopt in Cart page
Replace the inner content of `#empty-cart` (keep the outer `<div id="empty-cart" class="hidden">` so client JS still toggles it). Use `fill`, emoji `🛹`, heading "Your cart's empty", body "Nothing rolling yet — grab a deck, some wheels, or a fresh tee.", CTA "Continue Shopping" → `/shop/all` using Button's primary variant (this is the page's only action). Keep tone consistent with `404.astro`.

**Verify**: `pnpm dev`, open `/cart` with empty localStorage → new empty state renders; `grep -n 'id="empty-cart"' src/pages/cart.astro` → still present.

### Step 3: Adopt in MiniCart
Replace contents of `#mini-cart-empty` with `<EmptyState icon="uil:shopping-cart" heading="Your cart is empty" ctaLabel="Continue Shopping" ctaId="continue-shopping" ctaVariant="ghost" headingLevel="h3" … />`. The `id="continue-shopping"` MUST remain on the button and the wrapper `id="mini-cart-empty"` + its classes (`hidden`, bg) MUST remain.

**Verify**: `grep -rn "continue-shopping" src/` shows the id in the rendered output path and its JS consumer unchanged; `pnpm exec playwright test e2e/mini-cart-accessibility.spec.ts` passes (if dev env available).

### Step 4: Adopt in Shop All + News + News tag
Replace each hand-rolled block with `EmptyState`, preserving existing copy/conditions (Shop All: filters vs no-products variants, "Clear Filters"/"Go Home" CTAs). Shop All should now use `Button` via the component instead of pasted class strings.

**Verify**: `grep -n "font-sans font-semibold text-sm text-center lg:text-base" src/pages/shop/all.astro` → no matches (pasted class string gone); `pnpm check` → 0 errors.

### Step 5: Test
`src/components/__tests__/EmptyState.test.ts` via `AstroContainer` (see `src/components/__tests__/cardEntrance.test.ts` for setup style; if `AstroContainer` proves unworkable, STOP). Cases: renders heading; renders CTA link with href; icon/emoji are `aria-hidden`; no CTA when `ctaLabel` omitted; passes through `ctaId`.

**Verify**: `pnpm test:run src/components/__tests__/EmptyState.test.ts` → all pass.

## Test plan
Step 5 plus manual visual pass of `/cart` (empty), mini-cart open with empty cart, `/shop/all?…` with an impossible filter, `/news` with a search that matches nothing — desktop and 390px wide, light and dark theme.

## Done criteria

- [ ] `pnpm check`, `pnpm lint`, `pnpm format:check`, `pnpm test:run`, `pnpm test:coverage` all exit 0
- [ ] `grep -rln "components/EmptyState" src/pages src/components | wc -l` ≥ 5
- [ ] `id="empty-cart"`, `id="mini-cart-empty"`, `id="continue-shopping"` all still present
- [ ] `git status` shows only in-scope files changed
- [ ] `plans/README.md` status row updated

## STOP conditions

- `Button.astro` can't express the needed variants/`id`/`href` without modification (out of scope) — report what's missing.
- Cart or mini-cart client JS depends on DOM structure *inside* the empty blocks (e.g. queries a child by class) — grep `cart.astro`/`MiniCart.astro`/`src/lib` for selectors before replacing; if found, stop.
- Drift check mismatch.

## Maintenance notes

- Follow-up (not in this plan): replace the inline no-posts markup that plan 191 adds to `ArticleGrid.astro` with `EmptyState`.
- Any new empty state in the app should use this component; mention in a code comment at the top of `EmptyState.astro`.
- Reviewer: check the cart page's `lg:min-h-[90dvh]` behavior matches before/after (no layout jump when cart hydrates).
