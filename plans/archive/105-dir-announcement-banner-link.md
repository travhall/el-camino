# Plan 105: Add link field to announcement banner

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `grep -rn "announcement\|banner" src/ --include="*.ts" --include="*.astro" -i | head -20`

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `915a062`, 2026-08-01

## Why this matters

The audit (DIR-04) found the announcement banner (shown sitewide at the top of pages) has a text field but no link field. Admins cannot point the banner at a specific page (e.g. "Shop our summer sale → /the-shop"). This reduces the banner's utility as a call-to-action tool.

## Current state

Find the announcement banner implementation:
```bash
grep -rn "announcement\|AnnouncementBanner\|banner" src/ --include="*.ts" --include="*.astro" -i | grep -v node_modules | head -30
```

Read the data schema (likely in a Netlify Blob, `src/lib/` module, or admin settings page) and the display component.

## Commands

| Purpose | Command | Expected |
|---------|---------|---------|
| Typecheck | `pnpm check` | no errors |
| Build | `pnpm build` | exits 0 |

## Scope

**In scope**:
- Extend the announcement banner schema to add an optional `linkUrl` field
- Update the admin settings page to include a URL input for the banner
- Update the banner component to render an `<a>` tag when `linkUrl` is set

**Out of scope**: changing banner styling; adding new banner features beyond the link

## Git workflow

- Branch: `advisor/105-dir-announcement-banner-link`
- Commit: `feat: add optional link field to announcement banner`

## Steps

### Step 1: Find the schema and admin page

Read the data source for the announcement banner (likely `src/lib/admin/` or a Netlify Blob accessor). Note the TypeScript type for the banner data.

### Step 2: Extend the schema

Add `linkUrl?: string` to the banner data type. Ensure the field is optional so existing banners without a link are unaffected.

### Step 3: Update the admin form

In the admin settings page for the banner, add an input:
```html
<label for="banner-link">Banner link URL (optional)</label>
<input type="url" id="banner-link" name="linkUrl" value={bannerData.linkUrl ?? ''} />
```

Include client-side validation: if set, must start with `/` (internal) or `https://`.

### Step 4: Update the banner component

In the banner display component, conditionally render as a link:
```astro
{banner.linkUrl
  ? <a href={banner.linkUrl} class="announcement-banner">{banner.text}</a>
  : <div class="announcement-banner">{banner.text}</div>
}
```

### Step 5: Typecheck and build

```
pnpm check
pnpm build
```

## Done criteria

- [ ] Banner schema has optional `linkUrl` field
- [ ] Admin UI has a URL input for the banner link
- [ ] Banner renders as `<a>` when `linkUrl` is set, as text element when not
- [ ] Existing banners without a link are unaffected (backward compatible)
- [ ] `pnpm check` exits 0
- [ ] `pnpm build` exits 0
- [ ] `plans/README.md` updated to DONE

## STOP conditions

- The announcement banner does not exist in the codebase yet (no component found) — report to user; this plan assumes the banner exists

## Maintenance notes

`linkUrl` validation: only allow `/...` (internal) or `https://...` links. Reject `javascript:` and `data:` URIs. Enforce in both the admin form and the server-side schema validation.
