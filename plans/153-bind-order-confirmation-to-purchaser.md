# Plan 153: Stop serving any customer's order details to anyone holding an order ID

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
> When done, update this plan's status row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat ad2999d..HEAD -- src/pages/order-confirmation.astro src/pages/api/create-checkout.ts`
> If either file changed, compare the "Current state" excerpts against the live
> code first; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `ad2999d`, 2026-09-05

## Why this matters

`/order-confirmation?orderId=<id>` fetches and renders an order with **no check
that the visitor is the person who placed it**. The page displays the
recipient's full name, street address, and email address. Anyone holding an
order ID can read that customer's PII — a straightforward IDOR.

Order IDs are not guessable, but they leak readily: they are returned in the
`create-checkout` JSON response, written to `sessionStorage`, logged to the
browser console, and appear in admin URLs and support threads.

A secure binding **already exists and is already set** — the HttpOnly
`square-pending-orderId` cookie — but it is consulted only as a *fallback* when
the URL parameter is absent, so it never constrains anything.

Separately, the page renders raw exception text to unauthenticated visitors,
leaking Square SDK/API internals.

## Current state

`src/pages/order-confirmation.astro:21-22` — the URL parameter is taken at face
value:

```astro
let orderId = Astro.url.searchParams.get("orderId");
const transactionId = Astro.url.searchParams.get("transactionId");
```

`src/pages/order-confirmation.astro:29-41` — the cookie is only read when the
parameter is missing, so a supplied `?orderId=` bypasses it entirely:

```astro
if (!orderId) {
  const cookieHeader = Astro.request.headers.get("cookie") ?? "";
  const match = cookieHeader.match(/(?:^|;\s*)square-pending-orderId=([^;]+)/);
  if (match?.[1]) {
    orderId = match[1];
    // Clear the cookie now that we've consumed it so a later visit to this page
    // (e.g. a browser back-navigation) doesn't pull up a stale order.
    Astro.response.headers.set(
      "Set-Cookie",
      "square-pending-orderId=; Path=/; Max-Age=0; SameSite=Lax; HttpOnly",
    );
  }
}
```

`src/pages/order-confirmation.astro:64` — the unguarded fetch:

```astro
    const orderResult = await squareClient.orders.get({ orderId: orderId! });
```

`src/pages/order-confirmation.astro:174` and `:301` — raw error text rendered:

```astro
    error = e instanceof Error ? e.message : "Failed to load order";
...
          <p class="text-(--content-body) mb-8">{error}</p>
```

The cookie is set in `src/pages/api/create-checkout.ts:301`:

```ts
      ? `square-pending-orderId=${encodeURIComponent(orderId)}; Path=/; Max-Age=3600; SameSite=Lax; HttpOnly${import.meta.env.PROD ? '; Secure' : ''}`
```

Note its properties, all of which matter here: **HttpOnly**, **SameSite=Lax**
(so it survives Square's cross-site redirect back), **Max-Age=3600** (one hour),
and **Secure** in production.

### The hard constraint you must respect

This page is the **post-payment landing target from Square's redirect**. If you
break it, customers pay and then see an error. It already carries four
orderId-resolution paths precisely because Square's behavior varies: the URL
param, the cookie, a `transactionId` → Payments API lookup
(`order-confirmation.astro:44+`), and a client-side `sessionStorage` read
(`:284`). Read all four before changing anything.

## Commands you will need

| Purpose   | Command              | Expected            |
|-----------|----------------------|---------------------|
| Typecheck | `pnpm check`         | exit 0, 0 errors    |
| Tests     | `pnpm test:run`      | exit 0              |
| Coverage  | `pnpm test:coverage` | exit 0, no regression|
| Lint      | `pnpm lint`          | exit 0              |
| Build     | `pnpm build`         | exit 0              |
| Dev server| `pnpm dev`           | serves on :4321     |

Never use `pnpm test` — watch mode, it hangs.

## Scope

**In scope**:
- `src/pages/order-confirmation.astro`
- a new test file for the binding logic if you extract it (see Test plan)

**Out of scope** (do NOT touch):
- `src/pages/api/create-checkout.ts` — the cookie it sets is already correct
  (HttpOnly, SameSite=Lax, Secure in prod, 1h). Do not change its attributes;
  `SameSite=Strict` in particular would break the return from Square.
- The admin order views under `src/pages/admin/` — those are separately
  authenticated and legitimately show any order.
- The `transactionId` → Payments API resolution path's *existence*. It must keep
  working; it just has to end up subject to the same binding check.

## Git workflow

- Branch: `advisor/153-bind-order-confirmation-to-purchaser`
- Conventional commits, e.g.
  `fix(security): bind order-confirmation rendering to the purchaser's cookie`
- Do NOT push or open a PR unless the operator instructs it.

## Steps

### Step 1: Read the cookie unconditionally, before resolving `orderId`

Move the cookie read *above* the URL-parameter handling so you always know the
purchaser's own order id, whether or not a parameter was supplied. Do **not**
clear the cookie yet — clearing moves to Step 3.

**Verify**: `pnpm check` → exit 0.

### Step 2: Require the resolved order to match the cookie

After `orderId` is resolved by any of the paths (URL param, cookie,
`transactionId` lookup), require it to equal the cookie's value before calling
`squareClient.orders.get`.

On mismatch or missing cookie: do **not** fetch the order. Render a generic
"we can't show this order — check your email for confirmation" view. Do not
reveal whether the order id exists.

Compare with a constant-time comparison if one is readily available in the repo
(`src/lib/admin/auth.ts` uses `timingSafeEqual` — reuse that shape); a plain
`===` is acceptable here since the id is not a secret the attacker is guessing
character by character, but prefer the existing helper if it is easy.

**Verify**: `grep -n "orders.get" src/pages/order-confirmation.astro` → the call
is inside a branch that has already checked the cookie.

### Step 3: Keep the cookie usable for the whole confirmation view

The current code clears the cookie the moment it is consumed. With the cookie
now load-bearing for authorization, clearing it on first render means a page
refresh — or the client-side `sessionStorage` path at `:284` — fails.

Keep the cookie until it expires naturally (`Max-Age=3600`), or clear it only
after the order has rendered successfully AND you have confirmed a refresh still
works. Verify the refresh behavior manually in Step 5; do not assume.

**Verify**: covered by Step 5's browser check.

### Step 4: Stop rendering raw exception text

Replace the `{error}` render at `:301` with a fixed user-facing string. Log the
real exception server-side (`console.error`, matching the file's existing
logging style) so debugging is unaffected.

**Verify**: `grep -n "{error}" src/pages/order-confirmation.astro` → no match,
or the bound value is a fixed string from a known set, never `e.message`.

### Step 5: Verify the real flows in a browser

Start `pnpm dev`. Then:

1. **Legitimate flow**: complete a sandbox checkout and follow Square's redirect
   back. The order renders. **Refresh the page** — it must still render.
2. **The attack**: in a private window (no cookie), visit
   `/order-confirmation?orderId=<the same id>`. It must show the generic view
   and must NOT display the name, address, or email.
3. **`transactionId` path**: visit with `?transactionId=<id>` and no cookie →
   generic view, no PII.
4. **No parameters at all** → generic view, no crash.

**Verify**: all four behave as described. Record what you observed in the status
row — this is the plan's primary evidence.

### Step 6: Full gate

```bash
pnpm check && pnpm lint && pnpm test:run && pnpm build
```
→ all exit 0.

## Test plan

- Extract the binding decision into a small pure helper (e.g.
  `resolveViewableOrderId({ paramId, cookieId, transactionId })` returning the
  id or `null`) in `src/lib/checkout/` so it is unit-testable — `.astro`
  frontmatter is outside `vitest.config.ts`'s coverage include.
- Cases: param matches cookie → id returned; param differs from cookie → null;
  no cookie → null; cookie only → id returned; empty/malformed cookie → null.
- Model structurally on `src/lib/__tests__/shopHours.test.ts` (pure function,
  table-driven).
- `pnpm test:coverage` → exit 0, no threshold regression.

## Done criteria

- [ ] Private-window request with a valid `?orderId=` shows **no** name, address, or email
- [ ] Legitimate post-checkout flow renders the order, and **survives a refresh**
- [ ] `transactionId` path without a cookie shows the generic view
- [ ] `grep -n "{error}" src/pages/order-confirmation.astro` → no raw error render
- [ ] `src/pages/api/create-checkout.ts` unmodified (`git status`)
- [ ] Binding helper has unit tests covering the five cases above
- [ ] `pnpm check` / `pnpm lint` / `pnpm test:run` / `pnpm build` all exit 0
- [ ] `pnpm test:coverage` exits 0, no threshold regression

## STOP conditions

Stop and report if:

- **The legitimate Square redirect stops working** in sandbox — particularly if
  the cookie does not survive the cross-site redirect. That would mean
  `SameSite=Lax` is insufficient in some flow, and the fix is an operator
  decision (a signed token in the redirect URL, for instance), not something to
  improvise. **Do not "fix" it by weakening the binding.**
- You cannot complete a sandbox checkout to test the legitimate flow. Shipping
  this unverified risks breaking the post-payment page for real customers —
  report instead.
- Customers who open the confirmation link on a *different device* than they
  purchased on turn out to be an expected flow. Cookie binding cannot support
  that, and the operator needs to weigh it.
- Any verification fails twice after a reasonable fix attempt.

## Maintenance notes

- **The invariant**: no order PII renders without a server-side check tying the
  request to the purchaser. Any future resolution path added to this page (a
  fifth fallback, an email link, a QR code) must pass through the same gate.
- A reviewer should scrutinize: the cookie's attributes are unchanged, and the
  `transactionId` path is gated too — it is the easiest one to forget.
- **Deliberately deferred**: a signed, expiring order-view token that would work
  cross-device. That is the better long-term design but needs product input on
  whether cross-device confirmation is a real use case.
