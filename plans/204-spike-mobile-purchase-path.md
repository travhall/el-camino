# Plan 204: Spike — mobile PDP purchase-path options for multi-attribute products

> **Executor instructions**: This is a **spike**, not a build plan. The deliverable is 2-3 concrete, comparable options (markup/CSS prototypes on a throwaway branch) plus a written recommendation — not a shipped change to the live PDP. Do not merge or wire this into production code. Follow the steps in order; report your findings and mockups back for the maintainer to pick from.
>
> **Drift check (run first)**: `git diff --stat 45060e2..HEAD -- src/pages/product/\[id\].astro` — on a mismatch, re-measure Step 1 against the live file before proceeding.

## Status

- **Priority**: P2
- **Effort**: S (spike)
- **Risk**: LOW (no production code path is changed by this plan)
- **Depends on**: none (plan 205 has a soft dependency on this one's outcome — see its Maintenance notes)
- **Category**: direction
- **Planned at**: commit `45060e2`, 2026-09-27

## Why this matters

On a 375×812 mobile viewport, the Add to Cart button on a multi-attribute product (e.g. a pant with 5 sizes × 3 colors, quantity stepper visible) sits at or just below the fold — measured live at `top: 810px` on an 812px-tall viewport, and real device browser chrome (address bar) eats another ~60-90px in practice, pushing it further down. The maintainer has already tried a persistent sticky bottom bar for this and rejected it: it was "almost always visible" and covered variants and product details while scrolling. Any new direction must not repeat that — no persistent overlay that sits over content. This plan is scoped to produce comparable, concrete options (not a single pre-committed answer) because the right trade-off here is a product/design call, not an engineering one.

## Current state

`src/pages/product/[id].astro`, mobile column order (single-column stack under `md:` breakpoint — the `md:grid-cols-2` split only applies at `md` and up, `line 473`):
1. Image + gallery thumbnails (`lines 476-639`) — `aspect-4/3` on mobile (`line 479`), measured ~343×257px in a 375px-wide viewport.
2. Breadcrumbs — **hidden on mobile**: `class="hidden lg:block"` (`line 645`).
3. H1 — brand span (`text-xl`, `line 656`) + title (`text-5xl lg:text-6xl xl:text-7xl 2xl:text-8xl leading-[0.8]`, `line 651`).
4. Price block, `mb-6` (`line 663`).
5. Size chips, `mt-6` (`line 714` wrapper, inside the `attributeTypes.map` loop starting `line 706`).
6. Color chips, `mt-6` (same loop, one iteration per attribute type — each gets its own `mt-6` wrapper).
7. Quantity stepper, `mt-6` (`line 875`) — only rendered when `selectedVariationInStock` and only *visible* (not `hidden` class) when `effectiveMax > 1` (`pdpUI.ts:190-197`); for a single-unit-in-stock product this block collapses to just the "N available" text, saving ~90px.
8. Add to Cart button, `mt-4` (`line 946`).
9. BackInStock section (hidden unless OOS), description, trust-signals strip.

Live measurement this session (Huf Mason Pant, 5 sizes, 3 colors, qty stepper visible): `#add-to-cart-button` bounding-rect top = 810px, height = 44px, on a 375×812 emulated viewport — i.e. the button's bottom edge is already past the fold before accounting for real browser chrome.

Simple products (single variation, e.g. a skateboard deck with no size/color chips) don't have this problem — steps 5-7 above don't render, so the CTA sits much higher. **This is specifically a multi-attribute-product problem.**

The maintainer's constraint, verbatim from this session: "the variants and product details were blocked by [the sticky bar]... it was almost always visible and covering info." Whatever this spike proposes must not reintroduce a persistent element over content.

## Options to prototype (produce all three; do not pre-select)

### Option A — Collapsed selector triggers (bottom sheet)
Replace the inline chip rows for Size and Color with a single-line summary control per axis (e.g. a button reading `Size: 28 ▾`) that opens a modal/bottom sheet containing the full chip grid on tap. Selecting a chip closes the sheet and updates the trigger's label. This collapses steps 5+6 above from N wrapped rows down to two single lines, which is the largest recoverable vertical space on this page (each `mt-6` wrapper plus a chip row that can wrap to 2 lines on a 5-value axis is roughly 60-90px; collapsing two axes to two 44px trigger rows recovers well over 100px). It is not persistent — it only appears on tap and closes immediately after, which is structurally different from the rejected sticky bar (nothing sits over content while browsing).
- Prototype both the closed state (trigger row) and the open sheet.
- Accessibility requirements to prototype, not skip: focus moves into the sheet on open and returns to the trigger on close, `Escape` closes it, the sheet is `role="dialog"` with `aria-modal="true"` and a labelled heading, and it's reachable/operable by keyboard alone (model the existing `SizeGuide.astro` modal in this repo — `src/components/SizeGuide.astro:78-96` already implements `aria-modal`, labelled backdrop, and a labelled close button; match that pattern, don't invent a new one).

### Option B — Reserve-space compression, scoped to the CTA path only
Not a general "shrink everything" pass (already rejected as unappealing when framed that broadly) — specifically: (a) hide the "Shipping & taxes are calculated at checkout" helper line (`line 700-702`) behind a small info icon/tooltip instead of an always-visible line, (b) reduce the mobile H1 from `text-5xl` to `text-4xl` (the `lg:`/`xl:`/`2xl:` steps are untouched — this only affects the smallest breakpoint), (c) tighten the three `mt-6` section gaps to `mt-4` on mobile only (`max-md:mt-4` or equivalent, larger breakpoints unchanged). Quantify the recovered height precisely (measure before/after in the browser, don't estimate) and state plainly whether it's enough to clear the fold for the worst-case product (5+ sizes, multiple colors, stepper visible) or only for typical ones.

### Option C — Reveal-on-demand summary bar (not persistent)
A condensed price + CTA row that is **not present in the DOM/visible at all** until the user has scrolled past the real Add to Cart button, and disappears again if they scroll back up above it (IntersectionObserver on the real button, toggle visibility of a small fixed-position summary). Different from the sticky bar already rejected in one specific way: it is absent, not merely "present but small," for the entire time a first-time visitor is reading the product info and selecting variants — it can only appear after they've already scrolled past the real controls once. Prototype it and explicitly flag for the maintainer that this is close in spirit to what was tried before; state the one behavioral difference and let them judge whether it's enough.

## Commands

| Purpose | Command | Expected |
|---|---|---|
| Typecheck | `pnpm check` | 0 errors |
| Lint | `pnpm lint` | exit 0 |

(No test-writing in this plan — it's a spike with no shipped logic.)

## Scope

**In scope**: a throwaway branch touching `src/pages/product/[id].astro` and, if needed for Option A, a new small Astro/TS component for the bottom sheet — all clearly marked as prototype-only in commit messages, never merged.

**Out of scope**: any change to `pdpController.ts`, `pdpUI.ts`, cart logic, or the desktop (`md:` and up) layout — desktop is not in scope for this spike. Do not touch `variationParser.ts` (plan 203 owns that file).

## Git workflow

Branch `advisor/204-spike-mobile-purchase-path`. Commit prefix `spike:` (e.g. `spike: prototype collapsed variant selectors`). Do NOT push, open a PR, or merge — this branch is for review only, per the spike constraint above.

## Steps

### Step 1: Re-measure the current fold gap
On the current PDP, at 375×812, load a multi-attribute in-stock product (or synthesize one via the dev server if real catalog data isn't available in your environment — a product with ≥4 size values, ≥2 color values, and quantity >1 exercises the worst case). Record: viewport height, `#add-to-cart-button` bounding-rect top/bottom, and which of steps 1-8 (Current state, above) are present. This is your baseline for comparing options.

### Step 2: Build Option A (collapsed selectors)
Implement the trigger + sheet as described. Measure the new `#add-to-cart-button` top after collapsing both axes. Screenshot both states (closed, open).

### Step 3: Build Option B (scoped compression)
Implement all three sub-changes. Measure the new `#add-to-cart-button` top. Screenshot.

### Step 4: Build Option C (reveal-on-demand)
Implement the IntersectionObserver toggle. Screenshot both states (before/after the real button scrolls out of view). Note in your report: does this count as "the same thing we rejected" in the maintainer's judgment, or is the absence-until-scrolled-past distinction meaningful? Don't decide for them — ask the question clearly in your report.

### Step 5: Report
For each option: screenshots (closed/open or before/after where applicable), the measured fold-clearance number, an effort/risk estimate for turning it into a real (non-spike) plan, and one sentence on its main trade-off. Do not recommend a single winner unless one option strictly dominates on every axis (fold clearance, accessibility, implementation risk) — if it's a genuine trade-off, present it as one.

## Done criteria

- [ ] `pnpm check` and `pnpm lint` pass on the prototype branch (prototypes should still be valid TypeScript/Astro, even if throwaway)
- [ ] All three options have measurements and screenshots in the final report
- [ ] Branch is pushed nowhere; report says so explicitly
- [ ] `plans/README.md` status row for 204 updated to reflect the spike is complete and awaiting the maintainer's choice (not "DONE" in the shipped sense — use "TODO" with a note, or "BLOCKED (awaiting maintainer choice)")

## STOP conditions

- No real or synthesizable multi-attribute product data is available to measure against — report this rather than guessing numbers.
- Implementing Option A's sheet would require a new client-side state library or framework not already in this repo (Astro islands + vanilla TS/DOM only, matching `SizeGuide.astro`'s pattern) — if it seems to need more than that, stop and report what's missing.

## Maintenance notes

- Whichever option the maintainer picks becomes its own follow-up implementation plan (with tests, done criteria, etc.) — this spike's output feeds that plan, it is not itself shippable.
- Plan 205 (touch-target/chip redesign spike) should account for whichever option is chosen here if it's Option A — the chip *inside* the sheet still needs the touch-target work from 205, and the sheet *trigger* itself needs a touch target too.
