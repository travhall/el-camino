# Plan 065: Move rate limiter check before body parse in calculate-cart

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 9b5556b..HEAD -- src/pages/api/calculate-cart.ts`
> If any changes appear, compare before proceeding.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: correctness
- **Planned at**: commit `9b5556b`, 2026-07-22

## Why this matters

In `src/pages/api/calculate-cart.ts`, the rate limiter check fires **after**
`await request.json()` has already parsed the request body:

```ts
const { items, fulfillmentMethod } = (await request.json()) as CalculateRequest;

if (calculateLimiter.check(clientIp(request))) {
  return new Response(..., { status: 429 });
}
```

An attacker sending oversized bodies (e.g. 50 MB JSON) can exhaust server
memory before the rate limiter ever rejects the request. The rate limiter's
entire purpose is to reject cheap requests early — parsing the body first
inverts that order.

The fix moves the `clientIp` extraction and limiter check before any `await`,
making the rejection path zero-allocation.

## Current state

`src/pages/api/calculate-cart.ts:18-27`:

```ts
export const POST: APIRoute = async ({ request }) => {
  try {
    const { items, fulfillmentMethod } = (await request.json()) as CalculateRequest;

    if (calculateLimiter.check(clientIp(request))) {
      return new Response(
        JSON.stringify({ success: false, error: "Too many requests" }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      );
    }
```

## Commands you will need

| Purpose        | Command              | Expected on success      |
|----------------|----------------------|--------------------------|
| Typecheck      | `pnpm check`         | exit 0, no errors        |
| Unit tests     | `pnpm test:run`      | all pass                 |

## Scope

**In scope**:
- `src/pages/api/calculate-cart.ts` — reorder the first ~10 lines of the
  `POST` handler only

**Out of scope**:
- `src/lib/rateLimit.ts` — no changes
- Any other API route (some already have the correct order)

## Git workflow

- Branch: `advisor/065-rate-limiter-before-body-parse`
- Commit message: `fix: check rate limit before parsing request body in calculate-cart`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Read the full POST handler opening

Read `src/pages/api/calculate-cart.ts` lines 1–40 to see the full context.
Note the exact variable names for `items` and `fulfillmentMethod`.

### Step 2: Reorder the check

Move the rate limiter check to before `request.json()`:

```ts
export const POST: APIRoute = async ({ request }) => {
  try {
    if (calculateLimiter.check(clientIp(request))) {
      return new Response(
        JSON.stringify({ success: false, error: "Too many requests" }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      );
    }

    const { items, fulfillmentMethod } = (await request.json()) as CalculateRequest;
    // … rest of handler unchanged
```

No logic changes — only the order of these two operations.

### Step 3: Typecheck and test

```bash
pnpm check
```

Expected: exit 0.

```bash
pnpm test:run
```

Expected: all pass.

## Done criteria

- [ ] `pnpm check` exits 0
- [ ] `pnpm test:run` exits 0
- [ ] Reading lines 18–30 of `calculate-cart.ts` shows the `if (calculateLimiter.check(...))` block **before** `await request.json()`
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

- `request.json()` is required before `clientIp` because `clientIp` reads a
  header that is only set after body parsing — this would be very unusual;
  confirm by reading `rateLimit.ts:clientIp` first. If that is the case, report.
