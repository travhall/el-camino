# Plan 174: Put timeouts on the outbound WordPress and CrUX fetches

> **Executor instructions**: Follow step by step. Run every verification command
> and confirm the expected result. If anything in "STOP conditions" occurs, stop
> and report. When done, update this plan's status row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat ad2999d..HEAD -- src/lib/wordpress/api.ts src/pages/api/crux-data.ts src/lib/cache/blobCache.ts`
> On any change, compare against the excerpts below; on a mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `ad2999d`, 2026-09-05

## Why this matters

The WordPress fetch has no timeout. `wordpressCache`'s TTL is **300 s**, so
roughly every five minutes a real visitor's request to `/news` or `/news/[slug]`
is the one that recomputes and blocks on wordpress.com.

If WordPress is *slow* rather than *down*, the SSR render hangs until Netlify's
function timeout and the visitor gets a 502. The carefully-written
`processWordPressError` handler never runs, because nothing ever rejects — the
error path is unreachable for the failure mode most likely to occur.

The same gap exists on the Google CrUX call.

A repo-wide grep confirms no fetch anywhere sets a timeout: every
`AbortController` in the codebase is client-side event-listener cleanup.

## Current state

`src/lib/wordpress/api.ts:108-114`:

```ts
  return wordpressCache.getOrCompute(cacheKey, async () => {
    try {
      const response = await fetch(`${WP_URL}${endpoint}`, {
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
```

`src/pages/api/crux-data.ts:36-42`:

```ts
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ origin }),
    });
```

No timeout in either. Confirmed:

```
$ grep -rn "AbortSignal.timeout\|new AbortController" src/ | grep -v __tests__
src/components/ProductFilters.astro:565:    private abortController = new AbortController();
src/components/NewsFilters.astro:418:    private abortController = new AbortController();
src/components/Header.astro:136:    menuAbortController = new AbortController();
src/components/Nav.astro:475:    private abortController: AbortController = new AbortController();
src/components/admin/AdminNav.astro:412:    private abortController: AbortController = new AbortController();
src/scripts/mini-cart-client.ts:519:  itemsListAbortController = new AbortController();
src/scripts/mini-cart-client.ts:773:  miniCartAbortController = new AbortController();
src/lib/product/quickViewController.ts:65:      const abortController = new AbortController();
```

All client-side listener cleanup — none is a fetch timeout.

The existing error handling that a timeout would finally engage is
`processWordPressError` at `src/lib/wordpress/api.ts:98-99` — read it before
starting so your `AbortError` lands in the right branch.

Note `src/lib/square/apiRetry.ts` already implements a `timeoutMs` for Square
calls (default 10 000). WordPress and CrUX simply never got the same treatment.

## Commands you will need

| Purpose   | Command                              | Expected             |
|-----------|--------------------------------------|----------------------|
| Typecheck | `pnpm check`                         | exit 0               |
| Tests     | `pnpm test:run -- wordpress`         | all pass             |
| Full      | `pnpm test:run`                      | exit 0               |
| Coverage  | `pnpm test:coverage`                 | exit 0, no regression|
| Lint      | `pnpm lint`                          | exit 0               |
| Dev server| `pnpm dev`                           | serves on :4321      |

Never use `pnpm test` — watch mode, it hangs.

## Scope

**In scope**:
- `src/lib/wordpress/api.ts`
- `src/pages/api/crux-data.ts`
- `src/lib/wordpress/__tests__/` — the api test file

**Out of scope** (do NOT touch):
- `wordpressCache`'s 300 s TTL, and stale-while-revalidate behavior. Serving
  stale content instead of blocking is a real improvement but belongs with the
  stampede work (plan 176).
- Square's fetch paths — already covered by `apiRetry.ts`'s `timeoutMs`.
- `processWordPressError`'s logic. You are making it reachable, not changing it.
- Adding retries. A timeout without retries is a strict improvement; retries need
  a budget decision (plan 176).

## Git workflow

- Branch: `advisor/174-add-outbound-fetch-timeouts`
- Conventional commits, e.g. `fix: bound outbound WordPress and CrUX fetches with a timeout`
- Do NOT push or open a PR unless the operator instructs it.

## Steps

### Step 1: Choose the timeout, bounded by the platform limit

The timeout must be comfortably **under** Netlify's function timeout, so the
error path runs and the page renders degraded instead of 502-ing.

Find the platform limit (Netlify's default synchronous function timeout is 10 s
on most plans — confirm for this account) and pick something well below it.
**8 s is a reasonable starting point** for WordPress; CrUX is non-critical and
can be shorter, say 5 s.

Define them as named constants with a comment explaining the relationship to the
function timeout — a future reader must understand why the number is not
arbitrary.

**Verify**: record the platform limit and your chosen values in the status row.

### Step 2: Add the timeout to the WordPress fetch

Pass `signal: AbortSignal.timeout(WP_FETCH_TIMEOUT_MS)`.

Then confirm the abort actually reaches `processWordPressError` as an
`API_UNAVAILABLE`-style condition rather than an unhandled shape — `AbortSignal.timeout`
rejects with a `TimeoutError` `DOMException`, which may not match the handler's
existing checks. Adjust the handler's *matching* if needed, without changing what
it does on match.

**Verify**: `grep -n "AbortSignal.timeout" src/lib/wordpress/api.ts` → present.
`pnpm check` → exit 0.

### Step 3: Add the timeout to the CrUX fetch

Same treatment. CrUX already has a `try/catch` around the fetch (`:42`); confirm
the abort lands there.

**Verify**: `grep -n "AbortSignal.timeout" src/pages/api/crux-data.ts` → present.

### Step 4: Prove the degraded path actually works

A timeout is only useful if the page still renders. Simulate a slow WordPress:
point `WP_URL` at a deliberately slow endpoint, or mock `fetch` to hang.

**Verify**: loading `/news` returns a rendered page with the existing
error/empty state within roughly your timeout — **not** a 502, and not a hang.
Record what you observed. This is the plan's primary evidence.

### Step 5: Full gate

```bash
pnpm check && pnpm lint && pnpm test:run && pnpm test:coverage
```
→ all exit 0.

## Test plan

Add to the WordPress api test file (model on the existing tests there):

- a fetch that rejects with a `TimeoutError` is handled by
  `processWordPressError` and produces the existing degraded result — **not** an
  unhandled throw
- a normal successful fetch is unaffected (regression)
- a non-timeout network error still takes its existing path

Use `vi.useFakeTimers()` or a mocked `fetch` that rejects; do not write a test
that actually waits 8 seconds.

`pnpm test:coverage` → exit 0, no threshold regression.

## Done criteria

- [ ] Step 1's platform limit and chosen timeout values recorded in `plans/README.md`
- [ ] `grep -rn "AbortSignal.timeout" src/lib/wordpress/api.ts src/pages/api/crux-data.ts` → both present
- [ ] Timeout values are named constants with a comment tying them to the function timeout
- [ ] A test proves a timeout reaches the existing error handler, not an unhandled throw
- [ ] Step 4's simulated-slow-WordPress check performed; `/news` renders degraded, no 502
- [ ] `wordpressCache` TTL unchanged (`git status`)
- [ ] `pnpm check` / `pnpm lint` / `pnpm test:run` all exit 0

## STOP conditions

Stop and report if:

- **The timeout makes the page render *worse*** — e.g. an empty news page where
  previously a slow-but-successful load eventually worked. That means the timeout
  is too tight; report with the observed WordPress response times rather than
  guessing at a larger number.
- The abort rejection does not reach `processWordPressError` and making it do so
  requires restructuring that handler.
- Netlify's function timeout for this account turns out to be shorter than
  expected, making a useful WordPress timeout impractically tight.
- Any verification fails twice after a reasonable fix attempt.

## Maintenance notes

- **The rule**: every outbound `fetch` on a request-serving path needs a bound.
  Square's calls already have one via `apiRetry.ts`; WordPress and CrUX now do.
  A new third-party integration must get one too.
- A timeout converts a hang into a **cache miss with a degraded render**. That is
  strictly better, but it means WordPress slowness now shows as missing content
  rather than a spinner — worth knowing when triaging.
- The deeper fix is serving stale content while revalidating, so a slow origin is
  invisible. That is plan 176's cluster; this plan is the cheap floor under it.
- A reviewer should check the timeout is comfortably under the function timeout,
  and that the constant's comment explains why.
