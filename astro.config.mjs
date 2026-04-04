import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import icon from "astro-icon";
import sitemap from "@astrojs/sitemap";
import netlify from "@astrojs/netlify";
import node from "@astrojs/node";
import path from "path";

// Check if we're in preview mode
const isPreview = process.env.PREVIEW === "true";

export default defineConfig({
  site: "https://elcaminoskateshop.com",
  integrations: [
    icon({ iconDir: "src/assets/icons" }),
    sitemap(),
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
      sourcemap: true,
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
  },
});
