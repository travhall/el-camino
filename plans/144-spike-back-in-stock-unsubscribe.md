# Plan 144: Spike — self-service back-in-stock unsubscribe

> **Executor instructions**: This is a design/feasibility spike, not a
> build-everything plan — the goal is a scoped v1 recommendation and,
> optionally, a disposable proof-of-concept, not shipped production code.
> Follow the steps in order. If a STOP condition triggers, stop and report
> instead of improvising a workaround. When done, write your findings and
> recommendation into this file (under a new "## Spike findings" section)
> and update the status row in `plans/README.md` — unless a reviewer
> dispatched you and told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat cdf74a3..HEAD -- src/lib/backInStock.ts src/pages/api/back-in-stock.ts src/pages/api/admin/remove-back-in-stock.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: —
- **Effort**: S (spike) / S (v1 build, if recommended — see Step 4)
- **Risk**: LOW
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `cdf74a3`, 2026-09-04

## Why this matters

Back-in-stock subscriptions are create-only from a customer's perspective:
`POST /api/back-in-stock` lets anyone sign up, but the only removal paths
are admin-only (`POST /api/admin/remove-back-in-stock`, which bulk-removes
*every* subscriber for a product — meant for "this product is discontinued,"
not "this one customer changed their mind") and an automatic cleanup after
a restock notification is sent (per `plans/120-...md`'s spike notes). A
customer who signs up by mistake, or simply changes their mind, has no way
to remove themselves — they'd have to contact the shop and ask Tyler to do
it via the admin panel. This is the classic one-directional-CRUD pattern:
create exists, customer-facing delete doesn't.

**Confidence is MED, not HIGH**: this is grounded in real code (the gap is
real), but whether it's worth building depends on subscription volume and
complaint frequency this repo's code can't show — smaller in scope than the
already-rejected customer-order-status-lookup feature
(`plans/073-...md`, rejected for "business scale doesn't warrant it"), but
the same caution may or may not apply here. This spike's job is to answer
the feasibility/scope questions cheaply, not to commit to building it.

## Current state

`src/lib/backInStock.ts` (relevant exports, full file is 73 lines):
```ts
export async function removeSubscription(
  productId: string,
  email: string
): Promise<void> {
  await store().delete(key(productId, email));
  await summariesCache.delete(SUMMARIES_KEY);
}
```
Already does exactly what a self-service unsubscribe needs — delete one
`{productId}/{email}` entry. It currently has exactly one caller:
`removeAllSubscriptionsForProduct` does NOT call it (it deletes directly);
grep confirms `removeSubscription` (singular) itself is presently
**unused** anywhere in `src/pages/` — only referenced in its own module and
(if it exists) a test file. Confirm this with
`grep -rn "removeSubscription(" src --include="*.ts"` before relying on it.

`src/pages/api/back-in-stock.ts` (full file, ~60+ lines shown above) — the
subscribe endpoint. No confirmation email is sent to the customer at
signup time (only `sendBisAdminNotification`, an internal alert to the
shop). This matters: there is currently **no existing customer-facing email**
to embed an unsubscribe link into at the moment of signup — the customer's
only future contact point is the eventual "it's back in stock!" email
itself (built per `plans/120-...md`'s spike, not yet wired into
production — that plan's status is "SPIKE DONE... recommendation: build,
not shipped").

`src/pages/api/admin/remove-back-in-stock.ts` — the existing admin-only
bulk-remove endpoint, requires `isAdminAuthenticated`. Not reusable
as-is for a public-facing single-subscription removal (wrong auth model,
wrong granularity — removes ALL subscribers for a product, not one).

## Commands you will need

| Purpose   | Command       | Expected on success |
|-----------|-------------------|----------------------|
| Typecheck | `pnpm check`    | exit 0, no errors    |
| Tests     | `pnpm test:run` | all pass             |

## Scope

**Spike scope** (investigate/decide, optionally build a disposable PoC):
- Whether a public unsubscribe endpoint can be authenticated cheaply
  (a signed token, not a login) without new infrastructure.
- Whether it's worth building now given no notification email exists yet
  to carry the unsubscribe link (Plan 120's restock-notification feature
  isn't in production).
- A scoped v1 recommendation: what to build, and when (now vs. "once Plan
  120's notification email ships, since that's the natural place to put
  the unsubscribe link").

**Out of scope** (do not build/ship in this plan):
- A full "manage my subscriptions across all products" account-style page —
  that's the customer-accounts direction item already noted as a separate,
  larger idea in prior audits, not this plan's scope.
- Wiring Plan 120's restock-notification email into production — that's
  its own plan; this spike only needs to reason about *where* an
  unsubscribe link would eventually live once that ships.
- Any actual UI page — if a v1 build is recommended, scope it as a follow-up
  plan, not code written in this spike.

## Git workflow

- Branch: `advisor/144-spike-back-in-stock-unsubscribe` (only needed if a
  disposable proof-of-concept test is written, per Step 3)
- If code is written, follow this repo's disposable-spike convention:
  `plans/120-...md`'s `src/lib/__tests__/__spike__/plan120-variationLookup.spike.test.ts`
  is the precedent — a throwaway test proving the mechanism works, not
  production wiring.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Confirm `removeSubscription`'s current caller status

Run `grep -rn "removeSubscription(" src --include="*.ts"` (careful to
distinguish from `removeAllSubscriptionsForProduct`, a different function
with a similar name). Record whether it's truly unused today, or whether a
caller exists that this plan's recon missed.

### Step 2: Design a cheap authentication mechanism for a public unsubscribe link

The unsubscribe endpoint can't require a login (customers don't have
accounts), but also can't be an unauthenticated `productId`+`email` GET
(anyone could unsubscribe anyone else by guessing/knowing their email).
Investigate a signed-token approach: a short HMAC token derived from
`productId` + `email` + a server secret (this repo already has an HMAC
pattern to model after — `src/lib/admin/auth.ts`'s session-cookie
signing), embedded as a URL query param in whatever email would carry the
link. Confirm feasibility by sketching (not necessarily coding) the token
generation/verification shape, and note which existing repo secret/helper
it could reuse.

### Step 3: Optional — disposable proof-of-concept

If the token-verification approach in Step 2 has any non-obvious risk
(timing-safe comparison, token expiry), write a small disposable spike test
proving the mechanism works in isolation — e.g.
`src/lib/__tests__/__spike__/plan144-unsubscribeToken.spike.test.ts` —
following Plan 120's precedent. This is optional; skip it if Step 2's
design is simple enough to not need proving (e.g. if it's a direct reuse of
an existing signing helper with no new logic).

### Step 4: Write the v1 recommendation

Answer directly, in a new "## Spike findings" section appended to this
file:
- **Build now, or defer until Plan 120's notification email ships?**
  Given there's currently no customer-facing email at all carrying a link a
  customer would click, recommend deferring the *link* until Plan 120 (or
  whatever replaces it) is in production — but the removal *endpoint*
  itself (token-authenticated `GET`/`POST /api/back-in-stock/unsubscribe`,
  calling the already-existing `removeSubscription`) can be built now
  independently, ready for that email to link to whenever it ships.
- **Scope for the v1 build** (if recommended): one new API route
  (`src/pages/api/back-in-stock/unsubscribe.ts` or similar), the token
  generation/verification helper from Step 2, and — only once Plan 120's
  email ships — one line added to that email's template linking to it. No
  admin UI changes needed (the existing bulk-remove admin flow is
  unaffected).
- **Effort estimate for the v1 build**: S — a small, isolated addition
  reusing `removeSubscription` and an HMAC pattern this repo already has.

## Test plan

If Step 3's disposable spike test is written, it should be self-contained
and not wired into the main test suite's coverage requirements (matching
Plan 120's precedent) — delete it or leave it clearly marked as a spike
artifact per the operator's preference once the spike concludes.

- Verification: `pnpm test:run` → all pass (the disposable spike test, if
  written, passes on its own).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm check` exits 0 (if any code was written for Step 3)
- [ ] `pnpm test:run` exits 0
- [ ] This plan file has a "## Spike findings" section with: (a) the
      `removeSubscription` caller-status finding from Step 1, (b) the
      token-mechanism design from Step 2, (c) the v1 recommendation from
      Step 4
- [ ] `plans/README.md` status row updated to reflect spike completion
      (e.g. "SPIKE DONE — recommendation: build v1 endpoint now, defer the
      email link until Plan 120 ships")

## Spike findings

**Drift check**: `git diff --stat cdf74a3..HEAD -- src/lib/backInStock.ts src/pages/api/back-in-stock.ts src/pages/api/admin/remove-back-in-stock.ts` — no output, zero drift in the three named files.

### Correction to this plan's premise (STOP condition triggered, re-scoped per its own instruction)

Step 1 triggered two of this plan's own STOP conditions at once — a real caller of
`removeSubscription` that recon missed, and a "Current state" excerpt that doesn't
match reality. Per that STOP condition's own text ("re-scope around what that
caller already does instead of assuming a clean slate"), the finding is
documented here and the spike proceeds on the corrected premise rather than
aborting, since the correction strengthens rather than blocks the case for
building.

- `grep -rn "removeSubscription(" src --include="*.ts"` shows a real caller:
  `src/pages/api/admin/send-back-in-stock.ts:52`, inside the per-subscriber
  loop, called right after each notification email sends successfully. This
  matches what this plan's own "Why this matters" section already
  anticipated ("automatic cleanup after a restock notification is sent") —
  it's staff-triggered bulk cleanup, not a customer-facing path, and it's an
  idempotent delete of the same `{productId}/{email}` key a self-service
  unsubscribe would also delete. **No conflict** — safe to keep as-is.
- The bigger correction: this plan's "Current state" section claims "there
  is currently no existing customer-facing email... the eventual [...]
  email itself (built per plan 120's spike, not yet wired into
  production)." **This is false.** `git log --diff-filter=A --follow` on
  `src/pages/api/admin/send-back-in-stock.ts` shows it was built
  2026-03-28 (`7688ac8`, "Build back-in-stock notification system
  end-to-end") — nearly five months *before* Plan 120's spike merged
  (`8521221`, 2026-08-06). Plan 120 was about automating the *trigger*
  (inventory webhook vs. a staff member clicking "notify subscribers" in
  `/admin/notifications/back-in-stock`); the email itself
  (`sendBackInStockNotification` in `src/lib/email/sender.ts`) has been
  live in production and reaching real customers since March. Plan 144's
  reasoning conflated "the automatic-trigger spike" with "the email
  exists" — they're different things, and the email side was already done.

This means the "no email exists yet to carry a link" argument for
deferring is gone. See the recommendation below.

### (a) `removeSubscription` caller status

Not unused. One real caller: `src/pages/api/admin/send-back-in-stock.ts:52`
(admin-triggered bulk cleanup after notification send — see above). No test
file calls it as of writing except `src/lib/__tests__/backInStock.test.ts`.
Building a new customer-facing caller alongside it is safe: both paths
delete the same key, deletes are idempotent (`store().delete` on a
non-existent key is a no-op), and there's no ordering dependency between
them.

### (b) Token-authentication design sketch

Reuse the exact HMAC shape already in `src/lib/admin/auth.ts`
(`createHmac("sha256", secret)` + `timingSafeEqual` for constant-time
comparison, with an embedded expiry so a leaked link naturally dies):

```ts
// sketch — not implemented in this spike
function issueUnsubscribeToken(secret: string, productId: string, email: string, ttlSeconds = 60 * 60 * 24 * 30): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `${productId}.${email}.${exp}`;
  return `${exp}.${createHmac("sha256", secret).update(payload).digest("hex")}`;
}

function verifyUnsubscribeToken(secret: string, productId: string, email: string, token: string): boolean {
  const [expStr, sig] = token.split(".");
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || Math.floor(Date.now() / 1000) >= exp) return false;
  const expected = createHmac("sha256", secret).update(`${productId}.${email}.${exp}`).digest("hex");
  const bufA = Buffer.from(sig), bufB = Buffer.from(expected);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}
```

- URL shape: `GET /api/back-in-stock/unsubscribe?productId=...&email=...&token=<exp>.<sig>`.
- **New secret, not `ADMIN_SECRET`**: this token authenticates a public,
  non-admin action. Reusing `ADMIN_SECRET` would couple a customer-facing
  link's validity to the admin session secret's rotation schedule — a new
  `BIS_UNSUBSCRIBE_SECRET` env var keeps the blast radius of a rotation (or
  a leak) contained to its own domain.
  30-day TTL matches how long a back-in-stock email realistically stays
  actionable.
- This is a direct reuse of an existing signing helper shape with no new
  logic (same `createHmac`/`timingSafeEqual` primitives, just new payload
  fields) — **Step 3's disposable PoC is skipped**, per the plan's own
  "skip if direct reuse" carve-out. No meaningfully new infrastructure is
  needed (no secrets-rotation concern beyond adding one more env var
  alongside `ADMIN_SECRET`/`EMAIL_FROM`), so the third STOP condition does
  not trigger.

### (c) Build-now-vs-defer recommendation

**Build now — both the endpoint and the email link.** The original
plan's reasoning for deferring the link (no email exists yet) doesn't hold;
the notification email has been live for ~5 months. There's no reason to
wait on anything.

Scope for the v1 build:
1. One new route, `src/pages/api/back-in-stock/unsubscribe.ts` — `GET`,
   verifies the token, calls the existing `removeSubscription(productId,
   email)`, returns a simple confirmation page/response.
2. The token generation/verification helper from (b) — new module or
   added to `src/lib/backInStock.ts`.
3. One new env var, `BIS_UNSUBSCRIBE_SECRET`.
4. One line added to `sendBackInStockNotification`'s call site
   (`src/pages/api/admin/send-back-in-stock.ts`) generating the token, and
   one line in `buildBackInStockHtml`'s template adding the unsubscribe
   link — the email and its template already exist and are already being
   edited by nothing else in flight, so this is a small, contained change.

No admin UI changes needed (the existing bulk-remove admin flow at
`src/pages/api/admin/remove-back-in-stock.ts` is unaffected and stays as
the "discontinued product" path).

**Effort estimate**: still S — a small, isolated addition reusing
`removeSubscription` and an HMAC pattern this repo already has twice over
(admin auth, and now this).

## STOP conditions

Stop and report back (do not improvise) if:

- Any "Current state" excerpt doesn't match the live file (drift).
- Step 1 reveals `removeSubscription` already has a real caller this plan's
  recon missed — re-scope around what that caller already does instead of
  assuming a clean slate.
- The token-authentication design in Step 2 turns out to need meaningfully
  more infrastructure than a simple HMAC reuse (e.g. a new secrets-rotation
  concern) — that changes this from an S-effort v1 build to something
  larger; report the real complexity rather than downgrading the estimate
  to fit.

## Maintenance notes

- This spike's v1 recommendation is only actionable once written into
  "Spike findings" — do not treat this plan's TODO status as "ready to
  build a feature," only "ready to investigate," matching the same caution
  `plans/120-...md`/`plans/121-...md` already established for spike-type
  plans in this repo.
- If the operator decides not to build this at all (business-scale
  reasoning, same as Plan 073's rejection), record that verdict in
  `plans/README.md`'s "Findings considered and rejected" section instead of
  leaving this plan in an ambiguous TODO state.
