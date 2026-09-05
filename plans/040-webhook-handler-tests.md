# Plan 040: Add unit tests for the Square webhook handler

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 0da82aa..HEAD -- src/pages/api/webhooks/square.ts src/lib/email/`
> If Plan 038 has already landed, the webhook handler will have changed — read
> the live file before writing tests and adjust accordingly.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none (Plan 038 may change the handler; tests should be written against the live file, not this plan's excerpt)
- **Category**: tests
- **Planned at**: commit `0da82aa`, 2026-07-22

## Why this matters

`src/pages/api/webhooks/square.ts` (238 lines) is the single integration point
that fires after every completed payment. It: verifies the Square signature,
reads a pending-order blob, fetches the Square order, sends 2–3 transactional
emails, and deletes the blob as an idempotency guard. None of this is tested.

A regression in the webhook handler — wrong blob key, wrong email function
called, wrong idempotency logic — breaks post-purchase confirmation for every
order without any automated signal. The handler is also the most complex async
path in the codebase (multiple await chains, multiple error branches).

## Current state

**File to test**: `src/pages/api/webhooks/square.ts`

**Key functions used by the handler** (all need mocking):
- `verifySquareWebhookSignature(body, signature, url, secret)` — from `@/lib/square/client` or local
- `getPendingOrder(orderId)` — from `@/lib/email/pendingOrders`
- `deletePendingOrder(orderId)` — from `@/lib/email/pendingOrders`
- `sendOrderConfirmation({ order, contact })` — from `@/lib/email/sender`
- `sendPickupNotification({ order, contact })` — from `@/lib/email/sender`
- `sendShippingOrderNotification({ order, contact })` — from `@/lib/email/sender`
- `squareClient.orders.get({ orderId })` — Square SDK call (read `src/lib/square/client.ts`)

**Current handler shape** (confirm against live file before writing tests — if Plan 038
has landed, the email-error handling will differ):

```typescript
export const POST: APIRoute = async ({ request }) => {
  try {
    // 1. Verify signature
    // 2. Parse event body — get eventType, orderId, payment
    // 3. Switch on eventType:
    //    case "payment.updated": if status === "COMPLETED":
    //      a. getPendingOrder(orderId) — if null, skip (idempotency)
    //      b. squareClient.orders.get(orderId) — or fall back to payment data
    //      c. sendOrderConfirmation + sendPickupNotification or sendShippingOrderNotification
    //      d. deletePendingOrder(orderId)
  } catch (err) {
    console.error(...);
  }
  return new Response(JSON.stringify({ received: true }), { status: 200 });
};
```

**Existing test pattern**: `src/pages/api/__tests__/admin-auth.test.ts` — read this
file first for how API route handlers are tested in this repo (Request construction,
Response assertion, vi.mock patterns).

## Commands you will need

| Purpose       | Command                                                       | Expected on success |
|---------------|---------------------------------------------------------------|---------------------|
| Typecheck     | `pnpm check`                                                  | exit 0              |
| All tests     | `pnpm test:run`                                               | all pass            |
| Filter tests  | `pnpm test:run -- src/pages/api/__tests__/webhook-square.test.ts` | new tests pass |
| Coverage      | `pnpm test:coverage`                                          | thresholds pass     |

## Scope

**In scope**:
- `src/pages/api/__tests__/webhook-square.test.ts` (create new)

**Out of scope**:
- `src/pages/api/webhooks/square.ts` — do NOT modify the handler (except to add an
  export if needed for testability — unlikely)
- Any email template or sender file — mock these entirely

## Git workflow

- Branch: `advisor/040-webhook-handler-tests`
- Commit message: `test: add unit tests for Square webhook handler`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Read the live webhook handler and the existing test pattern

Before writing any test code:

1. Read `src/pages/api/webhooks/square.ts` in full — confirm the handler shape
   and all imported module paths.
2. Read `src/pages/api/__tests__/admin-auth.test.ts` — understand how `Request`
   objects are constructed and how `Response` is asserted in this repo's tests.

Identify the exact import paths for:
- `verifySquareWebhookSignature` (grep for it in the webhook file)
- `getPendingOrder` / `deletePendingOrder`
- `sendOrderConfirmation` / `sendPickupNotification` / `sendShippingOrderNotification`
- `squareClient`

### Step 2: Create the test file with mocks

Create `src/pages/api/__tests__/webhook-square.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock all external dependencies before importing the handler
vi.mock("@/lib/square/client", () => ({
  squareClient: {
    orders: {
      get: vi.fn(),
    },
  },
  // Add verifySquareWebhookSignature if it's exported from here
  verifySquareWebhookSignature: vi.fn().mockReturnValue(true),
}));

vi.mock("@/lib/email/pendingOrders", () => ({
  getPendingOrder: vi.fn(),
  deletePendingOrder: vi.fn(),
}));

vi.mock("@/lib/email/sender", () => ({
  sendOrderConfirmation: vi.fn().mockResolvedValue(undefined),
  sendPickupNotification: vi.fn().mockResolvedValue(undefined),
  sendShippingOrderNotification: vi.fn().mockResolvedValue(undefined),
}));

// Import the handler AFTER mocks are set up
import { POST } from "../webhooks/square";
import { squareClient } from "@/lib/square/client";
import { getPendingOrder, deletePendingOrder } from "@/lib/email/pendingOrders";
import {
  sendOrderConfirmation,
  sendPickupNotification,
} from "@/lib/email/sender";

// Helper: build a valid-looking webhook Request
function makeWebhookRequest(body: object, options: { validSignature?: boolean } = {}): Request {
  const bodyStr = JSON.stringify(body);
  return new Request("https://example.com/api/webhooks/square", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-square-hmacsha256-signature": options.validSignature === false ? "bad" : "valid",
    },
    body: bodyStr,
  });
}

const mockContact = {
  name: "Test User",
  email: "customer@example.com",
  fulfillmentMethod: "pickup",
  phone: "",
  notes: "",
};

const mockOrder = {
  id: "ORDER123456789012",
  totalMoney: { amount: 1999n, currency: "USD" },
  lineItems: [],
};

const paymentUpdatedBody = {
  type: "payment.updated",
  data: {
    object: {
      payment: {
        id: "PAY_001",
        order_id: "ORDER123456789012",
        status: "COMPLETED",
        total_money: { amount: 1999, currency: "USD" },
      },
    },
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SQUARE_WEBHOOK_SIGNATURE_KEY = "test-secret";
});

describe("POST /api/webhooks/square", () => {
  describe("signature verification", () => {
    it("returns 200 even when signature is invalid (prevents Square retry flooding)", async () => {
      // The handler always returns 200; invalid sigs are logged and early-returned
      // Adjust this test based on the actual handler behavior for bad signatures
      const req = makeWebhookRequest(paymentUpdatedBody, { validSignature: false });
      const res = await POST({ request: req } as any);
      expect(res.status).toBe(200);
    });
  });

  describe("payment.updated / COMPLETED — happy path (pickup)", () => {
    beforeEach(() => {
      vi.mocked(getPendingOrder).mockResolvedValue(mockContact as any);
      vi.mocked(squareClient.orders.get).mockResolvedValue({
        order: mockOrder,
      } as any);
    });

    it("returns 200", async () => {
      const req = makeWebhookRequest(paymentUpdatedBody);
      const res = await POST({ request: req } as any);
      expect(res.status).toBe(200);
    });

    it("calls sendOrderConfirmation with order and contact", async () => {
      const req = makeWebhookRequest(paymentUpdatedBody);
      await POST({ request: req } as any);
      expect(sendOrderConfirmation).toHaveBeenCalledWith(
        expect.objectContaining({ contact: mockContact })
      );
    });

    it("calls sendPickupNotification for pickup fulfillment", async () => {
      const req = makeWebhookRequest(paymentUpdatedBody);
      await POST({ request: req } as any);
      expect(sendPickupNotification).toHaveBeenCalled();
    });

    it("deletes the pending order blob after sending (idempotency guard)", async () => {
      const req = makeWebhookRequest(paymentUpdatedBody);
      await POST({ request: req } as any);
      expect(deletePendingOrder).toHaveBeenCalledWith("ORDER123456789012");
    });
  });

  describe("payment.updated / COMPLETED — no pending order (idempotency)", () => {
    it("skips email sending and returns 200 when no pending order found", async () => {
      vi.mocked(getPendingOrder).mockResolvedValue(null);
      const req = makeWebhookRequest(paymentUpdatedBody);
      const res = await POST({ request: req } as any);
      expect(res.status).toBe(200);
      expect(sendOrderConfirmation).not.toHaveBeenCalled();
    });
  });

  describe("payment.updated / COMPLETED — Square orders.get fails (fallback path)", () => {
    it("uses payment data as fallback order when orders.get throws", async () => {
      vi.mocked(getPendingOrder).mockResolvedValue(mockContact as any);
      vi.mocked(squareClient.orders.get).mockRejectedValue(new Error("Square API error"));

      const req = makeWebhookRequest(paymentUpdatedBody);
      const res = await POST({ request: req } as any);

      expect(res.status).toBe(200);
      // sendOrderConfirmation should still be called (with the fallback order)
      expect(sendOrderConfirmation).toHaveBeenCalled();
    });
  });

  describe("unhandled event types", () => {
    it("returns 200 for an unknown event type without throwing", async () => {
      const req = makeWebhookRequest({ type: "unknown.event", data: {} });
      const res = await POST({ request: req } as any);
      expect(res.status).toBe(200);
      expect(sendOrderConfirmation).not.toHaveBeenCalled();
    });
  });
});
```

**Note**: The mock for `verifySquareWebhookSignature` depends on exactly where
it's defined and how it's called. Read the live `webhooks/square.ts` to find
the exact import path and adapt the `vi.mock` call accordingly. If the function
is imported from a different module than `@/lib/square/client`, update the mock.

**Verify**: `pnpm test:run -- src/pages/api/__tests__/webhook-square.test.ts` → all tests pass

### Step 3: Full test run

**Verify**: `pnpm test:run` → all tests pass (no regressions)

**Verify**: `pnpm test:coverage` → coverage thresholds all pass

## Done criteria

- [ ] `pnpm check` exits 0
- [ ] `pnpm test:run` exits 0
- [ ] `src/pages/api/__tests__/webhook-square.test.ts` exists
- [ ] At minimum: happy-path pickup test, idempotency (no pending order), orders.get fallback, unhandled event type — all pass
- [ ] `deletePendingOrder` is asserted to be called in the happy path
- [ ] `sendOrderConfirmation` is asserted to NOT be called when there's no pending order
- [ ] `pnpm test:coverage` passes
- [ ] `plans/README.md` status row for 040 updated to DONE

## STOP conditions

- The `POST` handler is a named export from `src/pages/api/webhooks/square.ts`
  but the file structure doesn't allow direct import without side effects —
  check if there's a default export or a different handler shape, and adapt.
- `vi.mock("@/lib/square/client", ...)` fails because `squareClient` is a
  singleton created at module load time with a closure — look at how other tests
  mock `squareClient` in this repo and follow that exact pattern.
- If Plan 038 has landed, the webhook's email-error handling will differ from
  the excerpt in this plan — read the live file and adjust the error-path tests
  accordingly (e.g., there may be a `storeFailedEmail` call to assert).

## Maintenance notes

- These tests mock all external I/O (Square API, Netlify Blobs, Resend). They
  verify the handler's orchestration logic — that it calls the right functions in
  the right order under the right conditions — not the correctness of those
  functions themselves (those are tested in Plans 039 and elsewhere).
- If new event types are added to the webhook handler, add a corresponding test
  case asserting the expected behavior.
- The `SQUARE_WEBHOOK_SIGNATURE_KEY` environment variable must be set in the test
  environment for signature verification to work. If the mock for
  `verifySquareWebhookSignature` is set to `mockReturnValue(true)`, the env var
  value doesn't matter for tests — but a missing env var at startup might still
  throw if the file reads it at module load time (vs. inside the handler).
