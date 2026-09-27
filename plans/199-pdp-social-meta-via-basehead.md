# Plan 199: Product pages emit one set of social meta tags (through `BaseHead`), not duplicates

> **Executor instructions**: Follow step by step; run every verification command; on any STOP condition stop and report. Do NOT edit `plans/README.md`; report the outcome in your final message.
>
> **Drift check (run first)**: `git diff --stat 1ca06c0..HEAD -- src/components/BaseHead.astro src/layouts/Layout.astro "src/pages/product/[id].astro" src/lib/product/structuredData.ts` — on any change, re-read the excerpts below; on a mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW-MED (SEO/social-preview metadata)
- **Depends on**: plan 196 (merged — `BaseHead`/`Layout` already accept `description`)
- **Category**: bug (SEO)
- **Planned at**: commit `1ca06c0`, 2026-09-27

## Why this matters

`BaseHead.astro` emits a full default social tag set on every page (`og:title`, `og:description`, `og:image`, `og:type` = `website`, `og:site_name`, `twitter:card`, `twitter:title`, `twitter:description`, `twitter:image:src`). `src/pages/product/[id].astro:423-451` then adds its **own** copy of most of them through `slot="head"` (`og:title`, `og:description`, `og:image`, `og:type` = `product`, `og:site_name`, `twitter:card`, `twitter:title`, `twitter:description`, `twitter:image`). Every product page therefore carries two `og:type` tags with conflicting values, two `og:image`s (the site default and the product photo), and two of most others. Scrapers usually take the first occurrence, and `BaseHead`'s comes first — so shared product links can preview with the generic site image and `og:type=website`. This was found while planning 196; it has NOT been confirmed against a live scraper, so Step 1 confirms it from the source before changing anything.

## Current state

- `src/components/BaseHead.astro` (props `title`, `structuredData?`, `orgSchema`, `description?`) emits, near line 205-215: `og:type` (fixed `website`), `og:title`/`twitter:title` (= `title`), `og:image:alt`/`og:description`+`name=description`/`twitter:description` (= `description`), `og:image` and `twitter:image:src` (= `seoData.defaultImage`), `twitter:card`, `og:site_name`.
- `src/layouts/Layout.astro` forwards `title`, `structuredData`, `description` to `BaseHead` and has `<slot name="head" />`.
- `src/pages/product/[id].astro:418-451`: `<Layout title={fullTitle} …>` with head-slot tags from `ogData` (`generateOGData`) and `twitterData` (`generateTwitterCardData`, both in `src/lib/product/structuredData.ts`). `ogData.title` = brand-prefixed product title (differs from the page `title` `fullTitle`); `ogData.description` = `product.description` or a fallback; `ogData.image` is absolute; `ogData.type` = `'product'`; PDP-only tags with no `BaseHead` equivalent: `og:url`, `product:price:amount`, `product:price:currency`, `product:availability`, and `twitter:image` (BaseHead emits the legacy `twitter:image:src`).
- Precedent for single-source props: plan 196's `description` prop (see `git show 9c69873`).
- Tests: `src/components/__tests__/BaseHead.test.ts` (AstroContainer, `locals: { nonce: 'test' }`, `request: new Request('http://localhost/')`) — extend it.

## Commands

`pnpm check` (0 errors), `pnpm lint` (exit 0), `pnpm test:run`, `pnpm test:coverage` (exit 0).

## Scope

**In scope**: `src/components/BaseHead.astro`, `src/layouts/Layout.astro`, `src/pages/product/[id].astro` (head-slot meta block + `<Layout>` props only), `src/components/__tests__/BaseHead.test.ts`.
**Out of scope**: `src/lib/product/structuredData.ts` (do not change generators), `CartLayout.astro`/`AdminLayout.astro`, JSON-LD (`structuredData`), other pages, `site-config.ts`.

## Git workflow

Branch `advisor/199-pdp-social-meta`; commits `feat: BaseHead accepts per-page social image/type/title`, `fix: product pages emit one set of social meta tags`. Do NOT push or open a PR.

## Steps

### Step 1: Confirm the duplication (read-only)
Render `BaseHead` (defaults) and note its tags; read `[id].astro:423-451`. If Square data is unavailable you cannot render a real PDP — that's fine, the duplication is evident from the source. Write the exact duplicate list in your final report.

### Step 2: Extend `BaseHead`/`Layout` props (all optional, backwards-compatible)
Add: `socialTitle?: string` (used for `og:title` and `twitter:title`; defaults to `title`), `image?: string` (absolute URL; used for `og:image` and `twitter:image:src`; defaults to `seoData.defaultImage`), `ogType?: 'website' | 'product' | 'article'` (default `'website'`). Thread all three through `Layout.astro`. `description` already exists — use it as is. Also add `og:url` only if `BaseHead` doesn't already emit it — check first; if absent leave it in the PDP slot.
**Verify**: `pnpm check` → 0 errors; `CartLayout.astro` and `AdminLayout.astro` unmodified (`git diff --stat`).

### Step 3: PDP passes values, drops the duplicate tags
In `[id].astro`: `<Layout title={fullTitle} description={ogData.description} socialTitle={ogData.title} image={ogData.image} ogType="product" …>`. In the head slot, delete only the duplicated tags (`og:title`, `og:description`, `og:image`, `og:type`, `og:site_name`, `twitter:card`, `twitter:title`, `twitter:description`); keep `og:url`, the three `product:*` tags, and `twitter:image` (unique). Keep the LCP preload `<link>` untouched.
**Verify**: `grep -c 'property="og:' "src/pages/product/[id].astro"` → 1 (`og:url` only); `pnpm check` → 0 errors.

### Step 4: Tests
Extend `BaseHead.test.ts`: (a) defaults → `og:type` is `website`, one `og:image`, image is the site default; (b) `ogType: 'product', image: 'https://x/y.jpg', socialTitle: 'Brand Thing', description: 'D'` → exactly one `og:type` = `product`, one `og:image` = the given URL, `og:title` and `twitter:title` = `Brand Thing`, `<title>` still equals `title`; count each with a regex to prove no duplicates.
**Verify**: `pnpm test:run src/components/__tests__/BaseHead.test.ts` → all pass.

## Test plan

Step 4, plus a manual note: after deploy, run one product URL through a social-card debugger (Facebook Sharing Debugger / Twitter card validator) — the executor can't do this; list it for the operator.

## Done criteria

- [ ] `pnpm check`, `pnpm lint`, `pnpm test:run`, `pnpm test:coverage` exit 0
- [ ] `git status` shows only the four in-scope files changed
- [ ] `git diff` for `[id].astro` touches only the head-slot meta block and `<Layout>` props

## STOP conditions

- `BaseHead` emits `og:url` differently from what the PDP expects and it can't be reconciled without changing the generators.
- `ogData`/`twitterData` fields have changed shape (drift).
- Keeping any PDP tag would still leave a duplicate you can't remove without dropping unique data — report.

## Maintenance notes

- Rule: pages pass values to `Layout`; only `BaseHead` emits generic social tags. Other pages that add their own social tags via the head slot (none found today) should follow the same pattern.
- Reviewer: view the PDP source of a real product after merge and check each `og:`/`twitter:` name appears once.
