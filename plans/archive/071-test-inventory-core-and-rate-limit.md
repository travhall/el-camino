# Plan 071: Add unit tests for inventoryCore fallback and rateLimit

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 9b5556b..HEAD -- src/lib/square/inventoryCore.ts src/lib/rateLimit.ts`
> If any changes appear, compare before proceeding.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: test-coverage
- **Planned at**: commit `9b5556b`, 2026-07-22

## Why this matters

### `inventoryCore.ts` fallback path
When individual item inventory checks fail, `inventoryCore.ts` falls back to a
default "in stock" response. This fallback path is untested — if it were broken
by a refactor, all inventory errors would surface as crashes rather than safe
defaults, blocking add-to-cart for all products.

### `rateLimit.ts`
`createRateLimiter` and `clientIp` are untested. The rate limiter is the first
line of defense against DoS on the cart calculation and checkout endpoints. A
regression here (e.g. the limiter never fires, or fires on every request) would
either allow unlimited requests or break checkout for all users.

## Existing test pattern

See `src/lib/square/__tests__/inventory.test.ts` (written in plan 039) for the
inventoryCore-adjacent pattern. Rate limiter tests can be pure unit tests with
no mocks (the limiter is in-memory).

## Commands you will need

| Purpose          | Command                | Expected on success        |
|------------------|------------------------|----------------------------|
| Run tests        | `pnpm test:run`        | all pass                   |
| Coverage         | `pnpm test:coverage`   | thresholds pass            |
| Typecheck        | `pnpm check`           | exit 0                     |

## Scope

**In scope**:
- `src/lib/square/__tests__/inventoryCore.test.ts` (new file, or extend existing)
- `src/lib/__tests__/rateLimit.test.ts` (new file)

**Out of scope**:
- Source file modifications
- Tests for `inventory.ts` (the higher-level module) — those exist already

## Git workflow

- Branch: `advisor/071-test-inventory-core-rate-limit`
- Commit message: `test: add unit tests for inventoryCore fallback path and rateLimit`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Read the source files

```bash
cat src/lib/square/inventoryCore.ts
cat src/lib/rateLimit.ts
```

For `inventoryCore.ts`, identify:
1. The batch-failure fallback path (where a chunk fails and the code returns
   default values rather than throwing).
2. What is mocked vs. real in any existing inventory tests.

For `rateLimit.ts`, identify:
1. The `createRateLimiter` function signature and return type.
2. The `clientIp` function — what headers it reads.
3. Whether there is any state (sliding window, etc.) that requires advancing a
   fake timer in tests.

### Step 2: Read existing inventory tests

```bash
cat src/lib/square/__tests__/inventory.test.ts
```

Note what is already covered and what the `inventoryCache` mock looks like.

### Step 3: Write inventoryCore fallback tests

Create or extend `src/lib/square/__tests__/inventoryCore.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
// Import the function under test from inventoryCore.ts

describe("inventoryCore batch failure fallback", () => {
  it("returns default in-stock when a chunk Square call fails", async () => {
    // Mock squareClient to throw for the first batch call
    // Assert that the returned map still has entries with the default value
  });

  it("returns real values for successful chunks even when another chunk fails", async () => {
    // Two chunks: one succeeds, one fails
    // Assert successful chunk values are returned correctly
  });
});
```

Adapt mock patterns from the existing inventory test file.

### Step 4: Write rateLimit tests

Create `src/lib/__tests__/rateLimit.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { createRateLimiter, clientIp } from "../rateLimit";

describe("createRateLimiter", () => {
  it("allows requests within the limit", () => {
    const limiter = createRateLimiter({ windowMs: 1000, max: 3 });
    expect(limiter.check("127.0.0.1")).toBe(false); // not rate limited
    expect(limiter.check("127.0.0.1")).toBe(false);
    expect(limiter.check("127.0.0.1")).toBe(false);
  });

  it("blocks requests that exceed the limit", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 2 });
    limiter.check("10.0.0.1");
    limiter.check("10.0.0.1");
    expect(limiter.check("10.0.0.1")).toBe(true); // rate limited
  });

  it("does not carry state between different IP addresses", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1 });
    limiter.check("1.1.1.1");
    expect(limiter.check("2.2.2.2")).toBe(false); // different IP, not limited
  });
});

describe("clientIp", () => {
  it("returns x-nf-client-connection-ip when present", () => {
    const req = new Request("http://test/", {
      headers: { "x-nf-client-connection-ip": "1.2.3.4" },
    });
    expect(clientIp(req)).toBe("1.2.3.4");
  });

  it("falls back to x-forwarded-for last value", () => {
    const req = new Request("http://test/", {
      headers: { "x-forwarded-for": "attacker, 5.6.7.8" },
    });
    // After plan 043, should return "5.6.7.8" (last value)
    // Before plan 043, returns "attacker" (first value) — assert actual behavior
    const ip = clientIp(req);
    expect(typeof ip).toBe("string");
    expect(ip.length).toBeGreaterThan(0);
  });
});
```

Note: adjust the `clientIp` assertions to match the **current** implementation.
If plan 043 (IP spoofing fix) has already landed, the last-value assertion
should pass. If not, assert the current first-value behavior and add a
`// TODO: update after plan-043` comment.

### Step 5: Run tests and coverage

```bash
pnpm test:run
pnpm test:coverage
pnpm check
```

All expected to exit 0.

## Done criteria

- [ ] `pnpm test:run` exits 0
- [ ] `pnpm test:coverage` exits 0
- [ ] `pnpm check` exits 0
- [ ] `inventoryCore` fallback path covered by at least 2 test cases
- [ ] `createRateLimiter` covered: allow path, block path, IP isolation
- [ ] `clientIp` covered: Netlify header, XFF fallback
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

- `inventoryCore.ts` fallback is not a distinct code path (e.g. errors are
  always re-thrown) — report actual error handling and stop.
- `createRateLimiter` uses `Date.now()` internally without any abstraction —
  use `vi.useFakeTimers()` to advance time for window-expiry tests; if vitest
  fake timers conflict with something else in the test suite, report.
