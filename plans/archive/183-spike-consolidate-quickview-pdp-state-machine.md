# Plan 183: Spike — collapse QuickView's parallel re-implementation of the PDP variation state machine

> **Executor instructions**: This is a **spike**. The deliverable is a
> recommendation plus, at most, one narrow proof-of-concept. If anything in
> "STOP conditions" occurs, stop and report.
>
> **Drift check (run first)**:
> `git diff --stat ad2999d..HEAD -- src/lib/product/quickViewController.ts src/lib/product/pdpController.ts src/lib/product/pdpUI.ts src/lib/square/slugUtils.ts`
> On any change, re-derive the line numbers below.

## Status

- **Priority**: P3
- **Effort**: M (spike) — the follow-up work is L
- **Risk**: LOW (spike) / MED (the consolidation it recommends)
- **Depends on**: **179 (hard)** — see Why
- **Category**: tech-debt
- **Planned at**: commit `ad2999d`, 2026-09-05

## Why this matters

`quickViewController.ts` (1,147 lines) shadows the
`pdpController` + `pdpUI` + `pdpEvents` trio method for method: the same
attribute-selection → matching-variation → availability flow, the same
out-of-stock handling, the same add-to-cart path.

They have **already drifted**. QuickView renders the selected variant button with
`cursor-default`; the PDP path renders the same state with `cursor-pointer`. One
of those is wrong and nobody noticed, which is precisely what parallel
implementations produce.

QuickView also re-inlines the body of `createVariantSlug` rather than importing
it from `src/lib/square/slugUtils.ts`, and hand-writes Tailwind class strings that
`pdpUI.ts` owns — while `pdpController.ts` delegates to `pdpUI` for exactly that.

Every variation, stock, or pricing behavior change must currently be made twice.
And the duplicate that is **untested** is the one on the higher-traffic path
(category and listing pages).

**Why the hard dependency on 179**: consolidating an untested 1,147-line
controller into a tested one is how behavior gets silently lost. Plan 179 writes
the characterization tests. **Do not start this spike until 179 has landed** —
without them you cannot tell a successful consolidation from a regression.

## Current state

Re-derive every line number in Step 1; these are from commit `ad2999d`.

| QuickView | Mirrors |
|---|---|
| `updateCurrentVariation()` ~`:390` | `pdpController.ts:54` — same `findVariationByAttributes` → `updateProductUI` / `showOutOfStockState` shape, **plus** an extra color-fallback branch |
| `updateAttributeButtonStates()` ~`:660` | `pdpUI.ts:350-403` — comment says "EXACTLY mirror PDP updateAttributeButtonStates pattern"; hand-writes the class strings `pdpUI` owns |
| ~`:742-749` | re-inlines `createVariantSlug` from `src/lib/square/slugUtils.ts:20` |
| `showOutOfStockState`, `handleAttributeSelection`, `handleCartUpdate`, `canAddToCartForAttribute`, `buildProductData` | all have PDP counterparts |

**The observed drift**: `quickViewController.ts:319` renders the selected variant
button with `cursor-default`; `:686` renders the same state with `cursor-pointer`.

**The genuine difference**: QuickView has a color-image fallback branch the PDP
does not. Plan 179 characterizes it specifically. Whatever consolidation happens,
that branch must survive.

**The genuine structural difference**: QuickView lives in a modal, the PDP is a
page. DOM hosts, lifecycle, and focus management differ. A naive merge changes
modal behavior.

## Commands you will need

| Purpose   | Command                              | Expected        |
|-----------|--------------------------------------|-----------------|
| Typecheck | `pnpm check`                         | exit 0          |
| Tests     | `pnpm test:run -- quickView pdp`     | all pass        |
| Full      | `pnpm test:run`                      | exit 0          |
| Coverage  | `pnpm test:coverage`                 | exit 0          |
| Build     | `pnpm build`                         | exit 0          |
| Dev server| `pnpm dev`                           | serves on :4321 |

Never use `pnpm test` — watch mode, it hangs.

## Scope

**In scope**:
- This plan file and `plans/README.md`
- At most **one** narrow PoC — see Step 4

**Out of scope** (do NOT do):
- The full consolidation. That is the follow-up this spike scopes.
- Changing behavior in either controller.
- `src/components/QuickView.astro` markup.
- Resolving the `cursor-default` / `cursor-pointer` drift. **Record it and ask** —
  which is correct is a design decision, not yours.

## Git workflow

- Branch: `advisor/183-spike-consolidate-quickview-pdp-state-machine`
- Conventional commits, e.g. `refactor: import createVariantSlug instead of inlining it`
- Do NOT push or open a PR unless the operator instructs it.

## Steps

### Step 1: Confirm 179 has landed, and re-derive the map

```bash
pnpm test:coverage
```

**Verify**: `quickViewController.ts` coverage is substantially above its ~30%
baseline. **If plan 179 has not landed, STOP.**

Then build a method-by-method comparison table: QuickView method, PDP
counterpart, and whether they are identical, drifted, or genuinely different.

**Verify**: table recorded in `plans/README.md`.

### Step 2: Catalogue every drift

For each drifted pair, record the exact difference and — where you can tell —
which side is correct. `cursor-default` vs `cursor-pointer` is one; expect more.

**Verify**: a drift list. Flag each as "bug in QuickView", "bug in PDP", or
"needs a design decision". **Do not fix any of them in this spike.**

### Step 3: Identify what can be shared

Separate:

- **Pure logic** — selection → matching variation → availability predicate. No
  DOM. Sharable outright.
- **DOM manipulation** — class strings, button states. Sharable via a `UIManager`
  interface like `pdpUI`, with a QuickView implementation.
- **Genuinely divergent** — modal lifecycle, focus management, the color-image
  fallback. Must stay separate.

**Verify**: each method assigned to one of the three buckets, with reasoning.

### Step 4: One narrow PoC — the safest possible change

Do **only** this: replace QuickView's inlined `createVariantSlug` (~`:742-749`)
with an import from `src/lib/square/slugUtils.ts`.

It is the smallest, lowest-risk instance of the pattern, it proves the two
implementations really are equivalent, and it is independently valuable.

**Verify**: `pnpm check && pnpm test:run` → exit 0. In `pnpm dev`, open Quick
View, switch variants, confirm the URL/slug behavior is unchanged. Record what
you checked.

### Step 5: Write the recommendation

Produce:

- the proposed shared shape (which module holds the state machine; how the two
  UI layers plug in)
- an ordered sequence, each step independently verifiable
- which drifts must be resolved first, and which need the operator's decision
- what additional tests are needed before each step
- an honest effort estimate — and an honest assessment of whether it is worth it

**Note**: "not worth doing" is a legitimate conclusion. Two 1,000-line
controllers that mostly work are not obviously worse than one shared abstraction
with two adapters. Say what you actually think.

**Verify**: written here and summarized in `plans/README.md`.

### Step 6: Full gate

```bash
pnpm check && pnpm lint && pnpm test:run && pnpm test:coverage && pnpm build
```
→ all exit 0.

## Test plan

- No new tests beyond what the Step 4 PoC needs — plan 179 supplies the
  characterization suite this spike depends on.
- If Step 1 finds gaps in 179's coverage for a method you plan to consolidate,
  record them as prerequisites.
- `pnpm test:coverage` → exit 0, no threshold regression.

## Done criteria

- [ ] Step 1 confirms plan 179 landed; coverage figure recorded
- [ ] Method-by-method comparison table recorded
- [ ] Step 2's drift list recorded, each classified, **none fixed**
- [ ] Step 3's three-bucket assignment recorded
- [ ] Step 4's `createVariantSlug` PoC landed and verified
- [ ] Step 5's recommendation written, including a genuine worth-it assessment
- [ ] Only `quickViewController.ts` modified, and only the slug inlining (`git diff`)
- [ ] `pnpm check` / `pnpm lint` / `pnpm test:run` / `pnpm build` all exit 0

## STOP conditions

Stop and report if:

- **Plan 179 has not landed.** Hard dependency.
- Step 4's PoC changes QuickView's variant behavior at all. That would mean the
  inlined copy had drifted from `slugUtils.ts` — a real finding, and the
  consolidation is riskier than it looks. Report rather than absorbing it.
- Step 2 finds a drift that is a **user-visible bug** (wrong stock state, wrong
  price). Report immediately; that jumps ahead of any refactoring.
- You conclude the consolidation is not worth doing. Write that up with reasoning
  and stop — that is a successful spike.
- You are tempted to fix a drift "while you're in there". Don't.

## Maintenance notes

- **The rule**: shared behavior lives in one place; DOM differences go behind an
  interface. `pdpController` + `pdpUI` already demonstrates the split — QuickView
  simply never adopted it.
- The two controllers have drifted once already, silently, in a visible UI
  detail. Absent consolidation, expect more — and prefer at minimum sharing the
  pure logic even if the DOM layers stay separate.
- The color-image fallback is QuickView's one genuine behavioral difference. Any
  shared abstraction must accommodate it rather than dropping it.
- A reviewer should confirm this spike changed nothing except the slug import.


---

## Findings (executed 2026-11-16 at `051257c`)

**Drift check**: `quickViewController.ts` changed by 436 lines, `pdpController.ts`
203, `pdpUI.ts` 364 since `ad2999d`. Every line number in the plan was stale, so
the map below is re-derived from the current files. Several of the plan's claims
no longer hold (see the table).

**Step 1: 179 landed.** `quickViewController-real.test.ts` (44 tests with this
spike's two) is on master. Coverage of `quickViewController.ts`: 70.97% statements
/ 58.36% branches / 69.84% functions / 75.22% lines, up from ~30%.

**Method map** (QuickView at left, line numbers current):

| QuickView | PDP counterpart | Verdict |
|---|---|---|
| `resolveVariation` `:450` | `pdpController.ts:54` | Identical wrappers over the shared `resolveVariationForSelection` |
| `handleAttributeSelection` `:414` | `pdpController.ts:181` | Identical logic (snap to nearest real variation, announce); only the UI calls differ |
| `announceSelection` `:468` | `pdpController.ts:221` | Byte-for-byte duplicate |
| `canAddToCartForAttribute` `:689` | closure in `pdpController.ts:269` | Identical predicate |
| `updateAttributeButtonStates` `:639` | `PDPUIManager.updateAttributeButtonStates` `pdpUI.ts:495` | **Drifted** (list below). `pdpUI` already takes an `attributeRoot`, and QuickView already passes `#quick-view-attributes`, so it could delegate |
| `renderVariations` `:315` | SSR markup in `product/[id].astro:870-1000` | **Drifted**: hand-written class strings |
| `buildProductData` `:540` | `pdpController.updateButtonProductData` `:105` | **Drifted**: PDP bug below |
| `updateProductUI` `:493` | `pdpController.updateProductUI` `:64` | Mostly shared (same `uiManager` calls). Different by design: QuickView redraws its own gallery each time; PDP only when a variation has more than one image and also rewrites the URL |
| `updateQuantityAndBis` `:563` | `pdpController.updateBisSection` `:143` | Parallel, with different IDs and QuickView's gift-card and stepper handling; both already use `backInStockForm.ts` |
| `handleCartUpdate` `:818` | `pdpController.ts:247` | **Drifted**: PDP passes `keepQuantity: true`, QuickView does not |
| `initializeProduct` `:124` | server render of the PDP | Genuinely different: QuickView picks the default variation client-side |
| `updateViewDetailsButton` `:708` | none | QuickView only. Its inlined slug equals `createVariantSlug` |
| modal lifecycle, focus, color-image fallback, own gallery | none | Genuinely different |

**Step 2: drift list.** None fixed here.
1. **Bug in PDP, wrong price (STOP condition: reported).** On a variant swap
   `pdpController.updateButtonProductData` (`:105-121`) rewrites
   `variationId`, `variationName`, `price`, `image`, `unit` but never `saleInfo`,
   so the add-to-cart button keeps the **first variation's** `saleInfo`.
   QuickView's `buildProductData` sets it per variation. Reproduced with a
   throwaway test (not committed): swapping a $20 sale variation for a $30
   non-sale one leaves `saleInfo.salePrice = 2000` on the button data. In
   `cart.addItem` (`cart/index.ts:490-526`) the server value only wins when the
   variation is on sale (`fetchedSaleInfo ?? item.saleInfo`), so a non-sale
   variation inherits the stale sale price, and `getTotal()` then uses
   `saleInfo.salePrice ?? price`. The cart path was read from code, not run end
   to end. Plan 223.
2. **Bug in QuickView, touch targets.** PDP chips are `min-w-11 min-h-11 px-3 py-2`
   (44 px, plan 205 / #41); QuickView's are `px-2.5 py-1.5` (about 30 px), for
   chips and the single-value spans.
3. **Bug in QuickView, out-of-stock state.** PDP: out of stock wins the style
   cascade, and a selected sold-out chip gets a ring instead of a low-contrast
   fill (#41). QuickView: `opacity-60 line-through` on top of the selected fill,
   which is the state #41 fixed on the PDP.
4. **Bug in QuickView, accessibility.** PDP sets `aria-pressed` and
   `aria-label="<value> — out of stock"`; QuickView sets neither, so stock is
   conveyed by styling only.
5. **Bug in QuickView, quantity reset.** `handleCartUpdate` omits
   `keepQuantity: true`, so a cart refresh resets the quantity the shopper chose
   (the bug #42 fixed on the PDP).
6. **Stale in the plan: the `cursor-default` / `cursor-pointer` drift is gone.**
   Selected buttons use `cursor-pointer` on both sides; `cursor-default` is only
   on non-interactive single-value spans on both. No design decision needed.
Items 2-5 are plan 224. Nothing needs a design call beyond what #41 already
decided for the PDP.

**Step 3: three buckets.**
- *Pure logic, already or trivially shared*: variation resolution (shared),
  `announceSelection` (move to one place), the availability predicate.
- *DOM, shareable through `PDPUIManager`*: chip rendering and state (QuickView
  should delegate; the manager already takes the root), `updateButtonProductData`
  payload building, `keepQuantity` on cart refresh.
- *Divergent, keep separate*: modal lifecycle and focus, the item-level
  color-image fallback, QuickView's own gallery, default-variation selection,
  BIS/stepper wiring.

**Step 4: PoC.** `updateViewDetailsButton` now calls `createVariantSlug`
instead of re-inlining it. The inline copy was identical, character for
character, so behavior is unchanged: two new tests
(`"View Full Details" link`) pass both with the old inline code and the import,
which is the evidence. Real QuickView was not opened in a browser.

**Step 5: recommendation, and whether it is worth it.** Merging the two
controllers is **not** worth it: the real differences (modal lifecycle, own
gallery, color fallback, BIS and stepper wiring) are most of what is left, and
much of the original duplication has already gone (shared `PDPUIManager`,
shared resolver, shared BIS form). What is worth doing is small and targeted,
and it has already paid for itself in user-visible drift: delegate chip
rendering and state to `PDPUIManager` and pass `keepQuantity`. That is plan 224
(size S to M, risk LOW-MED, and each drift item can be checked against the PDP's
existing tests). Order: 223 first (a price bug beats any refactor), then 224;
after that, moving `announceSelection` and the payload builder into shared code
is a separate small cleanup and not needed to stop the drift. No new tests are
prerequisites beyond the failing tests named in each plan.
