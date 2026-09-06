# Plan 181: Spike — find the seam for extracting ~5,900 lines of inline `.astro` client logic

> **Executor instructions**: This is a **spike**, not a build plan. The
> deliverable is a recommendation plus one proof-of-concept extraction. Do not
> extract all the files. If anything in "STOP conditions" occurs, stop and report.
>
> **Drift check (run first)**:
> `git diff --stat ad2999d..HEAD -- src/pages/cart.astro src/components/ProductGrid.astro src/components/Modal.astro src/components/FulfillmentSelector.astro src/components/Nav.astro vitest.config.ts`
> On any change, re-run the line counts in Step 1.

## Status

- **Priority**: P3
- **Effort**: M (spike) — the follow-up work is L
- **Risk**: LOW (spike) / MED (the extraction it recommends)
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `ad2999d`, 2026-09-05

## Why this matters

The most bug-prone code in the storefront — cart mutation, filter state,
fulfillment and shipping maths — lives in inline `<script>` blocks inside
`.astro` files, where it **cannot be unit tested and does not count toward the
coverage gate**.

Verified file sizes:

| File | Lines |
|---|---|
| `src/pages/cart.astro` | 1,164 |
| `src/components/FulfillmentSelector.astro` | 1,030 |
| `src/components/ProductGrid.astro` | 1,011 |
| `src/components/Nav.astro` | 974 |
| `src/components/Modal.astro` | 634 |

Most of each is one inline script. Eleven more files exceed 250 inline script
lines.

`vitest.config.ts:33` includes only `src/lib/**/*.{js,ts}` and
`src/pages/api/**/*.ts`, so none of it is measured or reachable by tests. **The
coverage gate reports healthy while the checkout client is unverified.**

The repo already has the target pattern — `src/scripts/mini-cart-client.ts` and
`src/lib/product/pdpController.ts` are exactly this code, extracted.

This is a spike because the risk is real and the seam is not obvious: extraction
changes Astro's script-hoisting and module boundaries, and the view-transition
lifecycle wiring in `cart.astro` and `Nav.astro` is easy to break silently.

## Current state

`vitest.config.ts:33`:

```ts
    include: ['src/lib/**/*.{js,ts}', 'src/pages/api/**/*.ts'],
```

Downstream consequences already found by the same audit:
- the money formatters and image-URL builders duplicated across these blocks
  (plans 161, and the money split noted in this session's scan)
- `AppliedFilters.astro`, `ProductFilters.astro`, and `ProductGrid.astro`
  hand-roll filter URL-param handling that `src/lib/square/filterUtils.ts:256-306`
  already implements

Astro constraints to respect: hoisted `<script>` blocks are processed by Vite and
get a nonce under this repo's CSP; `astro.config.mjs` sets
`vite.build.assetsInlineLimit: 0` **specifically** because auto-inlined scripts
get no nonce and are blocked. Any extraction must keep working under that CSP.

## Commands you will need

| Purpose   | Command                  | Expected        |
|-----------|--------------------------|-----------------|
| Typecheck | `pnpm check`             | exit 0          |
| Tests     | `pnpm test:run`          | exit 0          |
| Coverage  | `pnpm test:coverage`     | exit 0          |
| Build     | `pnpm build`             | exit 0          |
| E2E       | `pnpm test:e2e:chromium` | see Steps       |
| Dev server| `pnpm dev`               | serves on :4321 |

Never use `pnpm test` — watch mode, it hangs.

## Scope

**In scope**:
- This plan file (write findings into it)
- `plans/README.md`
- **One** proof-of-concept extraction, on the file Step 2 selects
- `vitest.config.ts` — only to add `src/scripts/**` to the coverage `include`,
  and only if the PoC lands

**Out of scope** (do NOT do):
- Extracting more than one file. That is the follow-up work this spike scopes.
- Changing any behavior. Extraction is a move, not a rewrite.
- Fixing the duplication the extraction exposes (money formatters, filter
  params). Record it; plans 161 and others own it.
- Raising coverage thresholds. Adding `src/scripts/**` to `include` will likely
  **lower** measured coverage — see Step 5.

## Git workflow

- Branch: `advisor/181-spike-extract-inline-astro-scripts`
- Conventional commits, e.g. `refactor: extract <file>'s client logic to src/scripts`
- Do NOT push or open a PR unless the operator instructs it.

## Steps

### Step 1: Quantify precisely

For each `.astro` file with a substantial inline script, record: total lines,
inline script lines, whether it wires `astro:page-load` / `astro:before-swap`,
and whether it touches cart state, filter state, or money.

```bash
grep -rln "<script" src/pages src/components | while read f; do
  printf "%-52s %s\n" "$f" "$(wc -l < "$f")"
done | sort -k2 -rn | head -20
```

**Verify**: the table recorded in `plans/README.md`.

### Step 2: Pick the PoC file — smallest useful, not biggest

`cart.astro` is the highest-value target and the **worst** PoC: it is the
largest, touches money, and has view-transition wiring.

Pick something that proves the pattern with low blast radius — `Modal.astro`
(634 lines, self-contained, no money) is a good candidate. Justify your choice.

**Verify**: choice and reasoning recorded.

### Step 3: Extract it

Move the logic to `src/scripts/<name>.ts` exporting an `init()`, and have the
`.astro` file import and call it. Match `src/scripts/mini-cart-client.ts`'s shape
— read it first.

Preserve: `astro:page-load` re-init behavior, `AbortController` listener cleanup,
and CSP compatibility (the script must still receive a nonce).

**Verify**: `pnpm check && pnpm build` → exit 0. In `pnpm dev`, the component
behaves identically, including after a client-side navigation. **No CSP violation
in the console** — check explicitly.

### Step 4: Add tests for the extracted module

Write enough tests to prove extraction unlocks testing — not exhaustive coverage.
Use happy-dom, modelled on `src/lib/product/__tests__/pdpUI.test.ts`.

**Verify**: `pnpm test:run` → exit 0 with the new tests passing.

### Step 5: Add `src/scripts/**` to coverage, and measure the damage

Add `src/scripts/**/*.ts` to `vitest.config.ts`'s coverage `include`.

**This will likely lower measured coverage**, because `src/scripts/` already
contains largely-untested modules. Record the drop.

Do **not** re-baseline the thresholds to hide it. If it drops below the current
thresholds, that is a finding: report the numbers and let the operator decide
whether the visibility is worth the re-baseline. Note that after **plan 160**,
coverage is enforced in CI, so this becomes a hard gate rather than a number.

**Verify**: before/after coverage recorded; the decision surfaced to the operator.

### Step 6: Write the recommendation

Based on what the PoC actually cost, produce:

- an ordered list of files worth extracting, with effort and risk each
- the files **not** worth extracting, and why
- the specific hazards hit (Astro hoisting, CSP/nonce, view-transition lifecycle,
  event-listener cleanup) and how you handled each
- whether the coverage `include` change should ship now or wait
- an honest estimate for the full extraction

**Verify**: written into this file and summarized in `plans/README.md`.

### Step 7: Full gate

```bash
pnpm check && pnpm lint && pnpm test:run && pnpm build
```
→ all exit 0. Run `pnpm test:e2e:chromium` if **plan 158** has landed; otherwise
verify the PoC component manually and say so.

## Test plan

- Tests for the one extracted module (Step 4).
- No tests for the un-extracted files — that is the follow-up work.
- Coverage numbers before and after the `include` change are themselves a
  deliverable.

## Done criteria

- [ ] Step 1's inline-script inventory recorded in `plans/README.md`
- [ ] PoC file chosen with recorded reasoning
- [ ] One file extracted; behavior verified identical, including after client-side nav
- [ ] No CSP violation from the extracted script
- [ ] Tests exist for the extracted module and pass
- [ ] Coverage before/after the `include` change recorded; decision surfaced
- [ ] Step 6's ordered recommendation written here and summarized
- [ ] Exactly **one** `.astro` file extracted (`git status`)
- [ ] `pnpm check` / `pnpm lint` / `pnpm test:run` / `pnpm build` all exit 0

## STOP conditions

Stop and report if:

- **The extracted script is blocked by CSP.** The nonce mechanism is a security
  control — do not weaken `src/middleware.ts` to make the PoC work.
- Extraction changes behavior after a client-side navigation. The
  `astro:page-load` lifecycle is the subtle part; a component that works on first
  load and breaks on navigation is worse than no extraction.
- The coverage drop from Step 5 would push below the thresholds. Report the
  numbers; do not silently re-baseline.
- The PoC takes substantially longer than expected. That is the spike's answer —
  report it rather than pushing through.

## Maintenance notes

- **The structural problem**: the coverage gate measures `src/lib/**` and
  `src/pages/api/**`, and the riskiest client code lives outside both. Until
  `src/scripts/**` is in the `include`, "coverage is fine" means less than it
  appears to.
- Extraction is a **move**, not a rewrite. Every duplicate it exposes (money
  formatting, image URLs, filter params) should be recorded and fixed separately,
  or the change becomes unreviewable.
- Plan 177 also touches `ProductGrid.astro`. If both are in flight, do not pick
  `ProductGrid` as the PoC.
- The output of this spike should be new numbered plans, one per file worth
  extracting.
