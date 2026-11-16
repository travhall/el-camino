# Plan 134: Decompose `create-checkout.ts` into `src/lib/checkout/`

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `wc -l src/pages/api/create-checkout.ts && git diff --stat cdf74a3..HEAD -- src/pages/api/create-checkout.ts src/pages/api/__tests__/create-checkout.test.ts`
> Expect 578 lines and no diff. If either file changed since this plan was
> written, compare the "Current state" excerpts against the live code before
> proceeding; on a mismatch, treat it as a STOP condition.
>
> **Supersedes**: `plans/096-arch-decompose-create-checkout.md`. That plan
> was written against commit `915a062` (2026-08-01); the file has since
> drifted by 263 changed lines (parallelized inventory/pricing, dynamic
> shop-hours/pickup-location fetching, phone normalization, shipping
> instructions, `console.info`/`console.error` cleanup) and its "Current
> state" excerpts no longer match live code. `plans/README.md`'s status row
> for 096 also incorrectly says "DONE" — the decomposition was never
> actually executed (`src/lib/checkout/` does not exist anywhere in the
> repo, confirmed via `find`). This plan replaces 096 with a fresh read of
> the current file. Do not open 096 for reference — its code excerpts are
> stale.

## Status

- **Priority**: P3
- **Effort**: L
- **Risk**: MED
- **Depends on**: none (077 and 082, 096's original dependencies, are both DONE and already reflected in the current file this plan reads from)
- **Category**: architecture
- **Planned at**: commit `cdf74a3`, 2026-09-04

## Why this matters

`src/pages/api/create-checkout.ts` is 578 lines mixing five distinct
concerns in one file: rate limiting/request parsing, pickup-time scheduling
math (business-hours arithmetic across timezones), phone-number
normalization, inventory/pricing validation, fulfillment payload
construction, and the actual Square payment-link creation + post-order
bookkeeping (pending-order storage, cache busting, cookie setting). This is
the single highest-risk file in the checkout path — it has already been
touched by 6 other plans (021, 022, 067, 068, 074, 077, 082) since the
original audit, each one a small patch to a large, hard-to-fully-hold-in-
your-head function. Splitting it into focused modules under
`src/lib/checkout/` (mirroring the existing `src/lib/cart/`, `src/lib/email/`,
`src/lib/admin/` subdirectory convention already used for cohesive business
concerns in this repo) makes each concern independently testable and
reduces the blast radius of the next fix.

## Current state

`src/pages/api/create-checkout.ts` (578 lines) breaks down as:

- **Lines 1-31**: imports, `checkoutLimiter` (rate limiter instance), `STORE_TIMEZONE` constant.
- **Lines 33-140**: pickup-scheduling math — pure functions, no I/O except one call to `getShopHoursRaw()`:
  - `storeHoursForDay(jsDay, hoursData)` (38-49) — private helper.
  - `storeTimeOf(date)` (54-77) — **exported**, imported directly by `src/pages/api/__tests__/create-checkout.test.ts:33`.
  - `roundUpTo15(date)` (83-88) — private helper.
  - `nextPickupTime(from)` (99-140) — **exported**, imported directly by the same test file.
- **Lines 146-164**: `normalizePhoneE164(phone)` — pure function, no exports elsewhere, used at lines 384 and 418.
- **Lines 166-183**: `ShippingAddress` and `PickupContact` interfaces.
- **Lines 185-578**: the `POST` handler itself, which:
  - checks the rate limiter (186-194)
  - parses/validates the request body (197-234)
  - fetches inventory + pricing in parallel and filters/adjusts cart items (236-304)
  - computes subtotal, shipping rate, and builds `lineItems: OrderLineItem[]` (306-362)
  - builds the `fulfillments: Fulfillment[]` array — shipping branch (367-397) or pickup branch, which awaits `getPickupLocation()` + `nextPickupTime()` (398-424)
  - calls `checkoutRetryClient.executeWithRetry(...)` to create the Square payment link (426-479)
  - derives `orderId`, stores the pending-order contact via `storePendingOrder` (496-524), busts `inventoryCache` entries (526-532), sets the `square-pending-orderId` cookie (534-541), and returns the JSON response (543-554)
  - top-level `catch` logs and returns a generic 500 (555-577)

`src/pages/api/__tests__/create-checkout.test.ts:33` currently does:
```ts
import { POST, nextPickupTime, storeTimeOf } from '../create-checkout';
```
This import must be updated as part of this plan (see Step 6) since
`nextPickupTime`/`storeTimeOf` are moving out of `create-checkout.ts`.

**Repo convention to follow**: business-domain concerns get their own
`src/lib/<domain>/` subdirectory (see `src/lib/cart/`, `src/lib/email/`,
`src/lib/admin/`) — as opposed to `src/lib/square/`'s flat-file-per-concern
style (`catalogFetch.ts`, `catalogUtils.ts`, `productMapper.ts`, etc.), which
is specific to that directory's tight coupling to the Square SDK. `checkout`
is a cross-cutting business concern (shipping/pickup/pricing), so it gets
the subdirectory treatment, matching `plans/095-arch-decompose-client.md`'s
sibling decomposition of `client.ts` (already DONE) for precedent on *how*
to extract a large file's helper functions into named modules without
changing their behavior.

## Commands you will need

| Purpose   | Command                                                  | Expected on success |
|-----------|-------------------------------------------------------------|----------------------|
| Typecheck | `pnpm check`                                              | exit 0, no errors    |
| Tests     | `pnpm test:run`                                           | all pass             |
| Coverage  | `pnpm test:coverage`                                       | exit 0, thresholds met |
| Lint      | `pnpm lint`                                                | exit 0               |
| Build     | `pnpm build`                                               | exit 0               |

## Scope

**In scope**:
- `src/pages/api/create-checkout.ts` — becomes a thin orchestrator.
- New files under `src/lib/checkout/`:
  - `src/lib/checkout/pickupScheduling.ts`
  - `src/lib/checkout/phone.ts`
  - `src/lib/checkout/fulfillmentBuilders.ts`
  - `src/lib/checkout/lineItems.ts`
  - `src/lib/checkout/types.ts` (the `ShippingAddress`/`PickupContact` interfaces, if not colocated with their builder module — executor's call, see Step 2)
- `src/pages/api/__tests__/create-checkout.test.ts` — only the import lines for `nextPickupTime`/`storeTimeOf` (now from `@/lib/checkout/pickupScheduling` instead of `../create-checkout`); no test *behavior* changes.

**Out of scope**:
- Every other file that imports from `create-checkout.ts` — check
  `grep -rln "from '.*create-checkout'" src` before starting and confirm the
  only importer is the test file above; if you find another, that's a STOP
  condition (see below), not something to silently patch.
- `src/lib/square/apiRetry.ts`, `src/lib/square/inventory.ts`,
  `src/lib/square/pricing.ts`, `src/lib/config/shipping.ts`,
  `src/lib/email/pendingOrders.ts`, `src/lib/cache/blobCache.ts`,
  `src/lib/rateLimit.ts`, `src/lib/shopHours.ts` — all imported by
  `create-checkout.ts` but not touched by this plan; the orchestrator keeps
  calling them exactly as it does today.
- Changing any Square API payload shape, request/response JSON shape, or
  cookie behavior — this is a pure file-organization refactor, not a
  behavior change. If a refactor forces a behavior difference anywhere, stop
  and report rather than deciding it's fine.

## Git workflow

- Branch: `advisor/134-decompose-create-checkout`
- One commit per extracted module is fine, or a single combined commit —
  operator's call; land as one PR either way.
- Commit message style: lowercase, conventional-ish prefix, e.g.
  `refactor: decompose create-checkout.ts into src/lib/checkout/`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Extract pickup-scheduling math

Create `src/lib/checkout/pickupScheduling.ts` containing, moved verbatim
(only changing `export`/private-ness as needed):
- `STORE_TIMEZONE` constant (currently line 31)
- `storeHoursForDay` (private, lines 38-49)
- `storeTimeOf` (exported, lines 54-77)
- `roundUpTo15` (private, lines 83-88)
- `nextPickupTime` (exported, lines 99-140) — it imports `getShopHoursRaw`
  from `@/lib/shopHours` and `ShopHoursEntry` type from the same; carry
  those imports over.

Delete these from `create-checkout.ts` and import `nextPickupTime` from the
new module wherever it's called (line 402).

**Verify**: `pnpm check` → 0 errors (confirms the import graph resolves).

### Step 2: Extract phone normalization and shared types

Create `src/lib/checkout/phone.ts` with `normalizePhoneE164` (lines
146-164), exported. Create `src/lib/checkout/types.ts` (or fold into
`fulfillmentBuilders.ts` from Step 3 if that reads more naturally — your
call, but pick one and be consistent) with the `ShippingAddress` and
`PickupContact` interfaces (lines 166-183), exported.

Delete these from `create-checkout.ts`, import from the new locations.

**Verify**: `pnpm check` → 0 errors.

### Step 3: Extract fulfillment-payload builders

Create `src/lib/checkout/fulfillmentBuilders.ts` with two functions:

- `buildShippingFulfillment(shippingAddress: ShippingAddress): Fulfillment`
  — the logic currently at lines 367-397 (ship-date calculation, shipment
  note, the `Fulfillment` object literal). Pure, synchronous.
- `buildPickupFulfillment(pickupContact: PickupContact): Promise<Fulfillment>`
  — the logic currently at lines 398-424 (awaits `getPickupLocation()` +
  `nextPickupTime()` in parallel via `Promise.all`, builds the pickup note,
  returns the `Fulfillment` object). Import `nextPickupTime` from
  `./pickupScheduling` (Step 1) and `getPickupLocation` from
  `@/lib/config/shipping` (unchanged import source).

`create-checkout.ts`'s `POST` handler replaces its inline branches
(367-424) with a call to whichever builder matches `fulfillmentMethod`.

**Verify**: `pnpm check` → 0 errors.

### Step 4: Extract line-item construction

Create `src/lib/checkout/lineItems.ts` with a function
`buildLineItems(validItems: CartItem[], pricing: Record<string, AuthoritativePrice>, shippingRate: number, fulfillmentMethod: 'shipping' | 'pickup'): OrderLineItem[]`
— the logic currently at lines 329-362 (per-item `OrderLineItem` mapping
with sale-price override, plus the conditional shipping line item).

`create-checkout.ts`'s `POST` handler replaces lines 329-362 with a single
call to `buildLineItems(...)`.

**Verify**: `pnpm check` → 0 errors.

### Step 5: Confirm the orchestrator is now thin

After Steps 1-4, `create-checkout.ts`'s `POST` handler should read as a
sequence of: rate-limit check → parse/validate body → fetch
inventory+pricing, filter/adjust items (this part — lines 236-304 — stays
inline; it's tightly coupled to the request/response shape and isn't a
clean extraction candidate, don't force it) → `buildLineItems(...)` →
`buildShippingFulfillment(...)` or `await buildPickupFulfillment(...)` →
`checkoutRetryClient.executeWithRetry(...)` for the payment link → derive
`orderId`, `storePendingOrder`, bust `inventoryCache`, set cookie, return
response. The top-level try/catch (196, 555-577) stays wrapping the whole
handler.

**Verify**: `wc -l src/pages/api/create-checkout.ts` → should drop from 578
to roughly 250-320 lines (rough guide, not a hard gate — the point is a
clear reduction, not an exact number).

### Step 6: Update the test file's imports

In `src/pages/api/__tests__/create-checkout.test.ts:33`, change:
```ts
import { POST, nextPickupTime, storeTimeOf } from '../create-checkout';
```
to:
```ts
import { POST } from '../create-checkout';
import { nextPickupTime, storeTimeOf } from '@/lib/checkout/pickupScheduling';
```
No other change to this test file — every existing test case keeps testing
the same behavior through the same `POST` handler; the two moved functions
are tested exactly as before, just imported from their new home.

**Verify**: `pnpm test:run -- create-checkout` → all existing tests in this
file still pass, unchanged pass count.

## Test plan

No new test *cases* are required — this is a pure refactor and the existing
`create-checkout.test.ts` suite already exercises the `POST` handler
end-to-end (mocking `checkBulkInventory`, `getAuthoritativePricing`,
`squareClient.checkout.paymentLinks.create`, etc.) plus `nextPickupTime`/
`storeTimeOf` directly. If you want extra confidence, adding focused unit
tests for `buildLineItems`, `buildShippingFulfillment`, and
`buildPickupFulfillment` in a new `src/lib/checkout/__tests__/` directory is
a reasonable bonus but not required for this plan's done criteria — model
any such test file after `src/lib/square/money.test.ts`'s pattern (pure
function in, plain assertions out, no heavy mocking).

- Verification: `pnpm test:run` → same total pass count as before this plan
  (no regressions, no accidentally-dropped test cases).
- Verification: `pnpm test:coverage` → no threshold regression; coverage on
  the newly-extracted files should be picked up automatically since
  `create-checkout.test.ts` exercises them transitively through `POST`.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm check` exits 0
- [ ] `pnpm lint` exits 0
- [ ] `pnpm test:run` exits 0, same total pass count as pre-change baseline
- [ ] `pnpm test:coverage` exits 0, no threshold regression
- [ ] `pnpm build` exits 0
- [ ] `find src/lib/checkout -maxdepth 1 -name "*.ts"` lists at least
      `pickupScheduling.ts`, `phone.ts`, `fulfillmentBuilders.ts`, `lineItems.ts`
- [ ] `grep -n "nextPickupTime\|storeTimeOf" src/pages/api/create-checkout.ts` shows only the import line, not the function definitions
- [ ] `wc -l src/pages/api/create-checkout.ts` shows a meaningfully smaller file than 578 lines
- [ ] `git status` shows only files under `src/pages/api/create-checkout.ts`, `src/pages/api/__tests__/create-checkout.test.ts`, and new files under `src/lib/checkout/` modified/added
- [ ] `plans/README.md` status row for **134** updated, and the row for **096** corrected to reference this plan (e.g. "SUPERSEDED by 134")

## STOP conditions

Stop and report back (do not improvise) if:

- The live `create-checkout.ts` doesn't match "Current state" (drift).
- `grep -rln "from '.*create-checkout'" src` (repo-wide) finds an importer
  this plan didn't account for beyond the one test file.
- Any extraction would require changing the Square API payload shape, the
  JSON response shape returned to the client, or cookie behavior — this
  plan is scoped to pure reorganization; a forced behavior change means the
  boundary drawn here is wrong for this codebase and needs the operator's
  input before continuing.
- `pnpm test:run` fails after any step and a reasonable fix attempt doesn't
  resolve it within two tries — likely means an import was moved
  incorrectly; don't keep guessing, report the specific failing test.

## Maintenance notes

- Once this lands, a future change to pickup-time logic, phone
  normalization, fulfillment payloads, or line-item pricing touches exactly
  one small file instead of one 578-line one — a reviewer should scrutinize
  that the orchestrator (`create-checkout.ts`) still calls these in the
  right order (inventory/pricing before line items, fulfillment before the
  payment-link call) since Square's payload requires everything assembled
  before the single `paymentLinks.create` call.
- If a future plan wants unit tests for the extracted pure functions
  (`buildLineItems`, `buildShippingFulfillment`, etc.) beyond what
  `create-checkout.test.ts` already covers indirectly, that's a good
  candidate for a small follow-up test-coverage plan — not required here.
- `plans/096-arch-decompose-create-checkout.md` should be treated as
  historical/stale after this plan lands — its code excerpts describe the
  file as it existed at commit `915a062`, not the current shape.
