# Plan 178: Convert or delete the 49 commented-out `console.*` lines

> **Executor instructions**: Follow step by step. Run every verification command.
> If anything in "STOP conditions" occurs, stop and report. When done, update
> this plan's status row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat ad2999d..HEAD -- src/lib/cart/index.ts src/lib/square/categoryLookup.ts src/lib/logger.ts`
> On any change, re-run the counts in Step 1 before proceeding.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `ad2999d`, 2026-09-05

## Why this matters

There are **49** commented-out `console.*` lines across `src/`, concentrated in
the two busiest modules: `src/lib/cart/index.ts` (12) and
`src/lib/square/categoryLookup.ts` (8).

A real logger exists — `src/lib/logger.ts`, whose own header says its purpose is
to "Replace ad-hoc `console.log` calls in hot paths so prod logs aren't flooded".
The migration was done by **commenting out** rather than converting, and `logger`
is imported by only 7 modules.

So the debug tracing these lines represent is unavailable in production, where it
would actually be useful, and anyone debugging cart state uncomments lines by
hand instead of flipping a log level.

Verified counts:

```
$ grep -rn "^\s*//\s*console\." src/ | wc -l
49
$ grep -rc "^\s*//\s*console\." src/lib/cart/index.ts src/lib/square/categoryLookup.ts
src/lib/cart/index.ts:12
src/lib/square/categoryLookup.ts:8
```

## Current state

`src/lib/logger.ts:1-4` states the intent; read it first, and check whether
`logger.debug` is a no-op in production by construction (it should be — confirm,
because Step 2 depends on it).

The 49 sites split roughly:
- `src/lib/cart/index.ts` — 12
- `src/lib/square/categoryLookup.ts` — 8
- `src/pages/category/[...slug].astro` — ~7
- `src/pages/shop/all.astro`, `src/components/Nav.astro` — ~4 each
- ~10 more files with 1-3 each

## Commands you will need

| Purpose   | Command              | Expected             |
|-----------|----------------------|----------------------|
| Typecheck | `pnpm check`         | exit 0               |
| Tests     | `pnpm test:run`      | exit 0               |
| Coverage  | `pnpm test:coverage` | exit 0, no regression|
| Lint      | `pnpm lint`          | exit 0               |
| Build     | `pnpm build`         | exit 0               |

Never use `pnpm test` — watch mode, it hangs.

## Scope

**In scope**:
- The files containing commented-out `console.*` lines (enumerate in Step 1)
- `eslint.config.mjs` — only to add a `no-console` rule, if Step 4 is taken

**Out of scope** (do NOT touch):
- `src/lib/logger.ts`'s implementation.
- **Live** `console.*` calls. Some are intentional (`console.error` in catch
  blocks, `console.info` in the webhook). This plan is about the *commented-out*
  ones only.
- Any surrounding logic. If uncommenting reveals a variable no longer in scope,
  delete the line rather than restructuring.

## Git workflow

- Branch: `advisor/178-convert-commented-console-to-logger`
- Conventional commits, e.g. `chore: convert dead commented console lines to logger.debug`
- Do NOT push or open a PR unless the operator instructs it.

## Steps

### Step 1: Enumerate and classify

```bash
grep -rn "^\s*//\s*console\." src/ > /tmp/commented-console.txt
wc -l /tmp/commented-console.txt
cut -d: -f1 /tmp/commented-console.txt | sort | uniq -c | sort -rn
```

Classify each into **convert** (genuinely useful tracing — cart state
transitions, category resolution steps) or **delete** (one-off debugging noise,
duplicates, lines referencing variables that no longer exist).

**Verify**: the classification is recorded in `plans/README.md` with counts for
each bucket. Default to **delete** — a line nobody has uncommented in months is
probably not valuable.

### Step 2: Confirm `logger.debug` is production-safe

Read `src/lib/logger.ts` and confirm `debug` is a no-op (or filtered) in
production. If it is not, converting 20 lines to `logger.debug` would flood
production logs — the exact problem the logger exists to prevent.

**Verify**: state what you found. If it is not production-safe, **delete
everything instead of converting**, and say so.

### Step 3: Convert the keepers, delete the rest

For `cart/index.ts` and `categoryLookup.ts`, convert the classified keepers to
`logger.debug(...)`, importing `logger` where needed. Delete everything else.

Keep the message text; drop any `console.log` formatting arguments that
`logger.debug` does not support.

**Verify**:
```bash
grep -rn "^\s*//\s*console\." src/ | wc -l
```
→ `0`.

```bash
pnpm check && pnpm test:run
```
→ both exit 0.

### Step 4: Prevent regrowth

Add a `no-console` ESLint rule with an allowlist for `src/lib/logger.ts` and for
`console.error` / `console.warn` where the repo legitimately uses them.

**Note**: whether this rule can actually fail depends on **plan 159** (`pnpm lint`
currently exits 0 regardless of warnings). If 159 has not landed, add the rule at
`warn` and say in the status row that it is not yet enforced.

**Verify**: `pnpm lint` → exit 0, no new violations in existing code.

### Step 5: Full gate

```bash
pnpm check && pnpm lint && pnpm test:run && pnpm test:coverage && pnpm build
```
→ all exit 0.

## Test plan

- No new tests — this changes no behavior. Converted lines are debug output;
  deleted lines were inert.
- `src/lib/cart/index.ts` has a **per-file coverage threshold** with a documented
  ~84% branch ceiling. Adding `logger.debug` calls adds statements — confirm
  `pnpm test:coverage` still passes.
- `pnpm test:run` must pass unchanged. Any failure means you altered logic, not
  comments.

## Done criteria

- [ ] Step 1's classification (convert vs delete, with counts) recorded
- [ ] Step 2's `logger.debug` production-safety finding recorded
- [ ] `grep -rn "^\s*//\s*console\." src/ | wc -l` returns `0`
- [ ] Live `console.error` / `console.warn` calls untouched (`git diff` review)
- [ ] `no-console` rule added, with a note on whether it is enforced yet
- [ ] `pnpm check` / `pnpm lint` / `pnpm test:run` / `pnpm build` all exit 0
- [ ] `pnpm test:coverage` exits 0; `cart/index.ts` per-file threshold still met

## STOP conditions

Stop and report if:

- **`logger.debug` is not a no-op in production.** Delete rather than convert.
- Uncommenting a line reveals it references a variable that no longer exists —
  delete it; do not reconstruct the debugging context.
- `pnpm test:run` fails. You changed behavior; revert and find out how.
- `cart/index.ts` drops below its per-file coverage threshold.

## Maintenance notes

- **Commenting out a log is not a migration.** It leaves the tracing unavailable
  exactly where it is needed (production) and clutters the source. Either the log
  is useful — make it `logger.debug` — or it is not: delete it.
- The `no-console` rule is the durable half; without it these regrow.
- A reviewer should confirm only comment lines and the added `logger` imports
  appear in the diff.
