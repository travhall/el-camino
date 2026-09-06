# Plan 186: Upgrade `@netlify/blobs` 10 → 11

> **Executor instructions**: Follow step by step. Run every verification command.
> If anything in "STOP conditions" occurs, stop and report. When done, update
> this plan's status row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat ad2999d..HEAD -- package.json pnpm-lock.yaml src/lib/cache/blobCache.ts`
> On any change, re-check the installed version before proceeding.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: MED
- **Depends on**: 166 (soft — land 166 first if both are queued)
- **Category**: migration
- **Planned at**: commit `ad2999d`, 2026-09-05

## Why this matters

`package.json:43` pins `"@netlify/blobs": "^10.7.9"`; the current release is
**11.0.3** — a full major behind.

Every piece of mutable state the shop owns flows through this one client:
pending orders awaiting webhook confirmation, failed-email retry records,
admin-managed hours / contact / banner / social settings, back-in-stock signups,
and the catalog cache. **14 files** import `getStore`.

Staying a major behind on the storage client for an SSR-only storefront means
eventual incompatibility with the Netlify runtime, and blob-layer bugs land
directly on order-confirmation email delivery.

It may also close the `@opentelemetry/core` advisory for free
(`@netlify/blobs > @netlify/otel > @opentelemetry/core`) — though **plan 164**
already closes that cheaply via an override, so that is a bonus, not the reason.

## Current state

`package.json:43`:

```json
    "@netlify/blobs": "^10.7.9",
```

14 files import `getStore` (`grep -rln "getStore" src/ | wc -l` → 14),
including:

- `src/lib/cache/blobCache.ts` — the shared cache layer
- `src/lib/contactInfo.ts`, `socialLinks.ts`, `shopHours.ts`,
  `announcementBanner.ts`, `shopStatus.ts`, `pageVisibility.ts` — admin config
- `src/lib/backInStock.ts` — customer subscriptions
- `src/lib/email/pendingOrders.ts`, `failedEmails.ts` — **order-critical**

The import surface is uniform (`getStore` only), which is what makes this
tractable. But `src/lib/cache/__tests__/blobCache.test.ts:16` **mocks the module
shape**, so the mock must track any API change — and a mock that silently no
longer matches the real API is the dangerous failure here, because tests keep
passing while production breaks.

## Commands you will need

| Purpose   | Command                     | Expected             |
|-----------|-----------------------------|----------------------|
| Install   | `pnpm install`              | exit 0               |
| Typecheck | `pnpm check`                | exit 0               |
| Tests     | `pnpm test:run`             | exit 0               |
| Coverage  | `pnpm test:coverage`        | exit 0, no regression|
| Lint      | `pnpm lint`                 | exit 0               |
| Build     | `pnpm build`                | exit 0               |
| Audit     | `pnpm audit`                | see Steps            |

Never use `pnpm test` — watch mode, it hangs.

## Scope

**In scope**:
- `package.json`, `pnpm-lock.yaml`
- The 14 `getStore` call sites — **only** as required by API changes
- `src/lib/cache/__tests__/blobCache.test.ts` — the module mock

**Out of scope** (do NOT touch):
- Cache semantics, TTLs, or the two-tier design — **plan 166**.
- The `consistency: "strong"` choices — plan 187.
- Any behavior change. This is a version migration: same behavior, new client.
- The `@opentelemetry/core` override from plan 164. Leave it; remove it only
  after confirming this upgrade closes the advisory.

## Git workflow

- Branch: `advisor/186-upgrade-netlify-blobs`
- Conventional commits, e.g. `chore(deps): upgrade @netlify/blobs to v11`
- Do NOT push or open a PR unless the operator instructs it.

## Steps

### Step 1: Read the v11 changelog before touching anything

Find the migration notes for `@netlify/blobs` 10 → 11 and write down **every**
breaking change: `getStore` signature, `get`/`set`/`setJSON`/`delete`/`list`
semantics, the consistency options, metadata handling, and error shapes.

**Verify**: the breaking-change list recorded in `plans/README.md`. If you cannot
find a changelog, **STOP** — upgrading the storage client for order data on
guesswork is not acceptable.

### Step 2: Inventory the API surface actually used

```bash
grep -rn "getStore\|\.setJSON\|\.getJSON\|\.set(\|\.get(\|\.delete(\|\.list(" src/lib/ | grep -v __tests__
```

**Verify**: a list of every method used, with call sites. Cross-reference against
Step 1's breaking changes to get the real blast radius — it may be much smaller
than 14 files.

### Step 3: Upgrade and typecheck

```bash
pnpm add @netlify/blobs@^11
pnpm check
```

**Verify**: `pnpm check` → exit 0. Type errors here are the *good* case — they
show you exactly what changed. Fix each minimally, without changing behavior.

### Step 4: Update the test mock to match the real v11 shape

`blobCache.test.ts:16` mocks the module. Update the mock so it matches v11's
actual API.

**This is the highest-risk step.** A mock that no longer matches reality lets the
suite pass while production is broken. Read the real v11 types and mirror them —
do not just make the tests green.

**Verify**: `pnpm test:run` → exit 0.

### Step 5: Verify the advisory status

```bash
pnpm audit 2>&1 | tail -5
```

**Verify**: record whether `@opentelemetry/core` is now clean. If it is, note
that plan 164's override for it can be removed — but **do not remove it in this
plan**.

### Step 6: Smoke-test the real paths on a deploy preview

Unit tests use mocks, so they cannot prove the client works. On a preview:

1. **Admin write**: change shop hours in the admin panel; confirm it persists and
   renders on the storefront.
2. **Pending-order round trip**: complete a sandbox checkout; confirm the pending
   order is stored and read back on the confirmation page.
3. **Cache round trip**: load a category page twice; confirm the second is a
   cache hit.
4. **Back-in-stock**: submit a subscription; confirm it appears in admin.

**Verify**: all four confirmed. Record the preview URL. This is the plan's
primary evidence — items 1 and 2 are the ones that cost real money if broken.

### Step 7: Full gate

```bash
pnpm check && pnpm lint && pnpm test:run && pnpm test:coverage && pnpm build
```
→ all exit 0.

## Test plan

- No new behavioral tests — behavior must be unchanged.
- The mock update in Step 4 is the critical test work. After updating it, verify
  the existing `blobCache` tests still assert meaningful things and did not
  become vacuous.
- Real verification is Step 6's deploy-preview smoke test.
- `pnpm test:coverage` → exit 0, no threshold regression.

## Done criteria

- [ ] Step 1's breaking-change list recorded in `plans/README.md`
- [ ] Step 2's used-API inventory recorded
- [ ] `package.json` shows `@netlify/blobs` v11; lockfile updated
- [ ] `pnpm check` exits 0 with no `any` casts added to silence type errors
- [ ] `blobCache.test.ts`'s mock matches the real v11 API
- [ ] All four Step 6 smoke tests pass on a deploy preview; URL recorded
- [ ] `pnpm audit` advisory status for `@opentelemetry/core` recorded
- [ ] No cache semantics or TTLs changed (`git diff` review)
- [ ] `pnpm check` / `pnpm lint` / `pnpm test:run` / `pnpm build` all exit 0

## STOP conditions

Stop and report if:

- **No v11 changelog or migration guide can be found.**
- **You cannot produce a deploy preview.** Netlify Blobs behaves differently
  locally; shipping this on unit tests alone risks silent data loss on the
  pending-order path.
- A breaking change alters read/write **semantics** (consistency defaults,
  metadata, key encoding) rather than just signatures. That could corrupt or
  orphan existing stored data — report before proceeding.
- You find yourself adding `as any` to get past a type error. That is exactly the
  signal a real API change is being papered over.
- Step 6's pending-order round trip fails. Stop immediately — that path carries
  real orders.

## Maintenance notes

- **The data-safety question to always ask**: does existing stored data still
  read correctly under the new client? Keys and metadata written by v10 must
  remain readable by v11. Step 6's smoke tests exercise pre-existing data, which
  is why they use the admin panel rather than fresh keys.
- Plan 166 changes the write/invalidation semantics in this same file. Landing
  166 first means this upgrade validates against the intended final behavior;
  landing this first means 166 rebases onto a new client. Either order works, but
  do not run them in parallel.
- Once this lands and the advisory is confirmed clean, plan 164's
  `@opentelemetry/core` override becomes removable.
- A reviewer should confirm no `any` casts were added and no TTL or consistency
  option changed.
