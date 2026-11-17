# Plan 213: Keep staging out of search results and give every page one canonical host

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
> When done, update this plan's status row in `plans/README.md`.

> **Drift check (run first)**:
> `git diff --stat 2ba4b13..HEAD -- src/components/BaseHead.astro netlify.toml astro.config.mjs src/lib/site-config.ts public/robots.txt`
> If any listed file changed, compare the "Current state" notes against the
> live code first; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: —
- **Category**: seo
- **Planned at**: commit `2ba4b13`, 2026-11-16

## Why this matters

Staging (`elcaminoskateshop.netlify.app`) serves the same pages as production
and tells search engines to index them. Each page also declares itself
canonical on whatever host served it, so the staging copy never points at the
real one. And the code disagrees with itself about whether the shop's address
has `www.` in it.

## Current state

- `src/components/BaseHead.astro:214`:
  `<link rel="canonical" href={Astro.url.toString()} />` uses the request
  host, and includes query strings.
- `netlify.toml:121`: `X-Robots-Tag = "index, follow"` on every deployment.
- `public/robots.txt`: `Allow: /` on every deployment.
- `astro.config.mjs:21`, `src/lib/site-config.ts:44`,
  `src/lib/sitemapPages.ts:22`, `public/robots.txt:6` use
  `https://elcaminoskateshop.com` (no `www`).
  `src/lib/email/templates.ts:102` uses `https://www.elcaminoskateshop.com`.
  The live site is reached at `www`.

## Steps

### Step 1: Decide the canonical host

Check which of the two hosts redirects to the other in production
(`curl -sI https://elcaminoskateshop.com | grep -i location`). The host that
answers 200 is canonical. **Verify**: record the result. Ask Travis only if
neither redirects.

### Step 2: One constant for the site origin

Make `site-config.ts`'s `url` the single source; have `sitemapPages.ts` and
`templates.ts` read it, keep `astro.config.mjs` and `robots.txt` matching it,
and add a unit test that fails if they diverge. **Verify**:
`git grep -n "elcaminoskateshop.com" -- src astro.config.mjs public` shows one
spelling of the origin.

### Step 3: Canonical from the configured origin

Build the canonical URL from the configured origin plus `Astro.url.pathname`.
Drop the query string except where a page is genuinely different per query
(check `/news` tag and filter pages before deciding). **Verify**: on a local
build, a product page requested with `?utm_source=x` emits a canonical with no
query and the production host.

### Step 4: No indexing off production

In `src/middleware.ts`, when the request host is not the canonical host, set
`X-Robots-Tag: noindex, nofollow` on the response, and remove the blanket
header from `netlify.toml`. **Verify**: unit test for both hosts; `curl -sI`
against a deploy preview shows `noindex`.

### Step 5: Full gate

`pnpm check && pnpm lint && pnpm test:coverage` all exit 0.

## STOP conditions

- The canonical change alters URLs that are meaningfully different per query
  string (category filters): stop and list them before shipping.
