# Plan 083: Parallelize sequential Netlify Blob reads on page data fetches

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> ```
> git diff --stat 915a062..HEAD -- src/pages/the-shop/index.astro
> ```
> If the file changed, compare the excerpt before proceeding. Also check any
> other pages identified in Step 1.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: performance
- **Planned at**: commit `915a062`, 2026-08-01

## Why this matters

Several Astro page files open multiple `await` calls to Netlify Blob-backed
helpers (`getShopHours`, `getContactInfo`, `getSocialLinks`, etc.) sequentially.
Each Blob read has ~10–50ms of network latency. Pages with 3–4 sequential reads
add 30–200ms to server-side render time for no reason — the calls are
independent and safe to run in parallel with `Promise.all`.

**Confirmed case (PERF-04)**:

`src/pages/the-shop/index.astro`, lines 23–25:

```typescript
const shopHours = await getShopHours();
const contact = await getContactInfo();
const social = await getSocialLinks();
```

Three sequential Blob reads before the WordPress fetch even begins. Combining
them saves two round-trips (~20–100ms) on every page render.

**Investigation required**: Search for the same pattern in other pages (homepage,
about page, admin pages) — the same sequential pattern likely exists in 2–4
other files.

## Current state

**Confirmed** — `src/pages/the-shop/index.astro`, lines 23–25:

```typescript
const shopHours = await getShopHours();
const contact = await getContactInfo();
const social = await getSocialLinks();
```

**To discover**: Run this to find other pages with the pattern:

```bash
grep -rn "await getShopHours\|await getContactInfo\|await getSocialLinks\|await getNavItems" src/pages/ --include="*.astro" | grep -v "Promise.all"
```

Fix every file found.

## Commands you will need

| Purpose   | Command      | Expected on success |
|-----------|--------------|---------------------|
| Typecheck | `pnpm check` | exit 0, no errors   |

## Scope

**In scope**:
- `src/pages/the-shop/index.astro` (confirmed)
- Any other `src/pages/**/*.astro` file with sequential awaits on the same independent helpers

**Out of scope**:
- `src/lib/shopHours.ts`, `src/lib/contactInfo.ts`, `src/lib/socialLinks.ts` — implementations are fine
- Files where the second call depends on the first result (those must remain sequential)

## Git workflow

- Branch: `advisor/083-perf-promise-all-page-fetches`
- Commit: `perf: parallelize sequential Netlify Blob reads on page data fetches`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Find all affected pages

```bash
grep -rn "await getShopHours\|await getContactInfo\|await getSocialLinks\|await getNavItems\|await getAdminConfig" src/pages/ --include="*.astro" | grep -v "Promise.all"
```

List every file with multiple sequential awaits. For each, confirm the calls
are independent (second doesn't use first's result).

### Step 2: Replace sequential awaits with Promise.all

For `src/pages/the-shop/index.astro`, change lines 23–25 from:

```typescript
const shopHours = await getShopHours();
const contact = await getContactInfo();
const social = await getSocialLinks();
```

to:

```typescript
const [shopHours, contact, social] = await Promise.all([
  getShopHours(),
  getContactInfo(),
  getSocialLinks(),
]);
```

Apply the same pattern to every other file found in Step 1. Keep individual
`await` for calls where the result is needed by a subsequent call.

**Verify**: `pnpm check` → exit 0

### Step 3: Verify no behavioral change

The parallelization only changes timing, not semantics. Each result variable
gets the same data as before. Verify by starting the dev server and checking
each affected page renders correctly:

```bash
pnpm dev
```

Navigate to `/the-shop` and any other changed pages; confirm content appears.

## Done criteria

- [ ] `pnpm check` exits 0
- [ ] `src/pages/the-shop/index.astro` uses `Promise.all` for `getShopHours`, `getContactInfo`, `getSocialLinks`
- [ ] All other pages found in Step 1 also use `Promise.all` for independent calls
- [ ] No page has a sequential `await` for independent data fetches
- [ ] No files outside the in-scope list are modified
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

- A helper's second call uses the result of the first — keep those sequential
- A page has only a single `await` to the Blob helpers — no change needed for that page
- `pnpm check` fails after the change — check destructuring types match the original variable types

## Maintenance notes

- Future page files should use `Promise.all` for independent async calls from
  the start — add a note to CLAUDE.md or a code review checklist.
- If `getShopHours` / `getContactInfo` are ever changed to depend on each other's
  data, re-introduce sequential awaits for those specific calls.
