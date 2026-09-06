# Plan 073: Customer-facing order status lookup

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 9b5556b..HEAD -- src/pages/order-confirmation.astro src/pages/api/`
> If any changes appear, compare before proceeding.

## Status

- **Priority**: P3 (product decision required)
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `9b5556b`, 2026-07-22

## Why this matters

`src/pages/order-confirmation.astro` shows order status after checkout, but
the data is only accessible while the session cookie is live. Once the cookie
expires, the customer has no way to check their order status.

For a local food/retail business, this creates support burden: customers email
or call to ask "did my order ship / is it ready for pickup?" A self-service
lookup page would reduce that friction. Square already stores the order status
(`OPEN`, `PREPARED`, `COMPLETED`) and any fulfillment notes.

**This is a product decision before it is a technical task.** The business
owner should decide: (1) whether to build it, (2) how customers prove they own
the order (email+order ID? link emailed at order time?).

## Proposed approach (to discuss, not implement blindly)

**Lookup by email + order ID** (simpler, no email flow change):

1. Add a `/order-status` page with a form: email address + order ID.
2. New route `src/pages/api/order-status.ts`:
   - Accepts `{ email, orderId }`.
   - Calls `squareClient.orders.retrieve(orderId)`.
   - Verifies the order's `buyerEmailAddress` matches the submitted email
     (prevents enumeration).
   - Returns sanitized status: `{ orderId, status, fulfillmentType, updatedAt }`.
3. Rate-limit the endpoint (same pattern as `calculate-cart.ts`).
4. Page renders status inline (no redirect, no cookie dependency).

**Lookup by emailed link** (better UX, more work):

Add a signed order-status URL to the confirmation email (plan 042 touches
`templates.ts`) using the existing HMAC infrastructure in `src/lib/admin/auth.ts`.
The link contains an HMAC-signed `orderId`; the status page verifies the
signature and shows the order without requiring a second form entry.

## Commands you will need

| Purpose          | Command                | Expected on success        |
|------------------|------------------------|----------------------------|
| Typecheck        | `pnpm check`           | exit 0, no errors          |
| Unit tests       | `pnpm test:run`        | all pass                   |

## Scope (when approved)

**In scope**:
- `src/pages/order-status.astro` (new)
- `src/pages/api/order-status.ts` (new)
- `src/lib/email/templates.ts` — add order-status link to confirmation email
  (if the emailed-link approach is chosen)

**Out of scope**:
- Square order modification — read-only
- Admin order management — separate flow

## Git workflow

- Branch: `advisor/073-customer-order-status`
- Commit message: `feat: add customer-facing order status lookup page`
- Do NOT push or open a PR unless instructed.

## STOP conditions

- The business owner has not confirmed this feature should be built — STOP; do
  not create any pages or routes.
- The Square Orders API is not enabled on the account — verify with
  `squareClient.orders.retrieve(testOrderId)` in a sandbox and report if it
  returns 403 or 404.
