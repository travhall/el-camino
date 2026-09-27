# Plan 196: Per-page meta description support; restore the homepage's keyword-rich description

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, report the outcome in your final
> message; do NOT edit `plans/README.md` (the operator maintains the index).
>
> **Base branch (read first)**: this plan builds on plan 191, which is on
> branch `advisor/191-fix-homepage-permanent-skeleton` (commit `822e7c6`) and
> may not be merged to master yet. Run `git log --oneline master -5` and
> `git branch --list 'advisor/191*'`. If 191 is **not** in master, branch from
> `advisor/191-fix-homepage-permanent-skeleton`
> (`git switch -c advisor/196-per-page-meta-description advisor/191-fix-homepage-permanent-skeleton`);
> if it is in master, branch from master. Either way the state you start from must
> have the homepage's `<meta name="description">` already removed from
> `src/pages/index.astro` (verify in Step 0).
>
> **Drift check (run first)**:
> `git diff --stat 426d14e..HEAD -- src/layouts/Layout.astro src/layouts/CartLayout.astro src/components/BaseHead.astro src/pages/index.astro src/lib/site-config.ts`
> Expected changes: `src/pages/index.astro` (plan 191 removed the meta tag). Anything
> else → compare against the excerpts below; on a mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plan 191 (hard — the homepage meta removal it made is what this restores)
- **Category**: bug (SEO regression fix)
- **Planned at**: commit `426d14e`, 2026-09-26 (reviewed against 191's branch `822e7c6`)

## Why this matters

Plan 191 removed a duplicate `<meta name="description">` from `src/pages/index.astro`
(when a featured image exists the homepage emitted two — one from that page, one
from `BaseHead`). That fixed the duplicate but left `/` with only `BaseHead`'s
generic site default, losing the homepage's richer, keyword-bearing copy:

- Old homepage description: "El Camino Skate Shop is a 100% skater owned and operated skateboard shop in downtown Eau Claire, WI. Shop skateboards, apparel, and accessories."
- Site default (`src/lib/site-config.ts:85`): "El Camino Skate Shop is a skater owned and operated skateboard shop, located in Eau Claire, WI"

The homepage is the highest-value SEO page; it should have a page-specific
description without ever emitting two tags. `Layout` has no `description` prop, so
the clean fix is a per-page prop that flows to `BaseHead`, which already owns the
one description tag.

## Current state

- `src/layouts/Layout.astro:10-16` — props:

```astro
interface Props {
  title: string;
  structuredData?: object;
  activeCategory?: string;
}
const { title, structuredData, activeCategory } = Astro.props;
```
and `Layout.astro:28-32` renders `<BaseHead title={title} structuredData={structuredData} orgSchema={orgSchema} />`.

- `src/components/BaseHead.astro:5-13` — props `{ title, structuredData?, orgSchema }`; builds `const seoData = { ...siteConfig.seo }`. Lines ~201-207 emit, all from `seoData.defaultDescription`:

```astro
<meta property="og:image:alt" content={seoData.defaultDescription} />
<meta
  name="description"
  property="og:description"
  content={seoData.defaultDescription}
/>
<meta name="twitter:description" content={seoData.defaultDescription} />
```

  (Note the middle tag carries **both** `name="description"` and `property="og:description"` — keep that shape.)
- `src/layouts/CartLayout.astro:23` also renders `BaseHead` — must keep working with no description passed.
- `src/pages/index.astro` (after plan 191) — passes `title` to `<Layout>` and has a `<Fragment slot="head">` containing only preload `<link>`s. Its title string: `"El Camino Skate Shop | Skater Owned & Operated in Eau Claire, WI"`.
- `src/pages/product/[id].astro:425` adds its own `og:description` via `slot="head"` — that is a **separate, pre-existing** duplicate-`og:description` situation. Do **not** fix it here (out of scope); it will be easier once this prop exists — note it in Maintenance.
- Tests: vitest; Astro component tests use `AstroContainer` — precedent from plan 191: `src/components/__tests__/ArticleGrid.test.ts` (`// @vitest-environment node`, `experimental_AstroContainer as AstroContainer`, `locals: { nonce: 'test' }`, `request: new Request('http://localhost/')`).
- `BaseHead.astro` renders `ClientRouter` and reads `Astro.locals.nonce`, `Astro.url`; a container render may need `locals: { nonce: 'test' }` and `request`. If it can't render standalone, see Step 4's fallback.

## Commands you will need

| Purpose   | Command              | Expected |
|-----------|----------------------|----------|
| Typecheck | `pnpm check`         | 0 errors |
| Lint      | `pnpm lint`          | exit 0   |
| Format    | `pnpm format:check`  | exit 0   |
| Tests     | `pnpm test:run`      | all pass |
| Coverage  | `pnpm test:coverage` | exit 0   |
| Dev       | `pnpm dev` (then `curl -s localhost:4321/`) | see Step 5 |

## Scope

**In scope**:
- `src/components/BaseHead.astro`
- `src/layouts/Layout.astro`
- `src/pages/index.astro` (pass the description prop only)
- `src/components/__tests__/BaseHead.test.ts` (create)

**Out of scope**:
- `src/layouts/CartLayout.astro`, `AdminLayout.astro` (they keep the default; do not add the prop)
- `src/pages/product/[id].astro` and any other page's head-slot meta tags
- `src/lib/site-config.ts` (do not change the site default)
- Any change to the LCP preload `<link>`s in `index.astro`

## Git workflow

- Branch: `advisor/196-per-page-meta-description` (see "Base branch" above)
- Conventional commits: `feat: accept an optional per-page description in Layout/BaseHead`, `fix: restore the homepage meta description via Layout prop`
- Do NOT push or open a PR.

## Steps

### Step 0: Confirm the starting state
**Verify**: `grep -c 'name="description"' src/pages/index.astro` → `0` (plan 191's removal is present). If it prints `1`, you are not on/after plan 191 — STOP.

### Step 1: `BaseHead` accepts an optional description
In `BaseHead.astro` add `/** Page-specific meta description; falls back to the site default */ description?: string;` to `Props`, destructure it (`const { title, structuredData, orgSchema, description: descriptionProp } = Astro.props;`), and compute `const description = descriptionProp ?? seoData.defaultDescription;`. Replace the **three** uses of `seoData.defaultDescription` (og:image:alt, the combined name/og:description tag, twitter:description) with `description`. Keep the tag shapes identical (including the combined `name`+`property` attributes).

**Verify**: `grep -c "seoData.defaultDescription" src/components/BaseHead.astro` → `1` (only the fallback expression); `pnpm check` → 0 errors.

### Step 2: `Layout` forwards it
In `Layout.astro` add `description?: string;` to `Props`, destructure it, and pass `description={description}` to `<BaseHead>`.

**Verify**: `pnpm check` → 0 errors; `CartLayout.astro` unchanged (`git diff --stat` does not list it).

### Step 3: Homepage passes its copy
In `src/pages/index.astro` pass the description to the layout: `<Layout title="…" description="El Camino Skate Shop is a 100% skater owned and operated skateboard shop in downtown Eau Claire, WI. Shop skateboards, apparel, and accessories.">`. Do not re-add any `<meta name="description">` to the head slot.

**Verify**: `grep -c '<meta' src/pages/index.astro` → `0` (no raw meta tags in the page; only `<link rel="preload">` remain).

### Step 4: Tests
Create `src/components/__tests__/BaseHead.test.ts` modeled on `ArticleGrid.test.ts`. Render `BaseHead.astro` via `AstroContainer` with `props: { title: 'T', orgSchema: {} }`, `locals: { nonce: 'test' }`, `request: new Request('http://localhost/')`:
1. No `description` prop → output contains the site default string (import `siteConfig` from `@/lib/site-config` and compare to `siteConfig.seo.defaultDescription`), and exactly **one** `name="description"` occurrence.
2. With `description: 'Custom copy'` → contains `Custom copy` in the `name="description"`/`og:description` tag and in `twitter:description`, does **not** contain the site default, still exactly one `name="description"` occurrence.
Count with a regex, e.g. `(html.match(/name="description"/g) ?? []).length`.
If `BaseHead` can't render standalone under `AstroContainer` (it imports `astro:transitions` `ClientRouter` and `@/styles/global.css`), try once with the same setup as the ArticleGrid test; if it still fails, STOP and report the error rather than restructuring `BaseHead`, and fall back to verifying via Step 5's curl checks only (state this clearly in your final report).

**Verify**: `pnpm test:run src/components/__tests__/BaseHead.test.ts` → 2 pass.

### Step 5: Live check
Start `pnpm dev`, then:
- `curl -s http://localhost:4321/ | grep -o '<meta[^>]*name="description"[^>]*>'` → exactly one match, containing "100% skater owned".
- `curl -s http://localhost:4321/cart | grep -c 'name="description"'` → `1`, containing the site default ("…skateboard shop, located in Eau Claire, WI").
Stop the dev server afterward. (No Square/WordPress credentials should be needed for these two pages' `<head>`; if `/` fails to render at all without WordPress, note it and rely on the unit tests.)

## Test plan

Step 4 (unit) + Step 5 (live). Regression to watch: exactly one description tag on `/`, regardless of whether a featured image exists (the earlier duplicate only occurred when a featured image did).

## Done criteria

- [ ] `pnpm check`, `pnpm lint`, `pnpm format:check`, `pnpm test:run`, `pnpm test:coverage` all exit 0
- [ ] `grep -rn 'name="description"' src/pages` returns nothing (only `BaseHead` emits it)
- [ ] `git diff --stat <base>..HEAD` (base = the branch you started from) lists only the 4 in-scope files
- [ ] Step 5's `curl` results recorded in your final report

## STOP conditions

- Step 0 shows the homepage still has its own meta description (191 not present).
- `BaseHead`/`Layout` drifted from the excerpts above.
- Making `BaseHead` testable would require restructuring it (Step 4).
- You find a page other than `index.astro` that emits its own `name="description"` — report it; don't fix it here.

## Maintenance notes

- `product/[id].astro:425` and other pages' `slot="head"` `og:description` tags duplicate what `BaseHead` emits. Once this prop exists, those can pass `description` to `Layout` instead — good follow-up (PDP especially: product-specific descriptions matter for SEO).
- Keep the single-tag rule: only `BaseHead` should emit `name="description"`; pages pass the value, never the tag.
- Reviewer: confirm the combined `name="description" property="og:description"` tag is preserved and that `CartLayout` still falls back to the default.
