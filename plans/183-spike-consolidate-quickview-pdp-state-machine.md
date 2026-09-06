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
