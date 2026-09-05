# Plan 056: Upgrade TypeScript from 6.0.3 to 7.x

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 9b5556b..HEAD -- package.json tsconfig.json`
> If any changes appear, compare before proceeding.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/055-typescript-to-devdependencies.md
- **Category**: migration
- **Planned at**: commit `9b5556b`, 2026-07-22

## Why this matters

The project is on TypeScript 6.0.3; the current stable is 7.x. TypeScript 7
adds stricter type inference that can surface latent bugs before they reach
production. Staying on 6.x means the project will gradually lag the Astro/Vite
ecosystem, which tracks TypeScript closely. Plan 055 must land first (moving
TypeScript to devDependencies) to avoid the risk of breaking Netlify's
production bundle.

**Risk is MED**: TypeScript major versions historically introduce stricter
narrowing. Expect some annotation changes. Safe to do in a branch; do not merge
if `pnpm check` or `pnpm test:run` fail.

## Current state

**`package.json`** (after plan 055):
```json
"devDependencies": {
  "typescript": "6.0.3"
  // ...
},
"pnpm": {
  "overrides": {
    "typescript": "6.0.3"
  }
}
```

## Commands you will need

| Purpose   | Command              | Expected on success       |
|-----------|----------------------|---------------------------|
| Latest TS version | `npm view typescript version` | prints e.g. `7.0.2` |
| Install   | `pnpm install`       | exit 0                    |
| Typecheck | `pnpm check`         | exit 0, no errors         |
| Unit tests | `pnpm test:run`     | all pass                  |
| Build     | `pnpm build`         | exit 0                    |

## Scope

**In scope**:
- `package.json`
- `pnpm-lock.yaml` (regenerated)
- Any source file requiring annotation fixes to pass `pnpm check` after the upgrade

**Out of scope**:
- `tsconfig.json` `target`/`module` settings — do not change without research;
  TypeScript 7 may have new defaults, but changing them is a separate decision

## Git workflow

- Branch: `advisor/056-typescript-7-upgrade`
- Commit message: `chore: upgrade TypeScript from 6.0.3 to 7.x`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Check the current latest TypeScript version

```bash
npm view typescript version
```

Record the version (e.g. `7.0.2`). Use this exact version in Step 2.

### Step 2: Update package.json

In `package.json`, update both occurrences:
- `"typescript": "6.0.3"` in `devDependencies` → `"typescript": "<new-version>"`
- `"typescript": "6.0.3"` in `pnpm.overrides` → `"typescript": "<new-version>"`

**Verify**: `grep -n '"typescript"' package.json` → both show the new version.

### Step 3: Install and assess

```bash
pnpm install
```
Expected: exit 0.

```bash
pnpm check
```

If `pnpm check` passes immediately: proceed to Step 4.

If it fails with type errors:
- Read each error carefully. TypeScript 7 stricter inference often flags:
  - Missing return type annotations where inference narrows
  - Implicit `any` from untyped function parameters
  - Template literal type stricter matching
- Fix each error by adding explicit type annotations. Do NOT use `as any`.
- If a file has more than 10 errors, STOP and report — this warrants a
  dedicated annotation pass, not a quick fix.

### Step 4: Run tests and build

```bash
pnpm test:run
```
Expected: all pass.

```bash
pnpm build
```
Expected: exit 0.

## Done criteria

- [ ] `pnpm install` exits 0
- [ ] `pnpm check` exits 0 with TypeScript 7.x
- [ ] `pnpm test:run` exits 0
- [ ] `pnpm build` exits 0
- [ ] `grep '"typescript"' package.json` → both entries show version ≥7
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

- `pnpm check` produces >10 errors after the upgrade — record the error count
  and categories, stop, and report. A large number of errors warrants a
  dedicated annotation plan rather than fixing inline.
- `@typescript-eslint` peer compatibility is broken by TypeScript 7 — check
  `npm view @typescript-eslint/parser peerDependencies` and report if
  TypeScript 7 is outside the declared peer range.
- `pnpm build` fails with an error unrelated to type checking (e.g. Vite
  incompatibility) — report the error verbatim.

## Maintenance notes

- After upgrading, update the `pnpm.overrides` entry to match (plan 055's
  Step 2) — they must stay in sync.
- Check `@astrojs/check` peer dependencies after the upgrade; it tracks
  TypeScript closely and may need a minor bump.
