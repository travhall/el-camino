# Plan 179: Characterize `quickViewController.ts` — 1,147 lines at ~30% coverage on an add-to-cart path

> **Executor instructions**: Follow step by step. Run every verification command.
> If anything in "STOP conditions" occurs, stop and report. When done, update
> this plan's status row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat ad2999d..HEAD -- src/lib/product/quickViewController.ts src/lib/product/__tests__/`
> On any change, re-derive the method line numbers in Step 1.

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `ad2999d`, 2026-09-05

## Why this matters

Quick View is the add-to-cart entry point from category and listing pages — the
highest-traffic purchase path on the site. Its controller is **1,147 lines** and
has **four tests**, all shell-level: `getInstance()` identity, open-fetch success,
open-fetch failure, and `closeModal()`. Coverage sits around 30% statements /
23% branches.

Untested: variation resolution, stock gating, the double-submit guard, and the
call into `cart.addItem`. A regression that adds the wrong variation to the cart,
lets an out-of-stock item through, or double-fires `addItem` would ship silently.

The sibling `pdpController.ts` does the same job on the PDP, sits around 68%, and
has a dedicated `-real` suite. Quick View got the extraction — its header says
*"Extracted from QuickView.astro … for testability"* — without the tests.

This plan writes **characterization** tests: they document what the code does
today, so the duplication cleanup (plan 183) can proceed safely.

## Current state

`src/lib/product/quickViewController.ts` — 1,147 lines. Its existing test file
`src/lib/product/__tests__/quickViewController.test.ts` has 4 tests.

Methods to cover (**re-derive these line numbers in Step 1** — they are from
commit `ad2999d` and this file is long enough that drift is likely):

- `addToCart()` (~`:761`) — calls `cart.canAddToCart` (~`:792`) and `cart.addItem`
  (~`:809`); has an `isProcessing` double-submit guard
- `updateCurrentVariation()` (~`:390`) — attribute selection → matching variation
- `canAddToCartForAttribute()` (~`:705`)
- `showOutOfStockState()` (~`:426`)
- the back-in-stock form POST (~`:640`)
- `handleAttributeSelection`, `handleCartUpdate`, `buildProductData`

### The pattern to follow

`src/lib/product/__tests__/pdpController-real.test.ts` is the model: real
happy-dom DOM, fixture markup mounted, a stubbed `cart`. **Read it before writing
anything** — it solves the same problems (modal-less DOM, cart double, event
wiring) for the sibling controller.

Mocking pitfalls already documented in this repo:
- From inside `__tests__/`, mock `'../module'`, not `'./module'` — the latter
  resolves to a nonexistent sibling and silently falls through to the real
  implementation (including real network calls).
- `clearAllMocks()` does **not** undo a prior test's `mockReturnValue` /
  `mockRejectedValue`. Reassert defaults in `beforeEach`.

Both were found the hard way in earlier plans; do not rediscover them.

## Commands you will need

| Purpose   | Command                                     | Expected             |
|-----------|---------------------------------------------|----------------------|
| Typecheck | `pnpm check`                                | exit 0               |
| Tests     | `pnpm test:run -- quickView`                | all pass             |
| Full      | `pnpm test:run`                             | exit 0               |
| Coverage  | `pnpm test:coverage`                        | exit 0, no regression|
| Lint      | `pnpm lint`                                 | exit 0               |

Never use `pnpm test` — watch mode, it hangs.

## Scope

**In scope**:
- `src/lib/product/__tests__/quickViewController.test.ts` (extend)
- optionally a new `quickViewController-real.test.ts`, mirroring the PDP split
- a fixture file for the Quick View markup, if the PDP suite uses that pattern

**Out of scope** (do NOT touch):
- **`src/lib/product/quickViewController.ts` itself.** This is a characterization
  plan. If a test reveals a bug, that is a STOP-and-report.
- `pdpController.ts` / `pdpUI.ts` / `pdpEvents.ts`.
- The QuickView/PDP duplication — **plan 183**. These tests are its prerequisite.
- `src/components/QuickView.astro`.

## Git workflow

- Branch: `advisor/179-characterize-quickview-controller`
- Conventional commits, e.g. `test: characterize quickViewController add-to-cart paths`
- Do NOT push or open a PR unless the operator instructs it.

## Steps

### Step 1: Re-derive the surface and the baseline

```bash
wc -l src/lib/product/quickViewController.ts
grep -n "^\s*\(private\|public\|async\|[a-zA-Z]\)[a-zA-Z]*(" src/lib/product/quickViewController.ts | head -60
pnpm test:coverage
```

**Verify**: record current line numbers for the methods listed above, plus
baseline statements/branches for this file, in `plans/README.md`.

### Step 2: Build the fixture and harness

Mount Quick View's markup in happy-dom and stub `@/lib/cart`, following
`pdpController-real.test.ts`'s structure. Get **one** trivial test passing
against the harness before writing more — if the harness is wrong, every
subsequent test is wrong too.

**Verify**: one test exercising `updateCurrentVariation` passes.

### Step 3: Cover `addToCart` — the highest-value target

- happy path → `cart.addItem` called **once**, with the exact expected payload
  (assert the whole object, not just that it was called)
- `cart.canAddToCart` returns false → `addItem` **not** called
- `cart.addItem` rejects → error surfaced, no crash, button state restored
- **double-submit**: two rapid calls → `addItem` called exactly once
  (the `isProcessing` guard)
- invalid quantity → rejected before `addItem`

**Verify**: `pnpm test:run -- quickView` → all pass.

### Step 4: Cover variation resolution and stock gating

- selecting attributes resolves the correct variation
- an attribute combination with no matching variation → the out-of-stock state,
  no crash
- the **color-image fallback branch** — this is the one behavior Quick View has
  that the PDP does not; characterize it carefully, plan 183 depends on it
- `canAddToCartForAttribute` for available and unavailable combinations
- `showOutOfStockState` updates the expected DOM

**Verify**: `pnpm test:run -- quickView` → all pass.

### Step 5: Cover the back-in-stock form and modal lifecycle

- the form POST sends the expected body
- a failed POST surfaces an error without breaking the modal
- open → close → reopen leaves no stale state or duplicate listeners

**Verify**: `pnpm test:run -- quickView` → all pass.

### Step 6: Full gate

```bash
pnpm check && pnpm lint && pnpm test:run && pnpm test:coverage
```
→ all exit 0.

## Test plan

This plan *is* the test plan. Requirements:

- **No source modification.** `git status` shows only test/fixture files.
- Every test asserts **current** behavior. Where it looks wrong, comment clearly
  and report — do not encode an aspiration.
- Assert the full `cart.addItem` payload, not just call counts. Wrong-variation
  bugs hide in the payload.
- Target a substantial coverage lift on `quickViewController.ts` from the ~30%
  baseline; record the actual before/after rather than claiming a number.

## Done criteria

- [ ] Step 1's re-derived line numbers and baseline coverage recorded
- [ ] `addToCart` covered: happy path, blocked, rejected, double-submit, invalid quantity
- [ ] Variation resolution and the color-image fallback branch covered
- [ ] `canAddToCartForAttribute` and `showOutOfStockState` covered
- [ ] Back-in-stock POST and modal lifecycle covered
- [ ] **`quickViewController.ts` unmodified** (`git status`)
- [ ] Before/after coverage recorded in `plans/README.md`
- [ ] `pnpm check` / `pnpm lint` / `pnpm test:run` all exit 0
- [ ] `pnpm test:coverage` exits 0, no threshold regression

## STOP conditions

Stop and report if:

- **A test reveals a real bug** — the double-submit guard not holding, the wrong
  variation reaching `addItem`, an out-of-stock item getting through. Capture
  actual behavior in a clearly-marked test and report. **Do not fix the source.**
- The controller cannot be exercised without extensive DOM fixture work that
  amounts to reimplementing `QuickView.astro`. Cover what you can, report the
  rest — partial characterization still unblocks plan 183.
- You hit the documented mocking pitfalls and a mock silently falls through to a
  real network call. Symptom: a test that hangs or is slow. Fix the mock path.

## Maintenance notes

- **This plan is the prerequisite for plan 183** (collapsing QuickView's
  duplicate PDP state machine). Consolidating an untested 1,147-line controller
  against a tested one is how behavior gets silently lost; these tests are the
  safety net.
- The color-image fallback is the one genuine behavioral difference from the PDP.
  Whatever 183 does, that branch must survive — which is why Step 4 characterizes
  it specifically.
- A reviewer should confirm no source file appears in the diff, and that
  `addItem` payload assertions are full-object.
