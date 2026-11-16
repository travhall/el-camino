# Plan 189: Stop fetching the shop-status override client-side on every page load

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
> When done, update this plan's status row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat ad2999d..HEAD -- src/components/OpenStatusBadge.astro src/components/Footer.astro src/pages/api/shop-status.ts src/lib/shopStatus.ts`
> If any changed, compare the "Current state" excerpts against the live code
> first; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `1bf2f38`, 2026-09-06

## Why this matters

A live Chrome DevTools trace against the deployed staging build
(https://elcaminoskateshop.netlify.app/, Slow 4G + 4x CPU throttle) found
`/api/shop-status` as the single slowest node in the entire critical path —
2,080 ms, three levels deep in the network dependency tree (page →
`ClientRouter` script → `prefetch.js` → `/api/shop-status`).

The endpoint returns `Cache-Control: no-store` and reads from Netlify Blobs
(`getShopStatusConfig()`) on every call. It is fetched by
`OpenStatusBadge.astro`'s client script on **every single page load** — not
just once per session — because the badge renders in `Footer.astro`, which is
on every page.

This is a config that changes rarely (an admin manually toggling
open/closed/holiday override), not live data. The regular weekly schedule
this same component falls back to is *already* inlined server-side via a
`<script id="site-hours-data">` JSON block in `Footer.astro` — the override
is the one piece still round-tripping to the client for no reason.

## Current state

`src/components/OpenStatusBadge.astro:72-90` — the client-side fetch:

```ts
async function updateOpenStatusBadges() {
  const badges = document.querySelectorAll<HTMLElement>(
    '[data-open-status-badge]'
  );
  if (!badges.length) return;

  const now = new Date();

  // ── 1. Check admin override ──────────────────────────────────────────────
  let overrideStatus: 'open' | 'closed' | null = null;
  try {
    const res = await fetch('/api/shop-status');
    if (res.ok) {
      const override = (await res.json()) as ShopOverride;
      overrideStatus = resolveOverride(override, now);
    }
  } catch {
    // Network error — fall back to schedule silently
  }
  ...
```

`src/pages/api/shop-status.ts` (whole file) — the endpoint being fetched:

```ts
import type { APIRoute } from 'astro';
import { getShopStatusConfig } from '@/lib/shopStatus';

export const GET: APIRoute = async () => {
  try {
    const config = await getShopStatusConfig();
    return new Response(
      JSON.stringify({
        mode: config.mode,
        until: config.until ?? null,
        holidays: config.holidays,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch {
    return new Response(
      JSON.stringify({ mode: 'auto', until: null, holidays: [] }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }
};
```

`src/components/Footer.astro:50-56` — the existing inline-data pattern this
plan should follow, already used for the weekly schedule:

```astro
<!-- Store hours data island — read by OpenStatusBadge on every page -->
<script type="application/json" id="site-hours-data" set:html={JSON.stringify(hours)} />
```

`OpenStatusBadge` is rendered in exactly two places (confirmed via
`grep -rln "OpenStatusBadge" src/`):
- `src/components/Footer.astro:117` — site-wide, every page.
- `src/pages/the-shop/index.astro:45` and `:387` — two instances on the same
  page (both inside the site-wide `Footer`'s reach anyway, since Footer is
  global).

`src/lib/shopStatus.ts:32-43` — `getShopStatusConfig()`, the function to call
server-side instead of over HTTP:

```ts
export async function getShopStatusConfig(): Promise<ShopStatusConfig> {
  try {
    const data = (await store().get('shop-status', {
      type: 'json',
    })) as ShopStatusConfig | null;
    if (!data) return { ...DEFAULT_CONFIG };
    return { ...data, holidays: data.holidays ?? [] };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}
```

## Commands you will need

| Purpose   | Command              | Expected             |
|-----------|-----------------------|----------------------|
| Typecheck | `pnpm check`          | exit 0                |
| Tests     | `pnpm test:run`       | exit 0                |
| Coverage  | `pnpm test:coverage`  | exit 0, no regression |
| Lint      | `pnpm lint`           | exit 0                |
| Build     | `pnpm build`          | exit 0                |
| Dev server| `pnpm dev`            | serves on :4321       |

Never use `pnpm test` — watch mode, it hangs.

## Scope

**In scope**:
- `src/components/Footer.astro` — call `getShopStatusConfig()` server-side
  alongside the existing `hours` fetch, inline the result as a second JSON
  island next to `site-hours-data`.
- `src/components/OpenStatusBadge.astro` — read the inlined override data
  instead of `fetch('/api/shop-status')`.
- `src/pages/api/shop-status.ts` — decide whether to delete it or keep it as
  a fallback (see Step 4).

**Out of scope** (do NOT touch):
- `src/lib/shopStatus.ts` — `getShopStatusConfig()`'s implementation and the
  admin write path (`saveShopStatusConfig`, the admin UI that calls it) are
  unrelated to this plan.
- The weekly-schedule fallback logic in `OpenStatusBadge.astro`
  (`resolveOverride`, the `site-hours-data` read, the time-window match) —
  leave it exactly as-is; this plan only changes *how the override data
  arrives*, not the resolution logic that consumes it.
- `src/pages/the-shop/index.astro` — it renders `OpenStatusBadge` but takes
  no props related to this data; no changes needed there.

## Git workflow

- Branch: `advisor/189-inline-shop-status-override`
- Conventional commits, e.g.
  `perf: inline the shop-status override instead of fetching it client-side`
- Do NOT push or open a PR unless the operator instructs it.

## Steps

### Step 1: Inline the override data in `Footer.astro`

In `Footer.astro`'s frontmatter, call `getShopStatusConfig()` (import from
`@/lib/shopStatus`) alongside whatever already produces `hours`. Serialize the
same three fields the current API response returns (`mode`, `until`,
`holidays`) into a second `<script type="application/json">` island, e.g.
`id="shop-status-data"`, placed next to the existing `site-hours-data` block.

**Verify**: `grep -n "shop-status-data" src/components/Footer.astro` → present.

### Step 2: Read the inlined data in `OpenStatusBadge.astro`

Replace the `fetch('/api/shop-status')` block with a read of
`document.getElementById('shop-status-data')`, parsed the same way
`site-hours-data` already is a few lines below (same try/catch-on-malformed-
JSON shape). Preserve the exact fallback behavior: if the element is missing
or its JSON is malformed, `overrideStatus` stays `null` and the function falls
through to the regular schedule — do not change that contract.

**Verify**: `grep -n "fetch('/api/shop-status')" src/components/OpenStatusBadge.astro`
→ no match.

### Step 3: Confirm both `OpenStatusBadge` render sites still work

`the-shop/index.astro` renders two `OpenStatusBadge` instances on one page —
confirm both still resolve correctly from the single Footer-rendered data
island (they should; the badge already works this way for `site-hours-data`).

**Verify**: covered by Step 5's browser check.

### Step 4: Decide the fate of `src/pages/api/shop-status.ts`

With no remaining caller (confirm via
`grep -rln "shop-status" src/ --include=*.ts --include=*.astro` excluding the
route file itself and `shopStatus.ts`), the route is dead code. Two
reasonable options — pick one and record which:

(a) Delete it, since nothing calls it anymore.
(b) Keep it as a documented public endpoint (e.g. if something external, a
    status-page integration, or a future admin polling UI might want it) and
    add a one-line comment noting it is no longer used by `OpenStatusBadge`.

Default to (a) unless you find a reason not to — an unused route is a bigger
liability than a small amount of duplicated logic.

**Verify**: if deleted, `test -f src/pages/api/shop-status.ts` fails; if kept,
the added comment is present.

### Step 5: Verify in a browser

Start `pnpm dev`. Load the homepage:

1. View source (or check the rendered HTML directly, not just devtools) —
   confirm a `shop-status-data` JSON script tag is present with real data.
2. Confirm the "Open Now" / "Closed" badge renders correctly in the footer,
   matching whatever the current admin override / schedule actually says.
3. Open Network tab — confirm no request to `/api/shop-status` fires on page
   load.
4. Navigate client-side to `/the-shop` via a link (exercises the
   `astro:page-load` re-run) — confirm both badges on that page still update
   correctly and still no `/api/shop-status` request fires.
5. If you kept the API route (option b in Step 4), skip; if you deleted it,
   confirm `curl -i http://localhost:4321/api/shop-status` returns 404.

**Verify**: all of the above observed and recorded in the status row.

### Step 6: Full gate

```bash
pnpm check && pnpm lint && pnpm test:run && pnpm build
```
→ all exit 0.

## Test plan

- No new unit tests required — this moves an existing data source from HTTP
  to an inline script tag; the resolution logic (`resolveOverride`) is
  unchanged and untested today (it's inline `<script>` content, outside
  `vitest.config.ts`'s coverage include, same as the rest of this file).
- If `src/pages/api/shop-status.ts` is deleted, confirm no test file
  references it (`grep -rln "shop-status" src/pages/api/__tests__/` — if a
  test exists for the route, it must be deleted too, and noted in the status
  row).
- `pnpm test:coverage` → exit 0, no threshold regression.

## Done criteria

- [ ] `Footer.astro` inlines the shop-status override as a JSON script island
- [ ] `OpenStatusBadge.astro` reads that island instead of fetching `/api/shop-status`
- [ ] No `/api/shop-status` network request fires on initial load or client-side navigation (verified in-browser)
- [ ] Both `OpenStatusBadge` instances on `/the-shop` still resolve correctly
- [ ] `src/pages/api/shop-status.ts`'s fate decided and recorded (deleted or documented as kept)
- [ ] `pnpm check` / `pnpm lint` / `pnpm test:run` / `pnpm build` all exit 0
- [ ] `pnpm test:coverage` exits 0, no threshold regression

## STOP conditions

Stop and report if:

- The admin UI that writes the override (`saveShopStatusConfig`'s caller)
  expects the change to be reflected without a full page reload — i.e. if
  there's a live-polling expectation this plan would break by moving to a
  page-load-only inline value. Check the admin shop-status page before
  assuming this doesn't matter.
- Removing `/api/shop-status` turns out to have an external caller you can't
  see from `grep` alone (e.g. documented in `docs/` or referenced from
  outside the repo). If in doubt, keep the route (option b in Step 4) rather
  than guess.
- Any verification fails twice after a reasonable fix attempt.

## Maintenance notes

- **The pattern**: this plan makes the override data follow the exact same
  server-inline-JSON-island convention `site-hours-data` already uses in the
  same file. Any future per-page-load config `OpenStatusBadge` (or a similar
  component) needs should follow the same pattern rather than adding another
  client fetch.
- A reviewer should confirm the fallback behavior (missing/malformed inline
  data → fall through to schedule) still matches what a network failure used
  to produce, since that's the safety net for a corrupted or absent Blobs
  entry.
