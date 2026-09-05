# Plan 149: Stop font preloads from outranking the LCP image

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat ad2999d..HEAD -- netlify.toml src/components/BaseHead.astro`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `ad2999d`, 2026-09-05

## Why this matters

The homepage preloads 119 KB of WOFF2 (`AlumniSans.woff2` 56,792 B +
`Cabin.woff2` 62,588 B) **twice over**: once via `<link rel="preload">` in the
document head, and again via an HTTP `Link:` response header set in
`netlify.toml`. The header form is the aggressive one — the browser starts
those two downloads from the response headers, before it has parsed a single
byte of HTML, and therefore before it can discover the LCP image preload.

On a Chrome DevTools trace of production at Slow 4G + 4x CPU throttling, the
LCP image showed **270 ms of "resource load delay"** — 21% of a 1295 ms LCP —
which is the window where the image had been discovered but was waiting behind
other transfers. `AlumniSans.woff2` additionally carries
`fetchpriority="high"`, putting it in the same priority band as the LCP image
it is competing with.

The duplicate `Link:` header buys nothing (the in-document preload already
covers it, and it only applies to `/`), and costs contention on the exact
request that determines LCP.

## Current state

### The duplicate preload — HTTP header form

`netlify.toml:20-26`:

```toml
# Root page - HTTP/2 Push for critical assets
[[headers]]
for = "/"
[headers.values]
Cache-Control = "public, max-age=0, must-revalidate"
Link = '''</fonts/AlumniSans.woff2>; rel=preload; as=font; type=font/woff2; crossorigin,
</fonts/Cabin.woff2>; rel=preload; as=font; type=font/woff2; crossorigin'''
```

Note the stale comment: HTTP/2 Push is dead — removed from Chrome in 2022 —
and this is a `Link: rel=preload` header, not a push directive. The comment
describes a mechanism that no longer exists.

Note also that this block's `Cache-Control` for `/` is **superseded at
runtime**: `src/pages/index.astro:29-36` sets its own
`public, s-maxage=300, stale-while-revalidate=1800`, which is what production
actually serves (verified via `curl -sSI https://www.elcaminoskateshop.com/`).
That is fine and **out of scope** — do not "fix" it.

### The duplicate preload — document form

`src/components/BaseHead.astro:74-91`:

```astro
<!-- Alumni Sans: Display font - high priority for headings/LCP -->
<link
    rel="preload"
    href="/fonts/AlumniSans.woff2"
    as="font"
    type="font/woff2"
    crossorigin="anonymous"
    fetchpriority="high"
/>
<!-- Cabin: Body font - standard priority -->
<link
    rel="preload"
    href="/fonts/Cabin.woff2"
    as="font"
    type="font/woff2"
    crossorigin="anonymous"
/>
```

### Why the fonts are still needed early

`src/components/BaseHead.astro:96-113` hides `h1` until fonts resolve:

```css
    .fonts-loading h1 {
        opacity: 0;
        transition: opacity 0.1s ease;
    }
```

and the inline script at `src/components/BaseHead.astro:26-66` adds
`fonts-loading` then removes it once `document.fonts.load()` resolves for four
faces (which map to the two preloaded files). **Do not remove the font
preloads entirely** — that would leave `h1` hidden for longer. Only remove the
*duplicate* and demote the priority.

All four `@font-face` rules already use `font-display: swap`
(`src/styles/global.css:363-405`), so text renders with the fallback if a font
is slow — the `opacity` gate is the stricter constraint, not the font loading
itself.

### Unused preconnects (bundled here — same file, same concern)

`src/components/BaseHead.astro:135-137`:

```astro
<link rel="preconnect" href="https://elcaminoskateshop.wordpress.com" />
<link rel="preconnect" href="https://api.zippopotam.us" />
```

The DevTools `NetworkDependencyTree` insight flags **both** as unused on the
homepage: images are served same-origin through Netlify's Image CDN (the
wordpress.com URL only ever appears as a `?url=` parameter, never as a request
origin), and `api.zippopotam.us` is a checkout-time postcode lookup, not a
homepage request. Each unused preconnect costs a speculative DNS + TCP + TLS
handshake competing with the critical path.

## Commands you will need

| Purpose   | Command              | Expected on success             |
|-----------|----------------------|---------------------------------|
| Typecheck | `pnpm check`         | exit 0, 0 errors                |
| Tests     | `pnpm test:run`      | exit 0, all pass                |
| Lint      | `pnpm lint`          | exit 0                          |
| Build     | `pnpm build`         | exit 0                          |

Do **not** use `pnpm test` — watch mode, it will hang.

## Scope

**In scope**:
- `netlify.toml` (the `Link` header only)
- `src/components/BaseHead.astro` (font preload `fetchpriority`; preconnects)

**Out of scope** (do NOT touch):
- The `Cache-Control` value in the `for = "/"` block. It is overridden at
  runtime by `src/pages/index.astro`; changing it here does nothing and risks
  confusion.
- The `@font-face` declarations in `src/styles/global.css:354-405`, including
  the `font-display: swap` values and the metric-override "Alumni Fallback"
  face. Correct as-is.
- The `fonts-loading` / `fonts-loaded` inline script and the `h1` opacity gate
  in `BaseHead.astro`. That mechanism has its own tradeoffs; re-litigating it
  is not this plan's job.
- The `dns-prefetch` hints at `BaseHead.astro:138-139` — cheap, and the
  Square/api origins are genuinely used on other routes.
- The LCP image preload at `src/pages/index.astro:104-127`. Plan 150 owns it.

## Git workflow

- Branch: `advisor/149-stop-fonts-outranking-lcp-image`
- Conventional commits, e.g.
  `perf: drop duplicate font preload header and unused preconnects`
- Do NOT push or open a PR unless the operator instructs it.

## Steps

### Step 1: Remove the duplicate `Link:` preload header

In `netlify.toml`, delete the `Link = '''...'''` value (lines 25-26) from the
`for = "/"` block. Keep the block and its `Cache-Control` line. Update the
stale comment on line 20 — it claims "HTTP/2 Push", which does not exist.

The block should end up as:

```toml
# Root page. Cache-Control here is superseded at runtime by the value
# src/pages/index.astro sets on Astro.response; kept for the static case.
# The font `Link: rel=preload` header that used to live here was removed:
# it duplicated the in-document <link rel=preload> in BaseHead.astro and,
# because response headers are processed before HTML parsing, it started
# 119KB of WOFF2 ahead of the LCP image's own preload.
[[headers]]
for = "/"
[headers.values]
Cache-Control = "public, max-age=0, must-revalidate"
```

**Verify**:
```bash
grep -n "Link = \|AlumniSans.woff2" netlify.toml
```
→ no matches.

### Step 2: Demote the Alumni font preload priority

In `src/components/BaseHead.astro`, remove the `fetchpriority="high"` line
(line 82) from the `AlumniSans.woff2` preload. Keep the preload itself, and
keep `crossorigin="anonymous"` — a font preload without it double-fetches.

Add a short comment explaining the choice:

```astro
<!-- Alumni Sans: display font for headings. Preloaded (the h1 opacity gate
     below waits on it) but deliberately NOT fetchpriority=high — that put it
     in the same priority band as the LCP image and delayed it. -->
```

**Verify**:
```bash
grep -n "fetchpriority" src/components/BaseHead.astro
```
→ no matches. (`src/pages/index.astro`'s LCP preload keeps its own
`fetchpriority="high"` — that file is out of scope and must be unchanged.)

### Step 3: Remove the two unused preconnects

Delete both `<link rel="preconnect">` lines at
`src/components/BaseHead.astro:135-137` and replace with a comment recording
why, so nobody re-adds them:

```astro
<!-- No preconnect to elcaminoskateshop.wordpress.com: images are served
     same-origin via Netlify's Image CDN, so that host is never a request
     origin — only a ?url= parameter value. Likewise api.zippopotam.us is a
     checkout-time postcode lookup, not a page-load request. Both were flagged
     "Unused preconnect" by the DevTools NetworkDependencyTree insight and each
     cost a speculative DNS+TCP+TLS handshake on the critical path. -->
```

**Verify**:
```bash
grep -n "rel=\"preconnect\"" src/components/BaseHead.astro
```
→ no matches.

```bash
grep -c 'rel="dns-prefetch"' src/components/BaseHead.astro
```
→ `2` (both `dns-prefetch` link elements unchanged). Note a bare
`grep -n "dns-prefetch"` returns **3** matches — the two links plus the
explanatory comment on line 126 — so match on `rel="dns-prefetch"` to count
elements.

### Step 4: Confirm headings still appear promptly

Start `pnpm dev`, open `http://localhost:4321/`. In DevTools:

1. Application → Local Storage → delete the `fonts-loaded` key (the inline
   script short-circuits on it; without clearing, you will not exercise the
   cold path).
2. Network → **Slow 4G**; Performance → **4x CPU**.
3. Hard-reload with cache disabled.

**Verify**:
- Headings become visible within ~1 s; no indefinitely blank `h1`.
- `document.documentElement.className` contains `fonts-loaded` (not stuck on
  `fonts-loading`) once settled.
- No console errors.

### Step 5: Full gate

**Verify**, all four exit 0:
```bash
pnpm check && pnpm lint && pnpm test:run && pnpm build
```

## Test plan

- No unit tests apply: this plan changes only resource hints and a response
  header, neither of which is reachable from Vitest.
- Verification is Step 4's browser check plus, after deploy, a re-run of the
  DevTools trace. Record the LCP "resource load delay" before and after in the
  `plans/README.md` status row. Production baseline at Slow 4G + 4x CPU was
  **270 ms** of a 1295 ms LCP.
- `pnpm test:run` must still pass unchanged (no test touches these files).

## Done criteria

ALL must hold:

- [ ] `grep -n "Link = \|AlumniSans.woff2" netlify.toml` returns no matches
- [ ] `grep -n "fetchpriority" src/components/BaseHead.astro` returns no matches
- [ ] `grep -n "rel=\"preconnect\"" src/components/BaseHead.astro` returns no matches
- [ ] `grep -c 'rel="dns-prefetch"' src/components/BaseHead.astro` returns 2
- [ ] `grep -c "rel=\"preload\"" src/components/BaseHead.astro` returns 2 (both font preloads kept)
- [ ] `src/pages/index.astro` is unmodified (`git status`)
- [ ] Step 4: headings visible within ~1 s with `fonts-loaded` local-storage key cleared
- [ ] `pnpm check` / `pnpm lint` / `pnpm test:run` / `pnpm build` all exit 0
- [ ] Only `netlify.toml` and `src/components/BaseHead.astro` modified (`git status`)
- [ ] `plans/README.md` status row updated, with before/after LCP load-delay numbers

## STOP conditions

Stop and report back (do not improvise) if:

- Headings visibly regress — blank `h1` for noticeably longer than before, or
  `fonts-loading` sticking. The `opacity` gate makes font timing user-visible;
  if removing `fetchpriority="high"` costs real perceived speed, that is a
  genuine tradeoff for the operator to weigh, not for you to resolve.
- Removing the `Link:` header changes anything about `/`'s served
  `Cache-Control` (it should not — `index.astro` sets it at runtime).
- A font double-fetches after the change (check the Network panel for two
  requests to the same `.woff2`) — that means `crossorigin` was disturbed.
- Any verification fails twice after a reasonable fix attempt.

## Maintenance notes

- **Do not re-add `fetchpriority="high"` to a font.** Fonts and the LCP image
  compete for the same priority band; the image should win. If heading
  appearance needs to be faster, subset the font or relax the `h1` opacity gate
  instead.
- If a future page genuinely fetches from `elcaminoskateshop.wordpress.com` or
  `api.zippopotam.us` *during initial load*, a preconnect becomes correct again
   — but scope it to that route, not to every page via `BaseHead`.
- A reviewer should scrutinize: both font preloads still present with
  `crossorigin`, and `src/pages/index.astro` untouched.
- **Deliberately deferred**: revisiting the `h1 { opacity: 0 }` font gate
  itself, and subsetting the two WOFF2 files (119 KB combined is large for two
  faces). Both are real opportunities but need design input, not a mechanical fix.
