# Plan 074: Fix stale sale prices overwriting current cart after navigation

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 915a062..HEAD -- src/lib/cart/index.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `915a062`, 2026-08-01

## Why this matters

`fetchSaleInfoForCartItems` is called without `await` inside `loadCart`, meaning it runs
fire-and-forget. When Astro view transitions fire (user navigates between pages), `loadCart`
clears the cart Map (`this.items.clear()`) and repopulates from localStorage. If a prior
`fetchSaleInfoForCartItems` network call resolves after that clear, it iterates the
newly-populated Map and writes stale sale prices (from the previous page's products) back
onto current items, then persists them via `saveCart()`. The customer sees wrong sale prices
and they are persisted to localStorage, surviving a hard reload.

## Current state

**File**: `src/lib/cart/index.ts`

Line 157 — unawaited call inside `loadCart`:
```typescript
// line 136
this.items.clear();
// ...
// line 156-158
if (this.items.size > 0) {
  this.fetchSaleInfoForCartItems();  // ← fire-and-forget, no await
}
```

`fetchSaleInfoForCartItems` (around line 168):
```typescript
private async fetchSaleInfoForCartItems(): Promise<void> {
  if (this.items.size === 0) return;
  try {
    const variationIds = Array.from(this.items.values()).map(item => item.variationId);
    const response = await fetch("/api/sale-info", {  // ← yields here; race starts
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variationIds }),
    });
```

After `await fetch` yields, if `loadCart()` fires again (navigation), `this.items.clear()` runs.
When the original fetch resolves, it writes stale prices to the now-wrong Map contents.

**Repo convention**: Private fields on `CartManager`. Error handling uses try/catch throughout
this file. Existing pattern: see `this.initialized` guard. Match those patterns.

## Commands you will need

| Purpose   | Command                 | Expected on success        |
|-----------|-------------------------|----------------------------|
| Typecheck | `pnpm check`            | exit 0, no errors          |
| Tests     | `pnpm test:run -- cart` | all pass                   |
| Coverage  | `pnpm test:coverage`    | all thresholds met         |

## Scope

**In scope**:
- `src/lib/cart/index.ts`
- `src/lib/cart/index.test.ts` (add race-condition test)

**Out of scope**:
- `src/pages/api/sale-info.ts` — API endpoint is fine; only the caller is broken
- Any other cart-adjacent files

## Git workflow

- Branch: `advisor/074-fix-cart-sale-info-race`
- Commit: `fix: prevent stale sale prices from overwriting cart after navigation`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Add a generation counter to CartManager

In `src/lib/cart/index.ts`, find the class field declarations (where `this.initialized`,
`this.items`, etc. live) and add:

```typescript
private saleInfoGeneration = 0;
```

**Verify**: `pnpm check` → exit 0

### Step 2: Increment counter in loadCart; add guards in fetchSaleInfoForCartItems

In `loadCart`, change the fire-and-forget call to:
```typescript
if (this.items.size > 0) {
  this.saleInfoGeneration++;
  this.fetchSaleInfoForCartItems();
}
```

In `fetchSaleInfoForCartItems`, capture the generation **before** the first `await`, then
check it after every `await` before writing to `this.items`:

```typescript
private async fetchSaleInfoForCartItems(): Promise<void> {
  if (this.items.size === 0) return;
  const myGeneration = this.saleInfoGeneration;  // capture before any yield

  try {
    const variationIds = Array.from(this.items.values()).map(item => item.variationId);
    const response = await fetch("/api/sale-info", { ... });
    if (this.saleInfoGeneration !== myGeneration) return;  // stale — bail

    if (!response.ok) { ... }
    const data = await response.json();
    if (this.saleInfoGeneration !== myGeneration) return;  // stale — bail

    // existing loop that writes to this.items ...
    for (const [key, item] of this.items.entries()) {
      // ... write saleInfo back ...
    }
    if (this.saleInfoGeneration !== myGeneration) return;  // final guard before saveCart
    this.saveCart();
    // ... dispatch event ...
  } catch (error) {
    // existing catch
  }
}
```

Add the guard check after every `await` and before every write to `this.items`.

**Verify**: `pnpm check` → exit 0

### Step 3: Run tests and coverage

```
pnpm test:run -- cart
pnpm test:coverage
```

If existing tests fail because they expect `fetchSaleInfoForCartItems` to complete
synchronously, add `await vi.runAllTimersAsync()` or `await Promise.resolve()` after
`loadCart()` in those tests to drain the microtask queue.

**Verify**: `pnpm test:coverage` → `src/lib/cart/index.ts` ≥ 84% branches (existing threshold)

## Test plan

Add to `src/lib/cart/index.test.ts` inside the existing `describe('CartManager', ...)` block:

```typescript
it('does not apply sale info from stale navigation when a newer loadCart fires', async () => {
  // 1. Set up a fetch mock that can be resolved manually
  let resolveFetch: (v: Response) => void;
  const delayedFetch = new Promise<Response>(res => { resolveFetch = res; });
  vi.spyOn(global, 'fetch').mockReturnValueOnce(delayedFetch);

  // 2. First loadCart — triggers fetchSaleInfoForCartItems in background
  await cart.loadCart();

  // 3. Simulate navigation — second loadCart runs before first fetch resolves
  await cart.loadCart();

  // 4. Now resolve the stale fetch with fake sale data
  resolveFetch!(new Response(JSON.stringify({ saleInfo: { 'variation-a': { salePrice: 1 } } }), { status: 200 }));
  await Promise.resolve(); // drain microtask queue

  // 5. Verify stale sale data was NOT applied
  const items = cart.getItems();
  expect(items.every(i => i.saleInfo === undefined || i.saleInfo === null)).toBe(true);
});
```

**Verify**: `pnpm test:run -- cart` → all pass including new test

## Done criteria

- [ ] `pnpm check` exits 0
- [ ] `pnpm test:coverage` exits 0 with `src/lib/cart/index.ts` ≥ 84% branches
- [ ] `fetchSaleInfoForCartItems` has `myGeneration` capture and guards after every `await`
- [ ] `loadCart` increments `this.saleInfoGeneration` before calling `fetchSaleInfoForCartItems`
- [ ] New race-condition test exists in `src/lib/cart/index.test.ts`
- [ ] No files outside the in-scope list are modified
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

- Code at lines 136–160 of `src/lib/cart/index.ts` does not match the excerpts above
- Coverage threshold for `src/lib/cart/index.ts` drops below 84% and cannot be recovered
- `fetchSaleInfoForCartItems` has already been moved to a separate module

## Maintenance notes

- If `loadCart` is ever made `async` and awaited everywhere, the generation guard becomes
  redundant but harmless — leave it in place.
- The `saleInfoGeneration` counter is a simple int per session; no overflow risk.
- The `/api/sale-info` endpoint is stateless; no change needed there.
