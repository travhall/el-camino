# Plan 044: Add authentication to the /api/warmup endpoint

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 9b5556b..HEAD -- src/pages/api/warmup.ts .env.example`
> If any changes appear, compare the "Current state" excerpts before proceeding.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `9b5556b`, 2026-07-22

## Why this matters

`/api/warmup` is pinged every 5 minutes by a GitHub Actions job to pre-populate
caches. It has no authentication. Each unauthenticated request triggers a full
Square catalog fetch (`fetchProducts`) plus a batch inventory call for every
variation — expensive Square API quota. A script hitting the endpoint in a loop
could exhaust the Square rate-limit budget for catalog and inventory APIs,
degrading product listing and checkout for real customers.

Additionally, when Square or inventory calls fail, the error bodies (Square API
responses, function names) are returned in the JSON response under `errors`.
These disclose internal infrastructure details to unauthenticated callers.

The fix: verify a `X-Warmup-Secret` header against a `WARMUP_SECRET` env var
(shared secret approach — simple, no admin session needed, callable from CI).
Strip `errors` from the response body; log errors server-side only.

## Current state

**`src/pages/api/warmup.ts`** — warmup handler:

```typescript
// line 18
export const GET: APIRoute = async () => {
  const startTime = performance.now();
  const warmedCaches: string[] = [];
  const errors: string[] = [];
  // ... Square API calls ...
  return new Response(
    JSON.stringify({
      status: errors.length > 0 ? 'partial' : 'warm',
      // ...
      errors: errors.length > 0 ? errors : undefined,  // leaks internal errors
    }),
  );
};
```

No auth check anywhere in the handler.

**`.env.example`** — add `WARMUP_SECRET` documentation here.

The GitHub Actions warmup job that calls this endpoint lives at `.github/workflows/`
— read that directory to find the relevant workflow file and add the secret header
to its curl/fetch call.

## Commands you will need

| Purpose   | Command              | Expected on success       |
|-----------|----------------------|---------------------------|
| Typecheck | `pnpm check`         | exit 0, no errors         |
| Unit tests | `pnpm test:run`     | all pass                  |

## Scope

**In scope**:
- `src/pages/api/warmup.ts`
- `.env.example`
- `.github/workflows/` — whichever file calls `/api/warmup` (read to find it)

**Out of scope**:
- The warmup caching logic itself — do not change what gets warmed
- `src/lib/square/` — no changes to cache or product fetchers

## Git workflow

- Branch: `advisor/044-warmup-endpoint-auth`
- Commit message: `fix: require shared secret on /api/warmup; strip error details from response`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Find the GitHub Actions workflow that calls /api/warmup

```bash
grep -rn "warmup\|api/warmup" .github/
```

Note the file path and how it calls the endpoint (curl, fetch action, etc.).
You will update it in Step 4.

### Step 2: Add auth check to the warmup handler

At the top of the `GET` handler in `src/pages/api/warmup.ts`, before any cache
warming logic, add:

```typescript
export const GET: APIRoute = async ({ request }) => {
  const secret = import.meta.env.WARMUP_SECRET;
  if (!secret || request.headers.get("x-warmup-secret") !== secret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  // ... existing warmup logic ...
```

Note: change `async ()` to `async ({ request })` to receive the request object.

**Verify**: `grep -n "x-warmup-secret\|WARMUP_SECRET" src/pages/api/warmup.ts` → both appear.

### Step 3: Strip error details from the response body

In the response JSON, replace:
```typescript
errors: errors.length > 0 ? errors : undefined,
```
with:
```typescript
// Do not expose internal error details to callers
```
(remove the `errors` field entirely from the response object; the server-side
`console.error('[Warmup]', errorMsg)` at ~line 83 already logs to Netlify logs).

**Verify**: `grep -n '"errors"' src/pages/api/warmup.ts` → no match in the response object.

### Step 4: Add the secret header to the GitHub Actions workflow

In the workflow file found in Step 1, add the `X-Warmup-Secret` header to the
warmup request. The exact syntax depends on how the workflow calls the endpoint:

If using `curl`:
```yaml
- name: Warm up caches
  run: curl -f -H "X-Warmup-Secret: ${{ secrets.WARMUP_SECRET }}" https://your-site.netlify.app/api/warmup
```

If using a different action, add the header equivalently.

Also add `WARMUP_SECRET` to the repository secrets documentation in the workflow
comment or README if one exists.

**Verify**: `grep -n "X-Warmup-Secret\|WARMUP_SECRET" .github/workflows/*.yml` → the secret header is present in the workflow call.

### Step 5: Document WARMUP_SECRET in .env.example

Add to `.env.example` in the appropriate section:
```
# Warmup endpoint shared secret — must match WARMUP_SECRET in GitHub Actions
# WARMUP_SECRET=generate-a-random-string-here
```

**Verify**: `grep "WARMUP_SECRET" .env.example` → appears.

### Step 6: Typecheck and test

```bash
pnpm check
```
Expected: exit 0, no errors.

```bash
pnpm test:run
```
Expected: all pass.

## Done criteria

- [ ] `pnpm check` exits 0
- [ ] `pnpm test:run` exits 0
- [ ] `grep -n "x-warmup-secret" src/pages/api/warmup.ts` → the auth check is present
- [ ] `grep -n '"errors"' src/pages/api/warmup.ts` → no match in the JSON response object
- [ ] `.github/workflows/*.yml` includes `X-Warmup-Secret` header in the warmup call
- [ ] `.env.example` documents `WARMUP_SECRET`
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

- No GitHub Actions workflow file found that calls `/api/warmup` — report what
  you found in `.github/` and stop.
- `pnpm check` errors after changing `async ()` to `async ({ request })` —
  check the Astro `APIRoute` type; the context parameter type is
  `APIContext` from `astro`.
- The workflow uses a mechanism to call the endpoint that doesn't support
  custom headers — report the mechanism found and stop.

## Maintenance notes

- `WARMUP_SECRET` must be added to the Netlify environment (for local testing
  of the auth check if needed) and to GitHub Actions repository secrets (for
  the CI call). Neither is done by this plan — coordinate with the operator
  who manages environment variables.
- If the warmup endpoint is ever called from multiple places (another cron,
  a monitoring service), all callers must send the `X-Warmup-Secret` header.
