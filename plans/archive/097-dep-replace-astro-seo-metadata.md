# Plan 097: Replace astro-seo-metadata with inline SEO tags

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `grep -rn "astro-seo-metadata" src/ package.json`

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: dependencies
- **Planned at**: commit `915a062`, 2026-08-01

## Why this matters

`astro-seo-metadata` is a third-party Astro integration in `dependencies`. It wraps simple `<meta>` tags that are trivially written inline. Third-party SEO packages:
- Add a dependency that must be maintained and updated
- Can break on Astro major version bumps
- Often generate slightly wrong or non-customizable output

The functionality is small enough to own directly in `src/components/BaseHead.astro` or a `src/components/SEOHead.astro` component.

## Current state

Read `package.json` to confirm `astro-seo-metadata` is listed. Then find all uses:
```bash
grep -rn "astro-seo-metadata\|AstroSEO\|SEOMetadata" src/ --include="*.ts" --include="*.astro"
```

Read the component(s) that use it to understand what props are passed. The replacement needs to generate equivalent `<title>`, `<meta name="description">`, `<meta property="og:*">`, and `<meta name="twitter:*">` tags.

## Commands

| Purpose | Command | Expected |
|---------|---------|---------|
| Typecheck | `pnpm check` | no errors |
| Tests | `pnpm test:run` | all pass |
| Build | `pnpm build` | exits 0 |

## Scope

**In scope**: remove `astro-seo-metadata` from `package.json`; replace with inline `<meta>` tags in the consuming component(s)

**Out of scope**: changing what SEO tags are generated (same output, different implementation); no new dependencies

## Git workflow

- Branch: `advisor/097-dep-replace-astro-seo-metadata`
- Commit: `chore: replace astro-seo-metadata with inline SEO meta tags`

## Steps

### Step 1: Audit usage

```bash
grep -rn "astro-seo-metadata" src/ --include="*.astro" --include="*.ts"
```

Read each file that imports it. Note which props are passed (title, description, image, etc.).

### Step 2: Write the replacement

In the consuming Astro component (`BaseHead.astro` or similar), replace the `<AstroSEO ... />` (or equivalent) with direct meta tags:

```html
<title>{title}</title>
<meta name="description" content={description} />
<meta property="og:title" content={title} />
<meta property="og:description" content={description} />
<meta property="og:image" content={image} />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content={title} />
<meta name="twitter:description" content={description} />
```

Match whatever the package was generating (read the package source or its output to confirm).

### Step 3: Remove the package

```bash
pnpm remove astro-seo-metadata
```

### Step 4: Typecheck and build

```
pnpm check
pnpm build
```

## Done criteria

- [ ] `astro-seo-metadata` absent from `package.json` and `pnpm-lock.yaml`
- [ ] SEO meta tags still present in rendered HTML (verify via `pnpm build` and inspecting the built output)
- [ ] `pnpm check` exits 0
- [ ] `pnpm build` exits 0
- [ ] `plans/README.md` updated to DONE

## STOP conditions

- The package generates complex structured data (JSON-LD) that would take significant work to replicate — assess whether it's worth it; if not, defer and note

## Maintenance notes

SEO meta tags live directly in `src/components/BaseHead.astro`. No third-party SEO package needed.
