// src/env.d.ts
/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface ImportMetaEnv {
  // Square
  readonly SQUARE_ACCESS_TOKEN: string;
  readonly PUBLIC_SQUARE_APP_ID: string;
  readonly PUBLIC_SQUARE_LOCATION_ID: string;
  readonly PUBLIC_SQUARE_ENVIRONMENT?: string; // "production" | "sandbox" — defaults to sandbox if unset
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Fix JSX IntrinsicElements error
declare global {
  namespace JSX {
    type Element = astroHTML.JSX.Element;
    type IntrinsicElements = astroHTML.JSX.IntrinsicElements;
  }

  namespace App {
    interface Locals {
      /**
       * Per-request memoization slot for getSiteContext(). Lets Layout,
       * Footer, and Nav share one parallel fetch of contact/social/hours
       * instead of doing 6+ serial blob reads per page render.
       *
       * Treat as opaque — read via `getSiteContext(Astro.locals)`.
       */
      siteContext?: import("@/lib/siteContext").SiteContext;
      siteContextPromise?: Promise<import("@/lib/siteContext").SiteContext>;
    }
  }
}

// Make this file a module so `declare global` augmentations above are
// applied as merges rather than dropped.
export {};
