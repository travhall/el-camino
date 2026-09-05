# Plan 126: Remove the CSP-blocked, non-functional `clientPrerender` config

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 7a943d7..HEAD -- astro.config.mjs`
> If `astro.config.mjs` changed since this plan was written, compare the
> "Current state" excerpt against the live file before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `7a943d7`, 2026-08-17

## Why this matters

Every page load on the production site logs a console error:

```
Applying inline speculation rules violates the following Content Security
Policy directive 'script-src 'self' 'nonce-...' https://sandbox.web.squarecdn.com
https://web.squarecdn.com'. Either the 'unsafe-inline' keyword, a hash
('sha256-...'), or a nonce ('nonce-...') is required to enable inline
execution. The action has been blocked.
```

`astro.config.mjs` sets `experimental.clientPrerender: true`, which makes
Astro inject an inline `<script type="speculationrules">` tag per page to
drive the browser's Speculation Rules API (prerendering likely next-visited
pages in the background). Astro does not currently give this injected
script a CSP nonce, and this repo's `src/middleware.ts` generates a
per-request nonce-based CSP with no `'unsafe-inline'` fallback for
`script-src` (confirmed: `script-src 'self' 'nonce-${nonce}' ...` — no
`unsafe-inline`, no matching hash). Every browser page load is therefore
silently blocking this script — the feature has been fully non-functional
since it was enabled, producing zero benefit while adding a console error
on every navigation.

This isn't the primary fix for the "slow first open" symptom (that's Plans
124/125), but it's a real, free-to-fix bug found during that
investigation: dead config that should either work or be removed, not
silently fail. Adding `'unsafe-inline'` to fix it instead would reopen a
CSP weakness this repo has previously and deliberately closed — this
`plans/` directory's own history includes a prior plan specifically titled
"fix-csp-nonce-gaps-best-practices-regression" — so removal, not loosening
the CSP, is the correct fix here.

## Current state

- `astro.config.mjs:52-54` — the experimental block as it stands today:

```js
  experimental: {
    clientPrerender: true, // Enable Speculation Rules API support (already enabled)
  },
```

- `src/middleware.ts:9-33` — CSP generation, confirming no `unsafe-inline`
  or hash-based allowance exists for inline scripts:

```ts
  // Generate a per-request nonce for CSP — must happen before next() so
  // ...
  locals.nonce = randomBytes(16).toString("base64");
  // ...
  const nonce = locals.nonce;
  // ...
  `default-src 'self'; img-src 'self' https: data: *.wordpress.com; script-src 'self' 'nonce-${nonce}' https://sandbox.web.squarecdn.com https://web.squarecdn.com; style-src 'self' 'unsafe-inline'; font-src 'self' https:; connect-src 'self' https: wss:; frame-src 'self' https://www.youtube-nocookie.com https://www.youtube.com; object-src 'none'; base-uri 'self'; form-action 'self'`
```

(Exact line numbers may shift slightly — use the `nonce-${nonce}` string in
`script-src` as the anchor if line numbers have drifted; this file is
explicitly **out of scope** to edit, quoted here only as evidence for why
removal is correct.)

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `pnpm check` | exit 0, no errors |
| Lint | `pnpm lint` | exit 0 |
| Tests | `pnpm test:run` | all pass |

## Scope

**In scope** (the only file you should modify):
- `astro.config.mjs` (only the `experimental` block, lines 52-54)

**Out of scope** (do NOT touch, even though they look related):
- `src/middleware.ts` — do not add `'unsafe-inline'` or a hash to the CSP
  to make speculation rules work instead of removing them. That would
  weaken the CSP repo-wide for a feature that (per Astro's current
  behavior) has no supported nonce injection point. If the maintainer wants
  prerendering back in the future, that requires either an Astro version
  that supports nonce injection for this script, or a middleware-level
  patch to inject the nonce post-render — out of scope for this plan.
- The `prefetch` config block (`astro.config.mjs:42-46`) — that's Plan 125,
  a different mechanism (Astro's fetch-based prefetch runtime, not the
  browser's native Speculation Rules API).

## Git workflow

- Branch: `advisor/126-remove-broken-client-prerender`
- Single commit is fine for this change.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Confirm the console error exists (baseline)

If you have access to a running preview or the production URL via a
browser tool, load the homepage and check the console for the
"Applying inline speculation rules violates..." CSP error described above.
If you have no browser access in your environment, skip this step and rely
on the "Current state" evidence above — do not treat the lack of browser
access as a STOP condition.

### Step 2: Remove the `experimental.clientPrerender` block

Edit `astro.config.mjs`, deleting the `experimental` block entirely
(lines 52-54):

```js
  experimental: {
    clientPrerender: true, // Enable Speculation Rules API support (already enabled)
  },

```

Remove this whole block, including the blank line that follows it if doing
so leaves two consecutive blank lines elsewhere in the file — keep
formatting consistent with the surrounding config (single blank line
between top-level keys).

**Verify**: `pnpm check` → exit 0, no errors.

### Step 3: Confirm the build is unaffected

```bash
pnpm lint
pnpm test:run
```

**Verify**: both exit 0.

## Test plan

No unit test applies — this removes a dead experimental flag with no
application code depending on it.

- Verification: `grep -rn "clientPrerender" astro.config.mjs src/` returns
  no matches after the change.
- If browser access is available: reload the homepage, confirm the
  "Applying inline speculation rules violates..." console error no longer
  appears.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm check` exits 0
- [ ] `pnpm lint` exits 0
- [ ] `pnpm test:run` exits 0
- [ ] `grep -n "clientPrerender" astro.config.mjs` returns no matches
- [ ] No files outside `astro.config.mjs` are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at `astro.config.mjs:52-54` doesn't match the "Current state"
  excerpt (the file has drifted since this plan was written) — in
  particular, if `clientPrerender` has already been removed or if
  `src/middleware.ts`'s CSP now includes `'unsafe-inline'` or a matching
  hash for `script-src` (meaning the feature may now actually work) —
  re-verify the console-error claim before removing in that case.
- `pnpm test:run` fails after this change — a config-only removal should
  not affect any test.

## Maintenance notes

- If prerendering is wanted in the future, re-adding it will need either an
  Astro upgrade that supports nonce injection for the speculation-rules
  script, or a `src/middleware.ts` change to post-process the response HTML
  and inject the current request's nonce into that specific script tag
  before it's sent. Either approach should be a fresh, deliberate plan, not
  a re-flip of this boolean.
- This is unrelated to Plans 124/125 — it fixes a console-error bug found
  during the same investigation, not a contributor to load latency.
