# Plan 139: Add unit tests for WordPress content-processing functions

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat cdf74a3..HEAD -- src/lib/wordpress/content-utils.ts src/lib/wordpress/__tests__/content-utils.test.ts`
> If either file changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding; on a mismatch,
> treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: test-coverage
- **Planned at**: commit `cdf74a3`, 2026-09-04

## Why this matters

`src/lib/wordpress/content-utils.ts` has 5 exported functions but only 1
(`stripUnsafeHtml`) has any test coverage — `sanitizeWordPressContent`,
`optimizeWordPressImage`, `generateWordPressSrcSet`, and
`processRawWordPressHTML` (the largest, ~160 lines of regex-based HTML
rewriting) are entirely untested. `processRawWordPressHTML`'s output feeds
directly into `set:html` on every blog/news post via
`WordPressBlockParser.astro` — it rewrites YouTube embeds into a
lightweight facade, injects `width`/`height` on unsized `<img>` tags to
prevent CLS, routes images through the Netlify Image CDN, and adds
accessibility titles to iframes. A regex edit to any of that (an easy
mistake — the function is entirely regex-driven, no parser) currently has
no automated signal before it ships a broken markup or CLS regression to
production. All 5 functions are pure (string in, string out, no I/O),
making them cheap to test directly with fixture HTML strings.

## Current state

`src/lib/wordpress/content-utils.ts` (full file, 323 lines) — the 4
currently-untested exports:

- `sanitizeWordPressContent(content: string): string` (lines 44-64) —
  unwraps WordPress's automatic `<p>` tags around `<img>`/`<figure>`/
  `<iframe>`, fixes broken figcaption classes, normalizes spacing/whitespace.
- `optimizeWordPressImage(url, options): string` (lines 69-108) — appends
  `w`/`h`/`quality`/`crop` query params to a `wordpress.com` image URL;
  returns the URL unchanged if it's not a `wordpress.com` URL; defaults
  `quality` to `85` when not specified.
- `generateWordPressSrcSet(url, baseWidth = 800): string` (lines 113-132) —
  builds a `srcset` string at 5 widths (0.5x, 0.75x, 1x, 1.5x, 2x of
  `baseWidth`) by calling `optimizeWordPressImage` for each; returns `''`
  for non-`wordpress.com` URLs.
- `processRawWordPressHTML(html, options): string` (lines 143-305) — the
  large one. Documented behaviors from its own comments and code, in order:
  1. Replaces two YouTube-embed HTML patterns (`<span class="embed-youtube">`
     wrapper, and bare `<iframe>`) with a static-thumbnail facade `<div>`
     (lines 161-193).
  2. Strips fixed pixel `width`/`height` from `<iframe>` tags inside
     `embed-youtube|vimeo|responsive` wrapper spans and wraps them in a
     padding-bottom aspect-ratio container (lines 195-218).
  3. Injects a `title` attribute on any `<iframe>` lacking one, inferring a
     label from the `src` host (YouTube/Vimeo/Spotify/SoundCloud/Google
     Maps/Twitter-X/Instagram, else `"Embedded content"`) (lines 220-255).
  4. For every `<img>` tag: injects `width`/`height` (from `options` or the
     800/600 hardcoded defaults) if missing; rewrites `wordpress.com`/
     `wp.com` image `src` through `buildNetlifyImageCDNUrl` unless already
     `/.netlify/images`-prefixed; adds `loading="lazy"` unless
     `isAboveFold` or already present; adds `decoding="async"` unless
     present; adds `alt=""` if missing (lines 257-302).
  5. Runs the result through `stripUnsafeHtml` before returning (line 304).

`src/lib/wordpress/__tests__/content-utils.test.ts` (full file, 29 lines) —
only tests `stripUnsafeHtml`, 5 cases (`data:text/html` neutralized,
`data:application/javascript` neutralized, `javascript:` still neutralized,
legitimate `data:image/*` untouched, `<script>` tags stripped). This is the
exemplar pattern to follow: plain `describe`/`it`, no mocking, string-in/
string-out assertions.

## Commands you will need

| Purpose   | Command                                                  | Expected on success |
|-----------|-------------------------------------------------------------|----------------------|
| Typecheck | `pnpm check`                                              | exit 0, no errors    |
| Tests     | `pnpm test:run -- content-utils`                          | all pass             |
| Coverage  | `pnpm test:coverage`                                       | exit 0, thresholds met |

## Scope

**In scope**:
- `src/lib/wordpress/__tests__/content-utils.test.ts` — add new
  `describe` blocks for the 4 untested functions. Do not modify the
  existing `stripUnsafeHtml` block.

**Out of scope**:
- `src/lib/wordpress/content-utils.ts` itself — this plan adds tests only,
  no source changes. If a test reveals what looks like a real bug, do not
  fix it inline — report it and stop (see STOP conditions).
- `WordPressBlockParser.astro` and any other consumer of these functions —
  untouched.

## Git workflow

- Branch: `advisor/139-test-wordpress-content-utils`
- Single commit.
- Commit message style: lowercase, conventional-ish prefix, e.g.
  `test: add coverage for WordPress content-processing functions`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add tests for `sanitizeWordPressContent`

New `describe('sanitizeWordPressContent', ...)` block covering:
- unwraps a `<p><img ...></p>` to bare `<img ...>`
- unwraps a `<p><figure>...</figure></p>` to bare `<figure>...</figure>`
- unwraps a `<p><iframe>...</iframe></p>` to bare `<iframe>...</iframe>`
- rewrites `<figcaption class="wp-element-caption">` to `<figcaption>`
- collapses 3+ consecutive newlines to exactly 2
- trims leading/trailing whitespace
- returns `''` for empty/falsy input

**Verify**: `pnpm test:run -- content-utils` → new cases pass.

### Step 2: Add tests for `optimizeWordPressImage`

New `describe('optimizeWordPressImage', ...)` block covering:
- returns the URL unchanged for a non-`wordpress.com` URL
- returns the URL unchanged for empty/falsy input
- appends `w`, `h`, `quality`, `crop` params when all options are given, for
  a `wordpress.com` URL
- defaults `quality` to `85` when not specified
- does not overwrite an explicitly-specified `quality` with the default

**Verify**: `pnpm test:run -- content-utils` → new cases pass.

### Step 3: Add tests for `generateWordPressSrcSet`

New `describe('generateWordPressSrcSet', ...)` block covering:
- returns `''` for a non-`wordpress.com` URL
- returns `''` for empty/falsy input
- for a `wordpress.com` URL with the default `baseWidth` (800), returns a
  comma-separated string with exactly 5 entries at widths 400, 600, 800,
  1200, 1600 (each followed by `w`)
- a custom `baseWidth` scales all 5 entries proportionally

**Verify**: `pnpm test:run -- content-utils` → new cases pass.

### Step 4: Add tests for `processRawWordPressHTML`

New `describe('processRawWordPressHTML', ...)` block covering, at minimum:
- **YouTube facade, pattern A** (span.embed-youtube wrapper): input
  containing `<span class="embed-youtube">...<iframe src="https://www.youtube.com/embed/VIDEO_ID">...` →
  output contains `class="youtube-facade"`, `data-videoid="VIDEO_ID"`, and
  an `<img src="https://img.youtube.com/vi/VIDEO_ID/hqdefault.jpg"`; does
  NOT contain the original `<iframe>`.
- **YouTube facade, pattern B** (bare iframe, no wrapper span): same
  assertions, using a standalone `<iframe src="https://youtube.com/embed/VIDEO_ID">` input.
- **iframe title injection**: an `<iframe src="https://vimeo.com/...">`
  with no `title` attribute gets `title="Vimeo video player"` injected; an
  iframe that already has a `title="Custom"` is left unchanged (its
  original title is preserved, not overwritten).
- **img dimension injection**: an `<img src="...">` with no `width`/
  `height` gets the default `width="800" height="600"` (or whatever
  `options.defaultWidth`/`defaultHeight` was passed) injected; an `<img
  width="200" height="150" src="...">` keeps its existing dimensions
  unchanged.
- **Netlify Image CDN routing**: an `<img src="https://example.wordpress.com/foo.jpg">`
  gets its `src` rewritten to start with `/.netlify/images?`; an image
  already at `/.netlify/images?...` is left unchanged (not double-rewritten);
  a non-`wordpress.com`/`wp.com` image `src` is left unchanged.
- **Lazy loading**: an image is NOT given `loading="lazy"` when
  `options.isAboveFold` is `true`; IS given it when `isAboveFold` is
  `false`/omitted; an image that already specifies `loading="eager"` is left
  as-is (not overwritten with `lazy`).
- **Accessibility `alt`**: an `<img>` with no `alt` attribute gets `alt=""`
  injected; one that already has `alt="Something"` is left unchanged.
- **Sanitization pass-through**: the function still strips a `<script>` tag
  embedded in the input (proves the final `stripUnsafeHtml` call at line
  304 still runs) — this can reuse one of `stripUnsafeHtml`'s own existing
  fixture strings from the existing test block for consistency.

**Verify**: `pnpm test:run -- content-utils` → new cases pass.

## Test plan

This entire plan *is* the test plan — see Steps 1-4 above for the exact
cases. Model every new `describe`/`it` on the existing
`describe('stripUnsafeHtml', ...)` block's style: no mocking, direct
function calls, plain string/boolean assertions (`toContain`, `toBe`,
`not.toContain`).

- Verification: `pnpm test:run -- content-utils` → all pass, existing 5
  `stripUnsafeHtml` cases unchanged plus the new cases from Steps 1-4.
- Verification: `pnpm test:coverage` → `src/lib/wordpress/content-utils.ts`
  coverage rises substantially from its current 2.17% stmts / 1.25%
  branches; no repo-wide threshold regression.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm check` exits 0
- [ ] `pnpm test:run -- content-utils` exits 0, with 4 new `describe` blocks
      present (`sanitizeWordPressContent`, `optimizeWordPressImage`,
      `generateWordPressSrcSet`, `processRawWordPressHTML`) alongside the
      existing `stripUnsafeHtml` block
- [ ] `pnpm test:coverage` exits 0, no threshold regression, and
      `content-utils.ts` coverage is measurably higher than the pre-change
      2.17%/1.25% baseline
- [ ] Only `src/lib/wordpress/__tests__/content-utils.test.ts` modified
      (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Either file's live content doesn't match "Current state" (drift).
- A test you write reveals behavior that looks like a real bug (e.g. an
  `<img>` that already has `loading="eager"` gets overwritten with `lazy`
  anyway, or the YouTube regex fails to match a documented pattern) — do
  not silently "fix the source to match the test" or "write the test to
  match the buggy behavior" without flagging it; report the discrepancy and
  let the operator decide whether it's a real bug (separate plan) or
  expected behavior this plan's description got wrong.

## Maintenance notes

- If `processRawWordPressHTML` gains a new processing step in the future
  (the function already has 5 documented steps, numbered 0-4 with gaps —
  "Step 3" doesn't exist in the source, likely removed at some point), this
  test file is the place a new step's behavior should be characterized
  alongside the existing ones.
- These are pure-function tests with no mocking — if a future refactor
  makes any of these functions impure (e.g. adds a fetch call), the test
  approach here will need to change to match this repo's mocking
  conventions (see `src/pages/api/__tests__/*.test.ts` for that pattern).
