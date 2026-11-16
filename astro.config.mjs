import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import icon from "astro-icon";
import sitemap from "@astrojs/sitemap";
import netlify from "@astrojs/netlify";
import node from "@astrojs/node";
import path from "path";
import { buildSitemapPages } from "./src/lib/sitemapPages.ts";
import { shouldFetchSitemapPages, sitemapFailureIsFatal } from "./src/lib/sitemapGate.ts";

// Check if we're in preview mode
const isPreview = process.env.PREVIEW === "true";

// Only a build writes a sitemap, so only a build fetches its pages: this file
// is also loaded by `astro check`, `astro dev` and Vitest. See sitemapGate.ts.
// A failed fetch falls back to [] except on a Netlify production deploy, where
// it fails the build rather than publish an empty sitemap.
const sitemapPages = shouldFetchSitemapPages(process.argv, process.env)
  ? await buildSitemapPages().catch((err) => {
      if (sitemapFailureIsFatal(process.env)) {
        throw new Error(
          `[sitemap] could not build the page list for a production deploy: ${err?.message ?? err}. ` +
            "Set SITEMAP_ALLOW_EMPTY=true to deploy without it.",
          { cause: err },
        );
      }
      console.warn("[sitemap] buildSitemapPages failed, using empty list:", err?.message ?? err);
      return [];
    })
  : [];

export default defineConfig({
  site: "https://elcaminoskateshop.com",
  integrations: [
    icon({ iconDir: "src/assets/icons" }),
    sitemap({
      customPages: sitemapPages,
      filter: (page) => !page.includes("/admin") && !page.includes("/api/"),
    }),
  ],
  output: "server",
  adapter: isPreview
    ? node({
        mode: "standalone",
      })
    : netlify({
        builders: true,
        // REMOVED: functionPerRoute: true
        // This caused memory isolation - each route had separate cache
        // Now using single function + Netlify Blobs for shared cache
        binaryMediaTypes: ["image/*", "font/*", "application/pdf"],
      }),

  // Prefetch on hover/focus intent rather than viewport visibility — the
  // site's nav links are always in the viewport on initial load, so
  // "viewport" strategy was firing full-page SSR prefetches immediately on
  // page open, competing with critical-path resources for bandwidth.
  prefetch: {
    prefetchAll: false, // Selective prefetching for performance
    defaultStrategy: "hover",
  },

  devToolbar: {
    enabled: false,
  },

  image: {
    service: { 
      entrypoint: "astro/assets/services/sharp",
      config: {
        limitInputPixels: false,  // Prevent Sharp memory issues
      }
    },
    domains: [
      "elcaminoskateshop.wordpress.com",
      "api.elcaminoskateshop.com",
    ],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.gravatar.com",
      },
      {
        protocol: "https",
        hostname: "**.wp.com",
      },
      {
        protocol: "https",
        hostname: "**.squarecdn.com",
      },
      {
        protocol: "https",
        hostname: "**.s3.us-west-2.amazonaws.com",
      },
    ],
    formats: ["avif", "webp", "jpeg"],
    quality: 85,
  },
  server: {
    compress: true,
  },
  vite: {
    plugins: [tailwindcss()], // NEW: Add Tailwind v4 plugin here
    envPrefix: ["PUBLIC_"],
    define: {
      global: "globalThis",
    },
    resolve: {
      alias: {
        "@": path.resolve("./src"),
        "~": path.resolve("."),
      },
    },
    build: {
      sourcemap: process.env.NODE_ENV !== "production",
      minify: true,
      cssMinify: true,
      // 0 disables Vite's "inline small chunks as base64/inline" optimization.
      // Astro's script-hoisting plugin uses this same limit to decide whether
      // a self-contained <script> chunk gets inlined into the page HTML
      // instead of hoisted to an external file (see
      // astro/dist/core/build/plugins/plugin-scripts.js -> shouldInlineAsset).
      // Inlined scripts have no nonce and get blocked by our nonce-based CSP
      // (src/middleware.ts), so this must stay 0.
      assetsInlineLimit: 0,
      rollupOptions: {
        output: {
          // REMOVED manualChunks: Let Vite optimally split chunks
          // to fix massive 369KB ClientRouter script issue.
        },
      },
    },
    // "square" intentionally omitted from noExternal — it's a CJS package and
    // must be kept external so Node loads it natively. Bundling it as ESM
    // (via noExternal) causes "exports is not defined" at runtime.

    // Pre-declare deps that Vite discovers lazily during the first page load.
    // Without this, Vite triggers a mid-load reload on every fresh local
    // dev session when it finds the Astro transitions virtual modules.
    optimizeDeps: {
      include: [
        "astro/virtual-modules/transitions-router.js",
        "astro/virtual-modules/transitions-types.js",
        "astro/virtual-modules/transitions-events.js",
        "astro/virtual-modules/transitions-swap-functions.js",
      ],
    },
  },
});
