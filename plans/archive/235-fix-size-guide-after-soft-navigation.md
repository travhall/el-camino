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

## Not verified

- A production-mode server. The nonce and router behaviour are the same code, but
  product pages are served with CDN caching (`s-maxage=300`); how the cached HTML and
  its CSP header interact with the nonce was not examined.
- Related, worth checking: if the CDN serves cached HTML together with its CSP
  header, every visitor inside the 5-minute window shares one nonce, which a
  nonce-based CSP assumes is unguessable. Not verified either way.
- The `ArticleGrid` violation still occurs by design (see above).
- A Playwright regression test: the stub catalog deliberately avoids every word that
  enables the size guide, so the static guard was used instead of reshaping the
  shared catalog.
