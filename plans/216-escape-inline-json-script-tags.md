# Plan 216: Serialize every inline JSON script tag through one function that escapes `<`

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
> When done, update this plan's status row in `plans/README.md`.

> **Drift check (run first)**:
> `git diff --stat 2ba4b13..HEAD -- src/components/BaseHead.astro src/components/Footer.astro src/components/Breadcrumbs.astro`
> If any listed file changed, compare the "Current state" notes against the
> live code first; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: —
- **Category**: security
- **Planned at**: commit `2ba4b13`, 2026-11-16

## Why this matters

Structured data and inline JSON are written into `<script>` tags with
`set:html={JSON.stringify(value)}`. `JSON.stringify` does not escape `<`, so a
value containing `</script>` ends the tag early and whatever follows is parsed
as HTML. The values are product names, post titles and admin settings: all
entered by the shop, so this is low severity, but a product name with an angle
bracket would break the page, and a compromised Square or WordPress account
would turn it into script injection.

## Current state

15 sinks in 11 files use `set:html={JSON.stringify(`:

`BaseHead.astro` (2), `Footer.astro` (3), `Breadcrumbs.astro`,
`CartFooter.astro`, `NewsFilters.astro`, `SizeGuide.astro`,
`wordpress/blocks/WPEventBlock.astro`, `wordpress/blocks/WPTeamMember.astro`,
`pages/admin/content/event-reference.astro`,
`pages/admin/content/sku-reference.astro`, `pages/news/[slug].astro`.

Re-run `git grep -nE "set:html=\{JSON\.stringify" -- src` first; the list
above is from 2026-11-16.

## Steps

### Step 1: Failing test first

Add `src/lib/__tests__/safeJson.test.ts`: serializing
`{ name: "</script><script>alert(1)</script>" }` must produce a string with no
`<` character, and `JSON.parse` of the output must return the original value.

### Step 2: The serializer

Add `src/lib/safeJson.ts` exporting `safeJsonForScript(value: unknown): string`:
`JSON.stringify`, then replace `<` with `\u003c`, and the two line separator
characters U+2028 and U+2029 with their escapes. **Verify**: Step 1 passes.

### Step 3: Replace every sink

Swap each `set:html={JSON.stringify(x)}` for
`set:html={safeJsonForScript(x)}`. **Verify**: the grep above returns nothing;
structured data on a product page, an article and the home page still parses
(paste the rendered `<script type="application/ld+json">` into `JSON.parse`).

### Step 4: Stop it coming back

Add an ESLint `no-restricted-syntax` rule (or, if the Astro parser cannot
express it, a unit test that greps `src/`) failing on
`set:html={JSON.stringify(`.

### Step 5: Full gate

`pnpm check && pnpm lint && pnpm test:coverage` all exit 0.

## STOP conditions

- A sink is read back by client code using something other than `JSON.parse`
  (for example string matching on the raw text): stop and report that sink.
