# Plan 170: Route the main WordPress content path through the sanitizer that already exists

> **Executor instructions**: Follow step by step. Run every verification command
> and confirm the expected result. If anything in "STOP conditions" occurs, stop
> and report. When done, update this plan's status row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat ad2999d..HEAD -- src/lib/wordpress/content-utils.ts src/components/wordpress/`
> On any change, compare against the excerpts below; on a mismatch, STOP.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `ad2999d`, 2026-09-05

## Why this matters

`stripUnsafeHtml` exists to make a CMS-side compromise not immediately mean
script execution. It is applied to **titles and excerpts** — and to legal pages —
but **not** to the main article body, which is the path carrying by far the most
CMS HTML.

This is **defense-in-depth, not an open hole.** WordPress is a trusted CMS, and
the nonce-based CSP in `src/middleware.ts` would block an injected inline
`<script>` anyway. Prioritized P3 accordingly. The value is consistency: right
now the security posture is genuinely hard to reason about, because the sanitizer
is applied on the low-volume paths and skipped on the high-volume one.

## Current state

The sanitizer, `src/lib/wordpress/content-utils.ts:18-40` — regex-based, and
deliberately preserves iframes so legitimate embeds survive:

```ts
export function stripUnsafeHtml(html: string): string {
  if (!html) return html;
  return (
    html
      // Drop <script>...</script> and standalone <script ... />
      .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '')
      .replace(/<script\b[^>]*\/?>/gi, '')
      // Drop inline event handler attributes: on*="..." | on*='...' | on*=value
      .replace(/\s+on[a-z]+\s*=\s*"(?:[^"]*)"/gi, '')
      ...
```

**Where it IS applied** (verified):

- `src/components/ArticleCard.astro:372` (title), `:387` (excerpt)
- `src/pages/news/[slug].astro:187`, `:401`, `:462` (titles)
- `src/pages/legal/[slug].astro:107` — `const pageContent = stripUnsafeHtml(page.content.rendered);`

**Where it is NOT** — `src/components/wordpress/WordPressBlockParser.astro`, at
lines 826, 838, 850, 862, 874, 886, 898, 906:

```astro
              set:html={processRawWordPressHTML(block.html, { isAboveFold: block.originalIndex < 2 })}
```

`processRawWordPressHTML` (`content-utils.ts:138+`) only rewrites images and
YouTube embeds — it does no sanitization.

### Correction to the audit finding

The independent scan reported that `src/pages/legal/[slug].astro` also bypasses
the sanitizer. **That is wrong** — it imports it at `:6` and applies it at `:107`.
Legal pages are already covered. Do not "fix" them.

The scan also listed `WPQuote.astro`, `WPImage.astro`, `WPGallery.astro`, and
`JetpackSlideshow.astro` as sinks. **Verify each yourself in Step 1** before
touching it — given the legal-page error, treat that list as leads, not facts.

## Commands you will need

| Purpose   | Command                              | Expected             |
|-----------|--------------------------------------|----------------------|
| Typecheck | `pnpm check`                         | exit 0               |
| Tests     | `pnpm test:run -- content-utils`     | all pass             |
| Full      | `pnpm test:run`                      | exit 0               |
| Coverage  | `pnpm test:coverage`                 | exit 0, no regression|
| Lint      | `pnpm lint`                          | exit 0               |
| Dev server| `pnpm dev`                           | serves on :4321      |

Never use `pnpm test` — watch mode, it hangs.

## Scope

**In scope**:
- `src/lib/wordpress/content-utils.ts` (`processRawWordPressHTML` only)
- `src/lib/wordpress/__tests__/content-utils.test.ts`

**Out of scope** (do NOT touch):
- `src/pages/legal/[slug].astro` — already sanitized.
- `stripUnsafeHtml`'s regexes. Changing them risks breaking the paths that
  already depend on it. This plan changes *where* it runs, not *what* it does.
- `src/middleware.ts` CSP.
- `WPColumns.astro` / `WPEmbed.astro` — already reviewed and accepted as LOW risk
  in a prior audit; leave them.
- Replacing the regex sanitizer with a real HTML parser. Better long-term, much
  bigger change — see Maintenance notes.

## Git workflow

- Branch: `advisor/170-sanitize-wordpress-content-path`
- Conventional commits, e.g. `fix(security): sanitize CMS HTML in the main content path`
- Do NOT push or open a PR unless the operator instructs it.

## Steps

### Step 1: Enumerate the real sinks yourself

```bash
grep -rn "set:html" src/components/wordpress/ src/pages/news/ src/pages/legal/
grep -rn "stripUnsafeHtml" src/ | grep -v "content-utils.ts:"
```

**Verify**: produce a table of every CMS-HTML `set:html` sink and whether it is
currently sanitized. Record it in the `plans/README.md` status row. Expect the
scan's list to be partly wrong (it was, for legal pages).

### Step 2: Sanitize inside `processRawWordPressHTML`

Make `stripUnsafeHtml` the **first** operation in `processRawWordPressHTML`, so
every one of its eight call sites is covered by one change. Sanitize before the
image/embed rewriting, so the rewriting operates on already-cleaned HTML.

Add a comment stating that this function is the single gate for CMS body HTML and
that new `set:html` sinks must route through it.

**Verify**: `grep -n "stripUnsafeHtml" src/lib/wordpress/content-utils.ts`
→ appears inside `processRawWordPressHTML`.

### Step 3: Cover any sink Step 1 found outside that function

For each remaining unsanitized sink from Step 1, apply `stripUnsafeHtml` at the
call site. **Verify each is genuinely a CMS-HTML sink first** — some may render
component-authored markup, where sanitizing is pointless noise.

**Verify**: every row in Step 1's table is either sanitized or has a recorded
reason why not.

### Step 4: Confirm real articles still render correctly

This is the risk: a regex sanitizer over rich CMS HTML can eat legitimate markup.

With `pnpm dev`, open **at least four** real articles covering different block
types — one with a YouTube embed, one with a gallery, one with a blockquote, one
with inline formatting.

**Verify**: each renders identically to `master`. Embeds still play, galleries
still lay out, formatting intact. Capture before/after screenshots or HTML diffs
for at least the embed-heavy one. Record which articles you checked.

### Step 5: Full gate

```bash
pnpm check && pnpm lint && pnpm test:run && pnpm test:coverage
```
→ all exit 0.

## Test plan

Extend `src/lib/wordpress/__tests__/content-utils.test.ts` (it already has a
`stripUnsafeHtml` describe block — follow its style):

- `processRawWordPressHTML` strips a `<script>` block from body HTML
- it strips an inline `onerror=` handler from an `<img>`
- it neutralizes a `javascript:` href
- **it preserves an iframe embed** (the regression that matters most)
- it preserves ordinary formatting (`<strong>`, `<em>`, `<ul>`, `<blockquote>`)
- its existing image-rewriting behavior is unchanged (assert against the current
  expected output)

`pnpm test:coverage` → exit 0, no threshold regression.

## Done criteria

- [ ] Step 1's sink table recorded in `plans/README.md`
- [ ] `stripUnsafeHtml` runs first inside `processRawWordPressHTML`
- [ ] Tests prove script/handler/`javascript:` removal **and** iframe preservation
- [ ] Existing image-rewriting tests still pass unchanged
- [ ] Four real articles verified to render identically; which ones, recorded
- [ ] `src/pages/legal/[slug].astro` unmodified (`git status`)
- [ ] `stripUnsafeHtml`'s regexes unmodified (`git diff`)
- [ ] `pnpm check` / `pnpm lint` / `pnpm test:run` all exit 0

## STOP conditions

Stop and report if:

- **Any real article renders differently.** The regex sanitizer eating
  legitimate markup is the one real risk here, and this is a P3 defense-in-depth
  change — it is not worth breaking content for. Report what broke.
- Double-sanitization causes a problem on a path already calling
  `stripUnsafeHtml` (it should be idempotent — confirm with a test).
- Step 1 finds a sink rendering non-CMS HTML where sanitizing would be wrong.
- Any verification fails twice after a reasonable fix attempt.

## Maintenance notes

- **The gate rule after this**: CMS body HTML reaches the page only through
  `processRawWordPressHTML`. A new `set:html` on CMS content must go through it.
- **The honest limitation**: this is a regex sanitizer. It is defense-in-depth
  behind a nonce CSP, not a security boundary you should rely on. If the threat
  model ever changes — untrusted authors, public submissions — this needs a real
  HTML parser, not more regexes.
- A reviewer should focus on Step 4's rendering evidence, not the diff. The diff
  is two lines; the risk is entirely in what those two lines do to real content.
