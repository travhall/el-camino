# Plan 098: Unpin Astro and refresh stale lockfile

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `cat package.json | grep '"astro"'`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: dependencies
- **Planned at**: commit `915a062`, 2026-08-01

## Why this matters

The audit flagged pinned Astro versions and/or a stale lockfile. Pinning exact versions blocks security patches; a stale lockfile means contributors install different packages than CI. Additionally:
- `@astrojs/netlify` adapter must match the installed Astro version — mismatches cause build failures
- Astro 7.x has been releasing patch and minor updates; staying pinned means missing bug fixes

## Current state

Read `package.json` to see current Astro version and any exact pins (`"astro": "7.x.x"` vs. `"^7.x.x"`). Run:
```bash
pnpm outdated
```
to see what's available. Note: this plan covers Astro + `@astrojs/netlify` + `@astrojs/check`; other packages are in scope only if they appear in `pnpm outdated` as security-flagged.

## Commands

| Purpose | Command | Expected |
|---------|---------|---------|
| Typecheck | `pnpm check` | no errors |
| Tests | `pnpm test:run` | all pass |
| Build | `pnpm build` | exits 0 |
| E2E | `pnpm test:e2e` | all pass |

## Scope

**In scope**: `package.json` version ranges for `astro`, `@astrojs/netlify`, `@astrojs/check`; `pnpm-lock.yaml` regeneration

**Out of scope**: updating non-Astro packages; changing application code

## Git workflow

- Branch: `advisor/098-dep-unpin-astro-refresh-deps`
- Commit: `chore: unpin Astro to semver range and refresh lockfile`

## Steps

### Step 1: Check current versions

```bash
pnpm outdated
cat package.json | grep -E '"astro|@astrojs'
```

### Step 2: Update version ranges

In `package.json`, change any exact pins to caret ranges:
- `"astro": "7.x.x"` → `"astro": "^7.x.x"`
- `"@astrojs/netlify": "x.x.x"` → `"@astrojs/netlify": "^x.x.x"`
- `"@astrojs/check": "x.x.x"` → `"@astrojs/check": "^x.x.x"`

### Step 3: Update packages

```bash
pnpm update astro @astrojs/netlify @astrojs/check
```

### Step 4: Full verification

```
pnpm check
pnpm test:run
pnpm build
```

If E2E tests can run locally without a full Netlify dev environment:
```
pnpm test:e2e
```

All must pass before committing.

### Step 5: Commit package.json and pnpm-lock.yaml together

Stage both files. Verify no other unexpected package changes crept in:
```bash
git diff --stat
```

## Done criteria

- [ ] `astro`, `@astrojs/netlify`, `@astrojs/check` use `^` ranges in `package.json`
- [ ] `pnpm-lock.yaml` regenerated
- [ ] `pnpm check` exits 0
- [ ] `pnpm test:run` exits 0
- [ ] `pnpm build` exits 0
- [ ] `plans/README.md` updated to DONE

## STOP conditions

- `pnpm update` pulls in an Astro minor version that breaks `pnpm check` — pin to latest patch only and document why
- `@astrojs/netlify` adapter breaks after update — the adapter must be compatible with the installed Astro version; check the adapter's changelog

## Maintenance notes

Run `pnpm outdated` monthly and update Astro + adapter together. Never update one without the other.
