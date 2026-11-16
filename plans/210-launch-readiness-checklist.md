# Plan 210: Launch readiness: switch production from Square Sandbox to real orders

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
> When done, update this plan's status row in `plans/README.md`.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: HIGH
- **Depends on**: 211 (soft)
- **Category**: launch
- **Planned at**: commit `2ba4b13`, 2026-11-16

## Why this matters

`www.elcaminoskateshop.com` is publicly reachable but still on Square Sandbox
data, and its code is the fork `ElCaminoBoardShop/el-camino` at `ad2999d`
(2026-09-05), 147 commits behind `travhall/el-camino`. Before a real customer
pays, production needs current code, production Square credentials, its own
webhook, and one proven end-to-end order. Several steps can only be done by
Tyler in accounts Travis does not own, so the list is split by person.

This plan changes no source code. It is a checklist with evidence recorded
against each line.

## Current state (verified 2026-11-16)

- Fork head `ad2999d`; upstream `master` at `2ba4b13`. Production therefore
  lacks, among others, `afeff1f` (order confirmation only shown to the
  purchaser), #29 (CDN purge on Square changes), #33 to #36 (PDP fixes).
- Staging and production are separate Netlify sites. Blobs data, environment
  variables and Square webhook subscriptions are per site.
- The webhook checks its signature against the full request URL
  (`src/pages/api/webhooks/square.ts:88-93`), so a subscription only validates
  on the exact host it was created for.
- If `SQUARE_WEBHOOK_SIGNATURE_KEY` is unset the webhook answers 200 and does
  nothing (`square.ts:71-84`): no confirmation emails, no stock refresh, and no
  error visible to Square.
- Plan 186's four blob smoke tests were never run on a deployed site.

## Part A: Tyler does (production accounts)

Send this list to Tyler as written. Each line needs a reply of "done".

1. **Square production application**: in the Square Developer dashboard, open
   the production application and copy the production access token, the
   application id and the shop's location id.
2. **Netlify environment variables** on the production site. Set:
   `SQUARE_ACCESS_TOKEN`, `PUBLIC_SQUARE_APP_ID`, `PUBLIC_SQUARE_LOCATION_ID`,
   `PUBLIC_SQUARE_ENVIRONMENT=production`, `RESEND_API_KEY`, `EMAIL_FROM`,
   `TYLER_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_SECRET` (new random values, not the
   staging ones), `WARMUP_SECRET`. Compare against `.env.example` for the full
   list.
3. **Square webhook subscription** (production application), URL
   `https://www.elcaminoskateshop.com/api/webhooks/square`, with these three
   events: `payment.updated`, `inventory.count.updated`,
   `catalog.version.updated`. Copy the subscription's signature key into
   `SQUARE_WEBHOOK_SIGNATURE_KEY` on the production site.
4. **Resend**: confirm the sending domain used in `EMAIL_FROM` is verified.
5. **Redeploy** the production site after the variables are saved.

## Part B: Travis does (verification)

### Step 1: Bring production code up to date

Sync the fork to upstream `master` (or complete plan 211, which removes the
fork). **Verify**: the production deploy log shows commit `2ba4b13` or later.

### Step 2: Confirm the environment took

Load a product page on www. **Verify**: products are the real catalog, not
Sandbox test items. Open `/admin` and log in with the new password.

### Step 3: Re-enter site settings

Admin settings live in that site's Blobs store and did not come across from
staging: hours, contact info, announcement banner, social links, shop and sale
visibility. **Verify**: each admin settings screen shows intended values and
the public footer reflects them.

### Step 4: Blob smoke tests (closes plan 186)

Run on production: an admin setting write then read; a back-in-stock signup
appearing in the admin list; a cache round trip (second load of a category
page is served from cache). **Verify**: record each result in the 186 row.

### Step 5: Webhook reaches production

In Square, change the stock count of one variation. **Verify** in the
production function log: a `[Webhook/Square]` line for the inventory event and
a `[CDN] Purged` line; then the product page on www shows the new stock within
a minute. A 403 means the signature key or URL host is wrong.

### Step 6: One real order, each fulfillment method

Buy the cheapest item with a real card, once for pickup and once for shipping.
**Verify** for each: Square shows the payment; the confirmation page renders
with the order; the customer email arrives exactly once; the shop
notification arrives at `TYLER_EMAIL`; the order appears in the matching admin
orders screen. Then open the confirmation URL in a private window.
**Verify**: the order is not shown. Refund both orders in Square.

### Step 7: Search and warm-up

**Verify**: `https://www.elcaminoskateshop.com/robots.txt` and
`/sitemap-index.xml` load; the sitemap lists real product URLs. Plans 211 and
213 cover the keep-warm target and staging indexing.

## STOP conditions

- Step 6 produces zero or two customer emails: stop, do not open the shop;
  see plan 212.
- Any step shows Sandbox data after Part A is reported done: the deploy did
  not pick up the variables; stop and recheck Part A item 5.
- The private-window check in Step 6 shows the order: production is not on
  current code; stop.

## Done when

Every Part A line is confirmed and every Part B step has evidence recorded in
this plan's `plans/README.md` row.
