# Plan 120 (spike): Auto-trigger back-in-stock notifications from the inventory webhook

> **Executor instructions**: This is a **spike/design plan**, not a
> build-everything plan. The goal is a written design + answered open
> questions + a working proof-of-concept for the riskiest unknown (the
> variationId→product/email lookup), not a production-ready automated
> notification pipeline. Follow the steps in order. If you reach a STOP
> condition, write up what you found and stop rather than pushing forward
> into a full build. When done, update the status row for this plan in
> `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 8ff3096..HEAD -- src/pages/api/webhooks/square.ts src/lib/backInStock.ts src/pages/api/admin/send-back-in-stock.ts`
> If any of these changed since this plan was written, re-read them fully
> before proceeding — this plan's design depends on their exact current
> shape.

## Status

- **Priority**: direction (not bug/security-ranked — a product/business
  option, not a defect)
- **Effort**: M (for this spike; a full build is a separate, larger
  follow-on plan this spike should inform)
- **Risk**: MED (the eventual production version runs inside a webhook
  handler that Square expects a fast response from, and risks duplicate
  sends if not made idempotent — this spike's job is to surface exactly
  how much risk, not to ship it)
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `8ff3096`, 2026-08-06

## Why this matters

The back-in-stock feature is fully built end-to-end except for the one
step that makes it *automatic*: `src/pages/api/webhooks/square.ts` already
receives `inventory.count.updated` events from Square in real time — but
today it only uses them to bust the inventory cache
(`inventoryCache.delete(id)`), discarding the actual count data. Sending
the notification email itself only happens when an admin manually
navigates to `/admin/notifications/back-in-stock` and clicks "send" for one
product at a time (`src/pages/api/admin/send-back-in-stock.ts`) — there is
no cron job, no other webhook caller, and no scheduled task anywhere in
this codebase that invokes that route. README.md markets "Back-in-Stock
Notifications" as a feature; today it depends on a human noticing a
restock happened and remembering to trigger it, per product, from the
admin UI.

Closing this loop — Square tells us stock went from 0 to positive, we
automatically email the waiting subscribers — turns an already-built
feature from manually-triggered into genuinely automatic, which is the
whole point of collecting the subscription in the first place. This is
worth a dedicated design spike before committing to a build because two
real gaps stand between "the webhook fires" and "the right emails go out,"
both investigated below.

## Current state

- `src/pages/api/webhooks/square.ts:39-44` — the webhook payload type this
  handler currently parses (deliberately minimal, per its own comment:
  "Square does not publish TS types for webhook event bodies in the SDK —
  this captures only the fields this handler actually reads"):
  ```ts
  interface SquareWebhookInventoryCount {
    catalog_object_type?: string;
    catalog_object_id?: string;
  }
  ```
  **Gap 1**: this does not capture the actual `quantity` (or count delta)
  Square's webhook payload sends — only which catalog object changed, not
  what its new count is. Without the quantity, there is no way to tell
  "stock went from 0 to 5" apart from "stock went from 10 to 8" — both
  just look like "this variation's count changed."
- `src/pages/api/webhooks/square.ts:114-138` — the current handler body for
  this event type (full excerpt):
  ```ts
      case 'inventory.count.updated': {
        // Extract variation IDs from the counts array.
        // Square only includes counts for ITEM_VARIATION objects; we filter
        // defensively in case the payload ever includes other object types.
        const counts: SquareWebhookInventoryCount[] =
          event.data?.object?.inventory_counts ?? [];

        const variationIds = counts
          .filter((c) => c.catalog_object_type === 'ITEM_VARIATION')
          .map((c) => c.catalog_object_id as string)
          .filter(Boolean);

        if (variationIds.length > 0) {
          // inventoryCache backs both the bulk and batch inventory paths, so a
          // single delete per variation invalidates everything that reads stock.
          await Promise.allSettled(
            variationIds.map((id) => inventoryCache.delete(id))
          );
          console.info(
            `[Webhook/Square] Inventory cache busted for ${variationIds.length} variation(s):`,
            variationIds
          );
        }
        break;
      }
  ```
  It only has the *variation ID* — not the product ID.
- `src/lib/backInStock.ts` — the subscription store, keyed by
  `${productId}/${email}` (see `key()` at line ~21). `BisSubscription`
  records **do** carry a `variationId` field (per the interface at the top
  of the file), but there is no index from *variationId* to *productId* or
  to the list of subscribed emails — `getSubscriptionsForProduct(productId)`
  requires already knowing the productId, which the webhook doesn't have.
  **Gap 2**: the webhook only knows variation IDs; the subscription store
  is indexed by product ID. Some lookup or index needs to bridge this.
- `src/pages/api/admin/send-back-in-stock.ts` (full file, reproduced
  above in "Why this matters" section's linked description) — the
  existing, working, manually-triggered send path. Its core logic
  (`getSubscriptionsForProduct` → loop → `sendBackInStockNotification` →
  `removeSubscription`) is exactly what an automated path should reuse,
  not reimplement.

## Commands you will need

| Purpose   | Command          | Expected on success |
|-----------|------------------|----------------------|
| Typecheck | `pnpm check`     | exit 0, "0 errors" |
| Tests     | `pnpm test:run`  | all pass |
| Lint      | `pnpm lint`      | exit 0 |

(This spike may not produce mergeable production code — see Steps below —
so these commands apply only to whatever proof-of-concept code you do
write, not as a gate on the spike's written findings.)

## Scope

**In scope** (what this spike may touch/produce):
- Read-only investigation of `src/pages/api/webhooks/square.ts`,
  `src/lib/backInStock.ts`, `src/lib/email/sender.ts` (for
  `sendBackInStockNotification`'s signature).
- A **written design document** answering the open questions in Step 2
  below — this can be a new file under `docs/` (gitignored, per
  `CLAUDE.md`'s note that `docs/` holds historical implementation-plan
  files — this is a reasonable, consistent place for a design doc) or
  appended to this plan file's own findings before it's marked done; pick
  whichever this codebase's `docs/` convention (if any exists — check
  first) suggests.
- A **small, disposable proof-of-concept** for Gap 2 only (the
  variationId→productId/subscriber lookup) — see Step 3. This does not
  need to be production-quality or even land in the main webhook handler;
  its purpose is answering "can this be done cheaply, or does it require a
  new index/store."
- **Confirming Square's actual webhook payload shape** for `quantity` —
  see Step 1. This may require consulting Square's API documentation
  (external) since this repo's own code deliberately doesn't type the full
  payload.

**Out of scope** (do NOT build in this plan):
- A production-ready automated notification pipeline wired into the live
  webhook handler — that's a follow-on build plan this spike should make
  possible to scope accurately, not something to ship here.
- Any change to `send-back-in-stock.ts`'s existing manual-trigger UI/flow
  — it should keep working exactly as-is regardless of what this spike
  concludes; an automated path is additive, not a replacement (an admin
  may still want manual control/visibility, e.g. to review before
  sending).
- Idempotency/dedup infrastructure for the eventual production version —
  this spike should *identify* the requirement (see Step 2's questions)
  but the actual guard mechanism is a follow-on build decision.

## Steps

### Step 1: Confirm what Square's webhook payload actually contains

`src/pages/api/webhooks/square.ts`'s own comment says the current
`SquareWebhookInventoryCount` interface only captures what this handler
happens to read today, not the full payload Square sends. Investigate
(via Square's published webhook event documentation, or by triggering a
real test event via Square's Developer Dashboard "Send test event" feature
against this app's configured webhook endpoint, per the setup instructions
already in this file's header comment) whether the `inventory.count.updated`
event's `inventory_counts[]` array entries include a `quantity` (or
similarly-named count) field, and if so, whether it's an absolute count or
a delta.

Write up the answer: exact field name, type, and semantics (absolute vs.
delta), with a citation (doc URL or a redacted sample payload — do **not**
paste a real webhook secret/signature into any written output, per this
codebase's general handling of webhook signature material).

### Step 2: Answer the design questions this spike exists to resolve

Write up answers to each, grounded in what Step 1 and the code excerpts
above establish:

1. **0→positive transition detection**: given the payload shape from
   Step 1, how does the handler know a variation went from *out of stock*
   to *back in stock*, specifically — not just "count changed"? (E.g.: if
   the payload only gives an absolute new count, the handler needs to know
   the *previous* count to detect a transition — does `inventoryCache`
   already hold the pre-update value at the moment this event fires, and
   is that safe to rely on, or does the cache get busted before or after
   this check runs? Trace `inventoryCache`'s read/write order relative to
   this webhook's execution.)
2. **variationId → subscribers lookup**: what's the cheapest way to find
   which product (and its subscribers) a given variationId belongs to,
   without adding an unbounded-scan step? Two candidate approaches to
   evaluate (don't just pick one without comparing):
   - Add a `variationId` key alongside the existing `productId` key in
     `backInStock.ts`'s storage (a secondary index), updated in
     `addSubscription`/`removeSubscription`.
   - Fall back to fetching the product's data via
     `src/lib/square/client.ts`'s `fetchProduct`-adjacent functions (which
     already map variation→product relationships for other purposes) to
     resolve `variationId → productId` on demand, then reuse
     `getSubscriptionsForProduct`.
   Document the tradeoffs (index-maintenance risk vs. per-event Square API
   call cost) rather than picking one without justification.
3. **Idempotency**: Square webhooks can and do redeliver the same event
   (documented Square behavior — cite it). If the same
   `inventory.count.updated` event fires twice for the same 0→positive
   transition, what stops a subscriber from getting two emails? Does the
   existing `removeSubscription` call after a successful send (matching
   `send-back-in-stock.ts`'s pattern) provide natural idempotency once the
   first send completes, or is there a race window between "webhook fires
   twice in quick succession" and "first send's `removeSubscription`
   completes"? Identify the guard needed (this doesn't need to be built in
   this spike, just specified).
4. **Response time**: Square expects webhook handlers to respond quickly.
   Does adding a notification-send loop (which calls Resend, an external
   API, potentially for many subscribers) to the synchronous webhook
   handler risk a timeout, compared to today's handler which only does
   cheap cache-delete calls? Should the actual sending be deferred (e.g. a
   fire-and-forget background task, or writing a "pending notification"
   record for a separate process to pick up) rather than done inline in
   the webhook response path? Compare to how this codebase already handles
   a similar concern elsewhere (`src/lib/email/pendingOrders.ts` and the
   webhook's existing pattern for order-confirmation emails — read that
   code for a precedent to model against, rather than inventing a new
   pattern).

### Step 3: Build a small proof-of-concept for the variationId lookup only

Whichever approach Step 2's question 2 concludes is more promising, write
a minimal, disposable script or test (not necessarily wired into the live
webhook handler) that takes a known variationId and correctly returns the
matching product's active subscriber list, using real (or realistically
mocked) data. This is the highest-uncertainty piece of the whole feature —
proving it works cheaply (or discovering it doesn't) is the single most
valuable output of this spike.

**Verify**: the proof-of-concept correctly resolves a test variationId to
the right subscriber list; document how long it took / how many extra
Square API calls or storage reads it required, since that data feeds
directly into the effort estimate for a follow-on build plan.

### Step 4: Write up findings and a recommendation

Summarize: the exact webhook payload shape (Step 1), answers to all four
design questions (Step 2), the proof-of-concept result (Step 3), and a
recommendation — build it now, defer it, or reduce scope (e.g. "detect and
log candidate restocks for manual review" as a smaller first increment
instead of full automation). This is the deliverable this plan exists to
produce.

## Test plan

No production test suite changes are expected from this spike. If Step 3's
proof-of-concept is written as a test file, it can be added under a
clearly-labeled `__spike__` or similar path so it's obviously not part of
the production suite gate — check whether this codebase has a convention
for this (search for any existing spike/exploratory test patterns) before
inventing one.

## Done criteria

This spike is done when:

- [x] Step 1's payload-shape question is answered with a citation
- [x] All four of Step 2's design questions have written answers
- [x] Step 3's proof-of-concept exists and its result (works cheaply /
      doesn't / needs an index) is documented
- [x] Step 4's recommendation is written
- [x] Any code written for Step 3 either passes `pnpm check`/`pnpm lint`
      if left in the repo, or is cleaned up if purely disposable/local
- [x] `plans/README.md` status row for 120 updated (mark as a completed
      spike, not "DONE" in the sense of "feature shipped" — the actual
      build, if recommended, is separate follow-on work)

## STOP conditions

Stop and report back (do not improvise past this point) if:

- Square's webhook payload turns out not to include usable quantity data
  at all (Step 1) — that would mean this feature needs a different
  trigger mechanism entirely (e.g. polling), a substantially different
  spike than what this plan assumes; don't try to force the
  0→positive-detection question to work around a payload limitation
  without flagging it.
- The variationId→subscriber lookup (Step 2/3) turns out to require an
  approach with meaningfully more risk or cost than either candidate
  listed (e.g. it would require a full catalog scan per event) — report
  this rather than quietly picking the least-bad option and building
  toward it.

## Maintenance notes

- This spike's findings directly determine the shape and risk of a future
  build plan — whoever picks this up next should read Step 4's writeup in
  full before scoping that build, not just the one-line recommendation.
- If the recommendation is "defer," record why here so a future
  `/improve next` session doesn't have to re-investigate from scratch.

## Findings (spike completed 2026-08-06)

Executed in worktree `advisor-120-spike-bis-webhook`, branch
`advisor/120-spike-auto-trigger-back-in-stock`, off commit `244fe6b`. Drift
check found `src/lib/backInStock.ts` had changed since this plan was
written (Plan 115's summary-cache layer landed) — re-read in full; the
change adds a computed-summary cache on top of the same
`{productId}/{email}`-keyed store and does not affect this spike's
conclusions (no `variationId` index was added).

### Step 1: webhook payload shape — confirmed, not a blocker

Square's `inventory.count.updated` event `data.object.inventory_counts[]`
entries have this shape (per the
[InventoryCount object reference](https://developer.squareup.com/reference/square/objects/InventoryCount)
and the
[inventory.count.updated webhook reference](https://developer.squareup.com/reference/square/inventory-api/webhooks/inventory.count.updated),
which includes a full example payload):

```json
{
  "catalog_object_id": "FGQ5JJWT2PYTHF35CKZ2DSKP",
  "catalog_object_type": "ITEM_VARIATION",
  "location_id": "YYQR03DGCTXA4",
  "quantity": "10",
  "state": "IN_STOCK",
  "calculated_at": "2019-10-29T18:38:45.10296Z"
}
```

- `quantity` **is present** — a decimal string (up to 5 decimal places),
  e.g. `"10"`.
- It is an **absolute count**, not a delta: the InventoryCount object is
  documented as "the calculated quantity of an item variation at a
  specific location with a specific inventory state" — a recomputed
  snapshot, not an event delta.
- `state` is one of the `InventoryState` enum values (`IN_STOCK`, `SOLD`,
  `WASTE`, etc.) — a single event can carry multiple entries for the same
  `catalog_object_id` at different states; only `state === "IN_STOCK"`
  entries matter for stock-level detection.
- A single notification can carry up to 100 `inventory_counts` entries; if
  a bulk update produces more, Square splits it across multiple webhook
  notifications.

This directly extends `SquareWebhookInventoryCount` with `quantity: string`
and `state: string` (also `location_id` if multi-location matters — this
codebase's `PUBLIC_SQUARE_LOCATION_ID` pattern in
`src/lib/square/inventory.ts` suggests single-location is the working
assumption today). **Gap 1 as originally framed is resolved: the data
exists.** The real remaining question is what to diff it against (Q1
below).

### Step 2: design questions

**Q1 — 0→positive transition detection.** Traced `inventoryCache`
(`src/lib/cache/blobCache.ts:394`, `new BlobCache<number>('inventory',
900)`) against its only producer, `checkItemInventory()` in
`src/lib/square/inventory.ts`: the cache is **lazily populated** via
`getOrCompute` only when a product page or inventory check reads that
specific variation — it is not proactively kept warm, and the current
webhook handler's only interaction with it is `inventoryCache.delete(id)`
(a write, not a read-before-write). This means relying on
`inventoryCache.get(variationId)` immediately before the delete to recover
"the previous count" is **not safe on its own**:
- Cache miss is common, not an edge case — a product nobody has browsed in
  the last 15 minutes (very plausible for something that's been
  out-of-stock, which is exactly the population with back-in-stock
  subscribers) has no cached value to diff against at all.
- Even on a hit, the cached value is "whatever was last read," not
  necessarily the count immediately preceding this specific webhook event,
  if multiple inventory changes landed inside one 15-minute cache window
  without an intervening read.

  **This is a real gap the original plan didn't name** (it's adjacent to
  but distinct from Gaps 1/2), but it does not hit either of the plan's
  two STOP conditions, and it has a clean design-level fix rather than an
  infrastructure one: **don't try to diff state at all.** Because
  `removeSubscription` already runs after every successful send (both in
  the existing manual path and in any automated path that reuses it),
  "does this variation currently have active subscribers" is naturally
  self-clearing — once notified, a subscriber's record is gone, so a
  later webhook for the same variation (still `IN_STOCK`, quantity now
  higher, or even back down and up again) finds no subscribers and is a
  no-op. So the trigger condition can simply be **"this event's `IN_STOCK`
  quantity for this variation is > 0 AND `getSubscriptionsForProduct`
  (via the Step 3 resolution) returns at least one subscriber"** — no
  previous-count comparison, no cache dependency, no new staleness risk.
  This is simpler than the plan's original framing and avoids the
  cache-reliability problem entirely.

**Q2 — variationId → subscribers lookup.** Compared both candidates:
- **Candidate A (secondary index in `backInStock.ts`)**: requires touching
  `addSubscription`/`removeSubscription` (both explicitly out of scope per
  this plan's own Scope section) and introduces a second write per
  mutation that can drift from the primary record if one write succeeds
  and the other fails (Netlify Blobs has no cross-key transaction). Higher
  risk for no clear cost win, since subscription counts are small relative
  to catalog size.
- **Candidate B (on-demand resolution via Square's catalog API)**: no
  schema change, no write-path risk. `src/lib/square/client.ts`'s
  `fetchProduct()` takes an *item* ID, not a variation ID, so it can't be
  reused directly — but the lower-level
  `squareClient.catalog.object.get({ objectId: variationId })` (used by
  `fetchCatalogItemById` in `src/lib/square/catalogFetch.ts` for item
  lookups) works for *any* catalog object type, including
  `ITEM_VARIATION`, and its response's
  `object.itemVariationData.itemId` is exactly the parent product ID.
  One Square API call resolves variationId → productId, then
  `getSubscriptionsForProduct(itemId)` (existing, unmodified) does the
  rest.

  **Candidate B is the clear winner** — proven cheap in Step 3, below.
  Neither candidate requires an unbounded scan, so the plan's second STOP
  condition does not trigger.

**Q3 — idempotency.** Square explicitly documents at-least-once delivery
with retries for up to 24 hours
([Webhooks overview](https://developer.squareup.com/docs/webhooks/overview)),
and recommends deduping on the event's `event_id`. This codebase has an
**existing, accepted precedent for the exact same race shape**: the
`payment.updated` handler in this same file reads `getPendingOrder(orderId)`,
sends email, then calls `deletePendingOrder(orderId)` — with no lock
between the read and the delete, so two near-simultaneous redeliveries
could both pass the "pending order exists" check before either delete
lands. This codebase ships that risk today without additional guarding.
`send-back-in-stock.ts`'s existing manual path has the identical shape
(`getSubscriptionsForProduct` → send → `removeSubscription`, no lock).

  An automated back-in-stock path reusing that same pattern inherits the
  same narrow race window (two webhook deliveries for the same variation,
  arriving close enough together that both read the subscriber list before
  either's `removeSubscription` completes) — no worse than what's already
  in production for order confirmations. Given a duplicate back-in-stock
  email is a more visible/embarrassing failure mode for a
  supposedly-automated trust-building feature than a duplicate order
  receipt, **I recommend (not require) adding a lightweight `event_id`
  dedup guard** for the production build — a short-TTL blob keyed by
  `event_id`, written before processing and checked at the top of the
  handler, mirroring the shape `pendingOrders.ts`/`failedEmails.ts` already
  use for other webhook-adjacent state. This is a build-plan decision, not
  something this spike needs to build.

**Q4 — response time.** Checked for an existing deferred/background-task
pattern in this codebase (per the plan's pointer to `pendingOrders.ts`) and
found **none** — the `payment.updated` handler already calls
`sendOrderConfirmation`/`sendPickupNotification`/`sendShippingOrderNotification`
(all Resend calls) **synchronously, inline, in the webhook response path**,
wrapped in try/catch, always returning 200. There is no queue, no
fire-and-forget task, no "pending notification" record for a separate
process — this codebase's established pattern is "call Resend inline and
tolerate the latency." A back-in-stock loop over `N` subscribers (mirroring
`send-back-in-stock.ts`'s sequential per-subscriber loop) would follow the
same precedent and is consistent with existing risk tolerance for typical
subscriber counts. The one new consideration: order-confirmation emails
are inherently capped at a handful of recipients (order contact +
optional pickup/shipping notice), while a popular product's back-in-stock
list could plausibly be large (dozens+). I'd flag — for the build plan to
decide, not to solve here — whether to cap inline sends per event (e.g.
send the first N synchronously, log/queue the rest) rather than assume
subscriber counts stay small forever.

### Step 3: proof-of-concept result — works cheaply, no index needed

Added `src/lib/__tests__/__spike__/plan120-variationLookup.spike.test.ts`
(disposable, clearly spike-labeled, left in the repo per the plan's
"passes `pnpm check`/`pnpm lint`" option). It implements Candidate B end
to end — mocked `squareClient.catalog.object.get` resolving a known
variationId to its parent `itemId`, then the real (unmodified)
`getSubscriptionsForProduct` against a mocked Netlify Blobs store — and
asserts:
- A known variationId correctly resolves to its product's exact
  subscriber list.
- A variation whose product has no subscribers correctly resolves to `[]`.
- A variation Square can't resolve to an `itemId` (e.g. a deleted
  variation) short-circuits to `[]` without touching the blob store.

**Cost per resolution**: exactly 1 Square catalog API call
(`catalog.object.get`) regardless of subscriber count, plus whatever
`getSubscriptionsForProduct` already costs today (1 blob `list` scoped to
the `${productId}/` prefix + 1 blob `get` per matched subscriber) — the
same cost the existing manual send path already pays, with one additional
Square API call. All 3 tests pass in ~70ms. No new storage, no index, no
unbounded scan. **Neither STOP condition is triggered.**

### Step 4: recommendation — build it, with a scoped-down v1

Both of the plan's named STOP conditions are cleared: Square's payload
has usable, absolute quantity data (Step 1), and the variationId lookup
resolves cheaply via one on-demand Square API call with no index (Step 3).
The one real new finding is that `inventoryCache` cannot safely serve as
the "previous count" source for precise 0→positive detection — but the
fix is a simplification, not a blocker: gate on "quantity > 0 for this
variation AND it has active subscribers" rather than diffing state, which
sidesteps the cache-staleness problem entirely and is naturally
self-clearing via the existing `removeSubscription`-after-send pattern.

**Recommended v1 scope for the follow-on build plan:**
1. Extend `SquareWebhookInventoryCount` with `quantity: string` and
   `state: string`; filter to `state === 'IN_STOCK' && parseInt(quantity,
   10) > 0`.
2. For each qualifying variationId, resolve to `itemId` via
   `squareClient.catalog.object.get` (Candidate B), then call
   `getSubscriptionsForProduct(itemId)`.
3. Reuse `sendBackInStockNotification` + `removeSubscription` in the same
   per-subscriber try/catch loop shape as `send-back-in-stock.ts`, inline
   in the webhook handler, matching the `payment.updated` handler's
   existing precedent for synchronous Resend calls in this path.
4. Leave `send-back-in-stock.ts`'s manual UI untouched (already required
   by this plan's Scope) — useful as an admin fallback/backfill tool
   regardless.
5. Decide (build-plan-level decision, not resolved here): whether to add
   the `event_id` dedup guard from Q3, and whether to cap inline send
   count for large subscriber lists from Q4. Neither is required to match
   this codebase's existing risk tolerance, but both are cheap
   improvements over parity.

Do **not** build the precise-transition-detection version relying on
`inventoryCache` reads — Q1 establishes that's unreliable as designed
today.
