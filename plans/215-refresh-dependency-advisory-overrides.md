# Plan 215: Clear the 74 dependency advisories by refreshing overrides and patch versions

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
> When done, update this plan's status row in `plans/README.md`.

> **Drift check (run first)**:
> `git diff --stat 2ba4b13..HEAD -- package.json pnpm-workspace.yaml pnpm-lock.yaml`
> If any listed file changed, compare the "Current state" notes against the
> live code first; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW-MED
- **Depends on**: —
- **Category**: security
- **Planned at**: commit `2ba4b13`, 2026-11-16

## Why this matters

`pnpm audit --prod` reports 74 advisories (38 high, 29 moderate, 7 low) on
2026-11-16. Plan 164 closed the previous batch with `overrides` in
`pnpm-workspace.yaml`; new advisories have since been published against the
versions the lockfile still pins. All are in transitive packages.

## Current state

By package, with the direct dependency that pulls it in and the fixed version
the advisory names:

| Package | Via | Needs |
|---|---|---|
| `axios` | `square` (the `square-legacy` alias) | `>=1.20.0` |
| `follow-redirects` | `square` | `>=1.16.1` |
| `undici` | `astro` | `>=8.12.2` |
| `devalue` | `astro` | `>=5.9.3` |
| `toml`, `smol-toml` | `@astrojs/netlify` | `>=5.0.1`, `>=1.9.0` |
| `fast-uri` | `@astrojs/netlify` | `>=4.2.3` |
| `@fastify/busboy` | `@astrojs/netlify` | `>=3.2.1` |
| `brace-expansion` | `@astrojs/netlify` | `>=5.0.12` on the 5.x line |
| `svgo` | `astro`, `astro-icon` | `>=4.1.0`, `>=3.3.5` |
| `sharp` | direct | `>=0.35.4` |
| `extract-zip` | `astro-icon` | no fix published |

Existing overrides are floors such as `undici: ">=7.29.0"`; a floor does not
move a version the lockfile already satisfies.

Patch releases are also pending for `astro` (7.4.5 to 7.4.12),
`@astrojs/netlify` (8.2.11 to 8.2.14) and `@astrojs/sitemap`.

## Steps

### Step 1: Patch the direct dependencies first

`pnpm update astro @astrojs/netlify @astrojs/sitemap sharp` within their
current ranges. **Verify**: `pnpm audit --prod` count drops; record the new
number.

### Step 2: Raise the override floors for what remains

For each row still reported, raise or add its override in
`pnpm-workspace.yaml` to the "Needs" value, then `pnpm install`. Keep the
major-version guards already there (the three `brace-expansion` selectors,
the `@iconify/tools>svgo` `<4.0.0` cap). `undici` moving from 7 to 8 is a
major bump: check Astro's declared range accepts it before forcing it; if not,
leave it and record why.

**Verify**: `pnpm audit --prod` shows only `extract-zip` and anything recorded
as deliberately left.

### Step 3: Prove nothing broke

`pnpm check && pnpm lint && pnpm test:coverage && pnpm build && pnpm test:e2e:stub`
all exit 0. On a deploy preview: load home, a category, a product page; add to
cart; reach the Square checkout page (exercises `axios` through the Square
client).

### Step 4: Update the comment block

Refresh the "Advisory closures" comment in `pnpm-workspace.yaml` with this
plan number and the list of packages deliberately not overridden.

## STOP conditions

- Any step would change `square-legacy` beyond `^44`: stop. The Square v45
  upgrade is deferred to its own session.
- TypeScript resolves to anything but 6.0.3 after install: stop; `astro check`
  does not run on TypeScript 7.
- A forced override makes `pnpm build` or the e2e stub suite fail: revert that
  one override, record it, continue with the rest.
