# Plan 121 (spike): Webhook-based cache invalidation for WordPress content

> **Executor instructions**: This is a **spike/design plan**, not a
> build-everything plan. The goal is confirming whether this is even
> feasible given the WordPress.com plan tier this site runs on, and if so,
> a written design — not a shipped webhook endpoint. Follow the steps in
> order. If Step 1 concludes the feature isn't feasible, stop there and
> write up why rather than designing around a capability that doesn't
> exist. When done, update the status row for this plan in
> `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 8ff3096..HEAD -- src/lib/cache/blobCache.ts src/lib/wordpress/api.ts`
> If either changed since this plan was written, re-read the relevant
> sections before proceeding — this plan's numbers (TTL value, cache key
> structure) depend on their exact current state.

## Status

- **Priority**: direction (a product/business option, not a defect)
- **Effort**: M (for this spike; feasibility-gated — see Step 1)
- **Risk**: MED-LOW (a spike produces no production risk by itself; flagged
  MED-LOW rather than LOW only because a wrong feasibility conclusion
  would misdirect a future build plan)
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `8ff3096`, 2026-08-06

## Why this matters

`src/lib/cache/blobCache.ts:401` defines:
```ts
export const wordpressCache = new BlobCache<any>('wordpress', 300); // 5 min
```
Every WordPress fetch in `src/lib/wordpress/api.ts` (posts, pages, tags,
categories, legal pages) goes through this cache via `getOrCompute`, with
a flat 5-minute TTL and **no** event-driven invalidation — freshness is
purely time-based. This codebase already has the architectural answer to
"external content source changes, cache should update immediately" proven
out for Square: `src/pages/api/webhooks/square.ts` receives real-time
events and busts specific cache keys the moment something changes. No
equivalent exists for WordPress.

Concretely, this means an editor publishing a time-sensitive post — a sale
announcement, an event-day update, an urgent closure notice, using the
`shop-news`/`news`/`event`-tag WordPress category convention documented in
`CLAUDE.md`'s Gotchas — can wait up to 5 minutes before it's visible on the
live site. That reads as surprising for content the editor just hit
"Publish" on.

**The reason this is a spike, not a direct build plan**: this site's
WordPress instance is hosted on WordPress.com
(`src/lib/wordpress/api.ts:22`, fetches against
`public-api.wordpress.com/.../elcaminoskateshop.wordpress.com`), not
self-hosted. WordPress.com's ability to emit outbound publish-event
webhooks depends on the account's plan tier (natively available on
Business-tier plans with Jetpack, or via a third-party connector on lower
tiers) — a fact this codebase's own source can't confirm, since it's an
account/billing detail outside the repository. This spike's first and most
important job is confirming that capability exists before designing
anything around it.

## Current state

- `src/lib/cache/blobCache.ts:401`:
  ```ts
  export const wordpressCache = new BlobCache<any>('wordpress', 300); // 5 min
  ```
- `src/lib/wordpress/api.ts:22` (or nearby — re-verify exact line) — the
  WordPress.com REST API base URL this site fetches against:
  ```ts
  // fetches against public-api.wordpress.com/.../elcaminoskateshop.wordpress.com
  ```
  (Read the actual file for the precise constant/URL construction before
  designing a webhook receiver — this plan's excerpt is paraphrased from
  the prior audit pass, not a verbatim quote; re-confirm exact syntax.)
- Every `getOrCompute` call site in `src/lib/wordpress/api.ts` that reads
  through `wordpressCache` — grep for `wordpressCache.getOrCompute` to
  enumerate them all before designing invalidation granularity (a full
  `wordpressCache` clear vs. a per-post/per-slug targeted bust — see Step
  3's design question).
- `src/pages/api/webhooks/square.ts` — the existing webhook receiver
  pattern to model a WordPress equivalent on **if and only if** Step 1
  confirms WordPress.com can emit outbound webhooks for this account. Read
  its signature-verification pattern
  (`verifySquareWebhookSignature`) as a reference for what a WordPress
  equivalent would need (WordPress.com's outbound webhook payloads, if
  available, will **not** carry Square's HMAC scheme — a different
  verification mechanism is needed, to be determined in Step 2).

## Commands you will need

| Purpose   | Command          | Expected on success |
|-----------|------------------|----------------------|
| Typecheck | `pnpm check`     | exit 0, "0 errors" (only relevant if Step 2/3 produce any code) |
| Tests     | `pnpm test:run`  | all pass |
| Lint      | `pnpm lint`      | exit 0 |

## Scope

**In scope** (what this spike may touch/produce):
- Investigation of the WordPress.com account's plan tier and available
  webhook/publish-notification capabilities (external — the WordPress.com
  dashboard/support, or documentation for the account's specific plan;
  this cannot be determined from the repository alone).
- A written feasibility conclusion and, if feasible, a design document
  answering Step 2/3's questions.
- If feasible, a **small disposable proof-of-concept** for receiving and
  verifying one real WordPress.com webhook event (see Step 3), not a
  production-ready endpoint.

**Out of scope** (do NOT build in this plan):
- A production `/api/webhooks/wordpress` route wired into the live cache —
  that's a follow-on build plan, gated on this spike's feasibility
  conclusion.
- Any change to WordPress.com account settings/plan tier — that's a
  business decision outside this codebase's scope; this spike documents
  what's needed, it doesn't purchase or configure it.
- A fallback "reduce the polling interval" implementation, even though
  Step 1's conclusion might recommend it as the practical alternative if
  webhooks aren't available on the current plan — that's also a follow-on
  decision (changing the TTL is a one-line change once the *decision* is
  made, not something this spike needs to build).

## Steps

### Step 1: Confirm WordPress.com webhook capability for this account

This is the gating question. Investigate (via the WordPress.com dashboard
for `elcaminoskateshop.wordpress.com`, or by asking whoever manages that
account/plan) whether the current plan tier supports:
- Native WordPress.com webhook/publish notifications, or
- A Jetpack-provided webhook feature, or
- A third-party connector (e.g. a Jetpack/WordPress.com Zapier or similar
  integration) that could relay a publish event to this app's API.

Write up the answer plainly: **yes, available on the current plan** /
**no, requires a plan upgrade** (note the tier and any cost implication if
discoverable) / **not available on WordPress.com in this form at all,
consider alternative X**.

**This step alone may fully answer whether the rest of this spike is worth
doing** — if the conclusion is "not available without a plan change," stop
here (see STOP conditions) rather than designing a receiver for a webhook
source that doesn't exist yet.

### Step 2: If feasible, determine payload shape and verification

If Step 1 confirms webhook capability exists, investigate: what does the
publish-event payload contain (post ID, slug, category, or just a generic
"something changed" ping)? How is the payload's authenticity verified
(shared secret in a header, IP allowlist, signed payload)? This determines
how granular the cache-bust can be (see Step 3) and what a receiving
route's verification logic needs to do — do not assume it mirrors Square's
HMAC scheme (per "Why this matters," it almost certainly won't); document
whatever the actual mechanism is.

### Step 3: Design the cache-bust granularity

Two options to evaluate once Step 2's payload shape is known:
- **Full clear**: any publish event calls `wordpressCache.clear()` (if
  `BlobCache` exposes a full-store clear — check its API) — simplest,
  correct, but busts unrelated cached content (e.g. legal pages) on every
  unrelated post publish.
- **Targeted bust**: if the payload identifies the specific
  post/page/slug that changed, delete only that key's cache entry (or the
  small set of keys derived from it — check whether `wordpressCache` keys
  by slug directly or by a composite key that would need re-deriving).
  Requires more payload detail from Step 2, but avoids unnecessary
  cache churn for unrelated content.

Recommend one, with reasoning, based on what Step 2 actually confirms is
in the payload — don't design the more complex targeted-bust approach if
Step 2 reveals the payload is only a generic ping with no slug/ID.

### Step 4: Proof-of-concept (only if Step 1 is feasible)

If a webhook mechanism is confirmed available, build a minimal, disposable
route or test that receives and correctly verifies one real (or
realistically simulated) WordPress.com publish-event payload, using
whichever verification mechanism Step 2 identified. This does not need to
actually bust the cache yet — proving the receive+verify step works is the
valuable, uncertain part; the cache-bust call itself (Step 3's design) is
straightforward once a verified event is in hand.

### Step 5: Write up findings and a recommendation

Summarize: Step 1's feasibility conclusion, and if feasible, Step 2's
payload/verification shape, Step 3's granularity recommendation, and Step
4's proof-of-concept result. If Step 1 concluded "not feasible on the
current plan," the write-up should instead cover: the cost/tier needed to
enable it, and whether a cheaper alternative (e.g. reducing the TTL from 5
minutes to something shorter, accepting the tradeoff of more frequent
WordPress.com API calls) is worth recommending instead.

## Test plan

No production test suite changes expected unless Step 4 produces code
worth keeping — if so, follow whatever pattern
`src/pages/api/webhooks/square.ts`'s own test coverage (if any exists —
check `find src -iname "*webhook*test*"`) uses as a model.

## Findings (executed 2026-08-06)

**Step 1 — feasibility: likely yes, with one manual confirmation still
needed.** WordPress.com has a native "Webhooks" feature
(`Settings → Webhooks`, i.e. `/wp-admin/options-general.php?page=webhooks`)
that fires on `publish_post`, `publish_page`, and `comment_post`. Per
WordPress.com's own support docs, this native panel does **not** apply to
plugin-enabled sites — Business/Commerce-tier plans (which run on
Atomic infrastructure and support plugins) must use a plugin
(e.g. WP Webhooks) instead.

This site's own public REST API — the same
`public-api.wordpress.com/rest/v1.1/sites/elcaminoskateshop.wordpress.com`
base URL `src/lib/wordpress/api.ts:21` already fetches, reachable with no
auth — reports `is_wpcom_atomic: false`. Atomic is specifically the
infrastructure Business/Commerce plans run on, so this is real,
site-specific, publicly-verifiable evidence the account is on a
non-plugin-enabled tier (Free/Personal/Premium), i.e. the tier bucket
where native webhooks **are** available.

What this evidence does *not* do is get me into `wp-admin` — that requires
account credentials I don't have and shouldn't be entering. So I can't
personally confirm the Settings → Webhooks panel is actually present and
lets you add a subscription. **Someone with admin access to
`elcaminoskateshop.wordpress.com` needs to spend ~2 minutes confirming**:
log in, visit `/wp-admin/options-general.php?page=webhooks`, and check the
panel exists and accepts a "Post Publish" webhook. If it's there, the rest
of this write-up applies as designed. If it's missing (e.g. the account
turns out to be on a plan this evidence didn't predict), fall back to the
TTL-reduction alternative below.

**Step 2 — payload shape and verification.** Confirmed via WordPress.com's
own webhook documentation:
- Body is `application/x-www-form-urlencoded`, **not JSON** — a real
  divergence from Square's webhook, as flagged in "Why this matters."
- Available payload fields are whichever `WP_Post` properties are
  checked in the wp-admin config form (`ID`, `post_title`, `post_name`
  [WordPress's internal field for slug], `post_type`, `post_url`,
  `post_date`, `post_author`, `post_category`, `post_status`, …), plus an
  automatic `hook` field naming the triggering action
  (`publish_post`/`publish_page`).
- **No signing.** WordPress.com's native webhooks carry no HMAC, no
  secret header, no signature of any kind — confirmed across WordPress.com's
  own docs and third-party integration guides. The only admin-controlled
  secret channel is the destination URL itself (only admin-level
  WordPress.com users can configure it, per WordPress.com's docs). The
  practical verification mechanism is therefore a **shared-secret token
  embedded as a query parameter in the configured webhook URL**
  (`https://.../api/webhooks/wordpress?secret=<token>`), checked with a
  constant-time comparison on receipt — the same trust model Slack/Discord
  incoming webhooks use. This is real but weaker than Square's HMAC: no
  protection if the URL leaks (server logs, browser history, etc.), no
  replay protection, no payload-tamper detection. Worth stating plainly
  rather than glossing over — but it is a real mechanism, not the absence
  of one, so STOP condition 2 does not apply.

**Step 3 — cache-bust granularity: targeted, not full clear.** Current
`wordpressCache` keys (from `grep -n wordpressCache.getOrCompute
src/lib/wordpress/api.ts` and the `cacheKey` values feeding
`fetchWithCache`): `all_posts`, `post_${slug}`, `all_pages`, `page_${slug}`,
`legal_pages`, `all_tags`, `all_categories`. With `post_name`/`post_type`
selected in the webhook config, a publish event carries exactly what's
needed to target the right keys:
- `publish_post` → delete `post_${slug}` **and** `all_posts` (the list
  view embeds all posts, so it goes stale too on any single publish).
- `publish_page` → delete `page_${slug}` **and** `all_pages`.

That's a fixed two-key delete per event — no more complex than a single
`wordpressCache.clear()` call, but it avoids unnecessarily busting
`legal_pages`/`all_tags`/`all_categories`, which a full clear would churn
on every unrelated post publish. Recommend targeted bust.

**Step 4 — proof-of-concept: built, passing.**
`src/lib/wordpress/__tests__/webhookVerification.spike.test.ts` (disposable,
not wired into `src/pages/api`) implements and tests the shared-secret
verification and form-urlencoded payload parsing described above: 5 tests,
all passing (`pnpm test:run`). It proves the receive+verify step is
mechanically sound; it does not call any cache-bust method, per Step 4's
scope note that this part is straightforward once a verified event is in
hand.

**Step 5 — recommendation.** Feasibility is *likely* confirmed by public
evidence but not 100% certain without the 2-minute manual wp-admin check
above. Two paths:
- **If confirmed feasible**: build a real `/api/webhooks/wordpress` route
  modeled on `src/pages/api/webhooks/square.ts`, using this spike's
  verify function (promoted out of the disposable test file) and the
  targeted two-key delete from Step 3. This is a follow-on build plan, not
  this spike.
- **If the manual check finds it's not available** (or as a
  cheaper/simpler alternative regardless): reduce `wordpressCache`'s TTL
  in `src/lib/cache/blobCache.ts:401` from 300 seconds to something
  shorter — **60 seconds** is a reasonable recommendation (5x more
  WordPress.com API calls in the worst case, but those calls are cheap and
  already cached per-key; still bounds "how stale can a just-published post
  be" to a much tighter, if not zero, window without any webhook
  infrastructure at all). One-line change:
  `new BlobCache<any>('wordpress', 60); // 1 min`.

## Done criteria

This spike is done when:

- [x] Step 1's feasibility question is answered plainly (yes/no/needs
      upgrade) with whatever supporting evidence was found — answered
      "likely yes" with public evidence (`is_wpcom_atomic: false`) plus an
      explicit note that full certainty needs a 2-minute manual wp-admin
      check this spike couldn't perform itself
- [x] If feasible: Step 2's payload/verification shape is documented
- [x] If feasible: Step 3's granularity recommendation is written with
      reasoning
- [x] If feasible: Step 4's proof-of-concept exists and its result is
      documented
- [x] Step 5's recommendation is written (including the "not feasible,
      here's the cheaper alternative" case if applicable)
- [x] `plans/README.md` status row for 121 updated

## STOP conditions

Stop and report back (do not improvise past this point) if:

- Step 1 concludes webhooks aren't available on the current WordPress.com
  plan tier — write up the finding (Step 5's alternate path) and stop;
  do not proceed to Steps 2-4 designing around a capability that doesn't
  exist. This is not a failure of the spike — confirming infeasibility
  cheaply is exactly this plan's job.
- Step 2 reveals WordPress.com's webhook payload has no reliable
  authenticity-verification mechanism at all (unlikely, but possible for
  some third-party-connector-relay setups) — that's a security concern
  serious enough to warrant stopping and flagging rather than building a
  receiver that would accept unauthenticated cache-invalidation requests
  from the public internet.

## Maintenance notes

- If the recommendation ends up being "reduce the TTL instead" rather than
  a full webhook build, that's a one-line change to
  `blobCache.ts:401`'s second constructor argument — note the recommended
  value here if this path is chosen, so a future implementer doesn't have
  to re-derive the tradeoff.
- If webhooks are confirmed feasible but deferred for cost/plan reasons,
  record the tier/cost found in Step 1 here so a future
  `/improve next` session (or a business decision to upgrade the
  WordPress.com plan) has this spike's findings ready to act on without
  re-investigating.
