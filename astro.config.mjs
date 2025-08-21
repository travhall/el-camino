import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite"; // NEW: Tailwind v4 plugin
import icon from "astro-icon";
import netlify from "@astrojs/netlify";
import node from "@astrojs/node";
import AstroPWA from "@vite-pwa/astro";
import path from "path";

// Check if we're in preview mode
const isPreview = process.env.PREVIEW === "true";

export default defineConfig({
  integrations: [
    icon({ iconDir: "src/assets/icons" }),
    AstroPWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'El Camino Skate Shop',
        short_name: 'El Camino',
        description: 'Premium skateboarding gear and accessories',
        theme_color: '#1a1a1a',
        background_color: '#ffffff',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/pwa-192x192.svg',
            sizes: '192x192',
            type: 'image/svg+xml'
          },
          {
            src: '/pwa-512x512.svg',
            sizes: '512x512',
            type: 'image/svg+xml'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{css,js,html,svg,png,ico,txt}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.squarecdn\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'square-images',
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
              },
              cacheKeyWillBeUsed: async ({ request }) => {
                // Add format optimization to cache key
                const url = new URL(request.url);
                url.searchParams.set('f', 'auto');
                return url.toString();
              }
            }
          },
          {
            urlPattern: /\.(css|js|woff2?)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'static-assets',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
              }
            }
          },
          {
            urlPattern: /\/products\/.*/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'product-pages',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 5 * 60, // 5 minutes
              },
              networkTimeoutSeconds: 3,
              plugins: [{
                cacheKeyWillBeUsed: async ({ request }) => {
                  // Remove cache-busting params for consistent caching
                  const url = new URL(request.url);
                  url.searchParams.delete('_');
                  return url.toString();
                }
              }]
            }
          },
          {
            urlPattern: /\/(cart|checkout|api)\/.*/,
            handler: 'NetworkOnly'
          }
        ],
        navigationFallback: '/offline',
        navigationFallbackDenylist: [/\/(cart|checkout|api)\/.*/]
      }
    })
  ],
  output: "server",
  adapter: isPreview
    ? node({
        mode: "standalone",
      })
    : netlify({
        builders: true,
        functionPerRoute: true,
        binaryMediaTypes: ["image/*", "font/*", "application/pdf"],
      }),

  // ENHANCED: Prefetch configuration for navigation performance
  prefetch: {
    prefetchAll: false, // Selective prefetching for performance
    defaultStrategy: "hover", // Balance performance with resource usage
  },

  experimental: {
    clientPrerender: true, // Enable Speculation Rules API support (already enabled)
  },

  image: {
    service: {
      entrypoint: "astro/assets/services/squoosh",
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
          manualChunks: {
            square: ["square"],
          },
        },
      },
    },
    ssr: {
      noExternal: ["square"],
    },
  },
});
