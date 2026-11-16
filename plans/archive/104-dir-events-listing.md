# Plan 104: Events listing page

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `ls src/pages/ | grep event`

## Status

- **Priority**: P3
- **Effort**: L
- **Risk**: LOW
- **Depends on**: product decision (see below)
- **Category**: direction
- **Planned at**: commit `915a062`, 2026-08-01

## Product decision required

**Before implementing**, confirm with the user:
1. Where does events data live — WordPress custom post type, a Square catalog category, Netlify Blob, or something else?
2. What fields does an event have — title, date, time, description, location, image, ticket link?
3. Should the listing be public (`/events`) or admin-only for now?
4. Is there a design mock for the events page?

Do not implement until these questions are answered.

## Why this matters

The audit (DIR-03) found no events listing page. A shop that hosts workshops, pop-ups, or seasonal events has no public-facing page to surface them. This is a high-value feature for community engagement and drives foot traffic.

## Current state

Check if any events infrastructure exists:
```bash
ls src/pages/ | grep -i event
grep -rn "event" src/lib/ --include="*.ts" -i | head -20
grep -rn "event" src/lib/wordpress/ --include="*.ts" -i
```

## Commands

| Purpose | Command | Expected |
|---------|---------|---------|
| Typecheck | `pnpm check` | no errors |
| Build | `pnpm build` | exits 0 |

## Scope

**In scope**: `src/pages/events/index.astro` (new); data-fetching function for events; basic listing UI

**Out of scope**: event registration/ticketing (separate plan); admin event creation UI (separate plan)

## Git workflow

- Branch: `advisor/104-dir-events-listing`
- Commit: `feat: add events listing page`

## Steps (contingent on product decision)

### If events come from WordPress:
1. Add `getEvents()` to `src/lib/wordpress/api.ts` — fetch posts with category `events`, sorted by date ASC, filtered to future dates
2. Create `src/pages/events/index.astro` — list events with title, date, short description
3. Create `src/pages/events/[slug].astro` — event detail page

### If events come from Netlify Blob (admin-managed):
1. Define an event schema in `src/lib/events.ts`
2. Create admin pages for CRUD under `src/pages/admin/events/`
3. Create the public listing at `src/pages/events/index.astro`

### Shared:
- Add "Events" to the nav (`src/components/Nav.astro`) with a visibility toggle matching the existing shop-visibility pattern
- Wire the events page into the sitemap (`src/lib/sitemapPages.ts`)

**Verify**: `pnpm check` and `pnpm build` exit 0.

## Done criteria

- [ ] Product decision confirmed before implementation
- [ ] `/events` page renders a list of upcoming events
- [ ] Events page linked from nav (with visibility toggle)
- [ ] `pnpm check` exits 0
- [ ] `pnpm build` exits 0
- [ ] `plans/README.md` updated to DONE

## STOP conditions

- No events data source defined — do not create a page that would always be empty; resolve the data question first

## Maintenance notes

The events page must handle the empty-state (no upcoming events) gracefully. Don't show a blank page.
