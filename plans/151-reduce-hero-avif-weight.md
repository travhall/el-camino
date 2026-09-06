# Plan 151: Cut transformed-image weight by lowering AVIF quality

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat ad2999d..HEAD -- src/lib/image/enhanced-optimizer.ts src/pages/index.astro src/components/ArticleCard.astro astro.config.mjs`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (but see Dependency notes — sequence after 146)
- **Category**: perf
- **Planned at**: commit `ad2999d`, 2026-09-05

## Why this matters

The homepage LCP image is **143,968 bytes** of AVIF at `w=1024&q=75`, measured
live on production 2026-09-05. That is unusually heavy for AVIF at that width —
the source JPEG is only 165,600 bytes, so the "optimized" transform is saving
about 13%. On a Chrome DevTools trace at Slow 4G + 4x CPU, that single image
accounted for **570 ms** of resource load duration inside a 1295 ms LCP: 44% of
the metric.

AVIF at quality 50–60 is typically indistinguishable from 75 at this size, at
roughly half the bytes. This is the cheapest remaining LCP win once the caching
and scheduling issues (plans 146–149) are addressed.

This is explicitly a **tuning** plan: the correct value is found by measuring,
not by decree. The steps below produce the evidence and leave the final call to
the operator if the visual difference is arguable.

## Current state

### Where quality is set

Quality is specified per call site rather than centrally:

- `src/pages/index.astro:47-51, 57-61, 67-71, 77-81` — the LCP preload's four
  `EnhancedImageOptimizer` calls, all `quality: 85`
- `src/components/ArticleCard.astro:92-95` — `quality: 85` for card images
- `src/lib/wordpress/content-utils.ts:316` — `q: '75'` for in-article images
- `src/lib/product/pdpUI.ts:291` — `q: '85'` for PDP gallery
- `src/lib/image/enhanced-optimizer.ts:~282` — `quality = 80` default
- `astro.config.mjs` `image.quality: 85` — governs Astro's own `<Image>`
  component, a **different** pipeline

### An unresolved discrepancy you MUST resolve before editing anything

The live production HTML on 2026-09-05 serves the homepage hero with **`q=75`**
— in both the `<link rel=preload>` and the `<img>` `src`/`srcset`. But every
obvious candidate call site passes `quality: 85`:

- `src/pages/index.astro:53, 62, 71, 79` — all `quality: 85`
- `src/components/ArticleCard.astro:95, 106, 114, 124` — all `quality: 85`

And the resolver does not clamp numeric values —
`src/lib/image/enhanced-optimizer.ts`, `getQualityForFormat()`:

```ts
  private static getQualityForFormat(
    format: 'avif' | 'webp' | 'jpeg',
    quality: number | string = 'medium'
  ): number {
    if (typeof quality === 'number') return quality;

    return this.QUALITY_SETTINGS[format][quality as keyof typeof this.QUALITY_SETTINGS.avif];
  }
```

So a passed `85` should emerge as `85`, and it does not. Something else is
producing the served URL — candidates worth checking: the hardcoded `q: '75'`
in `src/lib/wordpress/content-utils.ts:316`, a default path where `quality` is
never passed (falling through to `'medium'` in `QUALITY_SETTINGS`), or a
different builder entirely.

**Step 1 exists to resolve this. Do not edit any `quality:` value until you
know which code path emits the hero's URL** — changing the four `quality: 85`
sites when the real value comes from somewhere else would be a no-op that looks
like a fix. This is an explicit STOP condition.

### Format order

`astro.config.mjs` sets `image.formats: ["avif", "webp", "jpeg"]`, and
`src/lib/image/enhanced-optimizer.ts:190-194` explicitly forces `fm=avif` for
WordPress images. That behavior is correct and stays.

## Commands you will need

| Purpose   | Command              | Expected on success             |
|-----------|----------------------|---------------------------------|
| Typecheck | `pnpm check`         | exit 0, 0 errors                |
| Tests     | `pnpm test:run`      | exit 0, all pass                |
| Lint      | `pnpm lint`          | exit 0                          |
| Build     | `pnpm build`         | exit 0                          |
| Dev server| `pnpm dev`           | serves on :4321                 |

Do **not** use `pnpm test` — watch mode, it will hang.

## Scope

**In scope** — but only the subset Step 1 proves is actually on the hero's path:
- `src/pages/index.astro` (four `quality: 85` values at lines 53, 62, 71, 79)
- `src/components/ArticleCard.astro` (four `quality: 85` values at lines 95, 106, 114, 124)
- `src/lib/image/enhanced-optimizer.ts` (the `quality = 80` default at line 281,
  and `QUALITY_SETTINGS` if Step 1 shows the `'medium'` string path is in play)
- `src/lib/wordpress/content-utils.ts` (the hardcoded `q: '75'` at line 316) —
  **only** if Step 1 proves this builder produces the hero URL

**Out of scope** (do NOT touch):
- `astro.config.mjs` — its `image.quality` governs Astro's `<Image>`
  component, which is a separate pipeline from `EnhancedImageOptimizer`.
  Changing it here confuses two systems.
- `src/lib/product/pdpUI.ts` — product photography has different fidelity
  requirements than editorial imagery. Out of scope by design; if the operator
  wants PDP tuned, that is a separate plan.
- `fm` / format selection and the `formats` array.
- The `w=` srcset widths.
- The image URL prefix (plan 146) and `sizes` strings (plan 150).

## Git workflow

- Branch: `advisor/151-reduce-hero-avif-weight`
- Conventional commits, e.g. `perf: lower AVIF quality for editorial imagery`
- Do NOT push or open a PR unless the operator instructs it.

## Steps

### Step 1: Establish which code path serves the hero, and the baseline bytes

Run the dev server, load the homepage, and read the actual `src`/`srcset` the
featured card emits. Trace back to which of the call sites above produced it.

Then measure the current bytes at several quality values directly against
production's Image CDN (read-only, no deploy needed):

```bash
for q in 75 65 60 55 50; do
  printf "q=%s  bytes=%s\n" "$q" \
    "$(curl -sS -o /dev/null -w '%{size_download}' \
      "https://www.elcaminoskateshop.com/.netlify/images?url=https%3A%2F%2Felcaminoskateshop.wordpress.com%2Fwp-content%2Fuploads%2F2026%2F03%2Fel-co-02.jpg&w=1024&fm=avif&q=$q")"
done
```

(If plan 146 has landed, use `/cdn-img?` instead of `/.netlify/images?`.)

**Verify**: you have a table of five byte counts and know which source file
sets the hero's quality. Record both in the `plans/README.md` status row.
Baseline to confirm: `q=75` → ~143,968 bytes.

### Step 2: Compare quality visually before changing code

Download the `q=75` and candidate-quality renders to a scratch directory and
compare them at full size, side by side, on a normal display.

```bash
mkdir -p /tmp/img-cmp && cd /tmp/img-cmp
for q in 75 60 55 50; do
  curl -sS -o "hero-q$q.avif" \
    "https://www.elcaminoskateshop.com/.netlify/images?url=https%3A%2F%2Felcaminoskateshop.wordpress.com%2Fwp-content%2Fuploads%2F2026%2F03%2Fel-co-02.jpg&w=1024&fm=avif&q=$q"
done
ls -la
```

**Verify**: pick the lowest quality with no visible degradation at 100% zoom —
watch skin tones, sky/gradient banding, and text-in-image if any. Note that the
card renders with `mix-blend-luminosity` and `opacity-80`
(`src/components/ArticleCard.astro`), which further masks compression artifacts.

If the difference between your pick and `q=75` is arguable rather than clearly
imperceptible, **STOP and ask the operator** with the files attached. This is
their brand imagery; it is not your call to make on a close margin.

### Step 3: Apply the chosen quality

Set the chosen value at the in-scope call sites. Keep them consistent with each
other and add a brief comment recording the measurement:

```ts
  // AVIF q=<N>: measured <N> bytes vs 143,968 at q=75 for the 1024w hero,
  // with no visible difference at 100% zoom (and the card renders at
  // opacity-80 + mix-blend-luminosity, masking artifacts further).
```

**Verify**: `pnpm check` → exit 0.

### Step 4: Confirm the served URL changed and re-measure

Restart `pnpm dev`, hard-reload the homepage, and read the featured image's
network entry.

**Verify**:
- The request URL carries the new `q=` value.
- The transferred size is meaningfully below the 143,968-byte baseline (target:
  at least 30% smaller).
- The rendered card looks correct.

### Step 5: Full gate

**Verify**, all four exit 0:
```bash
pnpm check && pnpm lint && pnpm test:run && pnpm build
```

## Test plan

- If any test asserts a literal `q=` value in a generated URL, update it.
  Check with: `grep -rn "q=75\|q=85\|quality" src/**/__tests__/`.
- No new unit tests: image quality is a perceptual tradeoff, not a behavior a
  test can assert. The value of this plan lives in the measurements recorded in
  Steps 1–2.
- `pnpm test:run` → exit 0, count not lower than baseline.

## Done criteria

ALL must hold:

- [ ] Step 1's byte table for q ∈ {75, 65, 60, 55, 50} recorded in `plans/README.md`
- [ ] Step 2's visual comparison performed; chosen value justified in the status row
      (or escalated to the operator if the margin was close)
- [ ] The hero image transfers at least 30% fewer bytes than the 143,968-byte baseline
- [ ] `astro.config.mjs` is unmodified (`git status`)
- [ ] `src/lib/product/pdpUI.ts` is unmodified (`git status`)
- [ ] `pnpm check` / `pnpm lint` / `pnpm test:run` / `pnpm build` all exit 0
- [ ] Only in-scope files modified (`git status`)

## STOP conditions

Stop and report back (do not improvise) if:

- The visual difference at your candidate quality is **arguable rather than
  clearly imperceptible**. Escalate with the sample files; do not decide.
- Lowering `q` does not meaningfully reduce bytes (< 15% at q=55). That would
  mean the bottleneck is the source image's dimensions, not its quality — a
  different fix (resizing at the source, or lower `w=` values), and out of
  scope here.
- **You cannot determine which code path sets the hero's quality in Step 1.**
  Do not shotgun-change every `quality:` in the repo, and do not "fix" the
  85-vs-75 discrepancy by making the call sites agree — that discrepancy is a
  clue about the real code path, and possibly a separate bug worth its own
  finding. Report what you found.
- Any verification fails twice after a reasonable fix attempt.

## Maintenance notes

- Quality is set at **six** separate call sites across the codebase. This plan
  deliberately changes only three of them (editorial imagery). If a future
  change wants one global knob, that is a worthwhile refactor — but it must
  keep PDP product photography separately tunable from editorial images.
- A reviewer should scrutinize: `astro.config.mjs` and `pdpUI.ts` untouched,
  and the recorded byte measurements actually support the chosen value.
- **Deliberately deferred**: tuning PDP gallery quality; auditing whether the
  `w=1024` srcset candidate is even needed for a card that renders at ~67vw;
  and asking whether the WordPress source images should be smaller at upload
  time (the real root cause of the weight).
