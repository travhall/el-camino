# Plan 039: Add unit tests for the email layer (templates.ts helpers + sender.ts)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 0da82aa..HEAD -- src/lib/email/`
> If Plan 035 has already been executed, `templates.ts` will have an `escHtml`
> function — include it in the tests for this plan.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none (can run independently; if Plan 035 has landed, also test `escHtml`)
- **Category**: tests
- **Planned at**: commit `0da82aa`, 2026-07-22

## Why this matters

`src/lib/email/templates.ts` (893 lines) and `src/lib/email/sender.ts` (208 lines)
have zero unit tests. The templates file contains pure helper functions
(`formatMoney`, `shortOrderId`, `formatPickupTime`) that are the sole source of
how order totals and order IDs appear in customer receipts. The `formatMoney`
function handles both `bigint` (Square's actual return type) and `number` —
the `bigint` branch is untested and is the live path in production.

A broken `formatMoney` could display `$0.00` for a paid order. A broken
`formatPickupTime` gives customers wrong pickup times. These are high-visibility
bugs with direct customer impact that a unit test would catch before deployment.

## Current state

**Files to test**:
- `src/lib/email/templates.ts` — private helpers `formatMoney`, `shortOrderId`,
  `formatPickupTime`; template builder functions `buildOrderConfirmationHtml`, etc.
- `src/lib/email/sender.ts` — async send functions wrapping Resend

**Coverage gap**: No test file exists in `src/lib/email/`.

**Pattern to follow**: `src/lib/square/money.test.ts` (recently added, clean
example of testing pure utility functions in this repo). Also look at
`src/pages/api/__tests__/admin-auth.test.ts` for how this repo mocks external
services.

**Vitest config**: `vitest.config.ts` in the repo root. Tests use `happy-dom`
for the DOM environment (where needed). Pure function tests need no DOM setup.

**`formatMoney` signature** (from `templates.ts`):
```typescript
function formatMoney(amount: bigint | number | undefined | null): string {
  if (amount == null) return "$0.00";
  const cents = typeof amount === "bigint" ? Number(amount) : amount;
  return `$${(cents / 100).toFixed(2)}`;
}
```

**`sender.ts` send pattern** (each function follows this shape):
```typescript
export async function sendOrderConfirmation({ order, contact }: EmailPayload): Promise<void> {
  const html = buildOrderConfirmationHtml({ order, contact, hoursLine });
  const { error } = await getResend().emails.send({ from, to, subject, html });
  if (error) throw new Error(`Resend failed: ${JSON.stringify(error)}`);
}
```

## Commands you will need

| Purpose     | Command                                              | Expected on success        |
|-------------|------------------------------------------------------|----------------------------|
| Typecheck   | `pnpm check`                                         | exit 0, no errors          |
| All tests   | `pnpm test:run`                                      | all pass                   |
| Filter tests | `pnpm test:run -- src/lib/email/templates.test.ts`  | new tests pass             |
| Coverage    | `pnpm test:coverage`                                 | thresholds pass            |

## Scope

**In scope** (create these files):
- `src/lib/email/templates.test.ts`
- `src/lib/email/sender.test.ts`

**Out of scope**:
- `src/lib/email/templates.ts` — do NOT modify the source file (unless Plan 035
  hasn't landed yet and `escHtml` needs to be exported for testability — see Step 1 note)
- `src/lib/email/sender.ts` — do NOT modify the source file
- `src/lib/email/pendingOrders.ts` — separate module, separate test if needed
- `src/lib/email/failedEmails.ts` — covered by Plan 038 if that has landed

## Git workflow

- Branch: `advisor/039-email-layer-tests`
- Commit message: `test: add unit tests for email templates helpers and sender`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Determine if helpers need to be exported

The helper functions in `templates.ts` (`formatMoney`, `shortOrderId`,
`formatPickupTime`, and `escHtml` if Plan 035 landed) are currently module-private
(no `export` keyword).

To test them directly, add `export` to each helper function declaration:

```typescript
// Before:
function formatMoney(...) { ... }

// After:
export function formatMoney(...) { ... }
```

Do the same for `shortOrderId`, `formatPickupTime`, and `escHtml` (if present).

**Alternative**: Test them indirectly by calling `buildOrderConfirmationHtml()` and
asserting the output contains the expected formatted string. This avoids changing
exports but makes test failures harder to diagnose. Prefer the direct export approach.

**Verify**: `pnpm check` → exit 0 after adding exports (the functions are only used
within the same file, so no external callers break)

### Step 2: Write `src/lib/email/templates.test.ts`

Create the file. Model the structure after `src/lib/square/money.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  formatMoney,
  shortOrderId,
  formatPickupTime,
  // escHtml,  // uncomment if Plan 035 has landed
} from "./templates";

describe("formatMoney", () => {
  it("returns $0.00 for null", () => {
    expect(formatMoney(null)).toBe("$0.00");
  });
  it("returns $0.00 for undefined", () => {
    expect(formatMoney(undefined)).toBe("$0.00");
  });
  it("formats a number (cents) correctly", () => {
    expect(formatMoney(1099)).toBe("$10.99");
  });
  it("formats a bigint (Square's actual return type)", () => {
    expect(formatMoney(2500n)).toBe("$25.00");
  });
  it("formats $0.00 for 0n (zero-value order)", () => {
    expect(formatMoney(0n)).toBe("$0.00");
  });
  it("formats large amounts correctly", () => {
    expect(formatMoney(100000)).toBe("$1000.00");
  });
});

describe("shortOrderId", () => {
  it("returns the last 8 characters uppercased", () => {
    expect(shortOrderId("abcdefgh12345678")).toBe("12345678");
  });
  it("uppercases the result", () => {
    expect(shortOrderId("XXXXXABC12345678")).toBe("12345678");
  });
  it("handles IDs shorter than 8 chars without crashing", () => {
    const result = shortOrderId("abc");
    expect(typeof result).toBe("string");
  });
});

describe("formatPickupTime", () => {
  it("formats an ISO timestamp in Central Time", () => {
    // 2026-07-22T15:00:00Z = 10:00 AM CDT (UTC-5 in summer)
    const result = formatPickupTime("2026-07-22T15:00:00.000Z");
    expect(result).toContain("10:00 AM");
    expect(result).toContain("Jul");
    expect(result).toContain("22");
  });
  it("returns a non-empty string for any valid ISO date", () => {
    const result = formatPickupTime("2026-01-01T12:00:00.000Z");
    expect(result.length).toBeGreaterThan(5);
  });
});

// If Plan 035 has landed, add:
// describe("escHtml", () => {
//   it("escapes < > & \" '", () => {
//     expect(escHtml('<a href="x">foo&bar</a>')).toBe('&lt;a href=&quot;x&quot;&gt;foo&amp;bar&lt;/a&gt;');
//   });
//   it("returns empty string for null", () => { expect(escHtml(null)).toBe(""); });
//   it("returns empty string for undefined", () => { expect(escHtml(undefined)).toBe(""); });
// });
```

**Verify**: `pnpm test:run -- src/lib/email/templates.test.ts` → all tests pass

### Step 3: Write `src/lib/email/sender.test.ts`

The `Resend` class is instantiated inside `getResend()` (lazy, one new instance
per call). Mock it at the module level using `vi.mock`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock resend before importing sender
vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: vi.fn().mockResolvedValue({ data: { id: "test-id" }, error: null }),
    },
  })),
}));

// Mock shopHours (called inside sendOrderConfirmation for pickup)
vi.mock("@/lib/shopHours", () => ({
  formatHoursForEmail: vi.fn().mockResolvedValue("Mon–Sat 10am–6pm"),
}));

import { sendOrderConfirmation } from "./sender";

const mockOrder = {
  id: "ORDER123456789012",
  totalMoney: { amount: 1999n, currency: "USD" },
  lineItems: [],
} as any;

const mockContact = {
  name: "Test User",
  email: "test@example.com",
  fulfillmentMethod: "pickup",
  phone: "",
  notes: "",
} as any;

describe("sendOrderConfirmation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.EMAIL_FROM = "noreply@elcaminoskateshop.com";
    process.env.RESEND_API_KEY = "test-key";
  });

  it("calls Resend emails.send with the correct recipient", async () => {
    const { Resend } = await import("resend");
    const mockSend = vi.fn().mockResolvedValue({ data: { id: "x" }, error: null });
    (Resend as any).mockImplementation(() => ({ emails: { send: mockSend } }));

    await sendOrderConfirmation({ order: mockOrder, contact: mockContact });

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ to: "test@example.com" })
    );
  });

  it("throws when Resend returns an error", async () => {
    const { Resend } = await import("resend");
    (Resend as any).mockImplementation(() => ({
      emails: {
        send: vi.fn().mockResolvedValue({ data: null, error: { message: "API error" } }),
      },
    }));

    await expect(
      sendOrderConfirmation({ order: mockOrder, contact: mockContact })
    ).rejects.toThrow("Resend failed");
  });
});
```

**Note**: If the `vi.mock` + re-import pattern doesn't work cleanly with this
codebase's module resolution (common with complex mocking of `process.env`-based
lazy instantiation), look at how `admin-auth.test.ts` handles similar external
service mocks and follow that pattern instead.

**Verify**: `pnpm test:run -- src/lib/email/sender.test.ts` → all tests pass

### Step 4: Full test run and coverage

**Verify**: `pnpm test:run` → all tests pass (no regressions)

**Verify**: `pnpm test:coverage` → coverage thresholds all pass

## Done criteria

- [ ] `pnpm check` exits 0
- [ ] `pnpm test:run` exits 0, including new tests in `templates.test.ts` and `sender.test.ts`
- [ ] `pnpm test:coverage` exits 0 (thresholds not broken)
- [ ] `formatMoney` with a `bigint` argument is explicitly covered
- [ ] `sendOrderConfirmation` throw-on-error path is covered
- [ ] No source files modified (only test files created, plus exports added to `templates.ts`)
- [ ] `plans/README.md` status row for 039 updated to DONE

## STOP conditions

- `vi.mock("resend", ...)` causes import-cycle errors or doesn't intercept `getResend()` — look at how other tests in `src/pages/api/__tests__/` mock external modules and adopt that exact pattern.
- Adding `export` to helper functions causes `pnpm check` to fail with "unused export" — in that case, keep the helpers private and test them indirectly via `buildOrderConfirmationHtml()`.
- `formatPickupTime` test fails due to timezone differences in the CI environment — use a fixed UTC offset or add `vi.setSystemTime()` to pin the system clock.

## Maintenance notes

- The `formatMoney(bigint)` path (`Number(bigint)`) is safe for amounts up to
  2^53 cents (~$90 trillion). This is not a concern for a skateshop but would be
  for a financial platform — documented here so future readers don't worry about it.
- If new template builder functions are added to `templates.ts`, add corresponding
  tests to `templates.test.ts` for any new pure helper functions they introduce.
- `sender.ts` tests are intentionally thin (just the send + error paths). Full
  integration tests of the email content belong in a future e2e suite with a real
  Resend test mode, not in unit tests.
