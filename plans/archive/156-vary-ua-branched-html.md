# Plan 156: Stop mobile and desktop visitors being served each other's cached HTML

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report. When done, update this
> plan's status row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat ad2999d..HEAD -- src/layouts/Layout.astro src/components/Header.astro src/utils/device.ts netlify.toml src/pages/index.astro src/pages/product/[id].astro`
> On any change, compare the excerpts below against live code first; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: MED
- **Depends on**: none (but shares `netlify.toml` with 146, 149, 155 if you fix it there)
- **Category**: bug
- **Planned at**: commit `ad2999d`, 2026-09-05

## Why this matters

The site renders **different HTML** depending on the request's `User-Agent`
header, and then tells the CDN to cache that HTML publicly with no indication
that it varies by device.

The result: a mobile visitor can be served the desktop-rendered page (carrying
QuickView and MiniCart markup it should not have), and a desktop visitor can be
served the mobile page (missing them entirely). Which one you get depends on who
warmed the cache entry, so it is intermittent and will look like a ghost bug.

This also silently undermines the "desktop-only features" optimization: the
components are conditionally rendered to save mobile bytes, but caching means
mobile users receive them anyway a fraction of the time.

## Current state

`src/layouts/Layout.astro:20-23` — the branch:

```astro
// Device detection for conditional component loading
const userAgent = Astro.request.headers.get("user-agent") || "";
const deviceInfo = detectDeviceFromUA(userAgent);
const isDesktop = deviceInfo.isDesktop;
```

`src/layouts/Layout.astro:60-68` — where it changes the markup:

```astro
    {
      isDesktop && (
        <>
          <QuickView />
          <MiniCart />
        </>
      )
    }
```

`src/components/Header.astro:22-23` — a second, independent branch:

```astro
const deviceInfo = detectDeviceFromUA(userAgent);
const isMobile = deviceInfo.isMobile;
```

`src/utils/device.ts:20-31` — the detection is a UA regex, so the output varies
across essentially every real browser string:

```ts
export function detectDeviceFromUA(
  userAgent: string
): Omit<DeviceInfo, 'screenWidth'> {
  const ua = userAgent.toLowerCase();
  const mobilePatterns =
    /android|webos|iphone|ipod|blackberry|iemobile|opera mini/i;
  const tabletPatterns = /ipad|android(?!.*mobile)|tablet|kindle|silk/i;
  const isMobile = mobilePatterns.test(ua) && !tabletPatterns.test(ua);
```

The pages that use `Layout` **and** set public CDN caching:

- `src/pages/index.astro:31-36` — `public, s-maxage=300, stale-while-revalidate=1800`
  on both `Cache-Control` and `Netlify-CDN-Cache-Control`
- `src/pages/product/[id].astro:411-412` —
  `public, max-age=0, s-maxage=300, stale-while-revalidate=3600, durable`
- `src/pages/category/[...slug].astro:67-73` and the shop routes

A repo-wide grep confirms the gap:

```bash
$ grep -rn "Vary" src/ netlify.toml
src/pages/api/get-categories.ts:93:          Vary: 'Accept-Encoding',
netlify.toml:46:Netlify-Vary = "query=brand,query=availability"
```

Nothing varies on `User-Agent` anywhere.

## The two viable fixes — pick one, in Step 1

**Option A — vary the cache on the device dimension.** Add
`Netlify-Vary = "header=User-Agent"` (or better, a narrow derived key) for the
cached HTML routes. **Warning**: raw `User-Agent` has enormous cardinality —
varying on it directly can fragment the cache so badly that the caching becomes
worthless, which would make the cold-path SSR cost (plans 176 et al.) much
worse. Netlify's `Netlify-Vary` does not support arbitrary normalization, so
this option is only safe if you can express the variance narrowly.

**Option B — remove the server-side branch (recommended).** Render QuickView and
MiniCart unconditionally and gate them on the **client** (CSS media query, or
the existing `initDeviceDetection.ts` script). The HTML becomes device-invariant
and the caching problem disappears entirely, at the cost of some markup mobile
users do not use. Note that `src/scripts/initDeviceDetection.ts` already runs on
every page (`Layout.astro:174`), so a client-side gate has a home.

**Option B is recommended** because it removes the failure mode rather than
configuring around it, and because Option A's cache fragmentation risk is real
and hard to bound. But confirm the byte cost of the unconditional render before
committing — see Step 1.

## Commands you will need

| Purpose   | Command         | Expected         |
|-----------|-----------------|------------------|
| Typecheck | `pnpm check`    | exit 0, 0 errors |
| Tests     | `pnpm test:run` | exit 0           |
| Lint      | `pnpm lint`     | exit 0           |
| Build     | `pnpm build`    | exit 0           |
| Dev server| `pnpm dev`      | serves on :4321  |

Never use `pnpm test` — watch mode, it hangs.

## Scope

**In scope** — depends on the option chosen in Step 1:
- Option A: `netlify.toml` (new/edited header blocks only)
- Option B: `src/layouts/Layout.astro`, `src/components/Header.astro`, and CSS
  or `src/scripts/initDeviceDetection.ts` for the client-side gate

**Out of scope** (do NOT touch):
- `src/utils/device.ts` — the detection function itself is fine and is used
  elsewhere. Do not delete it even if Option B stops using it in these two files;
  check for other callers first.
- `src/components/QuickView.astro` and `src/components/MiniCart.astro` internals.
  You are changing *whether* they render, not what they do.
- The `Cache-Control` TTL values.
- The `Netlify-Vary` query keys for `/category/*` — plan 155 owns that line.

## Git workflow

- Branch: `advisor/156-vary-ua-branched-html`
- Conventional commits, e.g.
  `fix: make cached HTML device-invariant so the CDN can't cross-serve it`
- Do NOT push or open a PR unless the operator instructs it.

## Steps

### Step 1: Choose the option, with evidence

Measure the byte cost of Option B before deciding:

1. `pnpm dev`, load `/` with a desktop UA, and record the HTML transfer size.
2. Load `/` with a mobile UA (DevTools device emulation) and record it.

The difference is what Option B would add for mobile visitors.

Also check for other callers before assuming `detectDeviceFromUA` becomes dead:

```bash
grep -rn "detectDeviceFromUA\|deviceInfo" src/
```

Record the byte delta, the caller list, and your chosen option in the
`plans/README.md` status row. If the delta is large (say >15 KB of HTML), report
before proceeding — Option A may be worth its cache-fragmentation cost after all,
and that is the operator's tradeoff.

### Step 2 (Option B): Render unconditionally, gate on the client

Remove the `isDesktop &&` condition at `Layout.astro:61` so `<QuickView />` and
`<MiniCart />` always render. Hide them for non-desktop viewports with CSS
(a media query matching the breakpoint the site already uses) rather than a
`User-Agent` test.

Do the same for `Header.astro`'s `isMobile` branch — inspect what it gates and
replace it with the equivalent CSS/client condition.

Leave a comment at each site explaining that the server render must stay
device-invariant because the HTML is CDN-cached publicly.

**Verify**:
```bash
grep -n "isDesktop\|isMobile" src/layouts/Layout.astro src/components/Header.astro
```
→ no matches, or only in a comment.

### Step 2 (Option A, only if chosen): Add the vary header

Add `Netlify-Vary = "header=User-Agent"` to the header blocks covering the
CDN-cached HTML routes in `netlify.toml`, with a comment naming
`Layout.astro:61` and `Header.astro:23` as the reason.

**Verify**: `grep -n "User-Agent" netlify.toml` → present.

### Step 3: Prove the HTML no longer varies by device (Option B)

With `pnpm dev` running:

```bash
curl -s -A "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)" http://localhost:4321/ > /tmp/mobile.html
curl -s -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" http://localhost:4321/ > /tmp/desktop.html
diff /tmp/mobile.html /tmp/desktop.html && echo "IDENTICAL"
```

**Verify**: prints `IDENTICAL`. Any diff means a UA branch remains — find it
before continuing (check `Footer.astro`, `Nav.astro`, and the CartLayout too).

### Step 4: Verify behavior is unchanged for real users

With `pnpm dev`, in DevTools:

- Desktop viewport: QuickView opens from a product card; MiniCart opens from the
  cart button. Both work as before.
- Mobile emulation (iPhone): QuickView and MiniCart are **not visible** and do
  not interfere with the mobile cart flow.
- Resize from desktop to mobile width without reloading: no broken layout, no
  stuck-open modal.

### Step 5: Full gate

```bash
pnpm check && pnpm lint && pnpm test:run && pnpm build
```
→ all exit 0.

## Test plan

- No existing unit tests cover `Layout.astro` (`.astro` is outside
  `vitest.config.ts`'s include).
- If `src/utils/__tests__/device.test.ts` exists, leave it alone — the detection
  function is unchanged.
- Primary verification is the Step 3 `diff` (machine-checkable) plus Step 4's
  browser checks. Record both in the status row.
- `pnpm test:run` → exit 0, count not lower than baseline.

## Done criteria

- [ ] Step 1's byte delta, caller list, and chosen option recorded in `plans/README.md`
- [ ] Option B: `diff` of mobile-UA vs desktop-UA HTML for `/` prints `IDENTICAL`
- [ ] Option B: `grep -n "isDesktop\|isMobile" src/layouts/Layout.astro src/components/Header.astro` → no live uses
- [ ] QuickView and MiniCart still work on desktop; hidden on mobile
- [ ] `src/utils/device.ts` unmodified (`git status`)
- [ ] `pnpm check` / `pnpm lint` / `pnpm test:run` / `pnpm build` all exit 0
- [ ] Only in-scope files modified (`git status`)

## STOP conditions

Stop and report if:

- **Step 3's `diff` still shows differences** after removing the two known
  branches. That means a third UA-dependent render exists that this plan did not
  find — report where, do not chase it silently.
- The unconditional render adds more than ~15 KB of HTML for mobile visitors.
- `detectDeviceFromUA` turns out to drive behavior beyond these two components
  (e.g. a data-fetching decision), which would make the HTML vary in ways CSS
  cannot fix.
- Option A is chosen and you cannot bound the cache fragmentation. Varying on
  raw `User-Agent` can effectively disable CDN caching for HTML, which would
  make the cold-start SSR problem substantially worse.
- Any verification fails twice after a reasonable fix attempt.

## Maintenance notes

- **The invariant**: any response cached with `public, s-maxage` must render
  identically for all users, or it must declare every dimension it varies on.
  A future "personalized" server render (geo, logged-in state, A/B bucket)
  reintroduces this bug — the Step 3 `diff` is a cheap check worth repeating.
- If Option B was taken, `src/utils/device.ts` may now have no server-side
  callers. Leave it; a later cleanup can remove it once confirmed dead (plan
  184's territory).
- A reviewer should run the Step 3 `diff` themselves rather than trusting the
  status row.
- **Deliberately deferred**: whether mobile should get a genuinely lighter
  payload. That is a real optimization, but it needs a mechanism that does not
  break caching — an edge function or client-side lazy loading, not a UA branch
  in SSR.
