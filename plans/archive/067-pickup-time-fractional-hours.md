# Plan 067: Fix integer/fractional hour mismatch in pickup time check

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 9b5556b..HEAD -- src/pages/api/create-checkout.ts`
> If any changes appear, compare before proceeding.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: correctness
- **Planned at**: commit `9b5556b`, 2026-07-22

## Why this matters

`create-checkout.ts` has two functions with incompatible return types for time:

- `storeTimeOf(date)` (lines 43–57) returns `{ jsDay, hour }` where `hour` is
  an **integer** extracted via `parseInt(..., 10)` — minutes are discarded.
- `storeHoursForDay(day, hoursData)` (lines 27–38) returns
  `{ open: oh + om/60, close: ch + cm/60 }` — **fractional hours**
  (e.g. 6:30 PM = 18.5).

The comparison at lines 88 and 98:

```ts
if (iHours && iHour >= iHours.open && iHour < iHours.close)
```

compares an integer `hour` against fractional `open`/`close`. This means that
from 6:30 PM to 6:59 PM (`hour = 18`), the check `18 < 18.5` is `true` — the
store appears **open** even though it closed at 6:30 PM. Any store with a
non-hourly close time (e.g. 5:30 PM, 8:45 PM) has this window where the
checkout incorrectly allows pickup scheduling.

The fix: make `storeTimeOf` return fractional hours by including the minute
component, matching the format returned by `storeHoursForDay`.

## Current state

`src/pages/api/create-checkout.ts:43-56` (`storeTimeOf`):

```ts
function storeTimeOf(date: Date): { jsDay: number; hour: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: STORE_TIMEZONE,
    weekday: "short",
    hour: "numeric",
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const wd = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
  const hr = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  // … (minutes not extracted)
  return { jsDay: dayMap[wd] ?? 0, hour: hr };
}
```

## Commands you will need

| Purpose        | Command              | Expected on success      |
|----------------|----------------------|--------------------------|
| Typecheck      | `pnpm check`         | exit 0, no errors        |
| Unit tests     | `pnpm test:run`      | all pass                 |

## Scope

**In scope**:
- `src/pages/api/create-checkout.ts` — `storeTimeOf` only

**Out of scope**:
- `storeHoursForDay` — do not change; its fractional format is correct
- Any other file

## Git workflow

- Branch: `advisor/067-pickup-time-fractional-hours`
- Commit message: `fix: storeTimeOf returns fractional hours to match storeHoursForDay format`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Read `storeTimeOf` in full

Read `src/pages/api/create-checkout.ts` lines 40–60. Confirm the `Intl.DateTimeFormat`
call and the `parseInt` that drops minutes.

### Step 2: Extend the format to include minutes

Update the `Intl.DateTimeFormat` options to add `minute: "numeric"`, then
extract the minute part and include it in the return value:

```ts
function storeTimeOf(date: Date): { jsDay: number; hour: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: STORE_TIMEZONE,
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const wd = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
  const hr = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const mn = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
  const dayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  return { jsDay: dayMap[wd] ?? 0, hour: hr + mn / 60 };
}
```

The return type `{ jsDay: number; hour: number }` is unchanged — `hour` is now
fractional (e.g. 6:30 PM → 18.5) to match `storeHoursForDay`'s output.

### Step 3: Verify no other caller depends on integer `hour`

```bash
grep -n "storeTimeOf\|\.hour" src/pages/api/create-checkout.ts
```

Confirm every use of `.hour` from `storeTimeOf` is compared against
`storeHoursForDay`'s fractional `open`/`close`. If any caller does integer
arithmetic on `hour`, update it to handle fractional values.

### Step 4: Typecheck and test

```bash
pnpm check
```

Expected: exit 0.

```bash
pnpm test:run
```

Expected: all pass.

## Done criteria

- [ ] `pnpm check` exits 0
- [ ] `pnpm test:run` exits 0
- [ ] `storeTimeOf` includes `minute: "numeric"` in its format options
- [ ] Return value is `hr + mn / 60` (fractional hours)
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

- Any caller of `storeTimeOf` uses `hour` as a display string or integer index —
  report the usage and confirm the fractional change is safe before proceeding.
