# Plan 054: Narrow `as any` casts in Square custom-attribute layer and Astro transition types

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 9b5556b..HEAD -- src/lib/square/productUtils.ts src/lib/square/client.ts src/lib/square/categories.ts src/lib/square/pricing.ts src/lib/filterCoordinator.ts`
> If any changes appear, compare before proceeding.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: LOW
- **Depends on**: 050 (soft — plan 050 moves some of these functions to catalogUtils.ts; if 050 has landed, check both files)
- **Category**: tech-debt
- **Planned at**: commit `9b5556b`, 2026-07-22

## Why this matters

~25 `as any` casts are concentrated in the Square custom-attribute accessors
(`customAttributeValues`) and cursor pagination. Every cast is a location where
TypeScript stops checking. A Square SDK update that renames a field would compile
successfully but fail at runtime. The casts also defeat IDE autocomplete.

Two patterns account for most casts:
1. `customAttributeValues` on Square `CatalogObject` is untyped in the SDK —
   writing local interfaces narrows all casts in one place.
2. The pagination cursor lives on the raw response object, not the typed result
   — narrowing to `as { cursor?: string }` is safer than `as any`.

Additionally, `filterCoordinator.ts` casts Astro transition events to `any`
to access `.to` — Astro exports the correct types in `astro:transitions/client`.

## Current state

Run this grep to get the full list before starting:
```bash
grep -rn "as any" src/lib/square/ src/lib/filterCoordinator.ts
```

Key patterns to fix:

**Custom attribute access** (in `productUtils.ts`, `client.ts`, after plan 050
possibly in `catalogUtils.ts`):
```typescript
const attrs = item.customAttributeValues as any;
// or
(item.customAttributeValues as any)[key]
```

**Cursor pagination** (in `client.ts` and `categories.ts`):
```typescript
cursor = (response as any).cursor;
// or
const nextCursor = (result as any).body?.cursor;
```

**Astro transition events** (`src/lib/filterCoordinator.ts:259,274`):
```typescript
const nextUrl = (e as any).to?.toString() ?? "";
```

## Commands you will need

| Purpose   | Command              | Expected on success       |
|-----------|----------------------|---------------------------|
| Typecheck | `pnpm check`         | exit 0, no errors         |
| Unit tests | `pnpm test:run`     | all pass                  |

## Scope

**In scope**:
- `src/lib/square/productUtils.ts`
- `src/lib/square/client.ts` (or `catalogUtils.ts` if plan 050 has landed)
- `src/lib/square/categories.ts`
- `src/lib/square/pricing.ts`
- `src/lib/filterCoordinator.ts`
- `src/lib/square/types.ts` (or wherever project types live) — add new interfaces here

**Out of scope**:
- `src/components/` — client-side `as any` casts are separate concerns
- Any cast that touches Square checkout/payment endpoints (different type shapes)

## Git workflow

- Branch: `advisor/054-narrow-as-any-casts`
- Commit message: `fix: add typed interfaces for Square custom attributes, narrow as-any casts`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Generate the complete as-any work list

```bash
grep -rn "as any" src/lib/square/ src/lib/filterCoordinator.ts
```

Record every file:line. Work through them in the order below.

### Step 2: Add Square custom-attribute types to types.ts

Open `src/lib/square/types.ts` (create it if it doesn't exist; if types are
elsewhere, add there). Add:

```typescript
export interface SquareCatalogCustomAttributeValue {
  type?: "STRING" | "NUMBER" | "BOOLEAN";
  stringValue?: string;
  numberValue?: string;
  booleanValue?: boolean;
  name?: string;
  key?: string;
}

export type SquareCatalogCustomAttributes = Record<string, SquareCatalogCustomAttributeValue>;
```

**Verify**: `grep -n "SquareCatalogCustomAttributes" src/lib/square/types.ts` → appears.

### Step 3: Replace customAttributeValues casts

For each `as any` cast on `customAttributeValues` (found in Step 1):

```typescript
// Before:
const attrs = (item.customAttributeValues as any);

// After:
import type { SquareCatalogCustomAttributes } from "./types";
const attrs = (item.customAttributeValues as unknown as SquareCatalogCustomAttributes) ?? {};
```

The `as unknown as T` double-cast is the correct TypeScript pattern when casting
from a type that TypeScript knows nothing about to a known interface.

**Verify**: `grep -rn "customAttributeValues as any" src/lib/square/` → no matches.

### Step 4: Narrow pagination cursor casts

For each cursor cast (e.g. `(response as any).cursor`), replace with:

```typescript
const cursor = (response as unknown as { cursor?: string }).cursor;
```

If the response type already has `cursor` on a nested property (e.g.
`response.result?.cursor`), remove the cast entirely and use the typed path.
Read the response type from the Square SDK to determine the correct path.

**Verify**: `grep -rn "response as any\|result as any" src/lib/square/` → no matches (or only non-cursor contexts).

### Step 5: Fix Astro transition event types in filterCoordinator.ts

Open `src/lib/filterCoordinator.ts`. At the top, add:

```typescript
import type { TransitionBeforeSwapEvent, TransitionBeforePreparationEvent } from "astro:transitions/client";
```

Replace each `(e as any).to` cast:
- In the `astro:before-swap` listener: `(e as TransitionBeforeSwapEvent).to`
- In the `astro:before-preparation` listener: `(e as TransitionBeforePreparationEvent).to`

**Verify**: `grep -n "as any" src/lib/filterCoordinator.ts` → no matches.

### Step 6: Typecheck

```bash
pnpm check
```
Expected: exit 0. If a new type error appears where a cast was replaced, the
inferred type at that location is more specific than `any` — narrow it correctly
rather than re-casting to `any`.

```bash
pnpm test:run
```
Expected: all pass.

## Done criteria

- [ ] `pnpm check` exits 0
- [ ] `pnpm test:run` exits 0
- [ ] `grep -rn "customAttributeValues as any" src/lib/square/` → no matches
- [ ] `grep -n "as any" src/lib/filterCoordinator.ts` → no matches
- [ ] `SquareCatalogCustomAttributes` exported from `src/lib/square/types.ts`
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

- `astro:transitions/client` is not a valid module path in this project's
  TypeScript config — run `grep -rn "transitions/client" node_modules/astro/` to
  find the correct import path and use that instead.
- Replacing a cast reveals a genuine type error that indicates real logic is wrong —
  stop and report the finding.
- The total `as any` count after all replacements is still >5 — some casts may
  require deeper Square SDK type research; document remaining ones and stop.

## Maintenance notes

- New Square API accessors should use `SquareCatalogCustomAttributes` from the start.
- The `as unknown as T` pattern is correct for third-party SDK gaps; do not use
  `as any` to work around TypeScript's type system.
