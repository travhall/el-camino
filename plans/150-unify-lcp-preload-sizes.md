# Plan 150: Make the LCP preload's `sizes` match the image it is preloading

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat ad2999d..HEAD -- src/pages/index.astro src/components/ArticleCard.astro`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `ad2999d`, 2026-09-05

## Why this matters

The homepage emits a `<link rel="preload" as="image">` for the featured
article image, specifically to get the LCP resource requested early. For that
preload to work, the browser must resolve it to the **same** candidate the
real `<img>` will later choose — otherwise the preload downloads one image and
the `<img>` downloads a different one. The preload is then pure waste and the
page pays for two images instead of one.

The two `sizes` strings disagree on their first breakpoint: the preload says
`640px`, the `<img>` says `767px`. For any viewport **641–767 px wide** —
large phones in landscape, small tablets, resizable desktop windows — the
preload resolves to `100vw` while the `<img>` resolves to `67vw`, selecting
different `srcset` candidates.

This also explains why the symptom is intermittent rather than constant:
outside that 127 px band the two strings agree and the preload works fine.

## Current state

### The preload's `sizes`

`src/pages/index.astro:85-87`:

```astro
// Featured card is col-span-4 of grid-cols-6 at md (~67vw), col-span-4 of grid-cols-8 at 2xl (50vw)
const lcpImageSizes =
  "(max-width: 640px) 100vw, (max-width: 1535px) 67vw, 50vw";
```

used at `src/pages/index.astro:111` and `:123` as `imagesizes={lcpImageSizes}`.

### The `<img>`'s `sizes`

`src/components/ArticleCard.astro:80-89`:

```astro
// Featured masonry card: col-span-4 of grid-cols-6 at md (~67vw), col-span-4 of grid-cols-8 at 2xl (50vw)
// Non-featured masonry: col-span-2 of grid-cols-6 (~33vw at md+)
let imageSizes =
  variant === "list"
    ? "(max-width: 768px) 0px, 256px"
    : variant === "teaser"
      ? "(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 33vw"
      : featured
        ? "(max-width: 767px) 100vw, (max-width: 1535px) 67vw, 50vw"
        : "(max-width: 767px) 100vw, 33vw";
```

The `featured` branch (line 88) is the one the preload is supposed to mirror.
Its comment on line 80 is identical to `index.astro:85` — the two were written
to match and drifted.

### Which value is correct

`767px` is correct, and `640px` is the bug. The grid switches to multi-column
at Tailwind's `md` breakpoint — `md:grid-cols-6` in `getContainerClasses()`,
`src/components/ArticleGrid.astro:72` — and Tailwind v4's `md` is `768px`. So
the card is full-width up to and including 767 px, which is what
`(max-width: 767px) 100vw` expresses. `640px` is Tailwind's `sm`, which the
grid does not key off at all.

Confirmed in the live production HTML on 2026-09-05: the preload carries
`imagesizes="(max-width: 640px) 100vw, ..."` while the `<img>` carries
`sizes="(max-width: 767px) 100vw, ..."` — both present, disagreeing.

### Repo conventions

- Astro 7 SSR, TypeScript.
- Tailwind v4 default breakpoints: `sm` 640px, `md` 768px, `lg` 1024px,
  `xl` 1280px, `2xl` 1536px.

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

**In scope**:
- `src/pages/index.astro` (the `lcpImageSizes` constant)
- `src/components/ArticleCard.astro` (only to export/share the string — see Step 2)

**Out of scope** (do NOT touch):
- The **non-featured**, `teaser`, and `list` `sizes` branches at
  `ArticleCard.astro:84-89`. Only the `featured` branch is mirrored by the
  preload. The `teaser` branch's `639px` is a *different* layout with a
  different breakpoint and is not a bug.
- The `srcset` widths (320/640/768/1024) and the `width={800} height={533}`
  attributes. Untouched by this plan.
- Image `quality` — plan 151 owns that.
- The image URL prefix — plan 146 owns that. If 146 has already landed, the
  URLs will read `/cdn-img?...`; that is expected and not drift.

## Git workflow

- Branch: `advisor/150-unify-lcp-preload-sizes`
- Conventional commits, e.g.
  `fix: align LCP preload imagesizes with the featured card's img sizes`
- Do NOT push or open a PR unless the operator instructs it.

## Steps

### Step 1: Fix the breakpoint

In `src/pages/index.astro:86-87`, change `640px` to `767px` so the string is
byte-identical to `ArticleCard.astro:88`.

**Verify**:
```bash
grep -n "max-width: 640px" src/pages/index.astro
```
→ no matches.

```bash
grep -c "(max-width: 767px) 100vw, (max-width: 1535px) 67vw, 50vw" src/pages/index.astro src/components/ArticleCard.astro
```
→ `1` in each file.

### Step 2: Make the drift impossible to repeat

Two identical string literals in two files is what caused this. Export a single
shared constant and use it in both places.

Add to `src/components/ArticleCard.astro`, above the component frontmatter's
`imageSizes` assignment (or in a small module if the `.astro` file cannot
export a value — in that case create `src/lib/image/sizes.ts`):

```ts
// The featured masonry card is full-width below Tailwind's `md` (768px, where
// .article-grid switches to md:grid-cols-6), then col-span-4 of 6 (~67vw),
// then col-span-4 of 8 (50vw) at 2xl. The homepage's LCP <link rel=preload>
// MUST use this exact string: if the preload's imagesizes and the <img>'s
// sizes resolve to different srcset candidates, the browser downloads both.
export const FEATURED_CARD_IMAGE_SIZES =
  "(max-width: 767px) 100vw, (max-width: 1535px) 67vw, 50vw";
```

Import it in `src/pages/index.astro` and assign `lcpImageSizes` from it, and
use it for the `featured` branch in `ArticleCard.astro`.

**Verify**:
```bash
pnpm check
```
→ exit 0, 0 errors.

```bash
grep -rn "FEATURED_CARD_IMAGE_SIZES" src/
```
→ one definition, two usages.

### Step 3: Confirm the preload is actually used

Start `pnpm dev`, open `http://localhost:4321/`. In DevTools:

1. Set the viewport to **700 px wide** (inside the previously-broken band).
2. Network tab, hard-reload with cache disabled, filter to images.

**Verify**:
- Exactly **one** request for the featured article image — not two at different
  `w=` values.
- Console shows **no** warning of the form *"A preload for … was found, but was
  not used"*.

Repeat at **375 px** and at **1440 px** viewport widths; one request each time.

### Step 4: Full gate

**Verify**, all four exit 0:
```bash
pnpm check && pnpm lint && pnpm test:run && pnpm build
```

## Test plan

- Add one Vitest case asserting the shared constant is used by both consumers,
  or — simpler and more valuable — assert the constant's exact value so a
  future edit to one breakpoint is caught. Put it in
  `src/lib/image/__tests__/sizes.test.ts` if you created `sizes.ts` in Step 2.
- Structural model: the assertion style in
  `src/lib/wordpress/__tests__/content-utils.test.ts`.
- Primary verification is Step 3's browser check — the double-download is only
  observable in a real browser.
- `pnpm test:run` → exit 0, count not lower than baseline.

## Done criteria

ALL must hold:

- [ ] `grep -n "max-width: 640px" src/pages/index.astro` returns no matches
- [ ] `grep -rn "FEATURED_CARD_IMAGE_SIZES" src/` returns one definition and two usages
- [ ] Step 3: exactly one featured-image request at 700 px, 375 px, and 1440 px viewports
- [ ] Step 3: no "preload … not used" console warning at any of the three widths
- [ ] The non-featured / teaser / list `sizes` branches in `ArticleCard.astro` are unchanged
- [ ] `pnpm check` / `pnpm lint` / `pnpm test:run` / `pnpm build` all exit 0
- [ ] Only in-scope files modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Step 3 still shows two requests after the strings match. That would mean the
  mismatch is elsewhere — likely the `type="image/avif"` on the preload versus
  what the `<picture>` element negotiates, or a `srcset` difference. Report what
  the two request URLs were; do not start changing `srcset`.
- The `.astro` file cannot export a constant in your Astro version and creating
  `src/lib/image/sizes.ts` conflicts with an existing file of that name.
- Changing `640px` to `767px` visibly changes which image renders at any tested
  width in a way that looks *worse* (e.g. a blurry card at 700 px). That would
  mean `767px` is not in fact the right breakpoint — report the evidence.
- Any verification fails twice after a reasonable fix attempt.

## Maintenance notes

- **`sizes` and `imagesizes` must stay byte-identical.** That is the entire
  point of the shared constant. A reviewer should reject any change that
  reintroduces a literal in either location.
- If `.article-grid`'s breakpoints ever change (`md:grid-cols-6` /
  `3xl:grid-cols-8` in `ArticleGrid.astro:72`), this constant must change with
  them — the comment on the constant says so; keep it accurate.
- A reviewer should scrutinize: only the `featured` branch changed, and the
  `teaser` branch's `639px` was left alone.
- **Deliberately deferred**: the same class of preload/img `sizes` drift could
  exist on the product-detail page. Not audited here; worth a look if PDP LCP
  ever regresses.
