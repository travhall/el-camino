# Plan 107: Remove 25 dead declarations found by astro check

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 8ff3096..HEAD -- <in-scope paths listed in Scope>`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts below against the live file before touching it;
> on a mismatch, treat it as a STOP condition for that file only (continue
> with the rest).

## Status

- **Priority**: P3
- **Effort**: M (mechanical but spans 20 files — budget for the breadth, not the difficulty)
- **Risk**: LOW
- **Depends on**: none (106 is a soft co-requisite — see Dependency note below)
- **Category**: tech-debt
- **Planned at**: commit `8ff3096`, 2026-08-05

## Why this matters

`pnpm check` (which runs `astro check`) currently reports 30 "declared but
its value is never read" hints. These hints don't fail the build (Astro
demotes them to non-blocking "hints"), and `pnpm lint` doesn't catch them
either — `.astro` frontmatter isn't covered by the `@typescript-eslint`
rules in `eslint.config.mjs` (see Plan 106, which closes that gap so this
class doesn't silently recur). This plan removes the current backlog.

**Important — this list was hand-verified, not taken at face value from the
tool output.** Two of the 30 raw hits (`from` in `src/layouts/AdminLayout.astro:18`
and `dest` in `src/pages/admin/login.astro:24`) are false positives: both
variables are read on the very next line
(`` return Astro.redirect(`/admin/login?from=${from}`) `` and
`return Astro.redirect(dest)` respectively) — this looks like an Astro
type-checker quirk with variables read only inside a conditional block's
`return` statement. **Do not touch either of these two files/lines** — see
Scope.

Two more of the 30 (`contact` in `src/components/BackInStock.astro:24` and
`src/components/QuickView.astro:10`) are **not** dead code — they're a real
bug. Both files have `href="mailto:{contact.email}"`, which is invalid Astro
attribute-interpolation syntax (Astro doesn't interpolate `{}` inside a
quoted string attribute value — the correct form is
`` href={`mailto:${contact.email}`} ``). As written, the link renders
literally as the text `mailto:{contact.email}`, so `contact` reads as
"unused" because the intended read of it never actually happens. **Do not
remove `contact` or its import in either file** — that would silently
cement the bug forever with no unused-var hint left to ever surface it
again. This bug has its own plan: `plans/108-fix-broken-mailto-interpolation.md`.
Do not fix it here — out of scope for this plan.

That leaves **25 genuine dead declarations across 20 files**, covered below,
grouped by fix pattern.

## Current state & fixes, by pattern

### Pattern A — `EL_CAMINO_LOGO_DATA_URI` imported but unused (8 files)

Each file imports both `EL_CAMINO_LOGO_DATA_URI` and
`EL_CAMINO_LOADER_DATA_URI` from `@/lib/constants/assets`; only the loader
constant is actually used in each. Delete just the `EL_CAMINO_LOGO_DATA_URI`
line/token, keep `EL_CAMINO_LOADER_DATA_URI`.

| File | Current import (today) | Fix |
|---|---|---|
| `src/components/QuickView.astro:5-8` | multi-line block, `EL_CAMINO_LOGO_DATA_URI,` on its own line 7 | delete line 7 |
| `src/components/Sidebar.astro:5-8` | multi-line block, `EL_CAMINO_LOGO_DATA_URI,` on line 6 | delete line 6 |
| `src/components/wordpress/blocks/BlogProductCard.astro:7-10` | multi-line block, `EL_CAMINO_LOGO_DATA_URI,` on line 8 | delete line 8 |
| `src/components/wordpress/blocks/JetpackSlideshow.astro:6` | single line: `import { EL_CAMINO_LOGO_DATA_URI, EL_CAMINO_LOADER_DATA_URI } from "@/lib/constants/assets";` | rewrite to `import { EL_CAMINO_LOADER_DATA_URI } from "@/lib/constants/assets";` |
| `src/components/wordpress/blocks/WPGallery.astro:6` | same single-line form as above | same fix |
| `src/components/wordpress/blocks/WPImage.astro:6-9` | multi-line block, `EL_CAMINO_LOGO_DATA_URI,` on line 7 | delete line 7 |
| `src/pages/news/[slug].astro:12-15` | multi-line block, `EL_CAMINO_LOGO_DATA_URI,` on line 14 | delete line 14 |
| `src/pages/the-shop/index.astro:7-10` | multi-line block, `EL_CAMINO_LOGO_DATA_URI,` on line 8 | delete line 8 |

`QuickView.astro` also has the unrelated `contact`/mailto bug (Pattern
excluded — see "Why this matters"); be careful to only touch its import
block here, not its `contact`/`href` lines.

After each edit, confirm the loader constant is still referenced later in
the same file (`grep -c EL_CAMINO_LOADER_DATA_URI <file>` → 2 or more, i.e.
import + at least one usage) so you know you kept the right one.

**Verify** (after all 8): `grep -rn "EL_CAMINO_LOGO_DATA_URI" src/components/QuickView.astro src/components/Sidebar.astro src/components/wordpress/blocks/BlogProductCard.astro src/components/wordpress/blocks/JetpackSlideshow.astro src/components/wordpress/blocks/WPGallery.astro src/components/wordpress/blocks/WPImage.astro "src/pages/news/[slug].astro" src/pages/the-shop/index.astro` → no matches.

### Pattern B — standalone unused `siteConfig` import (2 files)

- `src/components/Nav.astro:3` — `import { siteConfig } from "@/lib/site-config";` — delete the line entirely (confirm first with `grep -c siteConfig src/components/Nav.astro` → should be 1, i.e. only the import, before deleting).
- `src/pages/order-confirmation.astro:10` — `import { siteConfig } from "@/lib/site-config";` — same check and fix.

**Verify**: `grep -n siteConfig src/components/Nav.astro src/pages/order-confirmation.astro` → no matches.

### Pattern C — unused private class members in `.ts` files (3 files)

These are write-only or never-called class members — confirmed by grepping
each symbol across its whole file before this plan was written (each has
zero *read* sites, only the declaration and, for `isInitialLoad`,
write-only assignments).

- `src/lib/product/pdpController.ts` — `private isInitialLoad: boolean = true;`
  at line 20 is assigned at lines 221, 231, and 282
  (`this.isInitialLoad = false;` / `this.isInitialLoad = true;`) but never
  read anywhere. Delete the field declaration (line 20, including its
  trailing comment `// Track if this is initial page load`) and all three
  assignment statements (lines 221, 231, 282 — each is a standalone
  statement on its own line; deleting each whole line is safe). Re-run
  `grep -n isInitialLoad src/lib/product/pdpController.ts` before deleting
  each site to get current line numbers, since deleting earlier lines
  shifts later ones — work from the bottom of the file upward (282, then
  231, then 221, then 20) to avoid shifting line numbers out from under
  you.
- `src/lib/product/quickViewController.ts:233-249` — the private method
  `setActiveThumbnail` (with its preceding two-line comment "Sync the
  active thumbnail..."), never called anywhere in the file. Delete the
  full comment + method block:

  ```ts
  // Sync the active thumbnail highlight when the main image changes
  // (e.g. on variation switch).
  private setActiveThumbnail(imageUrl: string): void {
    const container = document.getElementById('quick-view-thumbnails');
    if (!container) return;

    container
      .querySelectorAll<HTMLButtonElement>('.quick-view-thumb')
      .forEach((t) => {
        const isActive = t.dataset.gallerySrc === imageUrl;
        t.classList.toggle('border-(--ui-button-border)', isActive);
        t.classList.toggle('opacity-100', isActive);
        t.classList.toggle('border-(--border-secondary)', !isActive);
        t.classList.toggle('opacity-60', !isActive);
        t.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      });
  }
  ```

- `src/lib/square/slugResolver.ts:14` — `private initializing = false;` is
  declared and never read or written anywhere else in the class (the only
  other match for the string `initializing` in the file is inside an
  unrelated code comment, not a reference to this field — the class
  actually guards re-entrancy via the separate `initPromise` field, a few
  lines below). Delete line 14 only.

**Verify**: `pnpm check 2>&1 | grep -c "isInitialLoad\|setActiveThumbnail\|initializing"` → 0.

### Pattern D — unused function parameter, rename not delete (1 file)

- `src/lib/wordpress/__tests__/api.test.ts:26` —
  `` vi.fn(<T>(key: string, compute: () => Promise<T>) => compute()) `` — the
  mock's `key` parameter is unused but must stay in the signature to match
  the real `getOrCompute(key, compute)` function it's mocking (removing the
  parameter would change the mock's arity). Rename `key` to `_key` (repo
  has no existing underscore-prefix convention to match, but this is the
  standard "intentionally unused, kept for signature shape" signal and the
  minimal-diff fix — do not delete the parameter).

**Verify**: `grep -n "_key: string" src/lib/wordpress/__tests__/api.test.ts` → 1 match.

### Pattern E — unused type-only imports (3 files)

- `src/pages/admin/content/sku-reference.astro:5` —
  `import type { SkuReference } from "@/utils/generateSkuReference";` —
  delete the line (the value import `generateSkuReference` on line 4 stays,
  it's used).
- `src/pages/news/index.astro:14-19` — multi-line `import type { ... }`
  block; delete the `WordPressPost,` line (currently line 15), leave
  `NewsFilterOptions`, `NewsSearchIndex`, and any remaining names in the
  block untouched.
- `src/pages/news/tag/[slug].astro:7` —
  `import type { WordPressPost } from "@/lib/wordpress/types";` — delete
  the line entirely (this file imports nothing else from that path).

**Verify**: `grep -rn "SkuReference\b" src/pages/admin/content/sku-reference.astro | grep -v generateSkuReference` and `grep -n WordPressPost src/pages/news/index.astro "src/pages/news/tag/[slug].astro"` → no matches in either.

### Pattern F — unused destructured values (1 file)

- `src/pages/news/index.astro:27` — currently
  `const { featuredPost, regularPosts, allPosts } = newsData;` — neither
  `featuredPost` nor `regularPosts` is referenced anywhere else in the file
  (the page renders everything from `allPosts`). Change to:
  `const { allPosts } = newsData;`

**Verify**: `grep -n "featuredPost\|regularPosts" src/pages/news/index.astro` → no matches.

### Pattern G — unused computed value, no side effect (3 files)

- `src/pages/product/[id].astro:339` — `const pageTitle = product.title;` —
  never referenced anywhere in the file (not even in a `<title>` tag —
  confirmed by `grep -n pageTitle` and `grep -n "<title"` returning no
  other hits). Delete the line.
- `src/pages/shop/all.astro:7,67` — import line 7 currently
  `import { INITIAL_PAGE_SIZE, INFINITE_SCROLL_THRESHOLD } from "@/lib/constants/pagination";`
  — `INITIAL_PAGE_SIZE` is unused (only `INFINITE_SCROLL_THRESHOLD` is
  referenced, at line 67). Change the import to
  `import { INFINITE_SCROLL_THRESHOLD } from "@/lib/constants/pagination";`.
  Also delete line 67, `const needsPagination = totalProductCount >
  INFINITE_SCROLL_THRESHOLD;` — never referenced after computation (the
  comment two lines below it, "ProductGrid handles progressive display via
  infinite scroll", confirms pagination is handled client-side inside
  `ProductGrid`, not via this variable).
- `src/pages/shop/sale.astro:7,120,185` — same import-line fix as
  `shop/all.astro` (drop `INITIAL_PAGE_SIZE`, keep
  `INFINITE_SCROLL_THRESHOLD`). Delete line 120,
  `const needsPagination = totalProductCount >
  INFINITE_SCROLL_THRESHOLD;` (same dead-computation reasoning as
  `all.astro`). Delete line 185,
  `const originalPrice = saleVariation?.saleInfo?.originalPrice ||
  product.price;` inside the JSON-LD `itemListElement` map callback — the
  `return` object immediately below only uses the sibling `salePrice`
  variable in its `offers.price` field; `originalPrice` is computed and
  discarded (verified by reading the full `return { "@type": "ListItem",
  ... }` object at lines 187-203 — it has no field that uses
  `originalPrice`).

**Verify**: `grep -n "pageTitle" "src/pages/product/[id].astro"`,
`grep -n "INITIAL_PAGE_SIZE\|needsPagination" src/pages/shop/all.astro src/pages/shop/sale.astro`,
and `grep -n originalPrice src/pages/shop/sale.astro` → no matches for any.

### Pattern H — dead computation in a standalone script (1 file)

- `src/scripts/validate-wordpress-integration.js:80-82` — currently:
  ```js
  const _wordPressLinks = wordPressContent
    ? wordPressContent.querySelectorAll("a")
    : [];
  ```
  The result is never used (the underscore prefix suggests it was
  deliberately marked "ignore this" at some point, but the DOM query itself
  is still dead work in a script whose whole purpose is validation output —
  the very next lines compute `businessComponentLinks` instead and that's
  what the script actually reports on). Delete all three lines.

**Verify**: `grep -n "_wordPressLinks" src/scripts/validate-wordpress-integration.js` → no matches.

## Commands you will need

| Purpose   | Command          | Expected on success |
|-----------|------------------|----------------------|
| Typecheck | `pnpm check`     | exit 0, "0 errors", hint count dropped by 25 from baseline (run `pnpm check 2>&1 | grep -c "ts(6133)\|ts(6196)"` before starting to record the baseline, e.g. 30; after this plan it should be 5 — the 2 false positives plus the 2 mailto-bug sites, neither touched by this plan) |
| Lint      | `pnpm lint`      | exit 0 |
| Build     | `pnpm build`     | exit 0 |
| Tests     | `pnpm test:run`  | all pass (no test files are edited except the parameter rename in Pattern D, which changes no behavior) |

## Scope

**In scope** (the only files you should modify):
- `src/components/QuickView.astro` (import line only — do NOT touch the
  `contact`/`mailto` lines, see Plan 108)
- `src/components/Sidebar.astro`
- `src/components/Nav.astro`
- `src/components/wordpress/blocks/BlogProductCard.astro`
- `src/components/wordpress/blocks/JetpackSlideshow.astro`
- `src/components/wordpress/blocks/WPGallery.astro`
- `src/components/wordpress/blocks/WPImage.astro`
- `src/lib/product/pdpController.ts`
- `src/lib/product/quickViewController.ts`
- `src/lib/square/slugResolver.ts`
- `src/lib/wordpress/__tests__/api.test.ts`
- `src/pages/order-confirmation.astro`
- `src/pages/admin/content/sku-reference.astro`
- `src/pages/news/[slug].astro`
- `src/pages/news/index.astro`
- `src/pages/news/tag/[slug].astro`
- `src/pages/product/[id].astro`
- `src/pages/shop/all.astro`
- `src/pages/shop/sale.astro`
- `src/pages/the-shop/index.astro`
- `src/scripts/validate-wordpress-integration.js`

**Out of scope** (do NOT touch, even though they look related):
- `src/layouts/AdminLayout.astro` and `src/pages/admin/login.astro` — the
  `from`/`dest` hints there are false positives (see "Why this matters").
- `src/components/BackInStock.astro` and `src/components/QuickView.astro`'s
  `contact`/`getContactInfo` lines and the `href="mailto:{contact.email}"`
  markup — real bug, fixed by Plan 108, not this plan. (`QuickView.astro`
  is in scope above only for its unrelated `EL_CAMINO_LOGO_DATA_URI` import
  line — be careful not to touch its `contact` lines while in that file.)
- `src/lib/square/categories.ts:177` — the unused `options` parameter there
  already has an explicit `// eslint-disable-next-line
  @typescript-eslint/no-unused-vars -- kept for call-site API
  compatibility` comment directly above it. This is a deliberate, already
  documented and already-suppressed exception, not a finding.
- `eslint.config.mjs` — that's Plan 106.

## Git workflow

- Branch: `advisor/107-remove-dead-astro-declarations`
- Commit message style: conventional commits, e.g. `refactor: remove dead
  declarations found by astro check` (matches
  `78d3ae1 refactor: replace empty catch blocks and stray console calls
  with proper error logging` in `git log`). One commit is fine given the
  mechanical, low-risk nature of every change; split further only if you
  prefer smaller reviewable units.
- Do NOT push or open a PR unless the operator instructed it.

## Test plan

No new tests — every change removes code with zero remaining references
(verified above) or renames an unused parameter with no behavioral effect.
Run the full existing suite to confirm nothing was actually still relying
on any of these (e.g. via reflection, dynamic access, or a test asserting
on dead state) — `pnpm test:run` should show the same pass count as on
`main` before this plan.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm check` exits 0, "0 errors"
- [ ] `pnpm check 2>&1 | grep -c "ts(6133)\|ts(6196)"` → 5 (down from the
      30-hint baseline recorded before starting; the 5 remaining are the 2
      false positives + the 2 mailto-bug sites, both explicitly out of
      scope, plus the still-suppressed `categories.ts:177` line which
      shows as a hint despite its eslint-disable comment — confirm this by
      re-running the baseline command before you start and comparing)
- [ ] `pnpm lint` exits 0
- [ ] `pnpm build` exits 0
- [ ] `pnpm test:run` exits 0, same pass count as before this plan
- [ ] All "Verify" greps in each pattern section above return no matches
- [ ] No files outside the Scope list are modified (`git status`)
- [ ] `plans/README.md` status row for 107 updated

## STOP conditions

Stop and report back (do not improvise) if:

- Any file's current content doesn't match the excerpt shown for it above
  (drift since this plan was written) — re-verify that pattern's reasoning
  against the live file before proceeding; if the reasoning no longer
  holds (e.g. a variable that was unused is now used), skip that one item
  and note it, don't force the removal.
- Deleting `isInitialLoad`'s assignments in `pdpController.ts` reveals a
  fourth call site not listed here (re-grep before deleting, not just once
  at the start) — if there's a *read* site anywhere (not just writes), stop
  and report; that would mean the field is not actually dead and this
  plan's evidence was wrong.
- `pnpm test:run` fails after any single-file change — isolate to that file
  (via `git stash` on other in-progress changes if working file-by-file) to
  confirm which removal caused it, then stop and report rather than
  guessing at a fix.

## Maintenance notes

- Plan 106 (extending ESLint to `.astro` frontmatter) is a **soft**
  dependency in either direction: if 106 lands first, `pnpm lint` will
  already flag most of Pattern A/B/E/F/G's sites as warnings before you
  start this plan, which is a useful double-check but changes nothing
  about what to do. If this plan (107) lands first, 106's Step 2
  verification (`grep -c "no-unused-vars"` ≥ 20) may return fewer once
  this backlog is cleared — re-read 106's Step 2 note about that before
  concluding its rule isn't working.
- The `categories.ts:177` suppressed parameter and the two mailto-bug
  `contact` sites are excluded here by design — don't let a future pass
  "clean these up" without re-reading why they're excluded (this file and
  Plan 108 respectively).
