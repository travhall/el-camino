# Plan 036: Upgrade sharp and clear pnpm audit critical/high advisories

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 0da82aa..HEAD -- package.json pnpm-lock.yaml`
> The advisory list below is a snapshot as of 2026-07-22; run `pnpm audit`
> fresh first to compare.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dependencies
- **Planned at**: commit `0da82aa`, 2026-07-22

## Why this matters

`pnpm audit` (as of HEAD `0da82aa`) reports **15 vulnerabilities: 1 critical, 9 high,
4 moderate, 1 low**, concentrated in `sharp` and its bundled `libvips` native library.
`sharp` is called on every SSR request that triggers image optimization via Astro's
`sharp`-backed image service (`astro/assets/services/sharp`, configured in
`astro.config.mjs:57-62`).

Critical and high CVEs in `libvips` have historically included heap-buffer-overflows
and arbitrary code execution via crafted image inputs. The Netlify function handling
image optimization runs in the same process as payment and order logic — a native
code vulnerability here has higher blast radius than a pure JS vulnerability.

The fix is a `pnpm update` to the latest patched `sharp` release and a re-audit
to confirm the count drops.

## Current state

**`package.json`** (direct `sharp` pin):
```json
"sharp": "^0.34.5"
```

**`astro.config.mjs:57-62`** (sharp as image service):
```javascript
image: {
  service: {
    entrypoint: "astro/assets/services/sharp",
    config: { limitInputPixels: false }
  },
  ...
}
```

**Advisory summary** (run `pnpm audit` to get the current list before starting):
- 1 critical in sharp/libvips
- 9 high in sharp/libvips
- 4 moderate (mixed)
- 1 low

Note: This repo previously ran Plan 018 which patched earlier advisories
(`form-data` CRLF, Astro SSRF/XSS). The current batch is a newer set,
primarily in `sharp`.

## Commands you will need

| Purpose     | Command                     | Expected on success                  |
|-------------|-----------------------------|--------------------------------------|
| Audit       | `pnpm audit`                | Shows current advisory list           |
| Update      | `pnpm update sharp`         | Updates sharp within semver range     |
| Force update | `pnpm add sharp@latest`    | Pins latest, use if update isn't enough|
| Typecheck   | `pnpm check`                | exit 0, no errors                    |
| Unit tests  | `pnpm test:run`             | all pass                             |
| Build       | `pnpm build`                | exit 0                               |

## Scope

**In scope**:
- `package.json` — sharp version bump
- `pnpm-lock.yaml` — regenerated automatically by pnpm

**Out of scope**:
- `astro.config.mjs` — the image service config does not need to change
- Any other dependency — don't use `pnpm update` without a package name (it
  updates everything and may introduce unrelated regressions)
- `pnpm.overrides` in `package.json` — only add an override if `pnpm update sharp`
  is insufficient to resolve the vulnerability (see STOP conditions)

## Git workflow

- Branch: `advisor/036-upgrade-sharp-clear-audit`
- Commit message: `chore(deps): upgrade sharp to clear critical/high pnpm audit advisories`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Check current advisory details

```bash
pnpm audit 2>&1 | head -60
```

Note the exact CVE IDs and affected sharp versions. This tells you the target
version floor the fix requires.

### Step 2: Attempt a semver-compatible upgrade

```bash
pnpm update sharp
```

Then check if the advisories are resolved:

```bash
pnpm audit 2>&1 | grep -E "high|critical|vulnerabilities found"
```

**If the critical/high count drops to 0**: proceed to Step 3.

**If high/critical remain after `pnpm update`**: The required fixed version is
outside the current `^0.34.5` range. In that case:

```bash
# Find the latest stable version:
pnpm info sharp version

# Pin it:
pnpm add sharp@<latest-version>

# Re-audit:
pnpm audit
```

If after pinning to `sharp@latest` critical/high advisories remain (they may
be in transitive deps that sharp itself pulls in), add a resolution override in
`package.json`'s `pnpm.overrides` field for the specific transitive package
reported. Example pattern (already used in this repo):
```json
"pnpm": {
  "overrides": {
    "vulnerable-package": ">=safe-version"
  }
}
```

### Step 3: Typecheck and test

**Verify**: `pnpm check` → exit 0

**Verify**: `pnpm test:run` → all pass. Sharp changes between patch versions
occasionally affect image output quality/format; the unit tests don't exercise
image rendering, so this only confirms no JS regressions.

### Step 4: Verify image service is functional (local smoke test)

```bash
pnpm dev &
# Wait for "Local: http://localhost:4321" in output, then:
curl -s -o /dev/null -w "%{http_code}" "http://localhost:4321/"
```

Expected: `200`. A `500` here often means a sharp native binding
incompatibility — check `pnpm dev` output for `sharp` error messages.

Kill the dev server after confirming.

### Step 5: Commit

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore(deps): upgrade sharp to clear critical/high pnpm audit advisories"
```

## Done criteria

- [ ] `pnpm audit` reports 0 critical, 0 high advisories (moderate/low acceptable)
- [ ] `pnpm check` exits 0
- [ ] `pnpm test:run` exits 0
- [ ] Local dev server returns 200 on `/`
- [ ] Only `package.json` and `pnpm-lock.yaml` modified
- [ ] `plans/README.md` status row for 036 updated to DONE

## STOP conditions

- After pinning `sharp@latest`, critical/high advisories remain in
  transitive dependencies that are not `sharp` itself — report with the
  full `pnpm audit` output; a `pnpm.overrides` approach needs a decision
  on whether the transitive package is actually reachable.
- The dev server returns 500 after the upgrade — sharp native bindings may be
  incompatible; report the exact error from `pnpm dev` output.
- `pnpm check` fails with new TypeScript errors related to sharp's type
  definitions changing — report rather than suppressing with `as any`.

## Maintenance notes

- Sharp follows semver for its JS API but native `libvips` binaries sometimes
  change behavior between `0.x` patch versions (e.g., AVIF encoding defaults).
  After any `sharp` upgrade, verify that product images still render correctly
  on the deployed Netlify preview before merging to main.
- The `limitInputPixels: false` setting in `astro.config.mjs` bypasses sharp's
  default memory protection for very large images. This is intentional (to
  handle high-res product photos) but means a malicious image could still
  trigger high memory use even on a patched sharp — acceptable risk for
  a site whose image sources are Square CDN and WordPress.
