# Plan 180: Add the `.env.example` that `.gitignore` and the README already assume

> **Executor instructions**: Follow step by step. Run every verification command.
> If anything in "STOP conditions" occurs, stop and report. When done, update
> this plan's status row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat ad2999d..HEAD -- .gitignore README.md .github/workflows/ci.yml src/lib/square/squareInstance.ts`
> On any change, re-derive the variable list in Step 1.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (soft interaction with 163 — both edit README)
- **Category**: dx
- **Planned at**: commit `ad2999d`, 2026-09-05

## Why this matters

`.gitignore:28` explicitly un-ignores `.env.example`:

```
!.env.example
```

But no such file is tracked (`git ls-files | grep env.example` → nothing), and
`README.md:60` says so out loud: *"There is no `.env.example` — create a `.env`
file yourself with the variables…"*, followed by a hand-maintained list.

So the required-env contract lives in **three** places that drift independently:
the README's prose list, the module-load validation in
`src/lib/square/squareInstance.ts:10`, and the eight stub variables in
`.github/workflows/ci.yml`.

The failure mode for a new contributor or an agent is a module-load crash rather
than a named missing variable — and `pnpm dev` hard-fails without `.env` at all
(it runs `node --env-file=.env`, which exits 9 when the file is absent; see plan
158).

## Current state

- `.gitignore:26-28` — ignores `.env` and `.env.*`, un-ignores `.env.example`
- `README.md:60` — states no example exists; the list starts around `:67`
- `README.md:98-110` — additionally documents eight `SQUARE_*` tuning vars that
  **no code reads** (plan 162 wires them up)
- `src/lib/square/squareInstance.ts:10` — module-load validation, the closest
  thing to an authoritative required list
- `.github/workflows/ci.yml:18-31` — eight stub vars CI sets

## Commands you will need

| Purpose   | Command         | Expected |
|-----------|-----------------|----------|
| Typecheck | `pnpm check`    | exit 0   |
| Tests     | `pnpm test:run` | exit 0   |
| Lint      | `pnpm lint`     | exit 0   |
| Dev server| `pnpm dev`      | starts   |

Never use `pnpm test` — watch mode, it hangs.

## Scope

**In scope**:
- `.env.example` (create)
- `README.md` — replace the inline list with a pointer

**Out of scope** (do NOT touch):
- `.gitignore`. It already handles this correctly.
- `src/lib/square/squareInstance.ts` and its validation.
- `.github/workflows/ci.yml` — plans 158/159/160 edit it.
- Wiring up the `SQUARE_*` tuning vars — **plan 162**. Document them here as
  currently-unread if 162 has not landed, or accurately if it has.
- The `--env-file` / CI server-start problem — **plan 158**.

## Git workflow

- Branch: `advisor/180-add-env-example`
- Conventional commits, e.g. `docs: add .env.example as the single source of required env`
- Do NOT push or open a PR unless the operator instructs it.

## Steps

### Step 1: Derive the authoritative variable list

Do not copy the README's list — it is one of the three drifting sources.

```bash
grep -rn "import.meta.env\.\|process\.env\." src/ | grep -oE "(import\.meta\.env|process\.env)\.[A-Z_][A-Z0-9_]*" | sort -u
sed -n '1,30p' src/lib/square/squareInstance.ts
sed -n '18,32p' .github/workflows/ci.yml
```

Cross-reference all three. Mark each variable **required** or **optional**, and
note which are `PUBLIC_`-prefixed (those reach the client — worth a comment in
the file).

**Verify**: the derived list, with required/optional marked, recorded in
`plans/README.md`. Note any variable the README lists that no code reads, and any
the code needs that the README omits.

### Step 2: Write `.env.example`

One variable per line, grouped by concern (Square, Resend/email, admin,
WordPress, optional tuning), each with a one-line comment and a **placeholder**
value.

Placeholders must be obviously fake — `your-square-access-token-here`, not a
realistic-looking token. Never a real value, and never a value copied from the
local `.env`.

Mark optional variables clearly, and note in a comment that the `SQUARE_*`
tuning vars are currently unread (plan 162) if that is still true.

**Verify**:
```bash
git add -f .env.example && git status --short .env.example
```
→ the file is trackable (`.gitignore`'s negation works).

Then read the file top to bottom and confirm **no real secret appears**. Do this
by eye, deliberately — it is the one irreversible risk in this plan.

### Step 3: Point the README at it

Replace the inline list with a pointer to `.env.example`, so there is one source
of truth. Keep any prose explaining *how to obtain* a given credential — that is
genuinely useful and does not belong in a `.env.example`.

**Verify**: `grep -n "There is no .env.example" README.md` → no match.

### Step 4: Prove it works

```bash
cp .env .env.backup
cp .env.example .env.test-example
```

Read `.env.test-example` and confirm every variable `squareInstance.ts` requires
is present. Do **not** start the server with placeholder credentials against real
Square — just confirm completeness. Then remove the temp file and restore.

**Verify**: every required variable present; temp files removed;
`git status` clean apart from the intended changes.

### Step 5: Gate

```bash
pnpm check && pnpm lint && pnpm test:run
```
→ all exit 0.

## Test plan

- No tests — a documentation/config file.
- The meaningful verification is Step 1's cross-reference and Step 2's secret
  review.
- Optionally add a CI step asserting every `import.meta.env.X` in `src/` appears
  in `.env.example`. That would make drift impossible — worthwhile, but note it
  interacts with plans 158/159/160, which also edit `ci.yml`.

## Done criteria

- [ ] Step 1's derived list (required/optional) recorded in `plans/README.md`
- [ ] Any README-vs-code discrepancies noted
- [ ] `.env.example` exists and is tracked by git
- [ ] Every variable has a comment and an obviously-fake placeholder
- [ ] **No real credential value in the file** — reviewed line by line
- [ ] README points at `.env.example` instead of listing variables inline
- [ ] `.gitignore` unmodified (`git status`)
- [ ] `pnpm check` / `pnpm lint` / `pnpm test:run` all exit 0

## STOP conditions

Stop and report if:

- **You are about to copy a value from the real `.env`.** Placeholders only,
  always. If you are unsure what a placeholder should look like for some
  variable, use `changeme` rather than anything resembling the real format.
- Step 1 finds a variable whose purpose you cannot determine. Document it as
  unknown rather than guessing at a placeholder that implies a format.
- `.gitignore`'s negation does not work and the file cannot be tracked.

## Maintenance notes

- **The rule**: `.env.example` is the single source of truth for required
  configuration. Adding a new `import.meta.env.X` means adding it here in the
  same change.
- The optional CI check in the Test plan is what would actually enforce that.
  Without it this file drifts like the README's list did.
- Plan 163 also edits README. If both are in flight, expect a small manual merge.
- A reviewer should read `.env.example` in full and confirm every value is
  obviously fake — this is the one file where a mistake is published.
