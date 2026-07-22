import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import icon from "astro-icon";
import sitemap from "@astrojs/sitemap";
import netlify from "@astrojs/netlify";
import node from "@astrojs/node";
import path from "path";
import { buildSitemapPages } from "./src/lib/sitemapPages.ts";

// Check if we're in preview mode
const isPreview = process.env.PREVIEW === "true";

// Falls back to [] if Square/WordPress are unreachable (e.g. during `astro check`).
// Production builds with valid SQUARE_ACCESS_TOKEN get the full page list.
const sitemapPages = await buildSitemapPages().catch((err) => {
  console.warn("[sitemap] buildSitemapPages failed, using empty list:", err?.message ?? err);
  return [];
});

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

  // ENHANCED: Prefetch configuration for navigation performance
  prefetch: {
    prefetchAll: false, // Selective prefetching for performance
    defaultStrategy: "viewport", // Prefetch when visible in viewport - better for mobile
  },

  devToolbar: {
    enabled: false,
  },

  experimental: {
    clientPrerender: true, // Enable Speculation Rules API support (already enabled)
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
    // Without this, Vite triggers two mid-load reloads on every fresh local
    // dev session: one when it finds the Astro transitions virtual modules,
    // and a second when it finds web-vitals.
    optimizeDeps: {
      include: [
        "astro/virtual-modules/transitions-router.js",
        "astro/virtual-modules/transitions-types.js",
        "astro/virtual-modules/transitions-events.js",
        "astro/virtual-modules/transitions-swap-functions.js",
        "web-vitals",
      ],
    },
  },
});
