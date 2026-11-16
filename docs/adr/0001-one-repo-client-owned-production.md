# 0001: One repository; the client owns production, the developer owns staging

- **Status**: Accepted (2026-11-16). Not yet implemented: see plan 211.
- **Deciders**: Travis Hall

## Context

The shop owner (Tyler) is meant to own the site outright, so early on he was
given his own GitHub account and his own Netlify account. That produced two
complete copies of everything:

| | Staging | Production |
|---|---|---|
| Repository | `travhall/el-camino` | `ElCaminoBoardShop/el-camino` (a fork) |
| Netlify site | `elcaminoskateshop.netlify.app` | `www.elcaminoskateshop.com` |
| Square | Sandbox | Sandbox today, production Square at launch |

The fork is synced by hand. As of 2026-11-16 it sat at `ad2999d` (2026-09-05),
147 commits behind, so production was missing every fix made since, including
the order-confirmation exposure fix (`afeff1f`). Nothing in the workflow makes
that visible. The fork also disables scheduled workflows after inactivity, so
the keep-warm job never ran against production, and the copy in the upstream
repository warms staging while calling it production.

Two things were being treated as one: who owns the accounts that carry business
risk and billing, and where the code lives.

## Decision

1. **One repository.** It lives in the client's GitHub organization
   (`ElCaminoBoardShop`), with the developer as an admin member. The fork
   relationship goes away; there is nothing to sync.
2. **The client owns production**: the production Netlify site, the domain,
   production Square, Resend, and their billing.
3. **The developer owns staging**: a separate Netlify site on the developer's
   account, building the same repository, permanently on Square Sandbox.
4. **Each site is self-contained.** Every site has its own environment
   variables, its own Square webhook subscription and signature key, and its
   own Netlify Blobs data (admin settings, pending orders, back-in-stock
   signups). Nothing done on staging reaches production.
5. **Promotion is explicit.** Staging builds `master`. Production builds a
   `production` branch that only moves by fast-forward from `master`.

## Alternatives considered

- **Keep the fork, sync more carefully.** No structural change, but drift is
  the default state and only discipline prevents it. This is what failed.
- **Everything on the developer's accounts.** Simplest to operate; the client
  would not own the thing his business runs on, which was the original goal.
- **One Netlify site, two domains, client-owned.** No separate staging data or
  Sandbox isolation; a webhook or blob written while testing would be live.

## Consequences

- A fix reaches production by moving one branch, and "what is production
  running" is answered by `git log production`.
- The developer needs continuing access to the client's GitHub organization.
  Removing that access is how a full handoff would happen later.
- Site-level setup must be done twice and can differ. Anything configured in
  the staging admin screens has to be entered again on production.
- Moving the repository changes its URL: clone URLs, the README, CI badges and
  the Netlify build hooks on both sites have to be repointed once.
- Code must not hardcode either host. Today `keep-warm.yml` hardcodes the
  staging host and the canonical link tag follows whatever host served the
  page.
