# Plan 034: Fix reflected XSS in AppliedFilters pill builder

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 0da82aa..HEAD -- src/components/AppliedFilters.astro`
> If the file changed since this plan was written, compare the "Current state"
> excerpts against the live code before proceeding.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `0da82aa`, 2026-07-22

## Why this matters

`AppliedFilters.astro`'s client-side `buildPills()` function inserts URL-parameter
values directly into `innerHTML`. An attacker crafts a URL containing a malicious
`brands` or `categories` value; when a real shopper loads that URL and clicks the
legitimate remove button on any pill, `removeFilter` re-reads all `brands` params
(including the malicious one) and passes them to `buildPills`, which writes the
attacker's string into the DOM without escaping. This allows script injection in
the shopper's browser with one user click — no second tab or special permission
required.

The fix is minimal: replace `innerHTML` template literals with `createElement` +
`textContent` for the user-controlled span, leaving the static SVG icon added
separately. No behavior changes.

## Current state

**File involved**: `src/components/AppliedFilters.astro`

The `buildPills()` function (in the `<script>` block) builds remove-filter buttons.
Lines 253–274 (abridged — confirm against live file):

```typescript
// Line 259 — brand value from URL param written raw to innerHTML:
btn.innerHTML = `<span>${brand}</span>${X_ICON}`;

// Line 272 — category slug/name from URL param written raw to innerHTML:
btn.innerHTML = `<span>${name}</span>${X_ICON}`;
```

`X_ICON` is a const defined earlier in the script block as a string of static SVG
markup — it is safe to set via innerHTML because it contains no user-controlled
content. Only the `${brand}` and `${name}` portions are user-controlled.

Lines 282 and 292 use the same `btn.innerHTML = ...` pattern for the "In stock
only" and "On sale only" pills — these contain **no user input** and are safe to
leave as `innerHTML`.

**Convention**: No existing DOM-creation helper in this file; DOM manipulation in
this codebase uses plain `document.createElement` + property assignment. Follow
that pattern.

## Commands you will need

| Purpose   | Command                    | Expected on success            |
|-----------|----------------------------|--------------------------------|
| Typecheck | `pnpm check`               | exit 0, no errors              |
| Unit tests | `pnpm test:run`           | all pass, no regressions       |
| Build check | `pnpm build`             | exit 0 (optional, confirm only)|

## Scope

**In scope**:
- `src/components/AppliedFilters.astro` — the `buildPills` function inside the `<script>` block

**Out of scope**:
- The server-rendered portion of `AppliedFilters.astro` (above the `<script>` tag) — Astro auto-escapes template expressions in `.astro` files; no change needed there
- Any other component that renders filter pills
- `X_ICON`, `X_ICON_GREEN` constants — static SVG, no user input, safe as-is

## Git workflow

- Branch: `advisor/034-fix-xss-applied-filters`
- Commit message style: `fix: sanitize URL param values before innerHTML in AppliedFilters`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Replace innerHTML for brand pills with textContent

In `src/components/AppliedFilters.astro`, inside the `<script>` block, find the
`brands.forEach` loop (around line 253). Replace:

```typescript
btn.innerHTML = `<span>${brand}</span>${X_ICON}`;
```

with:

```typescript
const brandSpan = document.createElement("span");
brandSpan.textContent = brand;
btn.appendChild(brandSpan);
btn.insertAdjacentHTML("beforeend", X_ICON);
```

`insertAdjacentHTML("beforeend", X_ICON)` is safe here because `X_ICON` is a
compile-time constant containing only static SVG markup with no user-controlled
data — confirmed at the const declaration earlier in the script block.

**Verify**: `grep -n 'innerHTML.*brand' src/components/AppliedFilters.astro` → no output

### Step 2: Replace innerHTML for category pills with textContent

Find the `categories.forEach` loop (around line 263). Replace:

```typescript
btn.innerHTML = `<span>${name}</span>${X_ICON}`;
```

with:

```typescript
const nameSpan = document.createElement("span");
nameSpan.textContent = name;
btn.appendChild(nameSpan);
btn.insertAdjacentHTML("beforeend", X_ICON);
```

Note: `name` is set at line 264 as `categoryNames[slug] || slug`. Both branches
are user-influenced (slug comes from URL param; `categoryNames` is populated from
Square catalog data). Both must be escaped.

**Verify**: `grep -n 'innerHTML.*name\b' src/components/AppliedFilters.astro` → no output (the static "In stock only" and "On sale only" lines are not affected — they contain no variable interpolation of user data)

### Step 3: Typecheck and test

**Verify**: `pnpm check` → exit 0, zero errors

**Verify**: `pnpm test:run` → all existing tests pass

## Test plan

No unit test needed for this client-side DOM fix — the XSS is eliminated by
construction (textContent can never inject HTML). The critical thing to verify
manually in a browser is:

1. Load `/shop/all?brands=TestBrand` — the "TestBrand" pill renders correctly
2. Load `/shop/all?brands=<img+src=x+onerror=alert(1)>` — the pill renders the
   literal string without triggering the onerror

Browser-level testing is outside the CI scope here; the fix is structurally
correct because `textContent` assignment always HTML-escapes the string.

## Done criteria

- [ ] `pnpm check` exits 0
- [ ] `pnpm test:run` exits 0
- [ ] `grep -n 'innerHTML.*\${brand}' src/components/AppliedFilters.astro` → no output
- [ ] `grep -n 'innerHTML.*\${name}' src/components/AppliedFilters.astro` → no output
- [ ] No files outside `src/components/AppliedFilters.astro` are modified
- [ ] `plans/README.md` status row for 034 updated to DONE

## STOP conditions

- The code at lines 259 and 272 doesn't match the excerpts above — the file has changed; compare carefully before proceeding.
- `pnpm check` fails with a TypeScript error in the script block after the change — the insertAdjacentHTML or appendChild approach may need adjustment for the inferred types; report rather than casting to `any`.

## Maintenance notes

- If `X_ICON` or `X_ICON_GREEN` are ever changed to include dynamic content,
  `insertAdjacentHTML` becomes unsafe — switch to `btn.appendChild(svgElement)`.
- The same `innerHTML` pattern appears at lines 282 and 292 for static "In stock
  only" / "On sale only" labels — those are safe and don't need changing.
- Astro's server-rendered `.astro` template expressions (using `{variable}` syntax)
  auto-escape HTML; this XSS exists only in the client-side `<script>` block where
  Astro doesn't intercede.
