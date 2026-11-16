# Plan 154: Fix the `s-max-age` typo that disables CDN caching on the two most expensive routes

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report. When done, update this
> plan's status row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat ad2999d..HEAD -- src/pages/shop/all.astro src/pages/shop/sale.astro`
> On any change, compare the excerpts below against live code first; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `ad2999d`, 2026-09-05

## Why this matters

The HTTP shared-cache directive is `s-maxage`. `s-max-age` (with the second
hyphen) is not a real directive — caches silently ignore unrecognised tokens.

`/shop/all` and `/shop/sale` both use the misspelling in **every** Cache-Control
string they set, including the `Netlify-CDN-Cache-Control` header. So both pages
effectively advertise no shared-cache lifetime at all, and `/shop/all`
additionally advertises `no-cache`. Netlify's CDN therefore revalidates on
essentially every request.

These are the two routes that call `fetchProducts()` over the **full Square
catalog** — the most expensive SSR renders on the site are precisely the two
that never get edge-cached. The intended caching was written and has never
taken effect.

The same file set proves the correct spelling is known: `src/pages/index.astro:32`
and `src/pages/category/[...slug].astro:69` both use `s-maxage`.

## Current state

`src/pages/shop/all.astro:35-46`:

```astro
// Browsers will always revalidate; CDN benefits from s-max-age.
  ? "public, no-cache, s-max-age=180, stale-while-revalidate=900"
  : "public, no-cache, s-max-age=300, stale-while-revalidate=1800";
...
    ? "public, s-max-age=180, stale-while-revalidate=900"
    : "public, s-max-age=300, stale-while-revalidate=1800"
```

`src/pages/shop/sale.astro:61-70`:

```astro
  ? "public, max-age=120, s-max-age=180, stale-while-revalidate=900" // 2min browser, 3min server, 15min stale for filtered
  : "public, max-age=300, s-max-age=300, stale-while-revalidate=1800"; // 5min browser/server, 30min stale for unfiltered
...
    ? "public, s-max-age=180, stale-while-revalidate=900"
    : "public, s-max-age=300, stale-while-revalidate=1800"
```

Eight occurrences total, four per file. The comment on `all.astro:35` also
contains the misspelling.

Correct usage for comparison, `src/pages/index.astro:31-36`:

```astro
Astro.response.headers.set(
  "Cache-Control",
  "public, s-maxage=300, stale-while-revalidate=1800",
);
Astro.response.headers.set(
  "Netlify-CDN-Cache-Control",
  "public, s-maxage=300, stale-while-revalidate=1800",
);
```

## Commands you will need

| Purpose   | Command         | Expected         |
|-----------|-----------------|------------------|
| Typecheck | `pnpm check`    | exit 0, 0 errors |
| Tests     | `pnpm test:run` | exit 0           |
| Lint      | `pnpm lint`     | exit 0           |
| Build     | `pnpm build`    | exit 0           |

Never use `pnpm test` — watch mode, it hangs.

## Scope

**In scope**:
- `src/pages/shop/all.astro`
- `src/pages/shop/sale.astro`

**Out of scope** (do NOT touch):
- The TTL **values** (180/300/900/1800) and the `max-age`/`no-cache` tokens.
  Only the misspelled directive name changes. Whether `no-cache` alongside
  `s-maxage` is the right policy for `/shop/all` is a separate question — the
  combination is legal (browsers revalidate, the CDN caches) and appears
  deliberate given the comment. Do not "improve" it here.
- `src/pages/index.astro`, `src/pages/category/[...slug].astro`,
  `src/pages/product/[id].astro` — already spelled correctly.
- `netlify.toml` — plans 155 and 156 own it.

## Git workflow

- Branch: `advisor/154-fix-s-max-age-typo`
- Conventional commits, e.g. `fix(perf): correct s-max-age typo to s-maxage on shop routes`
- Do NOT push or open a PR unless the operator instructs it.

## Steps

### Step 1: Correct all eight occurrences plus the comment

Replace `s-max-age` with `s-maxage` in both files, including the comment on
`all.astro:35`.

**Verify**:
```bash
grep -rn "s-max-age" src/
```
→ **no matches**.

```bash
grep -rc "s-maxage" src/pages/shop/all.astro src/pages/shop/sale.astro
```
→ 4 in each file.

### Step 2: Add a regression guard comment

Above each `Cache-Control` assignment in both files, note that the directive is
`s-maxage` with no second hyphen and that the misspelling fails silently. This
is the only defense — a typo here produces no error, no warning, and no test
failure.

**Verify**: `pnpm check` → exit 0.

### Step 3: Confirm the headers on a deploy preview

This change is only observable in an HTTP response. Deploy a preview and probe
both routes:

```bash
curl -sSI "https://<PREVIEW_HOST>/shop/all"  | grep -i "cache-control"
curl -sSI "https://<PREVIEW_HOST>/shop/sale" | grep -i "cache-control"
```

**Verify**: both responses show `s-maxage=300` (unfiltered case). Then request
each twice and check `cache-status` on the second request shows a hit rather
than `fwd=miss` every time.

If you cannot produce a deploy preview, say so in the status row and rely on the
grep criteria — the change is a two-character fix with no logic, so the risk of
shipping it unverified is low. This is the one plan in this cluster where that
tradeoff is acceptable.

### Step 4: Full gate

```bash
pnpm check && pnpm lint && pnpm test:run && pnpm build
```
→ all exit 0.

## Test plan

- No unit tests apply — these are response headers set in `.astro` frontmatter,
  outside `vitest.config.ts`'s coverage include.
- Verification is the greps in Step 1 plus the deploy-preview probe in Step 3.
- `pnpm test:run` must pass unchanged; no test touches these files.

## Done criteria

- [ ] `grep -rn "s-max-age" src/` returns no matches
- [ ] `grep -rc "s-maxage" src/pages/shop/all.astro src/pages/shop/sale.astro` returns 4 for each
- [ ] TTL values and `max-age`/`no-cache` tokens unchanged (`git diff` shows only the directive name)
- [ ] `pnpm check` / `pnpm lint` / `pnpm test:run` / `pnpm build` all exit 0
- [ ] Only the two shop route files modified (`git status`)

## STOP conditions

Stop and report if:

- The `git diff` shows anything beyond the directive-name change. This plan is
  eight two-character edits plus comments; any other change is out of scope.
- The deploy preview shows these routes returning stale or wrong inventory once
  caching actually starts working. That is the *intended* behavior finally
  taking effect, but if 300 s of stale product data is unacceptable to the
  operator, the TTL is theirs to choose — report, do not pick a new number.
- Any verification fails twice after a reasonable fix attempt.

## Maintenance notes

- **This class of bug is invisible.** An unrecognised Cache-Control directive
  produces no error anywhere in the stack. The same failure mode caused the dead
  `netlify.toml` image-header rule (plan 146) and the unread `SQUARE_*` env vars
  (plan 162). A shared helper that builds these header strings once would remove
  the whole class — see the maintenance note in plan 155.
- A reviewer should diff the strings character by character rather than eyeballing.
- **Deliberately deferred**: consolidating cache-header construction into one
  helper, and revisiting whether `no-cache` belongs on `/shop/all`.
