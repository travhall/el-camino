# Plan 146: Make transformed images browser-cacheable by routing them through an owned path

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat ad2999d..HEAD -- netlify.toml src/lib/image/enhanced-optimizer.ts src/lib/wordpress/content-utils.ts src/lib/product/pdpUI.ts src/lib/product/quickViewController.ts src/scripts/mini-cart-client.ts src/components/RecentlyViewed.astro src/pages/the-shop/index.astro`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `ad2999d`, 2026-09-05

## Why this matters

Every image on the site is served with `cache-control: public,max-age=0,must-revalidate`,
so no browser can ever reuse one without a network round-trip first. Measured
live on **both** production and staging on 2026-09-05:

```
$ curl -sSI "https://www.elcaminoskateshop.com/.netlify/images?url=https%3A%2F%2Felcaminoskateshop.wordpress.com%2Fwp-content%2Fuploads%2F2026%2F03%2Fel-co-02.jpg&w=1024&q=75&fm=avif"
HTTP/2 200
cache-control: public,max-age=0,must-revalidate
content-length: 143968
```

The homepage loads 9 such images. On a Chrome DevTools trace of production at
Slow 4G + 4x CPU throttling, the LCP image alone took **570 ms** of resource
load duration inside a 1295 ms LCP. This is the largest single contributor to
the "initial page load is choppy / slow to render" symptom the shop owner
reports: the entrance animations and skeleton removal are racing images that
must be re-fetched or at minimum re-validated on every single page view.

`netlify.toml` already contains a rule that was written to fix exactly this,
but it has never worked (see "Current state"). After this plan, transformed
images carry a long `max-age` and repeat views paint them from disk cache with
zero network round-trips.

## Current state

### The header rule that never fires

`netlify.toml:81-84`:

```toml
# Netlify Image CDN - Aggressive caching for transformed images
[[headers]]
for = "/.netlify/images/*"
[headers.values]
Cache-Control = "public, max-age=2592000, s-maxage=31536000, stale-while-revalidate=86400, immutable"
```

Two independent reasons this rule is dead, both verified live:

1. **The glob does not match the real URL.** Requests are
   `/.netlify/images?url=...` — the transform arguments are a *query string*,
   not a path segment. `for = "/.netlify/images/*"` requires a trailing slash
   plus a path. (`curl -sSI https://www.elcaminoskateshop.com/.netlify/images/`
   returns `HTTP/2 400` — that path form is not how the endpoint is addressed.)

2. **`netlify.toml` custom headers do not reach the Image CDN endpoint at
   all.** The image response carries **none** of the `for = "/*"` security
   headers defined at `netlify.toml:100-118` — no `X-Frame-Options`, no
   `Referrer-Policy`, no `Permissions-Policy` — and its
   `strict-transport-security` is Netlify's own default (`max-age=31536000`),
   not the repo's configured value (`max-age=31536000; includeSubDomains; preload`).

Per Netlify's Image CDN documentation, `Cache-Control` for a transformed image
is inherited from the **source** image. Every source here is remote, and both
remote origins are unhelpful:

```
$ curl -sSI https://elcaminoskateshop.wordpress.com/wp-content/uploads/2026/03/el-co-02.jpg
content-type: image/jpeg
expires: Tue, 25 Aug 2026 06:07:48 GMT      # no cache-control at all; this date is in the PAST

$ curl -sSI https://items-images-sandbox.s3.us-west-2.amazonaws.com/files/57ca.../original.jpeg
HTTP/1.1 200 OK
Content-Length: 53089                        # no cache headers whatsoever
```

An already-expired `Expires` with no `Cache-Control` means "stale", which
Netlify propagates downstream as `max-age=0, must-revalidate`. Neither origin
is under this repo's control (wordpress.com hosted; Square's S3 bucket), so
fixing the origin is not an option.

Netlify's documented workaround is a **rewrite**: serve the transform from a
path you own, then attach headers to that path.

### A shared helper already exists — prefer it over threading a constant

`src/lib/image/enhanced-optimizer.ts:275` already exports a shared builder:

```ts
export function toNetlifyImageCDN(
  src: string,
  width: number,
  opts: { height?: number; quality?: number; fit?: string } = {}
): string {
  if (!src?.startsWith("http")) return src ?? "";
  const { height, quality = 80, fit = "cover" } = opts;
  const params = new URLSearchParams({ url: src, w: String(width), q: String(quality), fit });
  if (height) params.set("h", String(height));
  return `/.netlify/images?${params.toString()}`;
}
```

It already has three importers — `Sidebar.astro:6`, `CategoryStrip.astro:13`,
`RelatedProducts.astro:7`.

**Three of the call sites below are byte-equivalent private copies of this
function**: `mini-cart-client.ts:133` (`optimizeCartImage`),
`RecentlyViewed.astro:48` (`optimizeProductImage`), and
`quickViewController.ts:188` (`optimizeImageSrc`) — each preceded by the same
copy-pasted comment block.

So Step 2/3 have a choice, and the better one is: **route those three copies
through `toNetlifyImageCDN` and change the prefix inside that one function**,
rather than importing a prefix constant into eight files. Fewer edits, and it
collapses duplication instead of spreading a new constant across it. Note the
guard difference — `toNetlifyImageCDN` guards on `startsWith("http")`, so
confirm each copy's inputs are absolute URLs before replacing it (the
`the-shop/index.astro` srcsets pass **relative** paths like `/the-shop-01.png`
and therefore cannot use this helper — they need the literal prefix).

### The 8 places that build image URLs

All of them produce the same `/.netlify/images?...` shape:

- `src/lib/image/enhanced-optimizer.ts:197` — main SSR optimizer (WordPress path)
  ```ts
        return `/.netlify/images?${netlifyParams.toString()}`;
  ```
- `src/lib/image/enhanced-optimizer.ts:289` — second builder in the same file
  ```ts
    if (height) params.set("h", String(height));
    return `/.netlify/images?${params.toString()}`;
  ```
- `src/lib/wordpress/content-utils.ts:318` — inside `buildNetlifyImageCDNUrl()`
  ```ts
      return `/.netlify/images?${params.toString()}`;
  ```
- `src/lib/product/pdpUI.ts:293` — PDP gallery srcset builder
  ```ts
        return `/.netlify/images?${params.toString()} ${size}w`;
  ```
- `src/lib/product/quickViewController.ts:197`
- `src/scripts/mini-cart-client.ts:142`
- `src/components/RecentlyViewed.astro:51`
- `src/pages/the-shop/index.astro` — **10 hardcoded `srcset` attributes** at
  lines 84, 88, 166, 170, 201, 205, 236, 240, 284, 288, e.g.
  ```astro
              srcset="/.netlify/images?url=/the-shop-01.png&fm=avif&w=1200&q=75"
  ```

There is also a **guard** at `src/lib/wordpress/content-utils.ts:280` that
must be kept in sync:

```ts
      !src.startsWith('/.netlify/images')
```

And a **test** that asserts the literal prefix, at
`src/lib/wordpress/__tests__/content-utils.test.ts:227` and `:230`.

### Repo conventions

- Astro 7 SSR, TypeScript, pnpm. Tailwind v4.
- Tests are Vitest; test files live in `__tests__/` next to the code
  (`src/lib/wordpress/__tests__/content-utils.test.ts` is the exemplar for
  this plan's test changes).
- Coverage thresholds are enforced in `vitest.config.ts` and will fail the
  build if coverage drops.

## Commands you will need

| Purpose   | Command                              | Expected on success            |
|-----------|--------------------------------------|--------------------------------|
| Typecheck | `pnpm check`                         | exit 0, 0 errors               |
| Tests     | `pnpm test:run`                      | exit 0, all pass               |
| Coverage  | `pnpm test:coverage`                 | exit 0, no threshold regression|
| Lint      | `pnpm lint`                          | exit 0                         |
| Build     | `pnpm build`                         | exit 0                         |

Do **not** use `pnpm test` — it starts Vitest in watch mode and will hang.

## Scope

**In scope**:
- `netlify.toml`
- `src/lib/image/enhanced-optimizer.ts`
- `src/lib/wordpress/content-utils.ts`
- `src/lib/product/pdpUI.ts`
- `src/lib/product/quickViewController.ts`
- `src/scripts/mini-cart-client.ts`
- `src/components/RecentlyViewed.astro`
- `src/pages/the-shop/index.astro`
- `src/lib/wordpress/__tests__/content-utils.test.ts`
- `src/lib/image/constants.ts` (create — see Step 2)

**Out of scope** (do NOT touch):
- `astro.config.mjs` `image.domains` / `image.remotePatterns` — these govern
  Astro's own `<Image>` component, a different pipeline. Unrelated.
- The `[images] remote_images` allow-list in `netlify.toml:9-16` — that
  allow-list is keyed on the **source** URL (`?url=` value), which this plan
  does not change. Leaving it alone is correct.
- Image `quality` / `w` / `fm` parameter values — a separate plan (151) owns
  those. Change only the URL *prefix*.
- `src/middleware.ts` CSP — `img-src` is not path-scoped; a same-origin path
  change needs no CSP edit. Verify in Step 5, don't pre-emptively edit.

## Git workflow

- Branch: `advisor/146-fix-netlify-image-cache-headers`
- Conventional commits, matching `git log` style, e.g.
  `fix(perf): route Netlify image transforms through /cdn-img so cache headers apply`
- Do NOT push or open a PR unless the operator instructs it.

## Steps

### Step 1: Prove the rewrite works BEFORE changing any call site

This is the load-bearing assumption of the whole plan: that Netlify forwards
the original query string to a rewrite destination that has no query string of
its own, and that `netlify.toml` headers apply to the *requested* path.

Add **only** this to `netlify.toml` — no other change yet. Put the
`[[redirects]]` block immediately after the `[images]` block (after line 16),
and the `[[headers]]` block immediately before the existing
`for = "/.netlify/images/*"` block at line 81:

```toml
# Netlify Image CDN is addressed as /.netlify/images?url=... — a query string,
# not a path — and custom headers from this file do not reach that internal
# endpoint at all. Rewriting through a path we own is Netlify's documented
# workaround: headers below apply to /cdn-img, and cascade to the transform.
[[redirects]]
from = "/cdn-img"
to = "/.netlify/images"
status = 200
force = true
```

```toml
# Transformed images: long browser cache. See the /cdn-img rewrite above.
# The source origins (wordpress.com, Square's S3) send no usable Cache-Control,
# so without this every image costs a network round-trip on every page view.
[[headers]]
for = "/cdn-img"
[headers.values]
Cache-Control = "public, max-age=2592000, s-maxage=31536000, stale-while-revalidate=86400, immutable"
```

Then deploy a **preview** (do not deploy to production) and probe it. If you
cannot produce a deploy preview in your environment, STOP and report — the
rest of this plan is not safe to execute unverified.

**Verify** — against the deploy-preview host, substituting `<PREVIEW_HOST>`:

```bash
curl -sSI "https://<PREVIEW_HOST>/cdn-img?url=https%3A%2F%2Felcaminoskateshop.wordpress.com%2Fwp-content%2Fuploads%2F2026%2F03%2Fel-co-02.jpg&w=1024&q=75&fm=avif" \
  | grep -iE '^(HTTP|cache-control|content-type|content-length)'
```

Expected, **all four**:
- `HTTP/2 200`
- `content-type: image/avif`
- `content-length:` a value in the 100000–200000 range (a real transform, not an error page)
- `cache-control: public, max-age=2592000, s-maxage=31536000, stale-while-revalidate=86400, immutable`

If `cache-control` still reads `max-age=0,must-revalidate`, or the content-type
is `text/html`, the rewrite did not carry the query string. STOP and report —
see STOP conditions for the fallback to evaluate.

### Step 2: Add a single shared constant for the prefix

Create `src/lib/image/constants.ts`:

```ts
// src/lib/image/constants.ts
//
// All Netlify Image CDN URLs are built through this prefix rather than
// hitting /.netlify/images directly. /cdn-img is a status=200 rewrite to
// /.netlify/images declared in netlify.toml; because it is a path this repo
// owns, netlify.toml's [[headers]] rules apply to it and the transformed
// image gets a real browser cache lifetime. Requests sent straight to
// /.netlify/images bypass those headers and come back
// `max-age=0, must-revalidate`.
export const IMAGE_CDN_PREFIX = "/cdn-img";
```

**Verify**: `pnpm check` → exit 0, 0 errors.

### Step 3: Switch every URL builder to the constant

**Prefer consolidation where possible.** Per "A shared helper already exists"
above, first replace the three private copies (`mini-cart-client.ts:133`,
`RecentlyViewed.astro:48`, `quickViewController.ts:188`) with calls to
`toNetlifyImageCDN`, verifying each passes an absolute URL. Then change the
prefix in `toNetlifyImageCDN` itself. Use `IMAGE_CDN_PREFIX` directly only
where consolidation is not possible — notably `the-shop/index.astro`'s ten
static `srcset` attributes (relative paths) and `content-utils.ts` /
`pdpUI.ts`, which have their own parameter shapes.

If consolidating a given copy turns out to change behavior (different default
`quality`, different `fit`, a relative-path input), **leave that copy alone**
and just swap its prefix — do not "fix" the behavior difference here. Note
which copies you consolidated and which you left in the status row.

In each of these files, import `IMAGE_CDN_PREFIX` from `@/lib/image/constants`
and replace the literal `/.netlify/images` prefix. Keep the query-building
logic byte-identical — only the prefix changes.

- `src/lib/image/enhanced-optimizer.ts:197` and `:289`
- `src/lib/wordpress/content-utils.ts:318`
- `src/lib/product/pdpUI.ts:293`
- `src/lib/product/quickViewController.ts:197`
- `src/scripts/mini-cart-client.ts:142`
- `src/components/RecentlyViewed.astro:51`

Example, for `content-utils.ts:318`:

```ts
    return `${IMAGE_CDN_PREFIX}?${params.toString()}`;
```

Also update the guard at `src/lib/wordpress/content-utils.ts:280`:

```ts
      !src.startsWith(IMAGE_CDN_PREFIX)
```

For `src/pages/the-shop/index.astro`, the 10 `srcset` attributes are static
strings in markup. Replace the prefix in place at lines 84, 88, 166, 170, 201,
205, 236, 240, 284, 288:

```astro
              srcset="/cdn-img?url=/the-shop-01.png&fm=avif&w=1200&q=75"
```

**Verify**:
```bash
grep -rn "/\.netlify/images" src/ | grep -v "__tests__"
```
→ **no matches**. (Test files are handled in Step 4.)

```bash
pnpm check
```
→ exit 0, 0 errors.

### Step 4: Update the test that asserts the literal prefix

`src/lib/wordpress/__tests__/content-utils.test.ts:227` and `:230` assert the
`/.netlify/images` string. Update both to `/cdn-img`. Do not change what the
test is testing — only the expected prefix.

**Verify**:
```bash
pnpm test:run
```
→ exit 0, all tests pass. Baseline at commit `ad2999d` is 942+ tests; the count
must not go **down**.

### Step 5: Confirm CSP still allows the images

`src/middleware.ts` sets CSP per request. Read its `img-src` directive and
confirm it permits same-origin images (`'self'`).

**Verify**:
```bash
grep -n "img-src" src/middleware.ts
```
→ the directive includes `'self'`. Since `/cdn-img` is same-origin, exactly
like `/.netlify/images`, no CSP change is needed. If `img-src` somehow
enumerates paths rather than origins, STOP and report — that would be an
unexpected shape and is out of this plan's scope to redesign.

### Step 6: Remove the dead header rule

Delete the now-superseded block at `netlify.toml:81-84`
(`for = "/.netlify/images/*"`). It has never matched anything and leaving it
invites a future reader to believe image caching is handled there.

**Verify**:
```bash
grep -n "/.netlify/images" netlify.toml
```
→ only the `to = "/.netlify/images"` line from the Step 1 rewrite remains.

### Step 7: Full gate

**Verify**, all four exit 0:
```bash
pnpm check && pnpm lint && pnpm test:run && pnpm build
```

## Test plan

- No new unit tests are required: this change is a URL-prefix swap whose real
  behavior (the HTTP response header) can only be verified against a deployed
  Netlify environment, which is what Step 1 does.
- Update the two existing assertions in
  `src/lib/wordpress/__tests__/content-utils.test.ts` (lines 227, 230).
- If `src/lib/image/enhanced-optimizer.ts` has a test file, add one case
  asserting the generated URL starts with `/cdn-img`. Model it on the existing
  assertion style in `src/lib/wordpress/__tests__/content-utils.test.ts`.
- Run `pnpm test:coverage` and confirm exit 0 with no threshold regression.

## Done criteria

ALL must hold:

- [ ] Step 1's `curl` against a deploy preview returned
      `cache-control: public, max-age=2592000, ...` and `content-type: image/avif`
- [ ] `grep -rn "/\.netlify/images" src/` returns no matches
- [ ] `grep -n "/.netlify/images" netlify.toml` returns only the rewrite's `to =` line
- [ ] `pnpm check` exits 0
- [ ] `pnpm lint` exits 0
- [ ] `pnpm test:run` exits 0, test count not lower than baseline
- [ ] `pnpm test:coverage` exits 0, no threshold regression
- [ ] `pnpm build` exits 0
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- **Step 1's probe fails.** Do not proceed to change 8 files on an unverified
  rewrite. Report which of the four expected values was wrong. Two fallbacks
  worth evaluating, but only with operator approval: (a) give the rewrite an
  explicit splat (`from = "/cdn-img/*"` / `to = "/.netlify/images?url=:splat"`)
  and reshape the URL builders to a path form; (b) abandon the rewrite and
  proxy images through an Astro API route that sets its own headers — much
  larger scope, and it puts a function invocation in front of every image.
- You cannot produce a deploy preview. This plan's core claim is unverifiable
  locally; `netlify dev` does not reproduce production header behavior.
- `grep` finds a `/.netlify/images` occurrence in a file not listed in Scope.
- `img-src` in `src/middleware.ts` turns out to be path-scoped rather than
  origin-scoped.
- Any verification fails twice after a reasonable fix attempt.

## Maintenance notes

- **A separate finding (independent scan, 2026-09-05) covers the wider
  duplication**: five distinct Netlify Image CDN URL builders exist, and
  `pdpUI.ts:283-296` uses different breakpoints (`[320,640,768,1024]`) and
  quality (`q=85`) than `enhanced-optimizer.ts:115` (`[320,640,768,1024,1280,1920]`),
  so a PDP variant swap silently changes image quality. That consolidation is
  **out of scope here** — this plan only changes the prefix — but whoever picks
  it up should land it on top of this one.
- **Any new image URL must go through `IMAGE_CDN_PREFIX`.** A future component
  that hardcodes `/.netlify/images` will silently lose browser caching with no
  visible error — the image still loads, just uncached. The Step 3 grep is
  worth keeping as a CI check if `pnpm lint` ever grows custom rules.
- The `[images] remote_images` allow-list in `netlify.toml` is matched against
  the `?url=` **source**, not the request path, so it is unaffected by this
  change. If someone later switches the rewrite to a splat form, re-check that.
- If Netlify ever makes `netlify.toml` headers apply to `/.netlify/images`
  directly, this rewrite becomes redundant — but harmless. Don't rush to
  remove it; verify with the Step 1 probe first.
- A reviewer should scrutinize: that no query-building logic changed (only the
  prefix), and that the 10 `the-shop/index.astro` srcsets were all caught.
- **Deliberately deferred**: image `quality`/dimension tuning (plan 151) and
  the `sizes` mismatch (plan 150). Both are independent of this change.
