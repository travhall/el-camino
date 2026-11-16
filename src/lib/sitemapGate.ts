// Decides whether astro.config.mjs should fetch the dynamic sitemap pages.
//
// astro.config.mjs is loaded by every Astro command and by Vitest (through
// getViteConfig), so anything it awaits at the top level runs for all of
// them. Only a build writes a sitemap. Without this gate every test run, type
// check and dev start called Square and WordPress and logged a failure.
//
// Imported from astro.config.mjs in a raw Node context, before Vite and the
// `@/` alias exist: keep this file free of imports.

type Env = Record<string, string | undefined>;

/** True only for `astro build`. */
export function shouldFetchSitemapPages(
  argv: readonly string[],
  env: Env
): boolean {
  if (env.VITEST) return false;
  return argv.includes('build');
}

/**
 * True when a failed fetch should fail the build instead of shipping an empty
 * sitemap. That is the case for a production deploy on Netlify: an empty
 * sitemap there is silent and stays live until the next deploy, while a failed
 * deploy is loud and leaves the previous one serving.
 *
 * SITEMAP_ALLOW_EMPTY=true is the way out when Square or WordPress is down
 * and a deploy has to go out anyway.
 */
export function sitemapFailureIsFatal(env: Env): boolean {
  if (env.SITEMAP_ALLOW_EMPTY === 'true') return false;
  return env.CONTEXT === 'production';
}
