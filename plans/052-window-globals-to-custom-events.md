# Plan 052: Replace window global bus with CustomEvents for cross-component communication

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 9b5556b..HEAD -- src/components/Notification.astro src/components/Modal.astro src/components/QuickView.astro`
> If any changes appear, compare the "Current state" excerpts before proceeding.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `9b5556b`, 2026-07-22

## Why this matters

The storefront uses 11+ `window.*` globals as an inter-component event bus
(`window.showNotification`, `window.showPolicyModal`, `window.showLocationModal`,
`window.showSecureCheckoutModal`, `window.openQuickView`, etc.). These globals
are untyped (all calls go through `(window as any).X()`), order-sensitive
across Astro's view-transition lifecycle (a call to `window.X` before the
assigning component renders silently no-ops), and prevent TypeScript from
checking the interfaces.

CustomEvents dispatched on `document` solve all three: they're queued until a
listener is registered, they're typed, and they decouple sender from receiver
without execution-order dependencies.

**Scope of this plan**: migrate the four most-used cross-component globals:
`showNotification`, `showPolicyModal`, `showLocationModal`, `showSecureCheckoutModal`.
Leave `openQuickView` and low-usage one-offs (`copyURL`, `reinitializeGalleries`)
for a separate pass once this pattern is established.

## Current state

**`src/components/Notification.astro`** (around line 99):
```typescript
window.showNotification = function(message: string, type: "success" | "error") { ... };
```

**`src/components/Modal.astro`** (around lines 443–445):
```typescript
window.showPolicyModal = function(slug: string) { ... };
window.showLocationModal = function() { ... };
window.showSecureCheckoutModal = function() { ... };
```

Call sites (grep to find all):
```bash
grep -rn "window\.showNotification\|window\.showPolicyModal\|window\.showLocationModal\|window\.showSecureCheckoutModal" src/
```

## Commands you will need

| Purpose   | Command              | Expected on success       |
|-----------|----------------------|---------------------------|
| Typecheck | `pnpm check`         | exit 0, no errors         |
| Unit tests | `pnpm test:run`     | all pass                  |

## Scope

**In scope**:
- `src/components/Notification.astro`
- `src/components/Modal.astro`
- All files that call any of the four globals above (found via grep in Step 1)

**Out of scope**:
- `window.openQuickView` — defer to a follow-up
- `window.copyURL`, `window.reinitializeGalleries`, `window.squareLoaded`,
  `window.loadSquareScript`, `window.newsFilterOptions`, `window.newsData` — defer
- `window.elco_expandFulfillmentForm` — defer

## Git workflow

- Branch: `advisor/052-window-globals-to-custom-events`
- Commit message: `refactor: replace window global bus with CustomEvents for notification and modal triggers`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Map all call sites for the four globals

```bash
grep -rn "window\.showNotification\|window\.showPolicyModal\|window\.showLocationModal\|window\.showSecureCheckoutModal" src/
```

Record every file and line. Each is a call site to update.

### Step 2: Define the event names as constants

Create or add to a shared `src/lib/events.ts` file (create if it doesn't exist):

```typescript
// Cross-component CustomEvent names — use these constants at all dispatch and listen sites.
export const EVENTS = {
  SHOW_NOTIFICATION: "elco:show-notification",
  SHOW_POLICY_MODAL: "elco:show-policy-modal",
  SHOW_LOCATION_MODAL: "elco:show-location-modal",
  SHOW_SECURE_CHECKOUT_MODAL: "elco:show-secure-checkout-modal",
} as const;

// Payload types
export interface ShowNotificationDetail { message: string; type: "success" | "error"; }
export interface ShowPolicyModalDetail { slug: string; }
// showLocationModal and showSecureCheckoutModal have no payload
```

**Verify**: `grep -n "EVENTS\|ShowNotificationDetail" src/lib/events.ts` → both appear.

### Step 3: Update Notification.astro — replace assignment with listener

In `src/components/Notification.astro`, replace:
```typescript
window.showNotification = function(message, type) { /* show logic */ };
```
with:
```typescript
document.addEventListener("elco:show-notification", (e: Event) => {
  const { message, type } = (e as CustomEvent<ShowNotificationDetail>).detail;
  // existing show logic using message and type
});
```

Remove the `window.showNotification` assignment entirely.

**Verify**: `grep -n "window\.showNotification" src/components/Notification.astro` → no match.

### Step 4: Update Modal.astro — replace assignments with listeners

Same pattern for the three modal globals in `src/components/Modal.astro`:

```typescript
document.addEventListener("elco:show-policy-modal", (e: Event) => {
  const { slug } = (e as CustomEvent<ShowPolicyModalDetail>).detail;
  // existing showPolicyModal logic
});
document.addEventListener("elco:show-location-modal", () => { /* existing logic */ });
document.addEventListener("elco:show-secure-checkout-modal", () => { /* existing logic */ });
```

Remove all three `window.showXModal` assignments.

**Verify**: `grep -n "window\.showPolicyModal\|window\.showLocationModal\|window\.showSecureCheckoutModal" src/components/Modal.astro` → no matches.

### Step 5: Update all call sites

For each call site found in Step 1, replace the `window.X(args)` call with a
`document.dispatchEvent(new CustomEvent(...))` call:

```typescript
// Before:
if (typeof window.showNotification === "function") {
  window.showNotification("Order placed!", "success");
}

// After:
document.dispatchEvent(new CustomEvent("elco:show-notification", {
  detail: { message: "Order placed!", type: "success" }
}));
```

The `typeof window.X === "function"` guard is no longer needed (CustomEvents
dispatch regardless of listener registration).

**Verify**: `grep -rn "window\.showNotification\|window\.showPolicyModal\|window\.showLocationModal\|window\.showSecureCheckoutModal" src/` → no matches.

### Step 6: Typecheck and test

```bash
pnpm check
```
Expected: exit 0, no errors.

```bash
pnpm test:run
```
Expected: all pass.

## Done criteria

- [ ] `pnpm check` exits 0
- [ ] `pnpm test:run` exits 0
- [ ] `grep -rn "window\.showNotification\|window\.showPolicyModal\|window\.showLocationModal\|window\.showSecureCheckoutModal" src/` → no matches
- [ ] `src/lib/events.ts` exists with `EVENTS` constants
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

- A call site is in an inline `<script>` that does not have access to the
  `src/lib/events.ts` import path (Astro `<script>` tags in components can
  import from `@/lib/` — this should work; if it doesn't, inline the string
  constant directly).
- `pnpm check` errors on the `CustomEvent<T>` generic — confirm `lib.dom.d.ts`
  is included in `tsconfig.json`.

## Maintenance notes

- The four remaining high-frequency globals (`openQuickView`, etc.) should
  follow the same pattern in a subsequent plan once this one is validated.
- All new cross-component signals must use `EVENTS` constants from `src/lib/events.ts`
  — no new `window.*` assignments.
- The `detail` payload is transmitted by value (structured clone). Do not put
  non-cloneable objects (DOM nodes, functions) in it.
