# Plan 165: Add tests for `src/lib/checkout/` — the module that builds the order payload

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report. When done, update this
> plan's status row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat ad2999d..HEAD -- src/lib/checkout/ src/lib/config/shipping.ts`
> On any change, compare against the excerpts below before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (soft interaction with 152 — see Maintenance notes)
- **Category**: tests
- **Planned at**: commit `ad2999d`, 2026-09-05

## Why this matters

`src/lib/checkout/` builds the exact payload sent to Square to create an order.
It has **no test file at all**. Its coverage comes incidentally from
`src/pages/api/__tests__/create-checkout.test.ts`: `fulfillmentBuilders.ts` sits
at ~44% statements / 50% branches, `phone.ts` at ~56% / 25%.

These modules were extracted out of `create-checkout.ts` **specifically for
testability** (commit `07a1438`, "refactor: decompose create-checkout.ts into
src/lib/checkout/"). The decomposition happened; the tests never followed.

The failure modes are all customer-visible and expensive:

- A malformed `phoneNumber` makes Square reject payment-link creation — checkout
  fails outright for that customer.
- A wrong or truncated address produces an undeliverable order.
- `calculateShippingRate`'s free-shipping boundary is a **money branch with 0%
  branch coverage**.

## Current state

`src/lib/checkout/` contains five files and no `__tests__/` directory:

```
fulfillmentBuilders.ts
lineItems.ts
phone.ts
pickupScheduling.ts
types.ts
```

Key surfaces to cover:

- `fulfillmentBuilders.ts:7` — `buildShippingFulfillment`, assembling recipient
  address and `expectedShippedAt` (`:11-12`, `+2` days with **no business-day
  logic** — characterize the current behavior, do not fix it here).
- `fulfillmentBuilders.ts:42` — `buildPickupFulfillment`, including note
  composition at `:52-55`.
- `phone.ts:5` — `normalizePhoneE164`, four branches: already-`+`, 10-digit,
  11-digit leading `1`, and a fallback at `:22` commented "hope for the best".
- `src/lib/config/shipping.ts:58` — `calculateShippingRate`, ~63% statements /
  **0% branches**; neither side of `FREE_SHIPPING_THRESHOLD_DOLLARS` is asserted.

### Repo conventions

- Vitest, tests in `__tests__/` beside the code.
- **Structural exemplar**: `src/lib/__tests__/shopHours.test.ts` — pure
  functions, table-driven, minimal mocking. Read it first.
- For the one builder needing a blob-store stub (`getPickupLocation` reads
  contact info), follow the mocking pattern in that same file.
- Mock-path pitfall documented in this repo: from inside `__tests__/`, mock
  `'../module'`, not `'./module'` — the latter resolves to a nonexistent sibling
  and silently falls through to the real implementation.

## Commands you will need

| Purpose   | Command                                  | Expected             |
|-----------|------------------------------------------|----------------------|
| Typecheck | `pnpm check`                             | exit 0               |
| Tests     | `pnpm test:run -- checkout shipping`     | all pass             |
| Full      | `pnpm test:run`                          | exit 0               |
| Coverage  | `pnpm test:coverage`                     | exit 0, no regression|
| Lint      | `pnpm lint`                              | exit 0               |

Never use `pnpm test` — watch mode, it hangs.

## Scope

**In scope** (create):
- `src/lib/checkout/__tests__/phone.test.ts`
- `src/lib/checkout/__tests__/fulfillmentBuilders.test.ts`
- `src/lib/checkout/__tests__/lineItems.test.ts`
- `src/lib/checkout/__tests__/pickupScheduling.test.ts`
- `src/lib/config/__tests__/shipping.test.ts`

**Out of scope** (do NOT touch):
- **Any source file.** This is a characterization-test plan: document what the
  code does today, including behavior that looks wrong. If a test reveals a bug,
  that is a finding to report — see STOP conditions.
- `src/pages/api/create-checkout.ts` and its existing test file. Plan 152 changes
  that route; overlapping edits would conflict.
- The `expectedShippedAt` `+2` days logic and the `phone.ts:22` "hope for the
  best" fallback. **Characterize them, do not fix them.**
- `vitest.config.ts` thresholds. Raising them after coverage improves is
  worthwhile but belongs in its own change.

## Git workflow

- Branch: `advisor/165-test-checkout-payload-builders`
- Conventional commits, e.g. `test: characterize checkout payload builders`
- Do NOT push or open a PR unless the operator instructs it.

## Steps

### Step 1: Record baseline coverage for the target files

```bash
pnpm test:coverage
```

**Verify**: record current statements/branches for `fulfillmentBuilders.ts`,
`phone.ts`, `lineItems.ts`, `pickupScheduling.ts`, and `shipping.ts` in the
`plans/README.md` status row.

### Step 2: `phone.test.ts` — table-driven, all four branches

Cases (assert exact output strings):
- already E.164 (`+14155551234`) → unchanged
- 10 digits (`4155551234`) → `+14155551234`
- 11 digits leading 1 (`14155551234`) → `+14155551234`
- formatted input (`(415) 555-1234`, `415-555-1234`, `415.555.1234`)
- the fallback: a string matching none of the above — assert what it *actually*
  returns, and add a comment noting `phone.ts:22`'s own "hope for the best"
- empty string, `undefined`/`null` if the signature allows

**Verify**: `pnpm test:run -- phone` → all pass. `pnpm test:coverage` shows
`phone.ts` branches well above the 25% baseline.

### Step 3: `fulfillmentBuilders.test.ts`

`buildShippingFulfillment`:
- full address including `street2` → assert the complete `Fulfillment` object
- **`street2` absent** → assert it is omitted, not sent as `undefined`/empty
- `expectedShippedAt` is exactly +2 days from a **frozen clock**
  (`vi.setSystemTime`) — do not compute it from `Date.now()` in the assertion, or
  the test proves nothing
- special characters in the recipient name

`buildPickupFulfillment`:
- with and without `instructions` → assert note composition (`:52-55`)
- stub the contact-info blob read; assert the pickup location is used

**Verify**: `pnpm test:run -- fulfillmentBuilders` → all pass.

### Step 4: `shipping.test.ts` — both sides of the money boundary

- subtotal **below** the threshold → `STANDARD_SHIPPING_RATE`
- subtotal **exactly at** the threshold → free (assert `>=`, the boundary itself)
- subtotal **above** → free
- `0` → standard rate
- a negative subtotal, if reachable → assert current behavior

Import `FREE_SHIPPING_THRESHOLD_DOLLARS` rather than hardcoding 75, so the test
follows the config.

**Verify**: `pnpm test:run -- shipping` → all pass; `shipping.ts` branch coverage
above 0%.

### Step 5: `lineItems.test.ts` and `pickupScheduling.test.ts`

For `lineItems.ts`, cover the sale-price override at `:22-29` specifically:
- catalog confirms a sale → `basePriceMoney` set to the sale price in cents
- **no catalog price** → `basePriceMoney` omitted (Square charges catalog price).
  This is the security-relevant fail-safe; assert it explicitly.
- shipping added as a custom line item when `fulfillmentMethod === 'shipping'`
  and `shippingRate > 0`; omitted when the rate is 0

**Verify**: `pnpm test:run -- lineItems pickupScheduling` → all pass.

### Step 6: Full gate

```bash
pnpm check && pnpm lint && pnpm test:run && pnpm test:coverage
```
→ all exit 0.

## Test plan

This plan *is* the test plan. Additional requirements:

- No source file may be modified. `git status` must show only new test files.
- Every test asserts **current** behavior. Where current behavior looks wrong,
  add a comment saying so and report it — do not encode an aspiration.
- Record before/after coverage for all five files in the status row.

## Done criteria

- [ ] Five new test files exist under the paths in Scope
- [ ] `phone.ts` covers all four branches plus malformed and empty input
- [ ] `expectedShippedAt` asserted against a frozen clock, not a computed value
- [ ] `shipping.ts` asserts below / exactly-at / above the free-shipping threshold
- [ ] `lineItems.ts` asserts that a missing catalog price omits `basePriceMoney`
- [ ] **No source file modified** (`git status` shows only new test files)
- [ ] Before/after coverage recorded in `plans/README.md`
- [ ] `pnpm check` / `pnpm lint` / `pnpm test:run` all exit 0
- [ ] `pnpm test:coverage` exits 0, no threshold regression

## STOP conditions

Stop and report if:

- **A test reveals a real bug** — e.g. `street2` silently dropped, a phone format
  producing something Square would reject, or the threshold using `>` instead of
  `>=`. Write the test to capture actual behavior, mark it clearly, and report.
  **Do not fix the source under this plan.**
- `buildPickupFulfillment` cannot be tested without extensive Square/blob
  mocking. Cover what you can and report what you could not.
- Any of these functions turns out to be dead (no production caller). Report —
  that changes it from a test gap to a deletion candidate.
- Any verification fails twice after a reasonable fix attempt.

## Maintenance notes

- **Interaction with plan 152**: that plan changes how `create-checkout.ts`
  computes the shipping subtotal (removing the client-price fallback). It does
  not change these modules' signatures, but if 152 lands first, re-read
  `calculateShippingRate`'s callers before writing Step 4.
- The `+2` day `expectedShippedAt` with no business-day logic and the
  `"hope for the best"` phone fallback are both characterized here, not fixed.
  Once tests pin current behavior, fixing them becomes safe — that is the point.
- Once coverage rises, bumping the thresholds in `vitest.config.ts` protects the
  gain. Only meaningful after plan 160 makes coverage actually run in CI.
- A reviewer should confirm no source file appears in the diff.
