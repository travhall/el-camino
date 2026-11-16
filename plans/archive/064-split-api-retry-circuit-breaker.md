# Plan 064: Split shared ApiRetryClient circuit breaker by domain

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 9b5556b..HEAD -- src/lib/square/apiRetry.ts`
> If any changes appear, compare before proceeding.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: correctness
- **Planned at**: commit `9b5556b`, 2026-07-22

## Why this matters

`src/lib/square/apiRetry.ts:232` exports a single `apiRetryClient` singleton:

```ts
export const apiRetryClient = ApiRetryClient.getInstance();
```

`ApiRetryClient` implements a circuit breaker. A circuit breaker trips after N
consecutive failures and blocks **all** subsequent calls until a reset interval
passes. Because both the catalog browsing paths (`fetchProducts`, category
checks) and the checkout path (`create-checkout.ts`, `calculate-cart.ts`) share
the same singleton, a Square catalog API outage that trips the breaker also
blocks checkout — even though the checkout endpoints use entirely different
Square APIs (Orders API, Payments API).

The fix is to export two domain-specific instances: one for catalog/inventory
reads (`catalogRetryClient`) and one for checkout writes (`checkoutRetryClient`).
Failures in one domain cannot trip the other's circuit breaker.

**Risk is MED**: this changes import names across multiple call sites. All
callers must be updated, and any import that imports both under the current name
needs to be split.

## Current state

`src/lib/square/apiRetry.ts:232`:

```ts
export const apiRetryClient = ApiRetryClient.getInstance();
```

`ApiRetryClient.getInstance()` creates a singleton; the class uses a static
`instance` property.

## Commands you will need

| Purpose        | Command              | Expected on success      |
|----------------|----------------------|--------------------------|
| Find callers   | `grep -rn "apiRetryClient" src/` | list all import sites |
| Typecheck      | `pnpm check`         | exit 0, no errors        |
| Unit tests     | `pnpm test:run`      | all pass                 |

## Scope

**In scope**:
- `src/lib/square/apiRetry.ts` — add a factory or second export
- All files that import `apiRetryClient` — update to the correct domain instance

**Out of scope**:
- `ApiRetryClient` class internals — do not change circuit breaker logic
- Any test file that mocks `apiRetryClient` — update import path only

## Git workflow

- Branch: `advisor/064-split-api-retry-circuit-breaker`
- Commit message: `fix: split shared ApiRetryClient into catalog and checkout instances`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Find all callers

```bash
grep -rn "apiRetryClient" src/
```

Categorize each caller as catalog/inventory (reads) or checkout/payment
(writes). The checkout domain includes `create-checkout.ts`,
`calculate-cart.ts`; catalog domain includes `categories.ts`,
`categoryUtils.ts`, `client.ts`, `inventoryCore.ts`.

### Step 2: Check if `ApiRetryClient` supports multiple instances

Read `src/lib/square/apiRetry.ts` fully. If `getInstance()` enforces a strict
singleton (static property, throws on second call), modify to support named
instances:

**Option A — factory function (preferred)**:

```ts
// In apiRetry.ts:
function createApiRetryClient(): ApiRetryClient {
  return new ApiRetryClient();
}

export const catalogRetryClient = createApiRetryClient();
export const checkoutRetryClient = createApiRetryClient();
// Keep the old name as an alias to avoid missing any call site:
// export const apiRetryClient = catalogRetryClient; // remove after all callers updated
```

**Option B — remove singleton enforcement**:
Change `ApiRetryClient` to allow normal `new ApiRetryClient()` construction
(remove the static singleton guard) and export two instances.

Choose whichever requires fewer changes to the class itself. Document your
choice in the commit message.

### Step 3: Update all callers

For each file found in Step 1:
- Catalog/inventory callers → import `catalogRetryClient`
- Checkout/payment callers → import `checkoutRetryClient`
- Update the import statement and every use of the old name within that file

### Step 4: Remove the old `apiRetryClient` export

Once all callers are updated, remove the old `apiRetryClient` export from
`apiRetry.ts` to prevent future drift.

```bash
grep -rn "apiRetryClient" src/
```

Expected: zero matches.

### Step 5: Typecheck and test

```bash
pnpm check
```

Expected: exit 0.

```bash
pnpm test:run
```

Expected: all pass. Note: if tests import `apiRetryClient` by name, update
those imports to the correct domain instance.

## Done criteria

- [ ] `pnpm check` exits 0
- [ ] `pnpm test:run` exits 0
- [ ] `grep -rn "apiRetryClient" src/` → zero matches
- [ ] `catalogRetryClient` and `checkoutRetryClient` exported from `apiRetry.ts`
- [ ] Catalog callers use `catalogRetryClient`, checkout callers use `checkoutRetryClient`
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

- More than 8 call sites need updating — list them and confirm the categorization
  (catalog vs. checkout) is unambiguous before proceeding.
- A file uses `apiRetryClient` for both catalog and checkout calls in the same
  handler — report which file and stop; it may need to be split or accept both
  imports.
- `ApiRetryClient` uses module-level mutable state beyond the static instance
  (e.g. a shared metrics store) that would produce incorrect results with two
  instances — report and stop.
