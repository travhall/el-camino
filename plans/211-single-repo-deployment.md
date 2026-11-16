# Plan 211: Replace the hand-synced fork with one repository and a `production` branch

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
> When done, update this plan's status row in `plans/README.md`.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: —
- **Category**: infrastructure
- **Planned at**: commit `2ba4b13`, 2026-11-16

## Why this matters

Implements `docs/adr/0001-one-repo-client-owned-production.md`. Production
builds from a fork that is synced by hand and was 147 commits behind on
2026-11-16. Nothing shows that drift until someone compares commits.

## Current state (verified 2026-11-16)

- `travhall/el-camino` (public): all development, CI active, staging site
  builds `master`.
- `ElCaminoBoardShop/el-camino`: fork, head `ad2999d`, "Keep Functions Warm"
  workflow in state `disabled_inactivity`.
- `.github/workflows/keep-warm.yml` runs every 2 minutes and pings
  `elcaminoskateshop.netlify.app` (staging) under a comment that says
  production.
- `README.md:51` and `README.md:539` name `travhall/el-camino`.

## Steps

### Step 1: Agree the move with Tyler

Needs Tyler: confirm `ElCaminoBoardShop` is a GitHub organization (not a
personal account) and add Travis as an owner or admin. **Verify**: Travis can
open the organization's settings page.

### Step 2: Remove the fork, transfer the repository

GitHub will not transfer a repository into an account that already has a fork
of it. Order matters:

1. On the production Netlify site, note the current build settings and
   environment variables (they stay with the site).
2. Delete or rename the fork `ElCaminoBoardShop/el-camino`. Production keeps
   serving its last deploy.
3. Transfer `travhall/el-camino` to `ElCaminoBoardShop`. Issues, pull requests
   and history move with it; the old URL redirects.

**Verify**: `gh repo view ElCaminoBoardShop/el-camino --json isFork` reports
`false` and the commit count matches the old upstream.

### Step 3: Create the `production` branch

`git branch production master && git push origin production`. Protect both
branches: `master` requires CI; `production` accepts fast-forward merges from
`master` only.

### Step 4: Repoint both Netlify sites

- Production site: link to `ElCaminoBoardShop/el-camino`, production branch
  `production`.
- Staging site (Travis's account): link to the same repository, production
  branch `master`. Requires the Netlify GitHub app to be installed on the
  organization with access to this repository.

**Verify**: a trivial commit to `master` deploys staging only; fast-forwarding
`production` deploys production only.

### Step 5: Fix what named the old layout

- `keep-warm.yml`: target `https://www.elcaminoskateshop.com`, correct the
  comment, and move `WARMUP_SECRET` to the new repository's secrets. Decide
  whether staging needs warming at all (recommended: no).
- `README.md`: clone URL and issues link.
- Local clones: `git remote set-url origin https://github.com/ElCaminoBoardShop/el-camino.git`.
- `CLAUDE.md`: add a short "Deployment" section stating master deploys to
  staging, `production` deploys to production, and linking the decision record.

**Verify**: `git grep -nE "travhall/el-camino|netlify\.app" -- . ':!plans' ':!docs'`
returns only intentional references.

### Step 6: Write the promotion step down

Add to `README.md`: promoting is
`git push origin master:production` after CI is green on `master`.

## STOP conditions

- Tyler's account is personal, not an organization: stop and ask Travis; the
  collaborator model differs and the decision record needs revisiting.
- The transfer is refused: do not work around it by pushing history into a new
  repository (that loses pull requests and issues); report the exact error.
- Either Netlify site fails its first build after relinking: relink to the
  previous repository and stop.

## Done when

One repository exists, the fork is gone, both sites build from it on their own
branches, and the keep-warm job hits production.
