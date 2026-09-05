# Plan 099: Add missing env var docs and .editorconfig

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `ls .editorconfig .env.example 2>/dev/null`

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: developer experience
- **Planned at**: commit `915a062`, 2026-08-01

## Why this matters

**DX-01**: No `.env.example` or documented list of required environment variables. A new developer cloning the repo doesn't know which env vars to set. The Square API key, Netlify blob config, Resend key, admin HMAC secret, and warmup secret are all required but undocumented in onboarding materials.

**DX-04**: No `.editorconfig`. Without it, editors default to different indentation (tabs vs. spaces, 2 vs. 4 spaces). Astro files in this repo use 2-space indentation but there's no enforced standard.

## Current state

```bash
ls .env.example .editorconfig 2>/dev/null
grep -rn "process\.env\." src/ --include="*.ts" --include="*.astro" | grep -v "node_modules" | grep -oP 'process\.env\.\w+' | sort -u
```

The second command lists all referenced env vars. Use the output to populate `.env.example`.

## Commands

| Purpose | Command | Expected |
|---------|---------|---------|
| Typecheck | `pnpm check` | no errors (no code changes) |

## Scope

**In scope**:
- `.env.example` (new file)
- `.editorconfig` (new file)

**Out of scope**: source code; no logic changes

## Git workflow

- Branch: `advisor/099-dx-env-editorconfig`
- Commit: `chore: add .env.example and .editorconfig`

## Steps

### Step 1: Find all env vars

```bash
grep -rh "process\.env\." src/ --include="*.ts" --include="*.astro" | grep -oP 'process\.env\.\w+' | sort -u
```

Also check `netlify.toml` for any env var references.

### Step 2: Write .env.example

Create `.env.example` with one line per required var, value set to an empty string or descriptive placeholder (never a real value). Group by service:

```
# Square
SQUARE_ACCESS_TOKEN=
SQUARE_LOCATION_ID=
SQUARE_ENVIRONMENT=sandbox

# Resend (email)
RESEND_API_KEY=
RESEND_FROM_ADDRESS=

# Admin
ADMIN_HMAC_SECRET=
WARMUP_SECRET=

# Netlify (set by platform)
# NETLIFY_BLOBS_CONTEXT= (auto-injected by Netlify; set for local dev only)
```

### Step 3: Write .editorconfig

```ini
root = true

[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true

[*.md]
trim_trailing_whitespace = false
```

### Step 4: Typecheck (no-op, just confirm no regression)

```
pnpm check
```

## Done criteria

- [ ] `.env.example` exists with all required env vars (no real values)
- [ ] `.editorconfig` exists with 2-space indent, LF, UTF-8
- [ ] `pnpm check` exits 0
- [ ] `plans/README.md` updated to DONE

## STOP conditions

- A real secret value appears in any existing `.env` or `.env.local` that you read — do not reproduce it in `.env.example`; use a placeholder

## Maintenance notes

When adding a new env var, add a corresponding entry to `.env.example` in the same PR.
