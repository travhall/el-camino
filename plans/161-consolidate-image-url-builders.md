# Plan 161: Collapse the five Netlify Image CDN URL builders into one

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report. When done, update this
> plan's status row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat ad2999d..HEAD -- src/lib/image/enhanced-optimizer.ts src/lib/product/pdpUI.ts src/lib/product/quickViewController.ts src/scripts/mini-cart-client.ts src/components/RecentlyViewed.astro`
> On any change, compare against the excerpts below before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW-MED
- **Depends on**: 146 (hard — see Dependency notes)
- **Category**: tech-debt
- **Planned at**: commit `ad2999d`, 2026-09-05

## Why this matters

Five separate functions build Netlify Image CDN URLs, and they disagree.

The visible consequence: **swapping a product variant silently changes image
quality**. The server renders PDP images through `EnhancedImageOptimizer`, whose
srcset breakpoints are `[320, 640, 768, 1024, 1280, 1920]`. When the client swaps
a variant, `pdpUI.ts` rebuilds the srcset with its own hardcoded
`[320, 640, 768, 1024]` and `q=85`. Same image, different URL, different bytes,
different rendered quality.

The wider cost: image quality, sizing, and `fit` policy are set in five places,
so any CDN parameter change reaches only whichever copies the author remembers.

A shared helper already exists and is already proven in three components. Three
of the five builders are byte-for-byte copies of it, each carrying the same
copy-pasted comment block.

## Current state

**The keeper** — `src/lib/image/enhanced-optimizer.ts:275-291`:

```ts
export function toNetlifyImageCDN(
  src: string,
  width: number,
  opts: { height?: number; quality?: number; fit?: string } = {}
): string {
  if (!src?.startsWith("http")) return src ?? "";
  const { height, quality = 80, fit = "cover" } = opts;
  const params = new URLSearchParams({
    url: src,
    w: String(width),
    q: String(quality),
    fit,
  });
  if (height) params.set("h", String(height));
  return `/.netlify/images?${params.toString()}`;
}
```

Existing importers: `Sidebar.astro:6`, `CategoryStrip.astro:13`,
`RelatedProducts.astro:7`.

**The three byte-equivalent copies**, each preceded by the same five-line comment:

- `src/scripts/mini-cart-client.ts:133` — `optimizeCartImage()`
- `src/components/RecentlyViewed.astro:48` — `optimizeProductImage()`
- `src/lib/product/quickViewController.ts:188` — `optimizeImageSrc()`

**The divergent fourth** — `src/lib/product/pdpUI.ts:283-296`:

```ts
      const srcsetParts = sizes.map((size) => {
        const params = new URLSearchParams({
          url: imageUrl,
          w: size.toString(),
          q: '85',
          fit: 'cover',
          h: size.toString(),
        });
        return `/.netlify/images?${params.toString()} ${size}w`;
      });
```

Note it sets `h` equal to `w` (square crop) and hardcodes `q=85`.

**The private fifth** — `src/lib/image/enhanced-optimizer.ts:139`
`optimizeSquareImageUrl()`, with its own quality rules via
`getQualityForFormat()` (`:~115`), whose breakpoints are
`[320, 640, 768, 1024, 1280, 1920]`.

### Guard difference you must respect

`toNetlifyImageCDN` guards on `src.startsWith("http")` and returns the input
unchanged otherwise. Any call site that passes a **relative** path (e.g.
`/the-shop-01.png`) cannot use it as-is. Check each before substituting.

## Commands you will need

| Purpose   | Command              | Expected             |
|-----------|----------------------|----------------------|
| Typecheck | `pnpm check`         | exit 0               |
| Tests     | `pnpm test:run`      | exit 0               |
| Coverage  | `pnpm test:coverage` | exit 0, no regression|
| Lint      | `pnpm lint`          | exit 0               |
| Build     | `pnpm build`         | exit 0               |
| Dev server| `pnpm dev`           | serves on :4321      |

Never use `pnpm test` — watch mode, it hangs.

## Scope

**In scope**:
- `src/lib/image/enhanced-optimizer.ts`
- `src/lib/product/pdpUI.ts`
- `src/lib/product/quickViewController.ts`
- `src/scripts/mini-cart-client.ts`
- `src/components/RecentlyViewed.astro`
- `src/lib/image/__tests__/` (create tests)

**Out of scope** (do NOT touch):
- `src/pages/the-shop/index.astro`'s ten static `srcset` attributes — they pass
  **relative** paths, which `toNetlifyImageCDN`'s `http` guard rejects.
- `src/lib/wordpress/content-utils.ts:318` — different parameter shape (width
  clamped to 1200, `q=75`, no `fit`), on the WordPress content path. Leave it.
- **Changing any rendered image's quality or dimensions.** This is a refactor.
  The one exception is the PDP variant-swap divergence, which Step 3 resolves
  deliberately — and even there, pick the value that matches the *server* render,
  so nothing visibly changes on first paint.
- The URL prefix itself. Plan 146 owns that.

## Git workflow

- Branch: `advisor/161-consolidate-image-url-builders`
- Conventional commits, e.g. `refactor: route all Netlify image URLs through toNetlifyImageCDN`
- Do NOT push or open a PR unless the operator instructs it.

## Steps

### Step 1: Confirm 146 has landed, or adjust

This plan and plan 146 both edit these files. 146 changes the URL **prefix**;
this plan changes **who builds the URL**.

```bash
grep -rn "IMAGE_CDN_PREFIX\|/cdn-img" src/lib/image/enhanced-optimizer.ts
```

If 146 has landed, `toNetlifyImageCDN` already returns the new prefix and you
simply route callers to it. If not, **STOP and report** — landing this first
would force 146 to re-verify five call sites that no longer exist, wasting its
deploy-preview probe.

### Step 2: Replace the three byte-equivalent copies

For each of `mini-cart-client.ts:133`, `RecentlyViewed.astro:48`, and
`quickViewController.ts:188`:

1. Confirm its inputs are absolute `http(s)` URLs (Square/WordPress CDN URLs).
2. Confirm its default `quality` and `fit` match `toNetlifyImageCDN`'s
   (`quality = 80`, `fit = "cover"`). **If they differ, pass the existing value
   explicitly** rather than accepting the helper's default — that keeps rendered
   output identical.
3. Delete the local function and its copy-pasted comment; import the helper.

**Verify**:
```bash
grep -rn "optimizeCartImage\|optimizeProductImage\|optimizeImageSrc" src/
```
→ no matches.

### Step 3: Fix the PDP variant-swap divergence

`pdpUI.ts:283-296` builds a srcset with different breakpoints and quality than
the server render. Route it through `toNetlifyImageCDN`, passing the **same**
breakpoints and quality the server uses so a variant swap no longer changes
image quality.

Determine the server's values by reading `EnhancedImageOptimizer`'s srcset
generation (`enhanced-optimizer.ts:~115`) and the quality actually passed by the
PDP page. **Note**: plan 151 documents an unresolved discrepancy — call sites
pass `quality: 85` but production serves `q=75`. If you cannot determine the
server's effective quality, STOP; guessing here would change what users see.

Preserve the `h: size` square-crop behavior if the PDP gallery depends on it —
check the rendered markup before dropping it.

**Verify**: `pnpm check` → exit 0.

### Step 4: Have the private builder delegate

Make `optimizeSquareImageUrl` (`enhanced-optimizer.ts:139`) call
`toNetlifyImageCDN` for URL construction, keeping its own quality-resolution
logic (`getQualityForFormat`) on top. After this, exactly **one** function in the
repo emits the `/.netlify/images?` (or `/cdn-img?`) string.

**Verify**:
```bash
grep -rn "netlify/images?\|cdn-img?" src/ | grep -v "__tests__" | grep -v "the-shop/index.astro" | grep -v "content-utils.ts"
```
→ exactly one match, inside `toNetlifyImageCDN`.

### Step 5: Prove no rendered URL changed

Capture image URLs before and after on the affected surfaces:

```bash
curl -s http://localhost:4321/ | grep -o '[^"]*images?[^"]*' | sort -u > /tmp/img-after.txt
```

Do the same for a product page, `/the-shop`, and a category page, on `master`
and on the branch, then `diff`.

**Verify**: the only differences are the PDP variant-swap srcset from Step 3.
Everything else must be byte-identical. Record the diff in the status row.

### Step 6: Verify the PDP variant swap in a browser

Open a product page with multiple variants. Swap variants and inspect the
image's `currentSrc` in DevTools.

**Verify**: the swapped-in URL uses the same quality and breakpoint set as the
initial server-rendered image. Record both URLs.

### Step 7: Full gate

```bash
pnpm check && pnpm lint && pnpm test:run && pnpm build
```
→ all exit 0.

## Test plan

Add `src/lib/image/__tests__/toNetlifyImageCDN.test.ts`:

- absolute URL + width → correct `url`/`w`/`q`/`fit` params
- `height` provided → `h` set; omitted → `h` absent
- explicit `quality` / `fit` override the defaults
- **relative path input** → returned unchanged (the `http` guard)
- empty / `undefined` input → returns `""`, does not throw

Model structurally on `src/lib/wordpress/__tests__/content-utils.test.ts`.

`pnpm test:coverage` → exit 0, no threshold regression.

## Done criteria

- [ ] `grep -rn "optimizeCartImage\|optimizeProductImage\|optimizeImageSrc" src/` → no matches
- [ ] Step 4's grep returns exactly one URL-emitting site
- [ ] Step 5 diff shows no URL changes except the intended PDP srcset
- [ ] Step 6: variant swap uses the same quality/breakpoints as the server render; both URLs recorded
- [ ] `src/pages/the-shop/index.astro` and `src/lib/wordpress/content-utils.ts` unmodified (`git status`)
- [ ] New tests for `toNetlifyImageCDN` pass
- [ ] `pnpm check` / `pnpm lint` / `pnpm test:run` / `pnpm build` all exit 0
- [ ] `pnpm test:coverage` exits 0, no threshold regression

## STOP conditions

Stop and report if:

- **Plan 146 has not landed** (Step 1).
- **You cannot determine the server's effective image quality** for the PDP
  (Step 3) — see plan 151's documented 85-vs-75 discrepancy. Do not guess.
- A call site turns out to pass relative paths or non-CDN URLs where you assumed
  absolute ones.
- Step 5's diff shows unexpected URL changes. Every one must be explainable;
  an unexplained change means a rendered image changed.
- Any verification fails twice after a reasonable fix attempt.

## Maintenance notes

- **The invariant after this**: exactly one function emits the image CDN URL
  string. Step 4's grep is worth keeping as a review check.
- Two call sites are deliberately excluded (`the-shop/index.astro` relative
  paths, `content-utils.ts` different parameter shape). Both are documented
  above; a future consolidation could bring them in by relaxing the `http`
  guard, but that guard is load-bearing for the "pass through unknown src
  unchanged" behavior.
- This plan resolves the PDP variant-swap quality divergence. If plan 151 later
  changes the global quality value, it now has one place to change it.
- A reviewer should scrutinize Step 5's diff most closely — that is the evidence
  nothing visibly changed.
