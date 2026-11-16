# Plan 062: Reduce shop page image preloads to LCP only

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 9b5556b..HEAD -- src/pages/shop/`
> If any changes appear, compare before proceeding.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: performance
- **Planned at**: commit `9b5556b`, 2026-07-22

## Why this matters

`src/pages/shop/all.astro:133-136` preloads the first 8 product images with
`<link rel="preload" as="image">`. Preloading tells the browser to fetch these
resources at highest priority — but that means all 8 compete with each other
and with the LCP image. The browser's built-in preload scanner already
discovers images in the initial viewport; explicitly preloading 8 images
creates resource contention that can actually **delay** the LCP element.

Standard practice is to preload only the LCP image (position 0), and let the
browser's preload scanner handle the rest. The same pattern applies to
`src/pages/shop/sale.astro`.

## Current state

`src/pages/shop/all.astro:133-136`:

```ts
const preloadImages = allProducts
  .slice(0, 8)             // ← preloads first 8
  .map((p) => p.image)
  .filter((img) => !img.includes("placeholder"));
```

`src/pages/shop/sale.astro` (similar pattern, verify exact lines with
`grep -n "preload\|slice" src/pages/shop/sale.astro`).

## Commands you will need

| Purpose        | Command              | Expected on success      |
|----------------|----------------------|--------------------------|
| Typecheck      | `pnpm check`         | exit 0, no errors        |

## Scope

**In scope**:
- `src/pages/shop/all.astro` — the `slice(0, 8)` call only
- `src/pages/shop/sale.astro` — same change if the same pattern exists

**Out of scope**:
- Any other page
- Product card components

## Git workflow

- Branch: `advisor/062-reduce-preload-images`
- Commit message: `perf: preload only LCP image on shop pages, not first 8`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Confirm the pattern in both files

```bash
grep -n "slice\|preload" src/pages/shop/all.astro src/pages/shop/sale.astro
```

Note exact line numbers and the slice argument in each file.

### Step 2: Change slice(0, 8) to slice(0, 1) in all.astro

In `src/pages/shop/all.astro`, change `.slice(0, 8)` to `.slice(0, 1)`:

```ts
// Before
const preloadImages = allProducts
  .slice(0, 8)
  .map((p) => p.image)
  .filter((img) => !img.includes("placeholder"));

// After
const preloadImages = allProducts
  .slice(0, 1)
  .map((p) => p.image)
  .filter((img) => !img.includes("placeholder"));
```

### Step 3: Apply same change to sale.astro

If `src/pages/shop/sale.astro` has the same pattern, change its slice to
`.slice(0, 1)` as well.

**Verify**:
```bash
grep -n "slice(0," src/pages/shop/all.astro src/pages/shop/sale.astro
```

Both should show `slice(0, 1)`.

### Step 4: Typecheck

```bash
pnpm check
```

Expected: exit 0.

## Done criteria

- [ ] `pnpm check` exits 0
- [ ] `grep "slice(0, 8)" src/pages/shop/all.astro` → no match
- [ ] `grep "slice(0, 1)" src/pages/shop/all.astro` → 1 match
- [ ] Same check passes for `sale.astro` if the pattern existed there
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

- `sale.astro` has a different preload mechanism (e.g., it passes images to a
  component that sets `fetchpriority`) — apply the same concept by limiting to
  1 image but adapt to the actual code shape; if in doubt, report.
