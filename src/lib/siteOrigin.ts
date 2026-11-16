// src/lib/siteOrigin.ts
//
// The one place the shop's public origin is spelled. It has no imports and
// reads no environment, because astro.config.mjs and sitemapPages.ts load it in
// a raw Node context before Vite exists. Everything else should read
// `siteConfig.url` (which is this value). The www host is canonical: the bare
// domain answers 301 to it.
export const SITE_ORIGIN = 'https://www.elcaminoskateshop.com';
