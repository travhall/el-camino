import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import icon from "astro-icon";
import netlify from "@astrojs/netlify";
import node from "@astrojs/node";
import path from "path";

// Check if we're in preview mode
const isPreview = process.env.PREVIEW === "true";

export default defineConfig({
  integrations: [
    icon({ iconDir: "src/assets/icons" }),
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
      "images.unsplash.com",
      "via.placeholder.com",
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
    envPrefix: ["PUBLIC_", "SQUARE_", "NEXT_PUBLIC_"],
    define: {
      global: "globalThis",
      "import.meta.env.SQUARE_ACCESS_TOKEN": JSON.stringify(
        process.env.SQUARE_ACCESS_TOKEN
      ),
      "import.meta.env.PUBLIC_SQUARE_APP_ID": JSON.stringify(
        process.env.PUBLIC_SQUARE_APP_ID
      ),
      "import.meta.env.PUBLIC_SQUARE_LOCATION_ID": JSON.stringify(
        process.env.PUBLIC_SQUARE_LOCATION_ID
      ),
    },
    resolve: {
      alias: {
        "@": path.resolve("./src"),
        "~": path.resolve("."),
      },
    },
    build: {
      minify: true,
      cssMinify: true,
      rollupOptions: {
        output: {
          manualChunks(id) {
            // Desktop-only features
            if (id.includes('CartButton') || 
                id.includes('ProductCard') ||
                id.includes('@astrojs/view-transitions')) {
              return 'desktop-features';
            }
            
            // Mobile-only features
            if (id.includes('MobileProductFilters') ||
                id.includes('MobileProductCard')) {
              return 'mobile-features';
            }
            
            // Square SDK
            if (id.includes('square')) {
              return 'square';
            }
            
            // Core vendor code
            if (id.includes('node_modules')) {
              return 'vendor';
            }
          },
        },
      },
    },
    ssr: {
      noExternal: ["square"],
    },
  },
});
