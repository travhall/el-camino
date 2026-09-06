# Plan 182: Spike — find the seam in `product/[id].astro`'s 419-line frontmatter

> **Executor instructions**: This is a **spike**. The deliverable is a
> recommendation and, if a clean seam exists, one proof-of-concept extraction.
> If anything in "STOP conditions" occurs, stop and report.
>
> **Drift check (run first)**:
> `git diff --stat ad2999d..HEAD -- src/pages/product/[id].astro src/lib/product/`
> On any change, re-read the frontmatter before relying on the notes below.

## Status

- **Priority**: P3
- **Effort**: M (spike) — the follow-up work is L
- **Risk**: LOW (spike) / MED (the extraction it recommends)
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `ad2999d`, 2026-09-05

## Why this matters

`src/pages/product/[id].astro` is **1,316 lines**, of which the frontmatter is
**lines 1–419** (verified). It is the highest-traffic route on the site and it
has zero unit coverage — `.astro` is outside `vitest.config.ts`'s include.

That frontmatter performs, in one scope: slug-vs-Square-ID detection, parallel
category prefetch, defensive product cloning to avoid `BlobCache` reference
bleed, `?variant=` handling, gift-card detection via a custom attribute,
inventory fetch and processing, **order-dependent in-place mutation** of
`variation.attributes`, item-level image fallback mapping, sale-info resolution,
structured data, and breadcrumbs.

The comments in the file document ordering hazards that exist *only* because all
of this shares one scope — for example a note that a block "must run BEFORE any
code that reads `variation.attributes`", and another explaining the defensive
clone. Those are exactly the constraints that survive review and break later.

`src/lib/product/` already holds the extracted **client** half — `pdpController`,
`pdpUI`, `pdpEvents`, `breadcrumbs`, `structuredData`, `relatedProducts`. The
server half never got the same treatment.

Spike rather than build plan: the in-place mutations and their ordering are
load-bearing, and whether a clean seam exists needs a careful read before anyone
commits to a shape.

## Current state

- File: 1,316 lines; frontmatter ends at line 420 (`awk '/^---$/{n++; if(n==2){print NR; exit}}'`)
- The documented ordering hazards live around `:103-107` (the defensive clone)
  and `:228-239` (the attribute mutation that must run first) — **re-read both
  yourself**, line numbers drift
- Existing extracted counterparts: `src/lib/product/pdpController.ts` (280
  lines), `pdpUI.ts`, `pdpEvents.ts`, `breadcrumbs.ts`, `structuredData.ts`,
  `relatedProducts.ts`
- Test cover: `src/lib/product/__tests__/pdpController-real.test.ts` and
  `pdpUI.test.ts` exist for the client half; nothing for the server half

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
- This plan file and `plans/README.md`
- **One** proof-of-concept extraction into `src/lib/product/`, if Step 3 finds a
  seam
- A test file for whatever is extracted

**Out of scope** (do NOT do):
- Extracting the whole frontmatter. That is the follow-up.
- Changing rendered output. Byte-identical HTML is the bar.
- Touching the ~900 lines of template below the frontmatter.
- `pdpController.ts` / `pdpUI.ts` / `pdpEvents.ts` — the client half is fine.
- "Fixing" the in-place mutations. Understand them first; a spike that
  accidentally changes mutation order has failed.

## Git workflow

- Branch: `advisor/182-spike-decompose-pdp-frontmatter`
- Conventional commits, e.g. `refactor: extract <concern> from PDP frontmatter`
- Do NOT push or open a PR unless the operator instructs it.

## Steps

### Step 1: Map the frontmatter

Read all 419 lines and produce a numbered list of concerns, each with: line
range, its inputs, its outputs, and **what it mutates**.

**Verify**: the map recorded in `plans/README.md`.

### Step 2: Map the ordering constraints explicitly

For each in-place mutation, identify what must run before and after it, and why.
The file's own comments name some; verify each and look for undocumented ones —
those are the dangerous kind.

**Verify**: a dependency list, e.g. "attribute parsing (`:228-239`) must precede
any read of `variation.attributes`, because …".

### Step 3: Find the seam — or report that there isn't one

Look for a boundary where a self-contained piece can move out with clear inputs
and outputs and no mutation of shared state.

The likely shape is a `src/lib/product/pdpPageData.ts` that takes the route
params and returns a fully-resolved, **immutable** `ProductPageData`, leaving the
`.astro` frontmatter as a call plus error handling. But confirm that against
Step 2's constraints rather than assuming it.

**If no clean seam exists, say so.** "This needs characterization tests before it
can be decomposed" is a valid and valuable outcome — and it would mean the next
plan is tests, not refactoring.

**Verify**: seam identified with evidence, or a documented negative result.

### Step 4: Extract one concern as a PoC

Pick the most independent piece from Step 1 — likely slug/ID detection or sale
resolution, not the attribute mutation. Move it to `src/lib/product/`, with unit
tests.

**Verify**: `pnpm check && pnpm build` → exit 0.

### Step 5: Prove the rendered output is unchanged

```bash
curl -s "http://localhost:4321/product/<slug>" > /tmp/pdp-after.html
```

Compare against `master` for **at least four** products: one with variants, one
gift card, one out of stock, one on sale.

**Verify**: byte-identical for all four (modulo nonces/timestamps — diff with
those normalized). Record which products you used.

### Step 6: Write the recommendation

Produce: the proposed target shape, an ordered extraction sequence with the
ordering constraints each step must preserve, what should get characterization
tests **first**, an honest effort estimate, and the hazards you hit.

**Verify**: written here and summarized in `plans/README.md`.

### Step 7: Full gate

```bash
pnpm check && pnpm lint && pnpm test:run && pnpm build
```
→ all exit 0. Run `pnpm test:e2e:chromium` if **plan 158** has landed; otherwise
verify manually and say so.

## Test plan

- Unit tests for the one extracted concern, in `src/lib/product/__tests__/`,
  modelled on `pdpController-real.test.ts`.
- The rendered-output diff (Step 5) is the real safety net for a refactor of an
  untested file.
- `pnpm test:coverage` → exit 0, no threshold regression.

## Done criteria

- [ ] Step 1's concern map recorded in `plans/README.md`
- [ ] Step 2's ordering-constraint list recorded, including any undocumented ones
- [ ] Step 3's seam identified with evidence, **or** a documented negative result
- [ ] If a seam exists: one concern extracted, with tests
- [ ] Rendered HTML byte-identical for four product types; which products, recorded
- [ ] Step 6's recommendation written here and summarized
- [ ] The template below the frontmatter is unmodified (`git diff`)
- [ ] `pnpm check` / `pnpm lint` / `pnpm test:run` / `pnpm build` all exit 0

## STOP conditions

Stop and report if:

- **Rendered output differs for any product type.** The mutations are
  order-dependent and untested; a diff means you changed behavior.
- Step 2 finds ordering constraints that are not documented and not obvious. That
  is the strongest possible argument for characterization tests first — report it
  and stop.
- Extracting the chosen concern requires threading five or more values through.
  That means it is not actually independent; pick another or report no seam.
- You are tempted to "clean up" a mutation while extracting. Don't. Move first,
  change later, and only with tests.

## Maintenance notes

- **The core hazard**: implicit ordering in a single large scope. Every extracted
  piece should make its dependencies explicit parameters, so the ordering becomes
  a type error rather than a comment.
- The `.astro` frontmatter is outside the coverage gate, so nothing here is
  measured today. Extraction is what makes it testable at all — that, not
  tidiness, is the reason to do it.
- A negative result is genuinely useful. If the honest answer is "characterize
  first, then decompose", that is a better outcome than a risky refactor of the
  highest-traffic route.
- A reviewer should focus on the rendered-output diff, not the code.
