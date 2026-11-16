# Plan 103: Document shop-news convention in admin UI

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `ls src/pages/admin/`

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `915a062`, 2026-08-01

## Why this matters

The audit (DIR-02) found that the admin UI has no documented convention for "shop news" content — posts that should appear as shop announcements (new arrivals, hours changes, events) vs. standard blog posts. Without a convention, admins publish ambiguous content and the shop news section becomes inconsistent.

The fix is lightweight: add a helper text or tooltip in the WordPress/admin content flow explaining the shop-news convention, and document it in CLAUDE.md or an admin-facing doc.

## Current state

Read `src/pages/admin/` to see what admin pages exist. Look for any news/blog/content management UI:
```bash
ls src/pages/admin/
grep -rn "shop.news\|shop-news\|shopNews" src/ --include="*.ts" --include="*.astro" -i
```

Also check how WordPress content is fetched:
```bash
grep -rn "getPost\|getPosts\|wordpressCache" src/lib/wordpress/ --include="*.ts"
```

## Commands

| Purpose | Command | Expected |
|---------|---------|---------|
| Typecheck | `pnpm check` | no errors |

## Scope

**In scope**:
- Add inline helper text to the relevant admin page explaining the shop-news convention
- Add a brief note to CLAUDE.md under "Gotchas" if the convention is non-obvious

**Out of scope**: changing the WordPress content structure; creating new admin routes

## Git workflow

- Branch: `advisor/103-dir-shop-news-convention`
- Commit: `docs: document shop-news convention in admin UI and CLAUDE.md`

## Steps

### Step 1: Find where shop news is managed

Read the admin pages. If there's a news/posts page, read it. Note where a human would create a shop-news post.

### Step 2: Add helper text

In the relevant admin page (likely a form or list view), add a `<p>` or tooltip element:

```html
<p class="text-sm text-gray-500">
  Shop news posts should use the "shop-news" category in WordPress.
  These appear on the shop homepage. Regular blog posts use "news" only.
</p>
```

Adjust copy to match the actual convention once you've read the code.

### Step 3: Update CLAUDE.md

Add one bullet under "Gotchas":
```
- Shop news vs. blog posts: posts with WordPress category `shop-news` appear on the shop homepage; posts with only `news` appear in the blog. Admin UI labels these separately.
```

### Step 4: Typecheck

```
pnpm check
```

## Done criteria

- [ ] Admin UI has visible helper text explaining the shop-news convention
- [ ] CLAUDE.md updated with the convention note
- [ ] `pnpm check` exits 0
- [ ] `plans/README.md` updated to DONE

## STOP conditions

- No shop-news convention exists yet — this is a product decision, not a doc task; stop and ask the user to define the convention first

## Maintenance notes

CLAUDE.md is the source of truth for conventions that can't be derived from code. Keep it in sync.
