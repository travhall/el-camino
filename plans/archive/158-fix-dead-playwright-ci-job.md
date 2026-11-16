# Plan 158: Make the Playwright CI job actually run instead of failing silently

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report. When done, update this
> plan's status row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat ad2999d..HEAD -- .github/workflows/ci.yml playwright.config.ts package.json`
> On any change, compare the excerpts below against live code first; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none (but shares `.github/workflows/ci.yml` with plans 159, 160)
- **Category**: dx
- **Planned at**: commit `ad2999d`, 2026-09-05

## Why this matters

The Playwright e2e job cannot start its web server, so it has never run a single
test — and `continue-on-error: true` reports the failure as a green job.

The mechanism, verified:

- `playwright.config.ts:79` starts the server with `command: "pnpm dev"`.
- `package.json:10` defines `dev` as
  `rm -rf .astro && sleep 1 && node --env-file=.env ./node_modules/astro/bin/astro.mjs dev`.
- `.gitignore:26-27` ignores `.env`, so no `.env` exists on a fresh CI checkout.
- CI supplies stub credentials as job-level `env:` variables
  (`.github/workflows/ci.yml:18-31` and `:58-72`), which `--env-file` does not
  read, and no step writes them to disk.
- `node --env-file=<missing>` **exits 9**. Confirmed directly:

```
$ node --env-file=/tmp/nope.env -e 'console.log("STARTED OK")'
node: /tmp/nope.env: not found
exit=9
```

So every push and PR spends a full runner — `pnpm install`, `playwright install
--with-deps chromium`, up to a 30-minute timeout — to produce an empty report.
Five spec files exist, including cart flow, and the storefront has **zero**
browser-level regression coverage.

The `continue-on-error` comment attributes this to test flakiness
("informational until tests are stabilized against stub creds"), which has kept
the real cause hidden.

## Current state

`playwright.config.ts:77-82`:

```ts
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:4321",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
```

`.github/workflows/ci.yml:82-84`:

```yaml
      - name: Run Playwright (chromium only)
        run: pnpm test:e2e:chromium
        continue-on-error: true # e2e is informational until tests are stabilized against stub creds
```

`package.json:10`:

```json
    "dev": "rm -rf .astro && sleep 1 && node --env-file=.env ./node_modules/astro/bin/astro.mjs dev",
```

Note: `rm -rf .astro && sleep 1` is a **deliberate, documented** cache-freshness
safeguard (see `CLAUDE.md`). Do not remove it.

## Commands you will need

| Purpose      | Command                    | Expected              |
|--------------|----------------------------|-----------------------|
| Typecheck    | `pnpm check`               | exit 0                |
| Unit tests   | `pnpm test:run`            | exit 0                |
| Lint         | `pnpm lint`                | exit 0                |
| Build        | `pnpm build`               | exit 0                |
| E2E chromium | `pnpm test:e2e:chromium`   | see Steps             |

Never use `pnpm test` — watch mode, it hangs.

## Scope

**In scope**:
- `.github/workflows/ci.yml` (the `Playwright e2e` job only)
- `playwright.config.ts`
- `package.json` (only if adding a new CI-specific script)

**Out of scope** (do NOT touch):
- The `rm -rf .astro && sleep 1` prefix on `dev`. It is a deliberate safeguard;
  removing it is explicitly forbidden without maintainer sign-off.
- The `Type check, lint, unit tests` job. Plans 159 and 160 own it. Touching it
  here creates a merge conflict for no benefit.
- The e2e specs themselves, **except** as Step 4 permits (quarantining, not
  rewriting).
- Real credentials. CI must keep using stubs; never add a real Square token to a
  workflow file or repo secret reference as part of this plan.

## Git workflow

- Branch: `advisor/158-fix-dead-playwright-ci-job`
- Conventional commits, e.g. `fix(ci): give Playwright a server command that boots in CI`
- Do NOT push or open a PR unless the operator instructs it.

## Steps

### Step 1: Reproduce the failure locally

Confirm the mechanism before changing anything:

```bash
mv .env .env.bak
pnpm dev; echo "exit=$?"
mv .env.bak .env
```

**Verify**: non-zero exit with a `not found` message naming `.env`. If `pnpm dev`
starts successfully without `.env`, this plan's premise is wrong — STOP and
report.

### Step 2: Give Playwright a server command that reads ambient env

Add a CI-safe script to `package.json` that starts the dev server **without**
`--env-file`, so it inherits the process environment (which is where CI's stubs
live):

```json
    "dev:ci": "astro dev"
```

Then make `playwright.config.ts`'s `webServer.command` pick it based on
`process.env.CI`, so local runs keep using `.env` and CI uses ambient env.

Keep `reuseExistingServer: !process.env.CI` as-is.

**Verify**:
```bash
mv .env .env.bak
CI=1 SQUARE_ACCESS_TOKEN=ci-stub PUBLIC_SQUARE_APP_ID=ci-stub \
  PUBLIC_SQUARE_LOCATION_ID=ci-stub PUBLIC_SQUARE_ENVIRONMENT=sandbox \
  ADMIN_SECRET=ci-stub-admin-secret-do-not-use ADMIN_PASSWORD=ci-stub \
  RESEND_API_KEY=ci-stub EMAIL_FROM=noreply@example.com \
  pnpm dev:ci
mv .env.bak .env
```
→ the server starts and serves on :4321.

### Step 3: Run the suite locally against stub credentials

```bash
mv .env .env.bak
CI=1 <same stub env as Step 2> pnpm test:e2e:chromium
mv .env.bak .env
```

**Verify**: the server boots and tests actually execute. Record the pass/fail
count in the `plans/README.md` status row. **Some failures are expected** —
stub Square credentials mean product data will not load. That is information,
not a reason to stop.

### Step 4: Decide what the gate covers, with evidence

Split the specs into those that pass against stub credentials and those that
cannot (anything requiring real catalog data). Then:

- Keep the passing specs in the CI gate.
- Move the rest behind a Playwright project or grep tag that CI skips, with a
  comment naming why each is excluded.
- The two `memory-leak-*.spec.ts` suites use Chromium CDP and are slow; exclude
  them from the PR gate regardless of whether they pass.

**Do not delete any spec.** Excluding is reversible; deleting loses the work.

**Verify**: `pnpm test:e2e:chromium` with stubs → exit 0, with a non-zero number
of tests actually run. Record which specs are in the gate and which are excluded.

### Step 5: Remove `continue-on-error` only once the gate is green

Once Step 4's command reliably exits 0, delete `continue-on-error: true` from
`.github/workflows/ci.yml:84` and update the comment to describe what the job
now covers.

**If Step 4 cannot reach a green gate**, leave `continue-on-error` in place but
**replace its comment** with the truth — that the server boots now, and which
specs are known-failing and why. A wrong comment is worse than a disabled gate.

**Verify**: `grep -n "continue-on-error" .github/workflows/ci.yml` → either no
match, or a match with an accurate comment.

### Step 6: Confirm in real CI

Push the branch and watch the workflow run.

**Verify**: the e2e job reports a real test count. Record the run URL in the
status row.

## Test plan

- This plan's deliverable *is* test infrastructure; no new unit tests.
- The verification is Steps 3, 4, and 6: tests demonstrably execute, and the
  count is recorded.
- `pnpm test:run` must remain unaffected (this plan does not touch unit tests).

## Done criteria

- [ ] Step 1 reproduced the `.env` failure
- [ ] `pnpm dev:ci` (or equivalent) starts with no `.env` and ambient env vars
- [ ] `pnpm test:e2e:chromium` with stubs runs a **non-zero** number of tests
- [ ] Step 4's in-gate / excluded spec lists recorded in `plans/README.md`
- [ ] `continue-on-error` either removed, or retained with an accurate comment
- [ ] A real CI run shows a genuine test count; run URL recorded
- [ ] `rm -rf .astro && sleep 1` still present in the `dev` script
- [ ] No real credentials added anywhere (`git diff` review)
- [ ] Only in-scope files modified (`git status`)

## STOP conditions

Stop and report if:

- **`pnpm dev` starts fine without `.env`** — the premise is wrong; report before
  changing anything.
- Getting the suite green would require **real Square credentials in CI**. Do not
  add them. Report and let the operator decide between a mock Square layer, a
  dedicated sandbox account, or keeping e2e out of the PR gate.
- More than roughly half the specs fail against stubs. That is a larger
  test-strategy question than this plan scopes, and quarantining most of the
  suite would produce a gate that proves almost nothing — report the counts.
- The e2e job's runtime makes the PR gate impractically slow (>10 min).
- Any verification fails twice after a reasonable fix attempt.

## Maintenance notes

- **`continue-on-error: true` on a gate is a standing hazard.** It converts
  "broken" into "green" indefinitely. If it must stay, it needs a dated comment
  and a tracking item — otherwise the next person reads a passing badge and
  believes the coverage exists.
- This is one of three CI findings from the same audit: `pnpm lint` cannot fail
  (plan 159) and coverage thresholds are never evaluated (plan 160). **All three
  CI gates are currently no-ops.** Landing only one leaves a misleading picture;
  prefer landing all three.
- Plans 158, 159, and 160 all edit `.github/workflows/ci.yml`, in different jobs
  and steps. Expect a manual merge when landing the second and third.
- A reviewer should check that CI still uses stub credentials only, and that the
  excluded-spec list has a reason per entry.
