# Plan 235: Fix the Size Guide button after a client-side navigation (page-only inline scripts and the per-request CSP nonce)

> **Executor instructions**: Finished; the record below is what was found, what
> was changed and how it was verified.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: 228 (where the violation was first seen)
- **Category**: bug
- **Planned at**: commit `bc62fd9`, 2026-11-18
- **Outcome**: DONE

## How it was found

While checking plan 228 in the browser, one `securitypolicyviolation`
(`script-src-elem`, blocked `inline`, reported from the router's
`transitions-router` code) appeared on a client-side navigation from `/cart` to
the home page. It was identical on unmodified master (stashed and repeated), so it
was not caused by that change, and `/news` to home showed none.

## Cause

- `src/middleware.ts` mints a nonce per request: `script-src 'self'
  'nonce-<N>'`. Every response has its own (three fetches gave three different
  nonces).
- On a client-side navigation the router (`runScripts`) re-creates every
  swapped-in script that is not already marked executed, copying the old script's
  attributes, including `nonce`, onto the new element. It skips an inline script
  only if that exact script already ran in this document.
- A script that exists on only some pages is therefore re-created with the
  *destination* response's nonce. The browser is still enforcing the nonce from
  the first page load, so it blocks it. That is why `/news` to home was clean (both
  pages carry the same scripts) and `/cart` to home was not (`ArticleGrid`'s
  inline script exists on home and news but not on the cart).
- `BaseHead.astro` already documents this and works around it for one script (the
  news view preference) by rendering it on every page so it is byte-identical. The
  rule was implicit; two scripts broke it.

## Impact

Inventory of every executable `<script is:inline>`: the five in `BaseHead`, plus
`Header` and `AnnouncementBanner`, are on every page and safe. Admin pages do not
use the router (full page loads), and `order-confirmation` is only reached by the
redirect back from Square. That left two exposed scripts:

1. **`SizeGuide`, a functional bug.** Its inline script attaches the click handler
   to `#size-guide-trigger`. After a soft navigation to an apparel product (the
   normal way to reach one) it was blocked: `openSizeGuide` undefined, the trigger
   never initialised, and the "Size Guide" button did nothing. Reproduced on the
   dev server (category to product): button dead, one CSP violation; the same
   product loaded directly: works, no violation. Every apparel product page with a
   size guide was affected.
2. **`ArticleGrid`, noise only.** Its inline arming script (plans 148, 230) is
   blocked on a first soft arrival at home or news; the hoisted module arms the
   cards on `astro:page-load`, so it degrades gracefully (one console CSP report).
   It has to stay inline: it runs before the module graph, which is what plan 230
   measured.

## Fix

- `SizeGuide`'s script is now a hoisted module, `src/scripts/size-guide-client.ts`
  (`init()`, bound on every `astro:page-load`), which the bundler emits as an
  external file that `script-src 'self'` allows. A module runs once per document
  but the category differs per product, so it reads `#size-guide-config` when the
  dialog opens instead of at load time (the inline script read it once at
  execution). It no longer leaks a global `openSizeGuide` (nothing used it), and a
  missing or unparseable config falls back to the tops chart, the component's own
  default, instead of throwing.
- `src/__tests__/inlineScripts.test.ts` fails if any other executable
  `<script is:inline>` appears outside an allowlist that records why each exception
  is safe (shared layout, admin full loads, `order-confirmation`, and
  `ArticleGrid` with the caveat above). JSON-LD data blocks are ignored: they are
  not executable, the CSP's `script-src` does not apply to them and the router skips
  non-JavaScript types. The scanner tracks `{}` depth so `set:html={...}` cannot end
  a tag early.
- The rule is in `CLAUDE.md`'s Gotchas.

## Alternative considered and not taken

Rewriting the nonce of every swapped-in script to the current document's nonce in
`astro:before-swap` would fix every page-only inline script at once. It would also
let any injected markup that merely carries a `nonce` attribute execute after a soft
navigation, which weakens the CSP. Moving the script to an external module fixes the
bug without touching the policy. (A stricter variant that only re-nonces scripts
carrying the destination's real nonce would be safe, but needs a trusted way to know
it; not pursued.)

## Verification

- Tests first: 23 for the module (the first 22 failed against a missing module);
  mutation check: 21 deliberate breaks, 19 caught outright; two gaps (an unparseable
  config, and the key listener not being removed on close) were closed with new
  tests, and one (the `data-initialized` guard) is an equivalent mutant because the
  DOM de-duplicates the same listener function.
- Guard: 11 tests. It first failed on the real tree because five JSON-LD tags were
  counted, which is how the scanner learned to ignore data blocks. Mutations: a new
  page-only inline script, `SizeGuide` back to inline, and a stale allowlist entry
  each fail it.
- Gate: check, lint, format:check, coverage 84.36 / 72.73 / 84.18 / 85.90, build and
  `test:e2e:stub` (117) pass.
- Browser, dev server: arriving at `/product/bronze-truck-t-shirt` by soft
  navigation from `/category/apparel/tees-tops` (same document), the trigger is
  initialised, the dialog opens with the Tops & Outerwear chart (Size, Chest,
  Waist, Hips; first row XS 31-33" 23-25" 33-35"), scroll locks and unlocks, Escape
  closes it, and there are no CSP violations and no page errors.

## Checked afterwards: do CDN-cached pages share a nonce? (2026-11-18)

Read-only GETs with `curl` against staging and production (generic and browser
user agents, another `Accept-Language`, a cookie).

- **Product pages share one nonce.** `/product/...` is served from Netlify's
  durable cache (`public,max-age=60,must-revalidate`, `cache-status: "Netlify
  Durable"; hit`, about 5 minutes of TTL). Six different clients all received the
  same nonce, identical in the HTML and the CSP header, on production and on
  staging. There is no `Set-Cookie`, `Vary` is only `Accept-Encoding`, and
  `netlify-vary: query` makes the query string part of the cache key. The cached
  HTML holds nothing per visitor: the one email/phone match is the shop's own
  public business contact in its JSON-LD block.
- **So on product pages the nonce is not a secret for up to about 5 minutes**; one
  request reads it. A nonce-based CSP assumes an injected script cannot know the
  nonce, and that does not hold there.
- **Exploitability is low, so this is a defense-in-depth gap, not an open hole.**
  It would need an injection vector into a product page's HTML. The cache key
  includes the query string and the nonce changes at each refresh, so a payload
  cannot hard-code the nonce of a response that does not exist yet, and
  `script-src 'self'` plus the Square hosts still apply. No change was made.
- **Every other route tested returned a different nonce on each of two requests
  1.2 s apart** (`/`, `/news`, `/category/skateboards`, `/shop/all`, `/the-shop`,
  `/cart`), so they are rendered per request.
- **Side finding (performance, not security): `/`, `/news` and `/category/*` are
  not being served from the CDN cache.** They send `public,s-maxage=300,
  stale-while-revalidate=1800` but report `cache-status: "Netlify Durable";
  fwd=bypass` and a fresh render with `age: 0` every time, although `CLAUDE.md`
  describes them as CDN-cached. Only product pages hit the durable cache. Not
  investigated; it may explain the cold TTFB figures noted in plan 231, and it bears on
  the open question whether the product-page tag purge (`purgeProductPages` in
  `src/lib/cache/cdnPurge.ts`) works on the deployed site.
- **An option that would fix both the router mismatch and the shared nonce:** a
  hash-based CSP (`'sha256-...'` for each inline script) in place of per-request
  nonces. A hash depends only on the script's content, so it is stable across
  pages, cache entries and visitors. The inline scripts are static, so it is
  feasible (build-time hashing, or Astro's own CSP support), but it is a policy
  change with its own risks and is not part of this plan.

## Not verified

- A production-mode build of this change: the nonce and router behaviour are the
  same code, and the production product page was observed above, but the size guide
  fix itself was only exercised on the dev server.
- The `ArticleGrid` violation still occurs by design (see above).
- A Playwright regression test: the stub catalog deliberately avoids every word that
  enables the size guide, so the static guard was used instead of reshaping the
  shared catalog.
