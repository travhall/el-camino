# Plan 076: Prevent duplicate cart entries from double-click on add-to-cart

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 915a062..HEAD -- src/lib/cart/index.ts`
> If the in-scope files changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (can run before or after plan 074)
- **Category**: bug
- **Planned at**: commit `915a062`, 2026-08-01

## Why this matters

`CartManager.addItem` is async but has no in-flight guard. If a customer
double-clicks "Add to Cart," two calls race through simultaneously. Both
read the current quantity (say 0), both add 1, and both call `saveCart()`.
The result: one item ends up in the cart instead of the intended two.
Worse: if the item wasn't already in the cart, both calls may each create
the entry, leaving quantity 1 instead of 2 (or duplicating the key
depending on timing).

The fix is an in-flight set: track which variation IDs have a pending
`addItem` call and drop the second one.

## Current state

**File**: `src/lib/cart/index.ts`

The class has existing guards like `this.initialized` (boolean) and
`this.items` (Map). There is no deduplication guard on `addItem`. The
method signature is roughly:

```typescript
async addItem(params: AddItemParams): Promise<CartOperationResult> {
  // no in-flight guard
  const key = buildCartKey(params.variationId, params.customizations);
  const existing = this.items.get(key);
  // ...mutate existing or create new entry...
  this.saveCart();
  return { success: true };
}
```

Read `src/lib/cart/index.ts` around the `addItem` method before editing
to confirm the exact signature, key construction, and return type.

**Repo convention**: private fields on the class. Error handling uses
try/catch. Match the `this.initialized` guard style.

## Commands you will need

| Purpose   | Command                 | Expected on success |
|-----------|-------------------------|---------------------|
| Typecheck | `pnpm check`            | exit 0, no errors   |
| Tests     | `pnpm test:run -- cart` | all pass            |
| Coverage  | `pnpm test:coverage`    | all thresholds met  |

## Scope

**In scope**:
- `src/lib/cart/index.ts`
- `src/lib/cart/index.test.ts`

**Out of scope**:
- Any UI component that calls `addItem` — fix the source, not every caller
- `src/scripts/mini-cart-client.ts` — plan 077 handles the unawaited call there

## Git workflow

- Branch: `advisor/076-fix-add-item-double-click-race`
- Commit: `fix: prevent duplicate cart entries from concurrent addItem calls`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Add an in-flight set to CartManager

In `src/lib/cart/index.ts`, locate the class field declarations and add:

```typescript
private addItemInFlight = new Set<string>();
```

**Verify**: `pnpm check` → exit 0

### Step 2: Guard addItem with the in-flight set

At the top of the `addItem` method body, before any read from `this.items`,
add the guard and registration:

```typescript
async addItem(params: AddItemParams): Promise<CartOperationResult> {
  const key = buildCartKey(params.variationId, params.customizations);

  if (this.addItemInFlight.has(key)) {
    return { success: false, error: "Add already in progress" };
  }
  this.addItemInFlight.add(key);

  try {
    // ... existing addItem logic unchanged ...
    return { success: true };
  } finally {
    this.addItemInFlight.delete(key);
  }
}
```

The `finally` block ensures the key is always removed even if the method
throws. Wrap the existing body in `try { ... } finally { ... }` — do not
restructure the logic inside the try block.

**Verify**: `pnpm check` → exit 0

### Step 3: Add a race-condition test

In `src/lib/cart/index.test.ts`, inside the existing `describe('CartManager', ...)` block:

```typescript
it('drops a concurrent addItem call for the same variation', async () => {
  const [r1, r2] = await Promise.all([
    cart.addItem({ variationId: 'var-a', quantity: 1 }),
    cart.addItem({ variationId: 'var-a', quantity: 1 }),
  ]);

  const successes = [r1, r2].filter(r => r.success).length;
  const drops = [r1, r2].filter(r => !r.success).length;
  expect(successes).toBe(1);
  expect(drops).toBe(1);

  const items = cart.getItems();
  const varItems = items.filter(i => i.variationId === 'var-a');
  expect(varItems).toHaveLength(1);
  expect(varItems[0].quantity).toBe(1);
});
```

Model `AddItemParams` shape after existing `addItem` tests in that file.

**Verify**: `pnpm test:run -- cart` → all pass including new test

### Step 4: Run coverage

```
pnpm test:coverage
```

**Verify**: `src/lib/cart/index.ts` ≥ 84% branches (existing threshold)

## Done criteria

- [ ] `pnpm check` exits 0
- [ ] `pnpm test:run -- cart` exits 0 with new test passing
- [ ] `addItemInFlight` set exists as a private class field
- [ ] `addItem` returns early with `success: false` when key is already in-flight
- [ ] `finally` block always deletes the key
- [ ] No files outside the in-scope list are modified
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

- `addItem` signature differs significantly from the excerpt above
- `buildCartKey` doesn't exist — key construction uses a different pattern; confirm before adding the guard
- Coverage drops below 84% for `src/lib/cart/index.ts`

## Maintenance notes

- Guard is per-key, not global — concurrent adds of *different* items proceed normally.
- If `addItem` is ever made synchronous, the in-flight guard becomes a no-op but stays harmless.
- "Drop" semantics (`success: false`) are intentional: the UI already handles `success: false` for stock/validation failures, so double-click gets silent deduplication.
