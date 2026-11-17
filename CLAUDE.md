# CLAUDE.md

Orientation for coding agents working in this repo. Keep this file in sync
with reality — if a fact here turns out to be wrong, fix this file in the
same change that fixes the discrepancy.

## Stack

Astro 7 (SSR, `output: "server"`) + TypeScript, deployed to Netlify
(`@astrojs/netlify` adapter, Netlify Blobs for caching/admin config).
Square SDK for catalog/inventory/checkout, Resend for email, WordPress
(headless) for blog/news content. Tailwind CSS v4.

## Commands

- `pnpm dev` — local dev server
- `pnpm check` — typecheck gate (`astro check`) — run this, not `tsc`, before
  considering a change done
- `pnpm test:run` — unit tests (vitest)
- `pnpm test:coverage` — unit tests with coverage; global and per-file
  thresholds are enforced repo-wide in `vitest.config.ts` — see the comment
  block above its `thresholds` key for the current numbers and why they're
  baselined below 80%, and update that comment (not this file) when the
  numbers change
- `pnpm test:e2e` — Playwright e2e tests (separate from vitest)
- `pnpm test:e2e:stub` — Playwright specs (`e2e/*.stub.spec.ts`) that run the
  real PDP/QuickView against a stubbed Square catalog (`e2e/fixtures/`,
  `playwright.stub.config.ts`); no credentials needed, runs in CI after the
  e2e gate. The default config ignores these specs
- `pnpm build` — production build (`astro check && astro build`)
- `pnpm lint` — ESLint (flat config in `eslint.config.mjs`, covers
  `.ts`/`.tsx`/`.astro`)
- `pnpm format` / `pnpm format:check` — Prettier

## Key directories

- `src/lib/square/` — catalog, inventory, pricing, Square API client
- `src/lib/cart/` — cart state
- `src/lib/product/` — PDP controller/UI logic (`pdpController.ts`, `pdpUI.ts`)
- `src/lib/wordpress/` — headless WordPress content integration (blog/news)
- `src/lib/cache/` — Netlify Blobs cache layer (`blobCache.ts`)
- `src/lib/admin/` — admin auth helpers (HMAC session tokens, CSRF checks)
- `src/lib/email/` — Resend email sending
- `src/pages/api/` — route handlers
- `src/pages/admin/` — admin UI (protected by `src/middleware.ts`)

## Deployment and vocabulary

- Staging is `elcaminoskateshop.netlify.app`; production is
  `www.elcaminoskateshop.com`. They are separate Netlify sites with separate
  environment variables, Blobs data and Square webhooks. Production currently
  builds from a fork (`ElCaminoBoardShop/el-camino`) synced by hand; see
  `docs/adr/0001-one-repo-client-owned-production.md` and plan 211.
- `GLOSSARY.md` defines Item, Product and Variation. Use those words.
- `plans/README.md` indexes every plan; open plans are in `plans/`, finished
  ones in `plans/archive/`.

## Gotchas

- `square-legacy` in `package.json` is an npm alias pointing at
  `npm:square@^44.1.0` — the *current* SDK version, not an old one. The name
  is a historical holdover from an earlier migration. All Square imports use
  `from "square-legacy"`.
- Admin routes (`/admin/*`) are protected by `src/middleware.ts`, which
  verifies an HMAC session cookie via `src/lib/admin/auth.ts`. Login is at
  `src/pages/api/admin-auth.ts`.
- `docs/` is gitignored except `docs/adr/` (architecture decision records,
  tracked). The ignored part contains many historical implementation-plan
  files — they are not a maintained index and may describe pre-implementation
  state. Verify against the actual code before trusting one, especially
  anything claiming a feature is "not yet built."
- Test coverage thresholds in `vitest.config.ts` will fail the build if a
  change drops coverage below the configured minimums — run
  `pnpm test:coverage` before considering a non-trivial change done.
- Product pages are CDN-cached (`s-maxage=300`, stale-while-revalidate, durable)
  and tagged `product-<itemId>`, `products` and `variation-<id>` per variation
  (`productCacheTags` in `src/lib/cache/cdnPurge.ts`; the quick-view API uses the
  same). The Square webhook (`src/pages/api/webhooks/square.ts`) clears the blob
  caches and then purges those tags with `purgeProductPages`, so stock and
  catalog edits show up without waiting out the TTL. `purgeCache` only has
  credentials inside a deployed function: in dev and tests it fails and is
  logged, never thrown. Listing pages (`/shop/*`, sale, home) are not tagged and
  still expire on their TTL. The PDP also re-checks stock on load
  (`refreshInventory`) as a backstop.
- WordPress content routing: posts in the `shop-news` category appear on The
  Shop page (`/the-shop`); posts with only `news` appear on the News page.
  Posts tagged `event` are filterable on the News page. This is a WordPress
  category convention — there is no code gate enforcing it.
- `pnpm dev` runs `rm -rf .astro && sleep 1` before starting the dev server —
  this clears Astro's `.astro` cache directory and pauses briefly before
  Astro regenerates it. Both pieces were added incidentally in unrelated
  feature commits with no explanatory message, so the original motivating bug
  isn't recorded — treat it as a deliberate cache-freshness safeguard rather
  than dead cruft, but confirm with the maintainer before removing it.
- `@emnapi/core`, `@emnapi/runtime` and `@tybys/wasm-util` are pinned as
  devDependencies on purpose. `astro check` loads `@astrojs/astro2tsx`, a
  WebAssembly module that needs them resolvable from the project root. Without
  the `@tybys/wasm-util` pin the first Netlify build after the astro 7.4.12 bump
  died with `Cannot find package '@tybys/wasm-util'` (exit code 2) even though
  the same lockfile built fine locally and on GitHub Actions. Do not drop them
  as unused, and re-check them when `astro` or `@astrojs/check` is bumped.
- Netlify builds are limited, so `[build] ignore` runs `scripts/netlify-ignore.sh`
  (exit 0 skips; tested by `src/__tests__/netlifyIgnore.test.ts`): a **PR deploy
  preview or branch deploy builds only when the head commit's message contains
  `[preview]`**, and any deploy is skipped when only `plans/`, `docs/` or markdown
  changed since the last built commit. Production (the staging site's master)
  builds on any change that ships. It fails safe: a doubt always builds. Add
  `[preview]` to the commit message only when a real Netlify deploy is needed (CDN,
  Image CDN, Lighthouse); verify everything else locally (`pnpm build`, the
  Lighthouse-through-a-proxy method in `plans/README.md` row 220). `[skip netlify]`
  does not stop PR previews. Don't push throwaway commits to a PR branch.
- `.husky/pre-commit` checks only what is staged: Prettier on the staged files,
  ESLint (`--max-warnings 0`) on staged code, then, if any `.ts`/`.tsx`/`.astro`
  is staged, `pnpm check` (whole-project) and `vitest related --run` on those
  files. A docs-only commit runs only the format check. A change to
  `package.json`, the lockfile, `pnpm-workspace.yaml`, `vitest.config.ts`,
  `tsconfig.json`, `astro.config.mjs` or `eslint.config.mjs` runs the whole
  suite. `vitest related` is a heuristic and can miss a test that reaches a file
  only indirectly, so CI (which runs everything) is the real gate; do not read a
  passing hook as a passing suite.
