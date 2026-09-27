# Plan 194: Guard the OKLCH palette with a WCAG contrast test; fix the light-mode input border

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 426d14e..HEAD -- src/styles/global.css`
> If it changed, re-run Step 1's measurement and compare to the table below;
> on a mismatch, STOP.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: LOW-MED (visual change to form borders)
- **Depends on**: none
- **Category**: bug (accessibility)
- **Planned at**: commit `426d14e`, 2026-09-26

## Why this matters

A design audit said the palette's contrast "has been designed, not measured."
It has now been measured (advisor session, 2026-09-26; WCAG 2.x relative
luminance computed from the OKLCH ramps in `global.css`). **All text tokens pass
AA 4.5:1 in both themes.** Two things are worth acting on: (a) `--ui-input-border`
in light mode is only **2.64:1** on `--surface-primary`, below the 3:1 non-text
minimum (WCAG 1.4.11) for form-control boundaries; (b) a few tokens pass with thin
margins and nothing stops a future palette tweak from silently breaking them. A
test that recomputes contrast from the CSS makes the palette self-guarding.

Measured (light theme unless noted; ratio on the named surface):

| Pair | Ratio | Verdict |
|------|-------|---------|
| `--content-meta`/`--product-category`/`--content-link` (sweet-tea-700) on `--surface-primary` (beeswax-100) | 10.37 | pass |
| same on `--surface-secondary` (beeswax-200) | 9.06 | pass |
| `--content-emphasis` (sweet-tea-500) on `--surface-primary` | 5.19 | pass, thin |
| `--ui-nav-hover` (sweet-tea-500) on `--surface-secondary` | 4.53 | pass, **barely** |
| `--ui-variant-selected-text` on `-surface` (beeswax-700) | 4.79 | pass, thin |
| button text on primary (fig-leaf-600) / secondary (sweet-tea-600) | 8.90 / 6.02 | pass |
| **`--ui-input-border` (sweet-tea-400) on `--surface-primary`** | **2.64** | **FAIL 3:1 non-text** |
| dark: `--content-meta` (sweet-tea-200) on fig-leaf-900 / -800 | 12.66 / 10.80 | pass |
| dark: `--content-emphasis` (sweet-tea-300) on fig-leaf-900 | 9.28 | pass |
| dark: button text on primary (sweet-tea-400) / secondary (fig-leaf-400) | 6.89 / 5.61 | pass |

## Current state

- `src/styles/global.css:2-72` — `@theme inline` block with OKLCH ramps, e.g. `--color-elco-sweet-tea-400: oklch(68% 0.065 60);` (format `oklch(L% C H)`, L as percent). Semantic tokens ~lines 109-195 (`--ui-input-border: var(--color-elco-sweet-tea-400);`, `--surface-primary: var(--color-elco-beeswax-100);` …). Dark overrides in `.dark { … }` starting ~line 199; some lines there are **commented out** (`/* … */`) — only uncommented declarations are live, so strip comments before parsing.
- Some consumers apply the input border at reduced opacity, e.g. `pdpUI.ts` uses `border-(--ui-input-border)/50` for variant buttons and `[id].astro:~905` for the quantity stepper. A 50%-alpha border composites to much lower contrast than the token — see Step 3.
- No `src/styles/__tests__/` dir exists; vitest picks up any `*.test.ts` (see `vitest.config.ts`: `getViteConfig`, happy-dom, globals on). Coverage `include` is `src/lib/**` and `src/pages/api/**` only, so a test under `src/styles/` does not affect coverage thresholds.
- OKLCH → luminance (Björn Ottosson matrices): `l_ = L + 0.3963377774a + 0.2158037573b`, `m_ = L − 0.1055613458a − 0.0638541728b`, `s_ = L − 0.0894841775a − 1.2914855480b` where `a = C·cos(h)`, `b = C·sin(h)`, `L` in 0..1; `l=l_³, m=m_³, s=s_³`; linear `R = 4.0767416621l − 3.3077115913m + 0.2309699292s`, `G = −1.2684380046l + 2.6097574011m − 0.3413193965s`, `B = −0.0041960863l − 0.7034186147m + 1.7076147010s`; clamp each to [0,1]; luminance `0.2126R + 0.7152G + 0.0722B`; ratio `(Lhi+.05)/(Llo+.05)`. (These are already-linear values — do **not** re-apply sRGB gamma decoding.)

## Commands you will need

| Purpose | Command | Expected |
|---------|---------|----------|
| Typecheck | `pnpm check` | 0 errors |
| Tests | `pnpm test:run src/styles` | pass |
| Lint/format | `pnpm lint && pnpm format:check` | exit 0 |
| Coverage | `pnpm test:coverage` | exit 0 |

## Scope

**In scope**:
- `src/styles/__tests__/contrast.test.ts` (create; reads `src/styles/global.css` via `fs`)
- `src/styles/global.css` (only `--ui-input-border`, and only the failing token)
- Consumers of `border-(--ui-input-border)/50` **only** as decided in Step 3

**Out of scope**:
- Any `--color-elco-*` ramp value — the brand palette is off-limits; re-point which *step* a semantic token uses instead
- Admin pages' styling; text tokens (they pass)

## Git workflow

- Branch: `advisor/194-contrast-guard`
- Conventional commits: `test: guard palette contrast (WCAG AA) from global.css`, `fix(a11y): raise light-mode input border to 3:1`
- Do NOT push or open a PR.

## Steps

### Step 1: Write the contrast guard test
Parse `global.css` (strip `/* … */` first): collect `--color-elco-*: oklch(L% C H)`; parse semantic tokens from `@theme inline` and `.dark { }` overrides; resolve `var(--x)` chains; dark = light tokens overlaid by `.dark` overrides. Assert, in both themes:
- text pairs ≥ 4.5: `--content-heading`, `--content-body`, `--content-meta`, `--content-meta-small`, `--content-emphasis`, `--content-link`, `--content-caption`, `--product-category` each on `--surface-primary` and `--surface-secondary`; `--ui-button-text` on `--ui-button-surface`; `--ui-button-secondary-text` on `--ui-button-secondary-surface`; `--ui-variant-selected-text` on `--ui-variant-selected-surface`; `--ui-nav-text` on `--ui-nav-surface`
- non-text ≥ 3.0: `--ui-input-border` on `--ui-input-surface`
Also test the converter itself: `oklch(100% 0 0)` vs `oklch(0% 0 0)` → 21:1 (±0.05). Run it once and confirm the input-border case fails at ≈2.64 (this proves the guard works) before Step 2.

**Verify**: `pnpm test:run src/styles/__tests__/contrast.test.ts` → all pass except the input-border case (fails ≈2.64 < 3.0).

### Step 2: Fix the token
Change light-theme `--ui-input-border` to `var(--color-elco-sweet-tea-500)` (5.19:1 on beeswax-100; nearest ramp step that clears 3:1 — if you want a lighter look, verify `-500` is needed by computing; the step between, none exists). Keep the dark override (`--ui-input-border: var(--content-body)`) unchanged.

**Verify**: `pnpm test:run src/styles/__tests__/contrast.test.ts` → all pass.

### Step 3: Handle the `/50` alpha consumers
`grep -rn "ui-input-border)/" src --include=*.astro --include=*.ts` — for each consumer decide: if it is a **form control boundary** (text input, quantity stepper, or a variant button whose border is its only boundary), remove `/50` (or raise it) so the composited border stays ≥ 3:1; if the control has another visual boundary (e.g. filled background), leave it and record the reason in the commit body. If more than ~6 call sites need changing, STOP and report the list.

**Verify**: `pnpm check` → 0 errors; visual pass in `pnpm dev` on `/cart`, a product page, `/shop/all` filters, light + dark.

## Test plan

Step 1's test is the deliverable. Manual: view input/stepper/variant borders in light theme before/after.

## Done criteria

- [ ] `pnpm test:run` exits 0 including `contrast.test.ts`
- [ ] `pnpm check`, `pnpm lint`, `pnpm format:check`, `pnpm test:coverage` exit 0
- [ ] `git diff src/styles/global.css | grep '^[+-].*--color-elco'` → empty (no ramp edits)
- [ ] `plans/README.md` status row updated

## STOP conditions

- The CSS parser can't resolve a `var()` chain for a token in the list (file structure changed) — report rather than hard-coding values.
- Fixing the input border would require changing a brand ramp value.
- More than ~6 `/50` consumers need changes (Step 3).
- Any *text* pair in Step 1 fails AA — that contradicts the advisor's measurement; report the numbers instead of "fixing" tokens blindly.

## Maintenance notes

- Any future ramp edit that drops a pair below AA now fails `pnpm test:run` (which runs in `.husky/pre-commit`).
- Thin-margin tokens worth watching: `--ui-nav-hover` (4.53), `--ui-variant-selected` (4.79), `--content-emphasis` (5.19).
- Not covered: free-shipping bar colors, status/admin tokens, text over images — extend the pair list if those matter.
