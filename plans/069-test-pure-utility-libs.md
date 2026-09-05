# Plan 069: Add unit tests for pure utility libraries

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 9b5556b..HEAD -- src/lib/`
> If any changes appear, compare before proceeding.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: test-coverage
- **Planned at**: commit `9b5556b`, 2026-07-22

## Why this matters

Seven pure-function utility modules have zero test coverage. These are the
safest and most valuable things to test — no I/O, no external dependencies, no
mocking required. They are also the modules most likely to develop subtle bugs
during future refactors. Collectively they include core application logic:
URL slug generation, filter parsing, shop hour formatting, product attribute
extraction, request deduplication, and error classification.

Coverage thresholds in `vitest.config.ts` enforce 80% globally and higher for
specific files. Adding these tests brings multiple files above their personal
thresholds and raises global coverage.

## Target modules and what to test

### `src/lib/square/filterUtils.ts`
- `parseFiltersFromURL(url)` — parses search params into a filters object
- `filtersToURLParams(filters)` — inverse of above; round-trip identity
- `mergeFilters(a, b)` — priority/override behavior
- `extractFilterOptions(products)` — correct unique option extraction
- Edge cases: empty inputs, special characters in filter values

### `src/lib/square/slugUtils.ts`
- `createSlug(name)` — lowercases, removes non-slug chars, truncates to 50
- `extractIdFromSlug(slug)` — extracts the trailing ID segment
- `createSlugMapping(products)` — builds slug→id map
- `createSEOTitle(product)` — formatting with brand/category
- Edge cases: empty strings, names with only special chars, very long names

### `src/lib/shopHours.ts` (or `src/lib/square/shopHours.ts` — verify path)
- `formatHoursRange(open, close)` — "10:00 AM – 6:00 PM" formatting
- `formatHoursForEmail(hoursData)` — groups consecutive same-hours days
- Edge cases: midnight, noon, closed days, all-day closed

### `src/lib/square/productUtils.ts`
- `extractIsGiftCard(item)` — returns true for gift card string attribute
- `extractBrandValue(item)` — extracts brand from custom attributes

### `src/lib/requestDeduplication.ts`
- `deduplicateRequest(key, fn)` — concurrent calls with same key share one promise
- Sequential calls each run their own function
- Error in first caller propagates to all concurrent waiters

### `src/lib/errorUtils.ts` and `src/lib/square/serverErrorUtils.ts`
- `classifyError(error)` or equivalent — error type classification
- `processSquareError(error, context)` — Square error → AppError mapping
- Direct calls, not via mocks

## Commands you will need

| Purpose          | Command                | Expected on success        |
|------------------|------------------------|----------------------------|
| Run tests        | `pnpm test:run`        | all pass                   |
| Coverage         | `pnpm test:coverage`   | thresholds pass            |
| Typecheck        | `pnpm check`           | exit 0                     |

## Existing test pattern to follow

Look at `src/lib/square/__tests__/inventory.test.ts` and
`src/lib/cart/__tests__/cart.test.ts` for file structure and import patterns.
Tests live in `__tests__/` subdirectories adjacent to the source, use vitest
(`describe`, `it`, `expect`), and import directly from relative paths.

## Scope

**In scope**: the seven test files listed below (new files only):
- `src/lib/square/__tests__/filterUtils.test.ts`
- `src/lib/square/__tests__/slugUtils.test.ts`
- `src/lib/__tests__/shopHours.test.ts` (adjust path to match where `shopHours.ts` lives)
- `src/lib/square/__tests__/productUtils.test.ts` (extending any existing file)
- `src/lib/__tests__/requestDeduplication.test.ts`
- `src/lib/__tests__/errorUtils.test.ts`
- `src/lib/square/__tests__/serverErrorUtils.test.ts`

**Out of scope**:
- Any source file modification
- Route handler tests (covered in plan 070)

## Git workflow

- Branch: `advisor/069-test-pure-utility-libs`
- Commit message: `test: add unit tests for filterUtils, slugUtils, shopHours, productUtils, deduplication, and error utils`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Read each target file

Before writing tests, read each source file in full to understand its API:

```bash
cat src/lib/square/filterUtils.ts
cat src/lib/square/slugUtils.ts
cat src/lib/square/productUtils.ts
cat src/lib/requestDeduplication.ts
cat src/lib/errorUtils.ts
cat src/lib/square/serverErrorUtils.ts
```

Also find shopHours.ts:
```bash
find src -name "shopHours.ts"
```

### Step 2: Read an existing test file for structure

```bash
cat src/lib/square/__tests__/inventory.test.ts
```

Match its import style, `describe`/`it` nesting, and assertion patterns.

### Step 3: Write tests for each module

Write one test file per module following the existing pattern. Each test file
should have:

- At least one `describe` block per exported function
- At least 3 `it` cases per function (happy path, edge case, error/empty case)
- No mocks for pure functions — call the real function

Example skeleton for `slugUtils.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createSlug, extractIdFromSlug, createSlugMapping } from "../slugUtils";

describe("createSlug", () => {
  it("lowercases and hyphenates", () => {
    expect(createSlug("Hello World")).toBe("hello-world");
  });
  it("removes non-slug characters", () => {
    expect(createSlug("Café & Bar!")).toBe("caf-bar");
  });
  it("truncates to 50 characters", () => {
    const long = "a".repeat(60);
    expect(createSlug(long).length).toBeLessThanOrEqual(50);
  });
});
```

For `requestDeduplication.ts`, test concurrency using `Promise.all` with a
spy on the inner function to confirm it's only called once for concurrent keys.

### Step 4: Run tests

```bash
pnpm test:run
```

Expected: all new tests pass with zero failures.

### Step 5: Check coverage

```bash
pnpm test:coverage
```

Expected: no threshold failures. If a file is still below its threshold after
adding tests, add more cases targeting the uncovered branches.

### Step 6: Typecheck

```bash
pnpm check
```

Expected: exit 0.

## Done criteria

- [ ] `pnpm test:run` exits 0, all new tests pass
- [ ] `pnpm test:coverage` exits 0, thresholds pass
- [ ] `pnpm check` exits 0
- [ ] At least 3 `it` blocks per exported function in each test file
- [ ] No source files modified
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

- A "pure" function turns out to depend on Netlify Blobs, `import.meta.env`,
  or other SSR globals — it cannot be tested without mocking; note the
  dependency and skip that function, leaving a `it.todo(...)` placeholder.
- `pnpm test:coverage` reports a per-file threshold failure for a file not in
  scope — do not fix it; report it.
