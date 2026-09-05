# Plan 172: Constrain `productId` before it becomes a Blobs key, and stop deriving admin URLs from the request

> **Executor instructions**: Follow step by step. Run every verification command
> and confirm the expected result. If anything in "STOP conditions" occurs, stop
> and report. When done, update this plan's status row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat ad2999d..HEAD -- src/pages/api/back-in-stock.ts src/lib/backInStock.ts src/lib/email/templates.ts src/lib/site-config.ts`
> On any change, compare against the excerpts below; on a mismatch, STOP.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `ad2999d`, 2026-09-05

## Why this matters

Two small input-trust gaps on the public back-in-stock endpoint.

**1. `productId` becomes a Blobs key prefix unchecked.** The route validates the
email carefully but checks `productId` only for non-emptiness, then interpolates
it straight into a blob key as `` `${productId}/${email}` ``. Reads use
`list({ prefix: \`${productId}/\` })`. A `productId` containing `/` or `..`
writes subscription records into arbitrary key paths, which can pollute or shadow
another product's prefix listing in the admin panel, and creates unbounded junk
keys behind only a 5-per-minute-per-IP rate limit.

**2. `adminUrl` is derived from the request.** `new URL(request.url).origin` is
passed into the admin notification email and interpolated **unescaped** into an
`href`. Netlify routes by Host so a spoofed Host reaching the function is
unlikely — this is the lower-probability half — but the value is request-derived
and lands in a link sent to the shop owner.

Both are cheap to close. Neither is an emergency.

## Current state

`src/pages/api/back-in-stock.ts:28-47` — note the asymmetry: email is validated,
`productId` is not:

```ts
    const productId = formData.get("product_id")?.toString().trim() ?? "";
    const variationId = formData.get("variation_id")?.toString().trim() ?? "";
    const productUrl = formData.get("product_url")?.toString().trim() ?? "";
    // Sanitize: only accept https:// URLs to prevent javascript:/data: href injection
    const safeProductUrl = productUrl.startsWith("https://") ? productUrl : "";

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: "Invalid email address" }), {
        status: 400,
        ...
    if (!productId) {
      return new Response(JSON.stringify({ error: "Missing product ID" }), {
        status: 400,
```

The `safeProductUrl` guard above shows the route's author was already thinking
about injection — `productId` was simply missed.

`src/lib/backInStock.ts:23-29`:

```ts
function key(productId: string, email: string) {
  return `${productId}/${email.toLowerCase().trim()}`;
}

export async function addSubscription(sub: BisSubscription): Promise<void> {
  await store().setJSON(key(sub.productId, sub.email), sub);
```

Reads use `store().list({ prefix: \`${productId}/\` })` (`backInStock.ts:~41`).

`src/lib/email/templates.ts:899` interpolates the request-derived origin into an
`href` unescaped.

### What a valid Square catalog ID looks like

Square catalog object IDs are uppercase alphanumerics and a small punctuation set
— no slashes, no dots. **Confirm the exact character set from real IDs in this
codebase** (Step 1) rather than trusting this sentence.

## Commands you will need

| Purpose   | Command                                    | Expected             |
|-----------|--------------------------------------------|----------------------|
| Typecheck | `pnpm check`                               | exit 0               |
| Tests     | `pnpm test:run -- back-in-stock backInStock` | all pass           |
| Full      | `pnpm test:run`                            | exit 0               |
| Coverage  | `pnpm test:coverage`                       | exit 0, no regression|
| Lint      | `pnpm lint`                                | exit 0               |

Never use `pnpm test` — watch mode, it hangs.

## Scope

**In scope**:
- `src/pages/api/back-in-stock.ts`
- `src/lib/backInStock.ts`
- `src/lib/email/templates.ts` (the `adminUrl` interpolation only)
- the corresponding test files

**Out of scope** (do NOT touch):
- The email validation regex or the rate limit. Both fine.
- The `key()` **format** itself. Changing `${productId}/${email}` would orphan
  every existing subscription. Validate the input; keep the format.
- The back-in-stock notification flow, the admin panel, or the unsubscribe spike.
- `safeProductUrl` — already guarded.

## Git workflow

- Branch: `advisor/172-constrain-back-in-stock-blob-key`
- Conventional commits, e.g. `fix(security): validate productId before using it as a blob key`
- Do NOT push or open a PR unless the operator instructs it.

## Steps

### Step 1: Determine the real catalog-ID character set

Do not guess. Find actual IDs:

```bash
grep -rn "variationId\|catalogObjectId" src/lib/square/__tests__/ | head -20
grep -rn "product_id" src/components/BackInStock.astro
```

Look at fixture IDs in tests and at what the form actually posts.

**Verify**: record the character set and a sample ID in the `plans/README.md`
status row. Your regex must accept every real ID.

### Step 2: Validate `productId` (and `variationId`) at the route

Add a format check alongside the existing email check, returning the same
generic 400 shape. Apply it to `variationId` too — it is stored on the same
record and comes from the same untrusted form.

Reject anything containing `/`, `\`, or `..`, and cap the length.

**Verify**: `grep -n "productId" src/pages/api/back-in-stock.ts` → a format check
exists before any store write.

### Step 3: Add a defensive guard in `key()`

The route is the boundary, but `key()` is the function that builds the path and
has other callers (including `src/pages/api/admin/send-back-in-stock.ts`). Make
it throw on an id containing a path separator — cheap, and it means a future
caller cannot reintroduce the problem.

**Verify**: `pnpm check` → exit 0.

### Step 4: Build `adminUrl` from configuration, not the request

Replace the `new URL(request.url).origin` derivation with the configured site URL
(`src/lib/site-config.ts` — confirm the field name), and escape it where it is
interpolated into the `href` at `templates.ts:899`.

**Verify**: `grep -n "request.url" src/pages/api/back-in-stock.ts` → no longer
feeds `adminUrl`.

### Step 5: Full gate

```bash
pnpm check && pnpm lint && pnpm test:run && pnpm test:coverage
```
→ all exit 0.

## Test plan

Route tests (`src/pages/api/__tests__/` — find the back-in-stock file):

- a valid real-shaped `productId` is accepted (use Step 1's sample — the
  regression proof that the regex is not too strict)
- `productId` of `"../other"`, `"a/b"`, `"a\\b"`, and a 500-char string → 400
- an invalid `productId` produces **no store write** (assert the mock)
- the existing email-validation tests still pass

`src/lib/__tests__/` for `backInStock.ts`:

- `key()` throws on an id containing `/`
- `key()` returns the existing format for a valid id (**format-stability proof** —
  existing subscriptions must keep resolving)

`pnpm test:coverage` → exit 0, no threshold regression.

## Done criteria

- [ ] Step 1's character set and sample ID recorded in `plans/README.md`
- [ ] `productId` and `variationId` format-checked at the route
- [ ] A test proves a real-shaped ID is still accepted
- [ ] A test proves an invalid ID produces no store write
- [ ] `key()` throws on path separators, and its output format is unchanged
- [ ] `adminUrl` derived from `site-config`, escaped in the template
- [ ] `pnpm check` / `pnpm lint` / `pnpm test:run` all exit 0
- [ ] `pnpm test:coverage` exits 0, no threshold regression

## STOP conditions

Stop and report if:

- **Real catalog IDs do not match a simple character class.** Rejecting valid
  subscriptions is worse than the problem being fixed. Report the counter-example.
- Existing stored subscriptions use a `productId` shape your regex would reject.
  Check the blob store's current contents before finishing — a validation change
  that orphans live data needs the operator's input.
- `src/lib/site-config.ts` has no configured site URL. Report; do not invent one.
- Any verification fails twice after a reasonable fix attempt.

## Maintenance notes

- **The rule**: any user-supplied value used as a storage key needs a format
  check at the boundary, not just a non-empty check. This route validated email
  carefully and missed the id — a good reminder that "the obviously dangerous
  field" is not always the one that gets checked.
- The `key()` guard in Step 3 is the durable half; the route check is the
  friendly half. Keep both.
- A reviewer should confirm the key **format** is byte-identical, so existing
  subscriptions still resolve.
