# Plan 053: Extract QuickViewController out of QuickView.astro into src/lib/product/

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 9b5556b..HEAD -- src/components/QuickView.astro src/lib/product/`
> If any changes appear, compare the "Current state" excerpts before proceeding.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `9b5556b`, 2026-07-22

## Why this matters

`src/components/QuickView.astro` has a 1,164-line `<script>` block containing
the `QuickViewController` class (lines ~320–1484). The class is untestable as
it sits inside an `.astro` component script. The `PDPController` for the full
product page was correctly extracted to `src/lib/product/pdpController.ts`
(262 lines, with tests at `src/lib/product/pdpController.test.ts`). This plan
mirrors that pattern for QuickView.

## Current state

**`src/components/QuickView.astro`**: Frontmatter ~1–11 lines, HTML template
~11–320 lines, `<script>` from line 320 to end (~1484 lines). The script opens
with `class QuickViewController { ... }` and ends with
`QuickViewController.getInstance().init()` or similar bootstrap call.

**`src/lib/product/pdpController.ts`** — the pattern to follow:
- Exported class with static `getInstance()` and `init()` method
- No DOM at module level — all DOM access inside methods called from `init()`

**`src/lib/product/pdpController.test.ts`** — test pattern:
- Imports `PDPController` directly
- Sets up JSDOM / Vitest browser environment
- Tests individual methods

## Commands you will need

| Purpose   | Command              | Expected on success       |
|-----------|----------------------|---------------------------|
| Typecheck | `pnpm check`         | exit 0, no errors         |
| Unit tests | `pnpm test:run`     | all pass                  |

## Scope

**In scope**:
- `src/lib/product/quickViewController.ts` — create new file
- `src/lib/product/quickViewController.test.ts` — create new test file
- `src/components/QuickView.astro` — replace `<script>` body with import + bootstrap

**Out of scope**:
- `src/components/QuickView.astro` HTML template (lines 11–320) — do not touch
- `src/lib/product/pdpController.ts` — do not touch

## Git workflow

- Branch: `advisor/053-extract-quickview-controller`
- Commit message: `refactor: extract QuickViewController to src/lib/product/ for testability`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Read the current QuickView.astro script block

Read `src/components/QuickView.astro` lines 320–1484 in full. Identify:
1. The class definition start and end.
2. The bootstrap call at the bottom (e.g. `QuickViewController.getInstance().init()`).
3. Any imports at the top of the script block (e.g. `import { ... } from "@/lib/..."`) —
   these will become imports in the new `.ts` file.

### Step 2: Create src/lib/product/quickViewController.ts

Create `src/lib/product/quickViewController.ts` with:
- All imports from the `<script>` block's preamble
- The `QuickViewController` class verbatim — do not change any logic
- `export { QuickViewController }` or `export class QuickViewController`

Model the file after `src/lib/product/pdpController.ts` for structure.

**Verify**: `wc -l src/lib/product/quickViewController.ts` → approximately the class line count from Step 1.
**Verify**: `grep -n "export" src/lib/product/quickViewController.ts` → `QuickViewController` is exported.

### Step 3: Replace the <script> body in QuickView.astro

Replace the entire `<script>` body in `src/components/QuickView.astro` with:

```astro
<script>
  import { QuickViewController } from "@/lib/product/quickViewController";
  QuickViewController.getInstance().init();
</script>
```

(Or whatever the bootstrap pattern is — match what was at the bottom of the old
script block.)

**Verify**: `wc -l src/components/QuickView.astro` → significantly fewer lines than before (~330 instead of ~1484).

### Step 4: Write basic unit tests

Create `src/lib/product/quickViewController.test.ts`. Model after
`src/lib/product/pdpController.test.ts`. Write at minimum:

- Test that `QuickViewController.getInstance()` returns the same instance on
  repeated calls (singleton pattern).
- Test 2–3 key public methods (look at what `pdpController.test.ts` tests as
  a guide for scope).

These are characterization tests — the goal is coverage, not exhaustive behavior
tests.

### Step 5: Typecheck and test

```bash
pnpm check
```
Expected: exit 0.

```bash
pnpm test:run
```
Expected: all pass including new tests in `quickViewController.test.ts`.

## Done criteria

- [ ] `pnpm check` exits 0
- [ ] `pnpm test:run` exits 0 with new tests present
- [ ] `src/lib/product/quickViewController.ts` exists and exports `QuickViewController`
- [ ] `src/components/QuickView.astro` `<script>` block is ≤10 lines (import + bootstrap)
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

- The `<script>` block contains Astro-specific APIs (`Astro.props`, `Astro.locals`,
  etc.) that cannot be imported into a plain `.ts` file — identify which ones
  and report; they may need to be passed as constructor arguments instead.
- `pnpm check` errors on the extracted file due to missing `window`/`document`
  types — add `/// <reference lib="dom" />` at the top of the file.
- The class has no `getInstance()` static method (it's instantiated differently) —
  adapt the bootstrap pattern to match, and report what you found.

## Maintenance notes

- Future contributors should add new QuickView behavior to `quickViewController.ts`,
  not to the Astro component's `<script>` block.
- Once plan 052 (window globals → CustomEvents) lands, `window.openQuickView`
  can be removed from `quickViewController.ts` in favor of a `document.addEventListener("elco:open-quick-view", ...)` listener.
