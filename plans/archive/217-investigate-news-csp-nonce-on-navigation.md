# Plan 217: **Investigation**: content security policy violations when navigating to /news

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
> When done, update this plan's status row in `plans/README.md`.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: —
- **Category**: bug
- **Planned at**: commit `2ba4b13`, 2026-11-16

## Why this matters

Notes left uncommitted from the plan 181 spike (2026-09-06) report that `/news`
throws four content-security-policy violations on every client-side
navigation into it, from its own inline JSON-LD and `news-data` scripts
carrying a stale nonce. If true, those scripts are blocked after a soft
navigation: structured data is harmless to lose, but the news filter data may
not be. **Unverified lead from two months ago**; code has changed since.

## Current state

- The policy is set per request in `src/middleware.ts:33` with a nonce.
- `src/components/NewsFilters.astro:398` writes
  `<script type="application/json" id="news-filter-options">`.
- `src/pages/news/index.astro` has inline scripts and uses the client router.
- Original note: `docs/salvage-2026-11-16/dreamy-shamir-34a87f.uncommitted.patch`
  (local, gitignored), in its `plans/README.md` hunk.

## Steps

### Step 1: Reproduce

`pnpm dev`, open the home page, click through to News (a real click, not a
page load). **Verify**: record the console's violation messages verbatim, or
record that there are none. Repeat on a production build, since the dev
server's policy may differ.

### Step 2: If none, close

Mark this plan REJECTED with "not reproducible at <commit>".

### Step 3: If reproduced, find the cause

Determine whether the blocked scripts are executable or data-only
(`type="application/json"` and `application/ld+json` are not executed and
should not need a nonce), and whether filters work after a soft navigation.
Check how other pages' inline scripts survive the client router.

### Step 4: Write the fix plan

With the reproduction steps and the chosen fix. Do not fix in this plan.

## Done when

The README row says either "not reproducible" or names the follow-up plan.
