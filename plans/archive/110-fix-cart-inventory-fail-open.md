# Plan 110: Make cart addItem fail closed on inventory-check failure

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 8ff3096..HEAD -- src/lib/cart/index.ts`
> If this file changed since this plan was written, compare the "Current
> state" excerpt below against the live file before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `8ff3096`, 2026-08-06

## Why this matters

`CartManager.addItem()` checks live inventory via `fetch('/api/check-inventory?...')`
before confirming an add-to-cart. When that fetch **rejects** (network
blip, timeout, ad-blocker interference, non-2xx response), the code
currently falls back to treating the item as having **999 units in
stock**:

```ts
const availableQuantity =
  inventoryResult.status === 'fulfilled' ? inventoryResult.value : 999;
```

This is the opposite of the fail-closed convention this codebase uses
everywhere else for inventory and pricing decisions:
- `src/pages/api/create-checkout.ts:213` defaults missing inventory data to
  `0` (`inventoryLevels[item.variationId] || 0`).
- `src/lib/square/inventory.ts`'s `checkBulkInventory` explicitly documents
  "anything we could not determine counts as 0" and fails closed on error.

A transient client-side network failure — a realistic, common occurrence,
unlike a server-side Square API outage — currently lets a customer add up
to 999 units of a potentially out-of-stock item and see a false "Added to
cart" success message. The mistake only surfaces later, at checkout, when
server-side validation correctly re-checks and silently adjusts/removes the
item — a confusing bait-and-switch at the final step of the funnel instead
of an honest "couldn't confirm stock, try again" at add-to-cart time.

## Current state

- `src/lib/cart/index.ts:440-465` — the relevant section of `addItem()`
  (line numbers approximate; re-locate via
  `grep -n "availableQuantity" src/lib/cart/index.ts` before editing since
  this file has had multiple prior plans land in it):
  ```ts
      const [inventoryResult, saleInfoResult] = await Promise.allSettled([
        fetch(`/api/check-inventory?variationId=${item.variationId}`)
          .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
          .then((data) => (data.success ? data.quantity || 0 : 0)),
        fetch('/api/sale-info', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ variationIds: [item.variationId] }),
        })
          .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
          .then((data) =>
            data.success ? (data.saleInfo?.[item.variationId] ?? null) : null
          ),
      ]);

      const availableQuantity =
        inventoryResult.status === 'fulfilled' ? inventoryResult.value : 999;
      const fetchedSaleInfo =
        saleInfoResult.status === 'fulfilled' ? saleInfoResult.value : null;
  ```
  Note the *fulfilled* path already fails closed correctly (`data.quantity
  || 0`, and a non-2xx response is turned into a rejection via
  `Promise.reject(r.status)`) — only the `Promise.allSettled` *rejected*
  branch's fallback value (`999`) is wrong.
- Find what `availableQuantity` is used for immediately after this block
  (read the following ~20-30 lines) — it almost certainly gates whether the
  add is allowed and/or what quantity is clamped to. Confirm the exact
  control flow before deciding the exact replacement value/behavior in Step
  1 below.

## Commands you will need

| Purpose   | Command          | Expected on success |
|-----------|------------------|----------------------|
| Typecheck | `pnpm check`     | exit 0, "0 errors" |
| Tests     | `pnpm test:run`  | all pass |
| Coverage  | `pnpm test:coverage` | exit 0 — `src/lib/cart/index.ts` has a **higher-than-global** per-file coverage threshold in `vitest.config.ts`; this file's new/changed branch must stay covered |
| Lint      | `pnpm lint`      | exit 0 |
| Build     | `pnpm build`     | exit 0 |

## Scope

**In scope** (the only files you should modify):
- `src/lib/cart/index.ts`
- Its test file(s) under `src/lib/cart/__tests__/` (there are three:
  `cart.test.ts`, `cart-real.test.ts`, `cart-integration.test.ts` — add the
  new case to whichever one already covers `addItem`'s inventory-check
  behavior; read all three's `addItem`-related tests first to avoid
  duplicating an existing rejected-inventory test that may already assert
  the *old* `999` behavior and need updating instead of a fresh test added)

**Out of scope** (do NOT touch, even though they look related):
- `src/pages/api/quick-view-product.ts` — a related but separate fail-open
  bug, fixed by `plans/111-fix-quick-view-inventory-fail-open.md`.
- `src/pages/api/check-inventory.ts` (the server-side endpoint being
  fetched) — this plan only changes the *client's* handling of that
  endpoint failing to respond, not the endpoint itself.
- Any UI/messaging changes beyond what's minimally needed to communicate a
  blocked add (e.g. don't redesign the cart's error-toast system if one
  already exists — reuse it).

## Git workflow

- Branch: `advisor/110-fix-cart-inventory-fail-open`
- Commit message style: conventional commits, e.g. `fix: fail closed when
  cart inventory check fails instead of defaulting to 999 in stock`
  (matches `7fc893d fix: guard CartManager.addItem against double-click
  race condition` in `git log`, another `src/lib/cart/index.ts` fix).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Read the full control flow around `availableQuantity`

Before changing the fallback value, read `src/lib/cart/index.ts` from the
`Promise.allSettled` block through wherever `availableQuantity` is last
used (likely a clamp on the quantity being added, or a rejection of the
add entirely). Confirm: does this codebase have an existing
"can't verify stock, try again" user-facing error path in `addItem()` or a
sibling method already? (Check for an existing thrown error type or
returned status the UI layer already handles — this file's tests will show
the shape.)

**Verify**: no command — this is a read-only investigation step, confirm by
citing the exact lines you read in your own working notes before Step 2.

### Step 2: Change the fallback from `999` to `0`

```ts
const availableQuantity =
  inventoryResult.status === 'fulfilled' ? inventoryResult.value : 0;
```

This makes a failed inventory check behave identically to "0 in stock" —
consistent with `checkBulkInventory`'s documented fail-closed contract and
`create-checkout.ts`'s `|| 0` default. If Step 1 revealed that
`availableQuantity === 0` already produces a sensible "out of stock, can't
add" outcome in the existing control flow (likely, since that's the normal
path for a genuinely-out-of-stock item), no further change is needed. If
`0` produces a *misleading* message specific to "sold out" rather than
"couldn't verify, try again," and the codebase has an existing distinct
error path for network/fetch failures elsewhere (check
`src/lib/square/errorUtils.ts` or similar for an existing "transient
failure" message pattern used elsewhere in this codebase), thread that
message through instead of the generic "out of stock" one — but do not
invent new UI text/copy patterns not already used elsewhere in this
codebase; match what exists.

**Verify**: `grep -n "availableQuantity" src/lib/cart/index.ts` shows the
`: 0` fallback, no `: 999` remaining in this function.

### Step 3: Add/update the regression test

Add a test asserting that when the inventory-check fetch rejects (mock a
rejected promise or a non-2xx response for `/api/check-inventory`),
`addItem()` does **not** treat the item as available with quantity 999 —
it should behave the same as a confirmed-zero-stock response (whatever that
existing behavior is, per Step 1/tests already covering the zero-stock
case).

**Verify**: `pnpm test:run` → all pass, including the new/updated case.

## Test plan

- New or updated test in the `addItem`-covering test file: inventory-check
  fetch rejects → assert the same outcome as a confirmed 0-quantity
  response (reuse an existing zero-stock test's assertions as the model if
  one exists).
- If an existing test already asserts the old `999`-fallback behavior
  (search test files for `999` before starting:
  `grep -rn "999" src/lib/cart/__tests__/`), update it rather than leaving
  a stale test that now contradicts the fixed code.
- Verification: `pnpm test:run` → all pass; `pnpm test:coverage` → exit 0,
  per-file threshold for `src/lib/cart/index.ts` still met.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm check` exits 0, "0 errors"
- [ ] `pnpm test:run` exits 0, new/updated test passing
- [ ] `pnpm test:coverage` exits 0, `src/lib/cart/index.ts` threshold met
- [ ] `pnpm lint` exits 0
- [ ] `pnpm build` exits 0
- [ ] `grep -n "999" src/lib/cart/index.ts` → no matches in the
      `addItem`/inventory-check region (confirm no other legitimate `999`
      use exists elsewhere in the file before treating any remaining match
      as a problem — re-check context)
- [ ] No files outside the Scope list are modified (`git status`)
- [ ] `plans/README.md` status row for 110 updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the cited lines doesn't match the excerpt above (drift since
  this plan was written).
- `grep -rn "999" src/lib/cart/__tests__/` reveals an existing test that
  explicitly asserts the current `999` fallback is *intended* behavior with
  its own stated rationale (not just incidental) — that would mean this
  plan's evidence about the intent was wrong; stop and report rather than
  overriding a deliberate design decision without understanding it first.
- Changing the fallback to `0` causes a different, unexpected code path to
  break (e.g. a downstream function that assumes `availableQuantity` is
  always positive) — trace and report rather than patching around it.

## Maintenance notes

- This aligns `addItem()`'s inventory-check failure handling with the
  fail-closed convention already documented and used in
  `checkBulkInventory` and `create-checkout.ts`. A reviewer should confirm
  no other spot in `src/lib/cart/index.ts` or its callers has a similar
  `999`-style optimistic fallback that this plan didn't catch (a
  `grep -rn "999" src/lib/cart/` sweep is cheap and worth doing in review).
- `plans/111-fix-quick-view-inventory-fail-open.md` fixes the same class of
  bug in a different file (`quick-view-product.ts`) — no code overlap, but
  a reviewer should recognize the pattern repeats and consider whether a
  shared helper/convention (e.g. a documented "inventory check failure
  always means 0" utility) would prevent a third instance of this from
  being introduced later.
