# Plan 137: Fix silent `catch {}` blocks; delete the dead `load-more-products` route

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat cdf74a3..HEAD -- src/pages/api/related-products.ts src/pages/api/resolve-product.ts src/pages/api/cart-inventory.ts src/pages/api/admin-auth.ts src/pages/api/load-more-products.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `cdf74a3`, 2026-09-04

## Why this matters

Four customer-facing API routes and the admin-login POST handler catch
errors with a bare `catch {}` (no bound variable, so nothing is even
available to log) — three of the four customer routes even have a dead
`// console.error(...)` comment left behind, showing logging was once there
and got silently dropped. When Square/catalog calls in these routes throw,
nothing appears in Netlify function logs — a real 5xx spike on these paths
is invisible to on-call. Separately, one of the four routes
(`load-more-products.ts`) turns out to have zero callers anywhere in the
frontend — it's unreachable dead code with an already-broken pagination
contract (always returns the full category, ignoring its own
`cursor`/`limit` params), so the leanest fix there is deletion, not logging.

## Current state

**`src/pages/api/related-products.ts:67-73`**:
```ts
  } catch {
    // console.error("[related-products] Error:", error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
```

**`src/pages/api/resolve-product.ts:65-71`**:
```ts
  } catch {
    // console.error("[resolve-product] Error resolving product slug:", error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
```

**`src/pages/api/cart-inventory.ts:43-49`** (approximate — verify exact
closing lines against live file):
```ts
  } catch {
    // console.error('Cart inventory API error:', error);

    return new Response(
      JSON.stringify({
```

**`src/pages/api/admin-auth.ts:66-68`** (the login `POST` handler's catch —
no dead comment here, just silent):
```ts
  } catch {
    return redirect(`/admin/login?from=${encodeURIComponent(from)}&error=1`);
  }
```

**`src/pages/api/load-more-products.ts`** (full file, 70 lines) — confirmed
via `grep -rln "load-more-products" src --include="*.ts" --include="*.astro" --include="*.tsx"`
to have **zero callers** anywhere outside itself and its own test file
(`src/pages/api/__tests__/load-more-products.test.ts`). Its implementation
also silently ignores its own contract: `fetchProductsByCategory` (in
`src/lib/square/categories.ts:174-210`) always returns the full category
and `hasMore: false`, regardless of the `cursor`/`limit` this route receives
— an intentional tradeoff documented in that function to avoid a buggy
Square search endpoint, but one this route's callers (if it had any) would
never see reflected correctly. Since nothing calls it, this is dead code
carrying a dead bug, not a live one — delete the route and its test rather
than fixing its catch block.

## Commands you will need

| Purpose   | Command               | Expected on success |
|-----------|--------------------------|----------------------|
| Typecheck | `pnpm check`            | exit 0, no errors    |
| Tests     | `pnpm test:run`         | all pass             |
| Coverage  | `pnpm test:coverage`    | exit 0, thresholds met |
| Lint      | `pnpm lint`             | exit 0               |

## Scope

**In scope**:
- `src/pages/api/related-products.ts`
- `src/pages/api/resolve-product.ts`
- `src/pages/api/cart-inventory.ts`
- `src/pages/api/admin-auth.ts`
- Delete: `src/pages/api/load-more-products.ts`
- Delete: `src/pages/api/__tests__/load-more-products.test.ts`

**Out of scope**:
- `src/pages/api/hours.ts`, `src/pages/api/shop-status.ts` — both also have
  silent catches, but by design (deliberate fail-open fallback to a default
  value when the underlying data source is unavailable); do not add logging
  or otherwise touch these.
- Any file calling into `fetchProductsByCategory`
  (`src/lib/square/categories.ts`) other than the deleted route — that
  function's documented cursor/limit tradeoff is unrelated to this plan and
  must not be changed.
- Any other route's error handling — this plan is scoped to exactly the 4
  files (fix) + 1 route (delete) listed above.

## Git workflow

- Branch: `advisor/137-fix-silent-catches-delete-dead-route`
- One commit is fine for the whole plan (small, cohesive changes).
- Commit message style: lowercase, conventional-ish prefix, e.g.
  `fix: log errors in silently-swallowed API catch blocks, remove dead route`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Confirm `load-more-products.ts` really has no callers

Run `grep -rln "load-more-products" src --include="*.ts" --include="*.astro" --include="*.tsx"`.

**Verify**: only `src/pages/api/load-more-products.ts` and
`src/pages/api/__tests__/load-more-products.test.ts` match. If a third file
matches, STOP (see below) — do not delete a route with a live caller.

### Step 2: Delete the dead route and its test

```
git rm src/pages/api/load-more-products.ts src/pages/api/__tests__/load-more-products.test.ts
```

**Verify**: `test -f src/pages/api/load-more-products.ts` fails (file gone).

### Step 3: Fix the three customer-facing routes' silent catches

In each of `related-products.ts`, `resolve-product.ts`, `cart-inventory.ts`,
change `catch {` to `catch (error) {` and replace the dead
`// console.error(...)` comment with a live call using the same message
text the comment already suggests, e.g. for `related-products.ts`:

```ts
  } catch (error) {
    console.error('[related-products] Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
```

Repeat the equivalent for `resolve-product.ts` (using its own
`[resolve-product] Error resolving product slug:` message) and
`cart-inventory.ts` (using its own `Cart inventory API error:` message —
match its existing bracket style, single-quotes).

**Verify**: `grep -n "catch {" src/pages/api/related-products.ts src/pages/api/resolve-product.ts src/pages/api/cart-inventory.ts` → no matches (all now bind `error`).

### Step 4: Fix `admin-auth.ts`'s silent login catch

Change:
```ts
  } catch {
    return redirect(`/admin/login?from=${encodeURIComponent(from)}&error=1`);
  }
```
to:
```ts
  } catch (error) {
    console.error('[admin-auth] Login error:', error);
    return redirect(`/admin/login?from=${encodeURIComponent(from)}&error=1`);
  }
```

**Verify**: `grep -n "catch {" src/pages/api/admin-auth.ts` → no match.

## Test plan

- For the 4 fixed routes: no new test *cases* are strictly required (the
  error-response behavior is unchanged — same status code, same body,
  same redirect — only logging was added). If any existing test in
  `src/pages/api/__tests__/` for these routes asserts on `console.error`
  call counts or mocks `console.error` and would break from the new call,
  update that assertion to expect the call rather than removing the new
  logging.
- For the deleted route: removing
  `src/pages/api/__tests__/load-more-products.test.ts` is itself the test
  plan — confirm no other test file imports from `../load-more-products`
  before deleting (same grep as Step 1 covers this).

Verification: `pnpm test:run` → all pass; total test count drops by exactly
`load-more-products.test.ts`'s case count, no other change.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm check` exits 0
- [ ] `pnpm lint` exits 0
- [ ] `pnpm test:run` exits 0
- [ ] `pnpm test:coverage` exits 0, no threshold regression
- [ ] `test -f src/pages/api/load-more-products.ts` fails (deleted)
- [ ] `grep -rn "catch {" src/pages/api/related-products.ts src/pages/api/resolve-product.ts src/pages/api/cart-inventory.ts src/pages/api/admin-auth.ts` returns no matches
- [ ] `grep -rln "load-more-products" src` returns no matches
- [ ] Only the 6 in-scope files touched/deleted (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Any "Current state" excerpt doesn't match the live file (drift).
- Step 1's grep finds a real caller of `load-more-products` — do not delete
  the route; instead just fix its `catch {}` the same way as Step 3 and note
  the scope change.
- Any existing test asserts specifically on the *absence* of a
  `console.error` call in one of the 4 fixed routes (would indicate the
  silence was more deliberate than this plan's recon found) — investigate
  before overriding that assertion.

## Maintenance notes

- `hours.ts` and `shop-status.ts` were deliberately left untouched — their
  silent catches are an intentional fail-open fallback, not an oversight.
  Don't "fix" those in a future pass without confirming the fallback
  behavior is actually meant to change.
- If a future audit finds more silent `catch {}` blocks, grep for the
  literal string `catch {` across `src/pages/api/` — this plan didn't do an
  exhaustive repo-wide sweep, only the specific sites the audit surfaced.
